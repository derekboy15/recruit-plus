import { BATTLE_SIZES } from '@recruit/data/roster';
import { Link } from 'react-router-dom';
import { useLists } from './listStore';

export function ListsPage() {
  const { lists, loading } = useLists();
  return (
    <section>
      <h1>Your lists</h1>
      <Link to="/build/new" className="btn btn--primary" style={{ marginBottom: '1rem' }}>
        New list
      </Link>
      {loading && <p className="muted">Loading your lists…</p>}
      {!loading && lists.length === 0 && <p className="muted">No lists yet. Build your first army: it takes a couple of minutes.</p>}
      <ul className="list">
        {lists.map((l) => {
          const { summary } = l.data;
          const problems = summary.issueCount;
          return (
            <li key={l.id}>
              <Link to={`/build/${l.id}`} className="list__link list__link--card">
                <span className="list__main">
                  <strong>{l.data.roster.name}</strong>
                  <span className="muted">
                    {summary.faction} · {BATTLE_SIZES[summary.battleSize]?.name ?? summary.battleSize}
                  </span>
                </span>
                <span className="list__side">
                  <span>{`${summary.points} / ${summary.pointsLimit} pts`}</span>
                  {problems > 0 ? (
                    <span className="status status--bad">{problems === 1 ? '1 problem' : `${problems} problems`}</span>
                  ) : (
                    <span className="status status--ok">Legal</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
