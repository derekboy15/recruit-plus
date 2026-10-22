import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../factions/useAsync';
import { rollDice } from './dice';
import { deriveState } from './game';
import { getMissions, missionById } from './missionData';
import { Scoreboard } from './Scoreboard';
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
  const [tab, setTab] = useState<Tab>('Turn');
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
        <p>This game is over. <Link to={`/table/${id}/summary`}>See the summary</Link></p>
      ) : (
        tab === 'Turn' && state.pos && (
          <TurnPanel data={game.data} pack={pack} mission={mission} state={state} append={append} update={update} roll={roll} onEnded={toSummary} />
        )
      )}
      {tab !== 'Turn' && <p className="muted">Coming soon.</p>}
    </section>
  );
}
