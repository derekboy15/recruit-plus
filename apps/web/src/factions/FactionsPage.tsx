import type { FactionGroup } from '@recruit/data/model';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getIndex } from './dataClient';
import { factionDisplayName } from './names';
import { useAsync } from './useAsync';

const GROUPS: FactionGroup[] = ['Imperium', 'Chaos', 'Xenos', 'Unaligned'];

export function FactionsPage() {
  const state = useAsync(getIndex, 'index');
  const [query, setQuery] = useState('');
  if (state.status === 'loading') return <p className="muted">Loading factions…</p>;
  if (state.status === 'error') return <p role="alert">Couldn’t load factions: {state.error.message}</p>;

  const q = query.trim().toLowerCase();
  const playable = state.data.catalogues
    .filter((c) => !c.library)
    .filter((c) => !q || factionDisplayName(c.name).toLowerCase().includes(q))
    .sort((a, b) => factionDisplayName(a.name).localeCompare(factionDisplayName(b.name)));

  return (
    <section>
      <h1>Factions</h1>
      <label htmlFor="faction-search" className="muted">
        Search
      </label>
      <input
        id="faction-search"
        className="input"
        type="search"
        placeholder="e.g. Necrons, Blood Angels"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ margin: '0.25rem 0 1rem' }}
      />
      {GROUPS.map((group) => {
        const items = playable.filter((c) => c.group === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            <h2>{group}</h2>
            <ul className="list">
              {items.map((c) => (
                <li key={c.slug}>
                  <Link className="list__link" to={`/factions/${c.slug}`}>
                    <span>{factionDisplayName(c.name)}</span>
                    <span className="muted">{c.unitCount} units</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {playable.length === 0 && <p className="muted">No faction matches “{query}”.</p>}
    </section>
  );
}
