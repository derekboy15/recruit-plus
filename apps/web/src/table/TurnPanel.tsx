import { useEffect, useId, useRef, useState } from 'react';
import type { MissionOut, PackOut } from '@recruit/data/missions';
import { prompts } from './checklist';
import { CpPrompt } from './CpPrompt';
import { cpDecisionsNeeded, dueScoring, type ScoreItem } from './flow';
import { LAST_ROUND, makeEvent, nextPos, undo, type EventBody, type Pos, type TableEvent, type TableGameData, type TableState } from './game';
import { MissionMap } from './MissionMap';
import { MissionRules } from './MissionRules';
import { ScorePrompt } from './ScorePrompt';

/** The current phase: the mission, the checklist, Command phase CP, scoring prompts, and Next phase / End turn / Undo. */
export function TurnPanel({ data, pack, mission, state, append, update, roll, onEnded }: {
  data: TableGameData; pack: PackOut; mission: MissionOut; state: TableState;
  append: (events: TableEvent[]) => Promise<void>; update: (change: (d: TableGameData) => TableGameData) => Promise<void>;
  roll: (sides: 3 | 6) => number; onEnded: () => void;
}) {
  const pos = state.pos as Pos;
  const { setup } = data;
  const [queue, setQueue] = useState<ScoreItem[]>([]);
  const [then, setThen] = useState<(() => Promise<void>) | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const active = state.active!;
  const cpNeeded = cpDecisionsNeeded(data, mission, pos);
  // Each tap's events are worked out from the phase on screen, so a tap must not run until the previous tap's change
  // has been saved and drawn: otherwise it acts on the phase it already left (a lost or doubled advance).
  const wrote = useRef(false);
  const write = (bodies: EventBody[]) => {
    wrote.current = true;
    return append(bodies.map((b) => makeEvent(b, pos)));
  };
  const saveChange = (change: (d: TableGameData) => TableGameData) => {
    wrote.current = true;
    return update(change);
  };

  const proceed = async (items: ScoreItem[], after: () => Promise<void>) => {
    if (items.length) {
      setQueue(items);
      setThen(() => after);
    } else await after();
  };
  const advance = async () => {
    const to = nextPos(pos);
    setTicked({});
    if (to) await write([{ t: 'advance', to }]);
  };
  const finishGame = async () => {
    await write([{ t: 'end', reason: 'complete' }]);
    onEnded();
  };
  const blocked = cpNeeded.length > 0 || queue.length > 0;
  // While a question is open, Next phase / End turn stays tappable but only points at the question: it writes nothing.
  const promptRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const onNext = () => {
    if (blocked) {
      promptRef.current?.querySelector('h2')?.focus();
      return;
    }
    void once(async () => {
      if (pos.phase === 'command') return proceed(dueScoring(mission, setup, pos, 'end-of-command-phase', data), advance);
      if (pos.phase !== 'morale') return advance();
      const last = pos.round === LAST_ROUND && pos.turn === 2;
      const items = [
        ...dueScoring(mission, setup, pos, 'end-of-turn', data),
        ...(pos.turn === 2 ? dueScoring(mission, setup, pos, 'end-of-round', data) : []),
        ...(last ? dueScoring(mission, setup, pos, 'end-of-battle', data) : []),
      ];
      return proceed(items, last ? finishGame : advance);
    });
  };
  // One change at a time. A tap that can change the phase (Next phase, End turn, Undo, the last score of a turn) keeps
  // the buttons disabled until newer game data arrives from the database (its change, saved and drawn), or at once if it
  // wrote nothing: its events are worked out from the phase on screen. A score that leaves more prompts to answer only
  // waits for its own save; the prompts come from the queue on screen, not from the saved game.
  const busy = useRef(false);
  const [waitingOn, setWaitingOn] = useState<TableGameData | null>(null);
  useEffect(() => {
    if (waitingOn && waitingOn !== data) setWaitingOn(null);
  }, [data, waitingOn]);
  const once = async (work: () => Promise<void>, lockUntilDrawn = true) => {
    if (busy.current || waitingOn) return;
    busy.current = true;
    wrote.current = false;
    if (lockUntilDrawn) setWaitingOn(data);
    try {
      await work();
      if (!wrote.current) setWaitingOn(null);
    } catch (e) {
      setWaitingOn(null);
      throw e;
    } finally {
      busy.current = false;
    }
  };
  const locked = waitingOn !== null;
  const actionItems = dueScoring(mission, setup, pos, 'on-action');
  const resolveScore = (vp: number, detail: string) =>
    once(async () => {
      const [item, ...rest] = queue;
      if (!item) return;
      setQueue(rest);
      await write([{ t: 'vp', player: item.player, category: item.category, sourceId: item.sourceId, vp, detail }]);
      if (!rest.length && then) {
        const after = then;
        setThen(null);
        await after();
      }
    }, queue.length <= 1);
  const onUndo = () =>
    once(async () => {
      setQueue([]);
      setThen(null);
      await saveChange(undo);
    });

  return (
    <div className="turn">
      <details className="card">
        <summary>Mission: {mission.name}</summary>
        <MissionMap map={mission.map} players={{ A: setup.players.A.name, B: setup.players.B.name }} />
        <MissionRules mission={mission} />
      </details>
      <div ref={promptRef} className="turn__prompt">
        {cpNeeded.length > 0 && (
          <CpPrompt
            key={`${pos.round}-${pos.turn}-${cpNeeded[0]}`}
            mission={mission} pos={pos} player={cpNeeded[0]} active={active} name={setup.players[cpNeeded[0]].name} roll={roll}
            onResolve={(events) => void write(events)}
          />
        )}
        {cpNeeded.length === 0 && queue.length > 0 && (
          <ScorePrompt
            key={`${queue[0].player}-${queue[0].component.id}-${queue.length}`}
            item={queue[0]} mission={mission} name={setup.players[queue[0].player].name} round={pos.round}
            onResolve={(vp, d) => void resolveScore(vp, d)}
          />
        )}
      </div>
      <ul className="checklist" aria-label="This phase">
        {prompts({ pack: pack.id, pos, mission }).map((p) => (
          <li key={p.id}>
            <label className="choices__option">
              <input type="checkbox" checked={!!ticked[p.id]} onChange={(e) => setTicked({ ...ticked, [p.id]: e.target.checked })} />
              <span>{p.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {actionItems.length > 0 && !blocked && (
        <button type="button" className="btn" onClick={() => void proceed(actionItems, async () => {})}>Score an action</button>
      )}
      <div className="wizard-actions">
        {blocked && <p id={hintId} className="turn__hint">Answer the question above first.</p>}
        <button type="button" className="btn" onClick={() => void onUndo()} disabled={locked || data.events.length <= 1}>Undo</button>
        <button type="button" className="btn btn--primary" onClick={onNext} disabled={locked} aria-describedby={blocked ? hintId : undefined}>
          {pos.phase === 'morale' ? 'End turn' : 'Next phase'}
        </button>
      </div>
    </div>
  );
}
