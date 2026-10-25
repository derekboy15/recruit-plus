import { BATTLEFIELD_ROLES, type UnitOut } from '@recruit/data/model';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LoadError } from '../layout/OfflineNotice';
import '../rules/rules.css';
import { keyStats, sizeLabel } from '../ui/datasheet';
import { PageHeader } from '../ui/PageHeader';
import { getCatalogue } from './dataClient';
import { factionLabel } from './factionSearch';
import { FACTIONS_BACK, FactionTabs } from './FactionTabs';
import { useAsync } from './useAsync';

/** "10–20 models · M5" T4 W1 Sv4+": a unit's size and the stats a player checks first. */
function unitMeta(u: UnitOut): string {
  const { M, T, W, Sv } = keyStats(u);
  return [sizeLabel(u), `M${M} T${T} W${W} Sv${Sv}`].filter(Boolean).join(' · ');
}

export function FactionPage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => getCatalogue(slug), slug);
  const [showLegends, setShowLegends] = useState(true);
  const [query, setQuery] = useState('');
  if (state.status === 'loading') return <p className="muted">Loading units…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="this faction" />;

  const cat = state.data;
  const q = query.trim().toLowerCase();
  const units = cat.units
    .filter((u) => showLegends || (!u.legends && !u.forgeWorld))
    .filter((u) => !q || u.name.toLowerCase().includes(q));
  const roles = [...BATTLEFIELD_ROLES, null];

  return (
    <section>
      <PageHeader title={factionLabel(cat).name} back={FACTIONS_BACK} />
      <FactionTabs slug={cat.slug} library={cat.library} />
      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          className="input"
          type="search"
          aria-label="Search units"
          placeholder="Search units"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 'var(--touch)' }}>
          <input type="checkbox" checked={showLegends} onChange={(e) => setShowLegends(e.target.checked)} style={{ width: 22, height: 22 }} />
          Show Legends and Forge World units
        </label>
      </div>
      {roles.map((role) => {
        const items = units.filter((u) => u.role === role);
        if (!items.length) return null;
        return (
          <div key={role ?? 'other'}>
            <h2>{role ?? 'Other'}</h2>
            <ul className="list">
              {items.map((u) => (
                <li key={u.id}>
                  <Link className="list__link faction-unit" to={`/factions/${cat.slug}/units/${u.slug}`}>
                    <span className="faction-unit__main">
                      <span className="faction-unit__name">
                        {u.name.replace(/\s*\[legends\]/i, '')}
                        {u.legends && <span className="badge badge--legends">Legends</span>}
                        {u.forgeWorld && <span className="badge badge--fw">FW</span>}
                      </span>
                      <span className="faction-unit__meta">{unitMeta(u)}</span>
                      {u.needs && <span className="faction-unit__needs">{`Needs ${u.needs.join(' or ')}`}</span>}
                    </span>
                    <span className="faction-unit__pts">{u.points != null ? `${u.points} pts` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {units.length === 0 && <p className="muted">No units match.</p>}
    </section>
  );
}
