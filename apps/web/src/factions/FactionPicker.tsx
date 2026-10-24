import type { CatalogueSummary, FactionGroup } from '@recruit/data/model';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadError } from '../layout/OfflineNotice';
import '../rules/rules.css';
import { FactionBadge } from '../ui/FactionBadge';
import { getIndex } from './dataClient';
import { factionLabel, factionMatches } from './factionSearch';
import { useAsync } from './useAsync';

const GROUPS: FactionGroup[] = ['Imperium', 'Chaos', 'Xenos', 'Unaligned'];

interface Props {
  /** Each faction links here (the Factions page). */
  to?: (c: CatalogueSummary) => string;
  /** Each faction is a button instead (the new-list wizard); `selected` is the slug of the chosen one. */
  onPick?: (c: CatalogueSummary) => void;
  selected?: string;
}

/** The playable factions in groups, with a search box that knows everyday names ("space marines", "guard"). */
export function FactionPicker({ to, onPick, selected }: Props) {
  const state = useAsync(getIndex, 'index');
  const [query, setQuery] = useState('');
  if (state.status === 'loading') return <p className="muted">Loading factions…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="factions" />;

  const playable = state.data.catalogues
    .filter((c) => !c.library && factionMatches(c, query))
    .map((c) => ({ c, label: factionLabel(c) }))
    .sort((a, b) => a.label.name.localeCompare(b.label.name));

  return (
    <div>
      <label htmlFor="faction-search" className="muted">
        Search factions
      </label>
      <input
        id="faction-search"
        className="input"
        type="search"
        placeholder="e.g. Necrons, Space Marines"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ margin: '0.25rem 0 1rem' }}
      />
      {GROUPS.map((group) => {
        const items = playable.filter(({ c }) => c.group === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            <h2>{group}</h2>
            <ul className="list">
              {items.map(({ c, label: { name, legends, family } }) => {
                const label = (
                  <>
                    <FactionBadge slug={c.slug} name={name} />
                    <span className="faction-row__main">
                      <span className="faction-row__name">
                        {name}
                        {legends && <span className="badge badge--legends">Legends</span>}
                      </span>
                      <span className="faction-row__meta">
                        {`${family ? `${family} chapter · ` : ''}${c.unitCount.toLocaleString('en-GB')} ${c.unitCount === 1 ? 'unit' : 'units'}`}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={c.slug}>
                    {onPick ? (
                      <button type="button" className="list__link faction-row" aria-pressed={selected === c.slug} onClick={() => onPick(c)}>
                        {label}
                      </button>
                    ) : (
                      <Link className="list__link faction-row" to={to ? to(c) : `/factions/${c.slug}`}>
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
