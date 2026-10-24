import { Link } from 'react-router-dom';
import { getCoreStratagems } from '../factions/dataClient';
import { StratagemCard, stratagemParts } from '../factions/StratagemCard';
import { useAsync } from '../factions/useAsync';
import { LoadError } from '../layout/OfflineNotice';
import { PageHeader } from '../ui/PageHeader';
import { ReportButton } from './ReportButton';
import { useScrollToHash } from './RulesArticlePage';
import { useWording, WordingToggle } from './wording';

const BACK = { to: '/rules', label: 'Rules' };

export function CoreStratagemsPage() {
  const state = useAsync(getCoreStratagems, 'core-stratagems');
  const { wording } = useWording();
  useScrollToHash(state.status === 'ready');
  const header = <PageHeader title="Core stratagems" back={BACK} />;
  if (state.status === 'loading') return <section>{header}<p className="muted">Loading stratagems…</p></section>;
  if (state.status === 'error') return <section>{header}<LoadError error={state.error} what="the stratagems" /></section>;
  const groups = [...new Set(state.data.map((s) => s.group))];
  return (
    <section>
      {header}
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
      <ReportButton target={{ kind: 'stratagem', name: 'Core stratagems' }} text="Core stratagems" parts={stratagemParts(state.data, wording)} />
    </section>
  );
}
