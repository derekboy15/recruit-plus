import { COST_PTS, stripCpSuffix, type ForceView, type Scope } from '@recruit/data/roster';
import { factionDisplayName } from '../factions/names';
import { fmt, isArmyOption, isAutoManaged, unitName, unitsByRole } from './editorView';
import type { EditorAction } from './useRosterEditor';

interface SectionProps {
  scope: Scope;
  fv: ForceView;
  /** The army's first detachment: its army choices are shown in Army options instead. */
  first: boolean;
  armyCatalogueId: string;
  flagged: Set<string>;
  dispatch: (a: EditorAction) => unknown;
  onOpenUnit: (selId: string) => void;
  onAddUnit: (forceSelId: string) => void;
}

/** One detachment: its units by role (name, models, pts, a red dot when a unit has problems) and add unit. */
export function DetachmentSection({ scope, fv, first, armyCatalogueId, flagged, dispatch, onOpenUnit, onAddUnit }: SectionProps) {
  const name = stripCpSuffix(fv.name);
  const groups = unitsByRole(scope, fv);
  // A second detachment's own choices (an ally's faction choice) have nowhere else to live.
  const own = first ? [] : fv.selections.filter((v) => v.merged && isArmyOption(scope, v) && !isAutoManaged(v) && v.merged.children.length > 0);
  const catalogue = scope.catalogue(fv.force.catalogueId)?.name;
  const allied = catalogue && fv.force.catalogueId !== armyCatalogueId ? factionDisplayName(catalogue) : null;

  return (
    <section className="detachment" aria-label={name}>
      <h2 className="detachment__title">
        {name}
        {allied && <span className="muted detachment__ally"> · {allied}</span>}
      </h2>
      {own.length > 0 && (
        <>
          <h3 className="role-head">Detachment options</h3>
          <ul className="list">
            {own.map((v) => (
              <li key={v.sel.id}>
                <button type="button" className="row" onClick={() => onOpenUnit(v.sel.id)}>
                  <span className="row__name">{v.name}</span>
                  {flagged.has(v.sel.id) && <span className="dot" role="img" aria-label="Has problems" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {groups.length === 0 && <p className="muted">No units yet.</p>}
      {groups.map((g) => (
        <div key={g.role}>
          <h3 className="role-head">{g.role}</h3>
          <ul className="list">
            {g.units.map((v) =>
              v.merged ? (
                <li key={v.sel.id}>
                  <button type="button" className="row" onClick={() => onOpenUnit(v.sel.id)}>
                    <span className="row__name">
                      {unitName(v.name)}
                      {v.models > 1 && <span className="muted"> ({fmt(v.models)} models)</span>}
                      {flagged.has(v.sel.id) && <> <span className="dot" role="img" aria-label="Has problems" /></>}
                    </span>{' '}
                    <span className="row__pts">{fmt(v.total[COST_PTS] ?? 0)} pts</span>
                  </button>
                </li>
              ) : (
                <li key={v.sel.id} className="row row--static">
                  <span className="row__name">
                    {v.name} <span className="dot" role="img" aria-label="Has problems" />
                  </span>
                  <button type="button" className="btn btn--small" onClick={() => dispatch({ type: 'remove', selId: v.sel.id })}>
                    Remove
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
      <div className="detachment__actions">
        <button type="button" className="btn" onClick={() => onAddUnit(fv.force.id)}>
          + Add unit
        </button>
      </div>
    </section>
  );
}
