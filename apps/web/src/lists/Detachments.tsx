import type { CatalogueSummary } from '@recruit/data/model';
import {
  BATTLE_SIZES,
  COST_PTS,
  detachmentChoices,
  stripCpSuffix,
  type BattleSizeId,
  type ForceView,
  type PolicyData,
  type Roster,
  type Scope,
} from '@recruit/data/roster';
import { useMemo, useState } from 'react';
import { factionDisplayName } from '../factions/names';
import { fmt, isArmyOption, isAutoManaged, unitName, unitsByRole } from './editorView';
import type { EditorAction } from './useRosterEditor';

interface SectionProps {
  scope: Scope;
  fv: ForceView;
  /** The army's first detachment: its army choices are shown in Army options instead. */
  first: boolean;
  armyCatalogueId: string;
  canRemove: boolean;
  flagged: Set<string>;
  dispatch: (a: EditorAction) => unknown;
  onOpenUnit: (selId: string) => void;
  onAddUnit: (forceSelId: string) => void;
}

/** One detachment: its units by role (name, models, pts, a red dot when a unit has problems), add unit, remove. */
export function DetachmentSection({ scope, fv, first, armyCatalogueId, canRemove, flagged, dispatch, onOpenUnit, onAddUnit }: SectionProps) {
  const [confirming, setConfirming] = useState(false);
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
        {canRemove &&
          (confirming ? (
            <>
              <button type="button" className="btn btn--danger" onClick={() => dispatch({ type: 'remove-force', forceSelId: fv.force.id })}>
                Remove it and its units
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirming(true)}>
              Remove detachment
            </button>
          ))}
      </div>
    </section>
  );
}

interface SetupProps { scope: Scope; roster: Roster; policy: PolicyData; catalogues: CatalogueSummary[]; dispatch: (a: EditorAction) => unknown }

/** "+ Add detachment" (the army's own first, allies by faction) and the battle size. */
export function ArmySetup({ scope, roster, policy, catalogues, dispatch }: SetupProps) {
  const [adding, setAdding] = useState(false);
  const choices = useMemo(() => {
    if (!adding) return [];
    const seen = new Set<string>();
    return detachmentChoices(scope, roster, policy, catalogues).filter((c) => {
      const key = `${c.catalogueId}|${c.forceId}`;
      return !seen.has(key) && (seen.add(key), true);
    });
  }, [adding, scope, roster, policy, catalogues]);
  const own = choices.filter((c) => !c.allied);
  const allies = new Map<string, typeof choices>();
  for (const c of choices.filter((x) => x.allied)) allies.set(c.catalogueId, [...(allies.get(c.catalogueId) ?? []), c]);
  const factionName = (id: string) => factionDisplayName(catalogues.find((c) => c.id === id)?.name ?? scope.catalogue(id)?.name ?? 'Allies');
  const add = (forceId: string, catalogueId: string) => {
    dispatch({ type: 'add-force', forceId, catalogueId });
    setAdding(false);
  };
  const button = (c: (typeof choices)[number]) => (
    <li key={`${c.catalogueId}|${c.forceId}`}>
      <button type="button" className="row" onClick={() => add(c.forceId, c.catalogueId)}>
        <span className="row__name">{stripCpSuffix(c.name)}</span>
      </button>
    </li>
  );

  return (
    <section className="army-setup">
      <button type="button" className="btn" aria-expanded={adding} onClick={() => setAdding(!adding)}>
        + Add detachment
      </button>
      {adding && (
        <div className="army-setup__choices">
          {choices.length === 0 && <p className="muted">{`No more detachments can be added at ${BATTLE_SIZES[roster.battleSize]?.name ?? 'this size'}.`}</p>}
          {own.length > 0 && <ul className="list">{own.map(button)}</ul>}
          {allies.size > 0 && <h3 className="role-head">Allies</h3>}
          {[...allies].map(([id, list]) => (
            <details key={id} className="ally">
              <summary>{factionName(id)}</summary>
              <ul className="list">{list.map(button)}</ul>
            </details>
          ))}
        </div>
      )}
      <label className="army-setup__size">
        <span>Battle size</span>
        <select className="input" value={roster.battleSize} onChange={(e) => dispatch({ type: 'battle-size', size: e.target.value as BattleSizeId })}>
          {Object.values(BATTLE_SIZES).map((s) => (
            <option key={s.id} value={s.id}>{`${s.name} (${fmt(s.points)} pts)`}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
