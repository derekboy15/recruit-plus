import { Link } from 'react-router-dom';
import { useAsync } from '../factions/useAsync';
import { deriveState } from './game';
import { getMissions, missionById } from './missionData';
import { useTableGames } from './tableStore';

/** The table companion's start page: saved games, newest first, and a way to start a new one. */
export function TableHome() {
  const { games, loading } = useTableGames();
  const missions = useAsync(getMissions, 'missions');
  return (
    <section>
      <h1>Table companion</h1>
      <p className="muted">Run a real game from one phone: phases, CP, VP, the mission and stratagems.</p>
      <Link className="btn btn--primary" to="/table/new">New game</Link>
      {loading || missions.status === 'loading' ? (
        <p className="muted">Loading your games…</p>
      ) : missions.status === 'error' ? (
        <p role="alert">Couldn’t load the missions: {missions.error.message}</p>
      ) : games.length === 0 ? (
        <p className="muted">No games yet. Start one when you sit down to play.</p>
      ) : (
        <ul className="list" aria-label="Saved games">
          {games.map((g) => {
            const { setup } = g.data;
            const pack = missions.data.packs.find((p) => p.id === setup.pack);
            const mission = missionById(missions.data, setup.missionId);
            const s = pack ? deriveState(g.data, pack) : null;
            const status = !s ? '' : s.ended || !s.pos ? 'Finished' : `Round ${s.pos.round}`;
            return (
              <li key={g.id}>
                <Link className="list__link" to={`/table/${g.id}`}>
                  <strong>{mission?.name ?? setup.missionId}</strong>
                  <span className="muted"> · {status}</span>
                  <br />
                  <span>
                    {setup.players.A.name} {s?.players.A.total ?? 0} – {s?.players.B.total ?? 0} {setup.players.B.name}
                  </span>
                  <span className="badge">{s?.ended ? 'View' : 'Resume'}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
