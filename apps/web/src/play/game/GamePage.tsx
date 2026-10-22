/** The game screen: the top bar, the battlefield, and the panel for whatever the game is waiting for. */
import type { PlayerId, Problem, Pt } from '@recruit/engine';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DISCLAIMER } from '../../layout/Footer';
import { useStorage } from '../../storage/StorageContext';
import { BoardCanvas, type RendererFactory } from '../board/BoardCanvas';
import { buildScene, type Ring } from '../board/scene';
import { PhasePanel } from '../panels/PhasePanel';
import { Problems } from '../panels/Problems';
import type { PanelProps, ReadySandbox, TapHandler } from '../panels/types';
import { hintFor } from './hints';
import { armyName } from './names';
import { GameLog, GameMenu, HandOver } from './Overlays';
import { TopBar } from './TopBar';
import { planReducer } from './plan';
import { useSandbox } from './useSandbox';

export function GamePage({ renderer }: { renderer?: RendererFactory }) {
  const { id = '' } = useParams();
  const sb = useSandbox(id);
  const { repo } = useStorage();
  const navigate = useNavigate();
  if (sb.status === 'loading') return <p className="muted">Loading the game…</p>;
  if (sb.status === 'missing')
    return (
      <section>
        <p>This game no longer exists.</p>
        <Link to="/play" className="btn">
          Back to games
        </Link>
      </section>
    );
  if (sb.status === 'unreadable')
    return (
      <section>
        <h1>This game can't be opened</h1>
        <p>{sb.message}</p>
        <button type="button" className="btn btn--danger" onClick={() => void repo.deleteDoc(id).then(() => navigate('/play'))}>
          Delete this game
        </button>{' '}
        <Link to="/play" className="btn">
          Back to games
        </Link>
      </section>
    );
  return <GameScreen sb={sb} renderer={renderer} />;
}

function GameScreen({ sb, renderer }: { sb: ReadySandbox; renderer?: RendererFactory }) {
  const { state, step, doc } = sb;
  const meta = doc.data.meta;
  const [selectedUnitId, select] = useState<string | null>(null);
  const [plan, planDispatch] = useReducer(planReducer, null);
  const [rings, setRings] = useState<Ring[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [overlay, setOverlay] = useState<'log' | 'menu' | null>(null);
  const [handOver, setHandOver] = useState<PlayerId | null>(null);
  const [tall, setTall] = useState(false);
  const tapRef = useRef<TapHandler | null>(null);
  const dragRef = useRef<((modelId: string) => boolean) | null>(null);
  const offset = useRef<Pt>({ x: 0, y: 0 });

  // A new phase or step starts with a clean board.
  const where = `${state.round}|${state.turn}|${state.phase}|${state.step}`;
  useEffect(() => {
    select(null);
    planDispatch({ type: 'clear' });
    setRings([]);
    setTargets([]);
    setInvalid([]);
    setProblems([]);
  }, [where]);

  // Pass-and-play: when someone else must act, hand the device over (not when the game is opened).
  const acting = step.actingPlayer;
  const lastActing = useRef(acting);
  useEffect(() => {
    if (lastActing.current !== acting && meta.handOver && !state.ended) setHandOver(acting);
    lastActing.current = acting;
  }, [acting, meta.handOver, state.ended]);

  const ui: PanelProps['ui'] = useMemo(
    () => ({
      selectedUnitId,
      select,
      plan,
      planDispatch,
      dragging,
      setRings,
      setTargets,
      setInvalid,
      setTapHandler: (fn) => (tapRef.current = fn),
      setDraggable: (fn) => (dragRef.current = fn),
      problems,
      setProblems,
    }),
    [selectedUnitId, plan, dragging, problems],
  );

  const scene = useMemo(
    () => buildScene(state, { selectedUnitId, plan, invalidModelIds: invalid, rings, targetUnitIds: targets }),
    [state, selectedUnitId, plan, invalid, rings, targets],
  );

  const onTap = useCallback(
    (at: Pt, modelId: string | null) => {
      if (tapRef.current) return tapRef.current(at, modelId);
      select(modelId ? state.models[modelId].unitId : null);
    },
    [state],
  );
  const canDrag = useCallback((modelId: string) => (dragRef.current ? dragRef.current(modelId) : !!plan?.positions[modelId]), [plan]);
  const onDrag = useCallback(
    (modelId: string, at: Pt, phase: 'start' | 'move' | 'end' | 'cancel') => {
      const pos = plan?.positions[modelId];
      if (phase === 'start') {
        if (pos) offset.current = { x: pos.x - at.x, y: pos.y - at.y };
        setDragging(true);
        return;
      }
      if (phase === 'cancel') return setDragging(false);
      planDispatch({ type: 'drag', modelId, to: { x: at.x + offset.current.x, y: at.y + offset.current.y } });
      if (phase === 'end') setDragging(false);
    },
    [plan],
  );

  const undo = () => {
    const p = sb.undo();
    setProblems(p ?? []);
    if (!p) planDispatch({ type: 'clear' });
  };
  const hint = meta.hints ? hintFor(state, step, selectedUnitId) : null;
  const armies = (['A', 'B'] as PlayerId[]).map((p) => ({ player: p, name: armyName(state, p) }));

  return (
    <div className={`game${tall ? ' game--tall' : ''}`}>
      <TopBar state={state} onUndo={undo} onLog={() => setOverlay('log')} onMenu={() => setOverlay('menu')} />
      <div className="game__board">
        <BoardCanvas
          scene={scene}
          canDrag={canDrag}
          onTap={onTap}
          onDrag={onDrag}
          renderer={renderer}
          label={`Battlefield, ${state.setup.board.w} by ${state.setup.board.h} inches`}
        />
      </div>
      <div className="game__panel">
        <button type="button" className="game__handle" aria-expanded={tall} onClick={() => setTall((t) => !t)}>
          {tall ? 'Show less' : 'Show more'}
        </button>
        {hint && (
          <p role="note" aria-label="Hint" className="game__hint">
            {hint}
          </p>
        )}
        <Problems problems={problems} />
        <PhasePanel sb={sb} ui={ui} />
        <p className="game__disclaimer muted">{DISCLAIMER}</p>
      </div>
      {overlay === 'log' && <GameLog lines={sb.log} onClose={() => setOverlay(null)} />}
      {overlay === 'menu' && (
        <GameMenu
          hints={meta.hints}
          handOver={meta.handOver}
          setHints={(v) => sb.setMeta({ hints: v })}
          setHandOver={(v) => sb.setMeta({ handOver: v })}
          armies={armies}
          ended={!!state.ended}
          onConcede={(p) => {
            setProblems(sb.act({ type: 'concede', by: p }) ?? []);
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      )}
      {handOver && <HandOver name={armyName(state, handOver)} onDone={() => setHandOver(null)} />}
    </div>
  );
}
