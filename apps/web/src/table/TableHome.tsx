import { Link } from 'react-router-dom';
import { useAsync } from '../factions/useAsync';
import { useStorage } from '../storage/StorageContext';
import { Menu } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { relativeTime } from '../ui/relativeTime';
import { useToast } from '../ui/toast';
import { deriveState } from './game';
import { gameStatus, scoreLine } from './gameRow';
import { getMissions, missionById } from './missionData';
import { deleteTableGame, useTableGames } from './tableStore';

/** The table companion's start page: saved games, newest first, and a way to start a new one. */
export function TableHome() {
  const { games, loading } = useTableGames();
  const missions = useAsync(getMissions, 'missions');
  const { repo } = useStorage();
  const { show } = useToast();
  const remove = async (id: string) => {
    const restore = await deleteTableGame(repo, id);
    show({ message: 'Game deleted', action: { label: 'Undo', onAction: () => void restore() } });
  };
  return (
    <section className="table-home">
      <PageHeader
        variant="top"
        title="Table companion"
        subtitle="Run a real game from one phone: phases, CP, VP, the mission and stratagems."
        actions={<Link className="btn btn--primary" to="/table/new">New game</Link>}
      />
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
            const missionName = missionById(missions.data, setup.missionId)?.name ?? setup.missionId;
            const s = pack ? deriveState(g.data, pack) : null;
            const totals = s?.players ?? { A: { total: 0 }, B: { total: 0 } };
            return (
              <li key={g.id} className="game-row">
                <Link className="game-row__main" to={`/table/${g.id}`}>
                  <strong className="game-row__title">{missionName}</strong>
                  <span className="game-row__score">{scoreLine(setup, totals)}</span>
                  <span className="muted game-row__meta">{[gameStatus(s), relativeTime(g.updatedAt)].filter(Boolean).join(' · ')}</span>
                </Link>
                <Menu
                  label={`Actions for ${missionName}`}
                  items={[
                    { label: s?.ended ? 'View' : 'Resume', to: `/table/${g.id}` },
                    { label: 'Delete', danger: true, onSelect: () => void remove(g.id) },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
