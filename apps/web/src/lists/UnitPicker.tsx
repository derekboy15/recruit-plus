import { availableUnits, type Roster, type Scope, type UnitOption } from '@recruit/data/roster';
import { useMemo, useState } from 'react';
import { fmt, unitName } from './editorView';
import { Panel } from './Panel';
import { unitInfo, type UnitIndex } from './unitIndex';

interface Props {
  scope: Scope;
  roster: Roster;
  forceSelId: string;
  /** Only these units (a fix's suggestions), until the player asks for all. */
  only?: string[];
  units: UnitIndex | null;
  onAdd: (entryId: string) => void;
  onClose: () => void;
}

/** Search, then units by role: tapping one adds it. */
export function UnitPicker({ scope, roster, forceSelId, only, units, onAdd, onClose }: Props) {
  // Prices are worked out when the picker opens, not on every render.
  const [options] = useState(() => availableUnits(scope, roster, forceSelId));
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const filtered = only?.length && !showAll;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = options.filter((o) => (!filtered || only!.includes(o.entryId)) && (!q || unitName(o.name).toLowerCase().includes(q)));
    const byRole = new Map<string, UnitOption[]>();
    for (const o of shown) byRole.set(o.role ?? 'Other', [...(byRole.get(o.role ?? 'Other') ?? []), o]);
    return [...byRole];
  }, [options, only, filtered, query]);

  return (
    <Panel title="Add a unit" kind="full" onClose={onClose}>
      <input
        type="search"
        className="input"
        aria-label="Search units"
        placeholder="Search units"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered && (
        <p className="picker__note">
          <span className="muted">Units that fix this problem.</span>
          <button type="button" className="btn btn--small" onClick={() => setShowAll(true)}>
            Show all units
          </button>
        </p>
      )}
      {groups.length === 0 && (
        <p className="muted">
          {query.trim()
            ? `No units match “${query.trim()}”.`
            : filtered
              ? 'None of the suggested units can be added here any more. Show all units to pick another.'
              : 'This detachment can’t take any units.'}
        </p>
      )}
      {groups.map(([role, list]) => (
        <section key={role}>
          <h3 className="role-head">{role}</h3>
          <ul className="list">
            {list.map((o) => {
              const fw = unitInfo(scope, units, o.entryId)?.unit.forgeWorld;
              return (
                <li key={o.entryId}>
                  <button type="button" className="row" onClick={() => onAdd(o.entryId)}>
                    <span className="row__name">
                      {unitName(o.name)}
                      {o.legends && <> <span className="badge badge--legends">Legends</span></>}
                      {fw && <> <span className="badge badge--fw">Forge World</span></>}
                    </span>{' '}
                    <span className="row__pts">{fmt(o.points)} pts</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Panel>
  );
}
