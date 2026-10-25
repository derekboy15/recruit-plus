/**
 * Plan H: the unit as the list editor adds it (spec §7a: "the default unit is the unit as the list editor adds it"),
 * worked out by the roster engine itself rather than re-implemented on the raw tree: how many of each kind of model it
 * has, what each model carries and the abilities that grants, and what sits on the unit rather than on a model.
 */
import type { CatalogueOut, ModelKindOut, UnitOut } from '../model/types';
import { addUnit, findSelView } from '../roster/edit';
import { evaluate, type SelView } from '../roster/evaluate';
import { createRoster, FORCE } from '../roster/policy';
import { buildScope, resolve, rootEntriesFor } from '../roster/scope';
import type { RosterFile } from '../roster/types';

/** The ids a selection was made through: its entry (a link's id for a link) and the entry's target. */
const idsOf = (s: SelView) => [...new Set([s.sel.entryId, s.merged?.target.id].filter((x): x is string => !!x))];

/** A unit as added, read by model: each model selection's ids and copies, with the ids of everything below it. */
interface AddedModel {
  ids: string[];
  copies: number;
  gear: string[];
}
interface Added {
  models: AddedModel[];
  /** Selections on the unit itself (or a squad inside it), outside any model. */
  unit: string[];
  /** Unit-level choices BattleScribe gives every model (isUnitWideChoice → perModel). */
  everyone: string[];
}

function read(v: SelView): Added {
  const out: Added = { models: [], unit: [...idsOf(v)], everyone: [] };
  const below = (s: SelView): string[] => s.children.flatMap((c) => [...idsOf(c), ...below(c)]);
  const walk = (s: SelView, copies: number) => {
    for (const c of s.children) {
      if (c.type === 'model') out.models.push({ ids: idsOf(c), copies: copies * c.sel.count, gear: below(c) });
      else if (c.type === 'unit') {
        out.unit.push(...idsOf(c));
        walk(c, copies * c.sel.count);
      } else (c.merged?.node.perModel ? out.everyone : out.unit).push(...idsOf(c), ...below(c));
    }
  };
  walk(v, 1);
  return out;
}

/**
 * Sets, in place, each model kind's `defaultCount`, `weapons` and `abilities` from the unit as the roster engine adds it
 * to a new Strike Force list, and the unit's `unitGear` and `everyone`. When the unit as added is complete, marks as
 * `optional` the kinds it doesn't have whose own stat line no kind it does have uses (the Cadian Command Squad's
 * attachés), never a loadout variant of a model it has (a Necron Warrior with a gauss reaper, or a variant with no stat
 * line of its own). `files` is the catalogue's roster scope; library catalogues are left as they are, as for points.
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
    const root = roots.get(u.id);
    if (!root) continue;
    const { roster: added, selId } = addUnit(scope, roster, forceSelId, root);
    const v = findSelView(evaluate(scope, added), selId);
    if (!v) continue;
    const single = u.modelKinds?.length === 1 && u.modelKinds[0].entryIds.some((id) => idsOf(v).includes(id));
    // A single model is the unit: everything on it is that model's.
    const a = single ? { models: [{ ids: u.modelKinds![0].entryIds, copies: v.sel.count, gear: [...idsOf(v), ...v.children.flatMap(function all(c: SelView): string[] { return [...idsOf(c), ...c.children.flatMap(all)]; })] }], unit: [], everyone: [] } : read(v);
    apply(u, a);
  }
}

function apply(u: UnitOut, added: Added): void {
  const entries = u.entries ?? {};
  const gather = (ids: string[], key: 'w' | 'a') => [...new Set(ids.flatMap((id) => entries[id]?.[key] ?? []))];
  const kinds: ModelKindOut[] = u.modelKinds ?? [];
  for (const k of kinds) {
    const mine = added.models.filter((m) => m.ids.some((id) => k.entryIds.includes(id)));
    k.defaultCount = mine.reduce((n, m) => n + m.copies, 0);
    // The model's gear as added; a kind the unit as added doesn't have shows what its own entry brings.
    const ids = mine.length ? mine.flatMap((m) => [...m.ids, ...m.gear]) : k.entryIds;
    k.weapons = gather(ids, 'w');
    k.abilities = gather(ids, 'a');
  }
  const unitWeapons = gather(added.unit, 'w');
  const unitAbilities = [...new Set([...gather(added.unit, 'a'), ...gather(added.everyone, 'a')])];
  if (unitWeapons.length || unitAbilities.length) u.unitGear = { weapons: unitWeapons, abilities: unitAbilities };
  const everyone = gather(added.everyone, 'w');
  if (everyone.length) u.everyone = everyone;
  // A unit the editor adds short (Kroot Farstalkers: the player picks the loadouts) has no extras, only choices.
  const total = kinds.reduce((n, k) => n + k.defaultCount, 0);
  if (u.minModels !== null && total < u.minModels) return;
  const usedProfiles = new Set(kinds.filter((k) => k.defaultCount > 0).map((k) => k.profile));
  for (const k of kinds) if (k.defaultCount === 0 && k.profile >= 0 && !usedProfiles.has(k.profile)) k.optional = true;
}
