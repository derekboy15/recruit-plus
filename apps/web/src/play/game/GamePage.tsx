/** The game screen: the top bar, the battlefield, and the panel for whatever the game is waiting for. */
import type { PlayerId } from '@recruit/engine';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DISCLAIMER } from '../../layout/Footer';
import { useStorage } from '../../storage/StorageContext';
import { PageHeader } from '../../ui/PageHeader';
import { AssistPanel } from '../assist/AssistPanel';
import { BoardCanvas, type RendererFactory } from '../board/BoardCanvas';
import { PhasePanel } from '../panels/PhasePanel';
import { Problems } from '../panels/Problems';
import type { ReadySandbox } from '../panels/types';
import { ActionSlotProvider } from './actionBar';
import { hintFor } from './hints';
import { armyName, boardNames } from './names';
import { MapKey } from './MapKey';
import { GameLog, GameMenu, HandOver } from './Overlays';
import { ScoreSheet } from './ScoreSheet';
import { TopBar } from './TopBar';
import { Toolkit } from '../toolkit/Toolkit';
import { useBoardUi } from './useBoardUi';
import { useSandbox } from './useSandbox';

const BACK = { to: '/play', label: 'Practice games' };

export function GamePage({ renderer }: { renderer?: RendererFactory }) {
  const { id = '' } = useParams();
  const sb = useSandbox(id);
  const { repo } = useStorage();
  const navigate = useNavigate();
  if (sb.status === 'loading') return <p className="muted">Loading the game…</p>;
  if (sb.status === 'missing')
    return (
      <section>
        <PageHeader title="Game not found" back={BACK} />
        <p>This game no longer exists.</p>
      </section>
    );
  if (sb.status === 'unreadable')
    return (
      <section>
        <PageHeader title="This game can’t be opened" back={BACK} />
        <p>{sb.message}</p>
        <button type="button" className="btn btn--danger" onClick={() => void repo.deleteDoc(id).then(() => navigate('/play'))}>
          Delete this game
        </button>
      </section>
    );
  return <GameScreen sb={sb} renderer={renderer} />;
}

function GameScreen({ sb, renderer }: { sb: ReadySandbox; renderer?: RendererFactory }) {
  const { state, step, doc } = sb;
  const meta = doc.data.meta;
  const { ui, scene, canDrag, onTap, onDrag } = useBoardUi(sb);
  const { selectedUnitId, planDispatch, problems, setProblems } = ui;
  const [overlay, setOverlay] = useState<'log' | 'menu' | 'score' | null>(null);
  const [handOver, setHandOver] = useState<PlayerId | null>(null);
  const [tall, setTall] = useState(false);
  const [toolkit, setToolkit] = useState(false);

  // Pass-and-play: when someone else must act, hand the device over (not when the game is opened).
  const acting = step.actingPlayer;
  const lastActing = useRef(acting);
  useEffect(() => {
    if (lastActing.current !== acting && meta.handOver && !state.ended) setHandOver(acting);
    lastActing.current = acting;
  }, [acting, meta.handOver, state.ended]);

  const undo = () => {
    const p = sb.undo();
    setProblems(p ?? []);
    if (!p) planDispatch({ type: 'clear' });
  };
  const hint = meta.hints ? hintFor(state, step, selectedUnitId) : null;
  const armies = (['A', 'B'] as PlayerId[]).map((p) => ({ player: p, name: armyName(state, p) }));
  const names = boardNames(state);

  return (
    <div className={`game game--fit${tall ? ' game--tall' : ''}`}>
      <TopBar state={state} onUndo={undo} onLog={() => setOverlay('log')} onMenu={() => setOverlay('menu')} onScore={() => setOverlay('score')} />
      {/* Sized to the map's shape on a phone, so the board has no black bands (play.css). */}
      <div className="game__board game__board--fit" style={{ '--board-w': state.setup.board.w, '--board-h': state.setup.board.h } as CSSProperties}>
        <BoardCanvas
          scene={scene}
          canDrag={canDrag}
          onTap={onTap}
          onDrag={onDrag}
          renderer={renderer}
          label={`Battlefield, ${state.setup.board.w} by ${state.setup.board.h} inches`}
          names={names}
        />
        <MapKey scene={scene} names={names} />
      </div>
      <div className="game__panel">
        <ActionSlotProvider>
          {/* Grows to fill the panel, so the Actions bar after it sits at the bottom even when there is little to show. */}
          <div className="game__panel-body">
            <button type="button" className="game__handle" aria-expanded={tall} onClick={() => setTall((t) => !t)}>
              {tall ? 'Bigger board' : 'Bigger panel'}
            </button>
            {hint && (
              <p role="note" aria-label="Hint" className="game__hint">
                {hint}
              </p>
            )}
            <Problems problems={problems} />
            {toolkit ? (
              <Toolkit sb={sb} ui={ui} onClose={() => setToolkit(false)} />
            ) : (
              <>
                {selectedUnitId && !state.ended && state.phase !== 'pre-battle' && (
                  <button type="button" className="btn btn--small game__adjust" onClick={() => setToolkit(true)}>
                    Adjust {state.units[selectedUnitId]?.name}…
                  </button>
                )}
                <PhasePanel sb={sb} ui={ui} />
                {!state.ended && <AssistPanel sb={sb} ui={ui} />}
              </>
            )}
            <p className="game__disclaimer muted">{DISCLAIMER}</p>
          </div>
        </ActionSlotProvider>
      </div>
      {overlay === 'log' && <GameLog lines={sb.log} onClose={() => setOverlay(null)} />}
      {overlay === 'score' && <ScoreSheet state={state} act={sb.act} onClose={() => setOverlay(null)} />}
      {overlay === 'menu' && (
        <GameMenu
          hints={meta.hints}
          handOver={meta.handOver}
          setHints={(v) => sb.setMeta({ hints: v })}
          setHandOver={(v) => sb.setMeta({ handOver: v })}
          armies={armies}
          ended={!!state.ended}
          onToolkit={() => {
            setToolkit(true);
            setOverlay(null);
          }}
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
