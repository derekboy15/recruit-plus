import { Link } from 'react-router-dom';
import { getCoreStratagems } from '../factions/dataClient';
import { StratagemCard } from '../factions/StratagemCard';
import { useAsync } from '../factions/useAsync';
import { useScrollToHash } from './RulesArticlePage';
import { WordingToggle } from './wording';
import { LoadError } from '../layout/OfflineNotice';

export function CoreStratagemsPage() {
  const state = useAsync(getCoreStratagems, 'core-stratagems');
  useScrollToHash(state.status === 'ready');
  if (state.status === 'loading') return <p className="muted">Loading stratagems…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="the stratagems" />;
  const groups = [...new Set(state.data.map((s) => s.group))];
  return (
    <section>
      <p>
        <Link to="/rules">← Rules</Link>
      </p>
      <h1>Core stratagems</h1>
      <p className="muted">
        Every army can use these. <Link to="/rules/core-stratagems">How stratagems work</Link> explains CP and timing.
      </p>
      <WordingToggle />
      {groups.map((g) => (
        <section key={g}>
          <h2>{g}</h2>
          <div className="stack">
            {state.data.filter((s) => s.group === g).map((s) => (
              <StratagemCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
