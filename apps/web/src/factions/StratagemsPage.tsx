import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LoadError } from '../layout/OfflineNotice';
import { ReportButton } from '../rules/ReportButton';
import '../rules/rules.css';
import { useWording, WordingToggle } from '../rules/wording';
import { PageHeader } from '../ui/PageHeader';
import { getCatalogue } from './dataClient';
import { factionLabel } from './factionSearch';
import { FACTIONS_BACK, FactionTabs } from './FactionTabs';
import { factionDisplayName } from './names';
import { sortPhases } from './phases';
import { StratagemCard, stratagemParts } from './StratagemCard';
import { useAsync } from './useAsync';

const ALL = 'All phases';

export function StratagemsPage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => getCatalogue(slug), slug);
  const { wording } = useWording();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState(ALL);
  if (state.status === 'loading') return <p className="muted">Loading stratagems…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="this faction" />;

  const cat = state.data;
  const name = factionDisplayName(cat.name);
  const q = query.trim().toLowerCase();
  const phases = sortPhases([...new Set(cat.stratagems.flatMap((s) => s.phases))]);
  const shown = cat.stratagems
    .filter((s) => phase === ALL || s.phases.includes(phase))
    .filter((s) => !q || [s.name, s.text, s.plain ?? ''].some((t) => t.toLowerCase().includes(q)));
  // The faction's own stratagems first, then sub-factions, detachments and armies of renown A–Z.
  const groups = [...new Set(shown.map((s) => s.group))].sort((a, b) => Number(b === name) - Number(a === name) || a.localeCompare(b));

  return (
    <section>
      <PageHeader title={factionLabel(cat).name} back={FACTIONS_BACK} />
      <FactionTabs slug={cat.slug} library={cat.library} />
      <WordingToggle />
      <input
        className="input"
        type="search"
        aria-label="Search stratagems"
        placeholder="Search stratagems"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="rules-chips" role="group" aria-label="Phase">
        {[ALL, ...phases].map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={phase === p} onClick={() => setPhase(p)}>
            {p}
          </button>
        ))}
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h2>{g}</h2>
          <div className="stratagem-list">
            {shown.filter((s) => s.group === g).map((s) => (
              <StratagemCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      ))}
      {shown.length === 0 && <p className="muted">{cat.stratagems.length ? 'No stratagems match.' : 'This faction has no stratagems of its own.'}</p>}
      <ReportButton target={{ kind: 'stratagem', name: `${name} stratagems` }} text={`${name} stratagems`} parts={stratagemParts(shown, wording)} />
    </section>
  );
}
