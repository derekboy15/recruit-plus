import type { CatalogueSummary, FactionGroup } from '@recruit/data/model';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getIndex } from './dataClient';
import { factionDisplayName } from './names';
import { useAsync } from './useAsync';
import { LoadError } from '../layout/OfflineNotice';

const GROUPS: FactionGroup[] = ['Imperium', 'Chaos', 'Xenos', 'Unaligned'];

interface Props {
  /** Each faction links here (the Factions page). */
  to?: (c: CatalogueSummary) => string;
  /** Each faction is a button instead (the new-list wizard); `selected` is the slug of the chosen one. */
  onPick?: (c: CatalogueSummary) => void;
  selected?: string;
}

/** The playable factions in groups, with a search box. */
export function FactionPicker({ to, onPick, selected }: Props) {
  const state = useAsync(getIndex, 'index');
  const [query, setQuery] = useState('');
  if (state.status === 'loading') return <p className="muted">Loading factions…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="factions" />;

  const q = query.trim().toLowerCase();
  const playable = state.data.catalogues
    .filter((c) => !c.library)
    .filter((c) => !q || factionDisplayName(c.name).toLowerCase().includes(q))
    .sort((a, b) => factionDisplayName(a.name).localeCompare(factionDisplayName(b.name)));

  return (
    <div>
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
              {items.map((c) => {
                const label = (
                  <>
                    <span>{factionDisplayName(c.name)}</span>
                    <span className="muted">{`${c.unitCount.toLocaleString('en-GB')} ${c.unitCount === 1 ? 'unit' : 'units'}`}</span>
                  </>
                );
                return (
                  <li key={c.slug}>
                    {onPick ? (
                      <button type="button" className="list__link" aria-pressed={selected === c.slug} onClick={() => onPick(c)}>
                        {label}
                      </button>
                    ) : (
                      <Link className="list__link" to={to ? to(c) : `/factions/${c.slug}`}>
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {playable.length === 0 && <p className="muted">No faction matches “{query}”.</p>}
    </div>
  );
}
