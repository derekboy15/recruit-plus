/**
 * Plan H: how many of each kind of model a unit has as the list editor adds it (spec §7a: "the default unit is the unit
 * as the list editor adds it"), worked out by the roster engine itself rather than re-implemented on the raw tree.
 */
import type { CatalogueOut, UnitOut } from '../model/types';
import { addUnit, findSelView } from '../roster/edit';
import { evaluate, type SelView } from '../roster/evaluate';
import { createRoster, FORCE } from '../roster/policy';
import { buildScope, resolve, rootEntriesFor } from '../roster/scope';
import type { RosterFile } from '../roster/types';

/** Model selections in a unit as added, by every id that selects them (entry id and target id), with their counts. */
function modelCounts(v: SelView): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (s: SelView, copies: number) => {
    if (s.type === 'model') {
      for (const id of new Set([s.sel.entryId, s.merged?.target.id].filter((x): x is string => !!x))) out.set(id, (out.get(id) ?? 0) + copies * s.sel.count);
      return;
    }
    for (const c of s.children) walk(c, s === v ? copies : copies * s.sel.count);
  };
  walk(v, 1);
  return out;
}

/**
 * Sets each model kind's `defaultCount` (in place) from the unit as the roster engine adds it to a new Strike Force list,
 * and, when the unit as added is complete, marks as `optional` the kinds it doesn't have whose stat line no kind it does
 * have uses (the Cadian Command Squad's attachés), not a loadout variant of a model it has (a Necron Warrior with a
 * gauss reaper).
 * `files` is the catalogue's roster scope; library catalogues are left as they are, as for points.
 */
export function applyDefaultModels(out: CatalogueOut, files: RosterFile[]): void {
  if (out.library) return;
  const scope = buildScope(files);
  const roster = createRoster(scope, { name: 'Models', catalogueId: out.id, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
  const forceSelId = roster.forces[0].id;
  const roots = new Map<string, string>();
  for (const n of rootEntriesFor(scope, out.id)) {
    const target = resolve(scope, n).target.id;
    if (!roots.has(target)) roots.set(target, n.id);
  }
  for (const u of out.units) {
    if (!u.modelKinds?.length) continue;
    const root = roots.get(u.id);
    if (!root) continue;
    const { roster: added, selId } = addUnit(scope, roster, forceSelId, root);
    const v = findSelView(evaluate(scope, added), selId);
    if (!v) continue;
    setDefaults(u, v.type === 'model' ? new Map(u.modelKinds[0].entryIds.map((id) => [id, v.sel.count])) : modelCounts(v));
  }
}

function setDefaults(u: UnitOut, counts: Map<string, number>): void {
  const kinds = u.modelKinds!;
  for (const k of kinds) k.defaultCount = Math.max(0, ...k.entryIds.map((id) => counts.get(id) ?? 0));
  // A unit the editor adds short (Kroot Farstalkers: the player picks the loadouts) has no extras, only choices.
  const added = kinds.reduce((n, k) => n + k.defaultCount, 0);
  if (u.minModels !== null && added < u.minModels) return;
  const usedProfiles = new Set(kinds.filter((k) => k.defaultCount > 0).map((k) => k.profile));
  for (const k of kinds) if (k.defaultCount === 0 && !usedProfiles.has(k.profile)) k.optional = true;
}
