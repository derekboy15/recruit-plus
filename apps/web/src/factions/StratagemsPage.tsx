import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WordingToggle } from '../rules/wording';
import { getCatalogue } from './dataClient';
import { FactionTabs } from './FactionTabs';
import { factionDisplayName } from './names';
import { StratagemCard } from './StratagemCard';
import { useAsync } from './useAsync';

const ALL = 'All phases';

export function StratagemsPage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => getCatalogue(slug), slug);
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState(ALL);
  if (state.status === 'loading') return <p className="muted">Loading stratagems…</p>;
  if (state.status === 'error') return <p role="alert">Couldn’t load this faction: {state.error.message}</p>;

  const cat = state.data;
  const name = factionDisplayName(cat.name);
  const q = query.trim().toLowerCase();
  const phases = [...new Set(cat.stratagems.flatMap((s) => s.phases))].sort((a, b) => a.localeCompare(b));
  const shown = cat.stratagems
    .filter((s) => phase === ALL || s.phases.includes(phase))
    .filter((s) => !q || [s.name, s.text, s.plain ?? ''].some((t) => t.toLowerCase().includes(q)));
  // The faction's own stratagems first, then sub-factions, detachments and armies of renown A–Z.
  const groups = [...new Set(shown.map((s) => s.group))].sort((a, b) => Number(b === name) - Number(a === name) || a.localeCompare(b));

  return (
    <section>
      <p>
        <Link to="/factions">← All factions</Link>
      </p>
      <h1>{name}</h1>
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
      <div className="chips" role="group" aria-label="Phase">
        {[ALL, ...phases].map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={phase === p} onClick={() => setPhase(p)}>
            {p}
          </button>
        ))}
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h2>{g}</h2>
          <div className="stack">
            {shown.filter((s) => s.group === g).map((s) => (
              <StratagemCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      ))}
      {shown.length === 0 && <p className="muted">{cat.stratagems.length ? 'No stratagems match.' : 'This faction has no stratagems of its own.'}</p>}
    </section>
  );
}
