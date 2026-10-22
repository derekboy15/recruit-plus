import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PlayerKey } from '@recruit/data/missions';
import { useAsync } from '../factions/useAsync';
import { rollDice } from './dice';
import { deriveState, makeEvent, undo, type TableEvent, type TableSetup } from './game';
import { LogPanel } from './LogPanel';
import { getMissions, missionById } from './missionData';
import { Scoreboard } from './Scoreboard';
import { ScoreSheet } from './ScoreSheet';
import { StratagemPanel } from './StratagemPanel';
import { ToolsPanel } from './ToolsPanel';
import { useTableGame } from './tableStore';
import { TurnPanel } from './TurnPanel';

const TABS = ['Turn', 'Score', 'Stratagems', 'Tools', 'Log'] as const;
type Tab = (typeof TABS)[number];
const defaultRoll = (sides: 3 | 6) => rollDice(1, sides)[0];

/** One game at the table: the scoreboard, then the current phase and the other tabs. */
export function GamePage({ roll = defaultRoll }: { roll?: (sides: 3 | 6) => number }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { game, loading, append, update } = useTableGame(id);
  const missions = useAsync(getMissions, 'missions');
  const [params] = useSearchParams();
  const asked = params.get('tab');
  const [tab, setTab] = useState<Tab>(TABS.includes(asked as Tab) ? (asked as Tab) : 'Turn');
  if (loading || missions.status === 'loading') return <p className="muted">Loading the game…</p>;
  if (missions.status === 'error') return <p role="alert">Couldn’t load the missions: {missions.error.message}</p>;
  if (!game) return <p role="alert">This game doesn’t exist on this device. <Link to="/table">Back to games</Link></p>;
  const pack = missions.data.packs.find((p) => p.id === game.data.setup.pack);
  const mission = missionById(missions.data, game.data.setup.missionId);
  if (!pack || !mission) return <p role="alert">This game’s mission isn’t in the app’s data.</p>;
  const state = deriveState(game.data, pack);
  const toSummary = () => navigate(`/table/${id}/summary`);
  return (
    <section className="game">
      <Scoreboard setup={game.data.setup} state={state} />
      <div className="seg game__tabs" role="tablist" aria-label="Game">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" className="seg__btn" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {state.ended ? (
        <p>
          This game is over. <Link to={`/table/${id}/summary`}>See the summary</Link>{' '}
          <button type="button" className="btn btn--small" onClick={() => void update(undo)}>Undo the end</button>
        </p>
      ) : (
        tab === 'Turn' && state.pos && (
          <TurnPanel data={game.data} pack={pack} mission={mission} state={state} append={append} update={update} roll={roll} onEnded={toSummary} />
        )
      )}
      {tab === 'Score' && <ScoreSheet data={game.data} pack={pack} mission={mission} state={state} append={append} />}
      {tab === 'Log' && <LogPanel data={game.data} missions={missions.data} append={append} />}
      {tab === 'Stratagems' && !state.ended && <StratagemPanel data={game.data} state={state} append={append} />}
      {tab === 'Tools' && <ToolsPanel pos={state.pos} roll={roll} append={append} />}
      {!state.ended && <EndGame setup={game.data.setup} pos={state.pos} append={append} onEnded={toSummary} />}
    </section>
  );
}

/** End the game early or after round 5: finished, agreed to stop, or one player concedes. */
function EndGame({ setup, pos, append, onEnded }: { setup: TableSetup; pos: TableEvent['pos']; append: (e: TableEvent[]) => Promise<void>; onEnded: () => void }) {
  const [open, setOpen] = useState<'closed' | 'choose' | 'concede'>('closed');
  const end = async (reason: 'complete' | 'agreed' | 'concede', concededBy?: PlayerKey) => {
    await append([makeEvent({ t: 'end', reason, ...(concededBy ? { concededBy } : {}) }, pos)]);
    onEnded();
  };
  if (open === 'closed') return <button type="button" className="btn btn--danger" onClick={() => setOpen('choose')}>End the game</button>;
  return (
    <section className="card prompt" aria-label="End the game">
      <h2>End the game</h2>
      {open === 'choose' ? (
        <div className="prompt__actions prompt__actions--stack">
          <button type="button" className="btn" onClick={() => void end('complete')}>We've finished all 5 rounds</button>
          <button type="button" className="btn" onClick={() => void end('agreed')}>We agreed to stop early</button>
          <button type="button" className="btn" onClick={() => setOpen('concede')}>A player concedes</button>
          <button type="button" className="btn" onClick={() => setOpen('closed')}>Cancel</button>
        </div>
      ) : (
        <div className="prompt__actions prompt__actions--stack">
          {(['A', 'B'] as const).map((p) => (
            <button key={p} type="button" className="btn" onClick={() => void end('concede', p)}>{setup.players[p].name} concedes</button>
          ))}
          <button type="button" className="btn" onClick={() => setOpen('choose')}>Back</button>
        </div>
      )}
    </section>
  );
}
