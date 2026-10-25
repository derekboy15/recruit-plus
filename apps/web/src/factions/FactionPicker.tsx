import type { CatalogueSummary, FactionGroup } from '@recruit/data/model';
import { useId, useState, type ReactNode } from 'react';
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

/**
 * The playable factions in groups, with a search box that knows everyday names ("space marines", "guard"). Forces that
 * aren't armies on their own come last, under Add-on forces, with how each joins an army; the wizard can't pick them.
 */
export function FactionPicker({ to, onPick, selected }: Props) {
  const state = useAsync(getIndex, 'index');
  const [query, setQuery] = useState('');
  const id = useId();
  if (state.status === 'loading') return <p className="muted">Loading factions…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="factions" />;

  const playable = state.data.catalogues
    .filter((c) => !c.library && factionMatches(c, query))
    .map((c) => ({ c, label: factionLabel(c) }))
    .sort((a, b) => a.label.name.localeCompare(b.label.name));
  const armies = playable.filter(({ c }) => !c.addOn);
  const addOns = playable.filter(({ c }) => c.addOn);
  const head = (c: CatalogueSummary, name: string, legends: boolean, meta: ReactNode) => (
    <>
      <FactionBadge slug={c.slug} name={name} />
      <span className="faction-row__main">
        <span className="faction-row__name">
          {name}
          {legends && <span className="badge badge--legends">Legends</span>}
        </span>
        <span className="faction-row__meta">{meta}</span>
      </span>
    </>
  );

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
        const items = armies.filter(({ c }) => c.group === group);
        if (!items.length) return null;
        return (
          <section key={group} aria-labelledby={`${id}-${group}`}>
            <h2 id={`${id}-${group}`}>{group}</h2>
            <ul className="list">
              {items.map(({ c, label: { name, legends, family } }) => {
                const label = head(c, name, legends, `${family ? `${family} chapter · ` : ''}${c.unitCount.toLocaleString('en-GB')} ${c.unitCount === 1 ? 'unit' : 'units'}`);
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
          </section>
        );
      })}
      {addOns.length > 0 && (
        <section aria-labelledby={`${id}-add-ons`}>
          <h2 id={`${id}-add-ons`}>Add-on forces</h2>
          <p className="muted">These can’t be an army on their own. They join another army as allies.</p>
          <ul className="list">
            {addOns.map(({ c, label: { name, legends } }) => (
              <li key={c.slug}>
                {onPick ? (
                  <div className="faction-row faction-row--add-on">
                    {head(
                      c,
                      name,
                      legends,
                      <>
                        {c.addOn!.how}{' '}
                        <Link className="faction-row__guide" to={`/factions/${c.slug}/guide`}>
                          Read the guide
                        </Link>
                      </>,
                    )}
                  </div>
                ) : (
                  <Link className="list__link faction-row" to={to ? to(c) : `/factions/${c.slug}`}>
                    {head(c, name, legends, c.addOn!.how)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {playable.length === 0 && <p className="muted">No faction matches “{query}”.</p>}
    </div>
  );
}
