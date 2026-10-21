/** Roster option queries: what can be added to a force or a selection, with limits and pts. Browser-safe. */
import { BATTLEFIELD_ROLES, type BattlefieldRole } from '../model/types';
import { childLimits, evaluateCandidate } from './children';
import { addUnit, findSelView } from './edit';
import { childIndex, evaluate, type RosterView, type SelView } from './evaluate';
import { resolve, rootEntriesFor, type Merged, type Scope } from './scope';
import { COST_PTS, type RNode, type Roster, type Sel } from './types';

export interface UnitOption { entryId: string; name: string; role: string | null; points: number; legends: boolean }
export interface OptionNode {
  kind: 'option' | 'group'; id: string; name: string;
  min: number; max: number /* -1 = no limit */;
  count: number; pointsEach: number; collective: boolean; selIds: string[]; children: OptionNode[];
}

const LEGENDS = /\[legends\]/i;
const CONFIGURATION = 'Configuration';
const ARMY_ROLES = new Set([CONFIGURATION, 'Stratagems']);
const NO_FORCE_ORG_SLOT = 'No Force Org Slot';
const isBattlefieldRole = (role: string | null) => BATTLEFIELD_ROLES.includes(role as BattlefieldRole);

/**
 * Root entries the user adds as units: unit and model entries, plus upgrade-typed ones with a battlefield role (the
 * Aquila Strongpoints are Fortification upgrades) or taking no slot (a Rogue Psyker beside Obsidius Mallex). Not
 * hidden, primary category one of the force's; by role then name.
 */
export function availableUnits(scope: Scope, r: Roster, forceSelId: string): UnitOption[] {
  return rootOptions(scope, r, forceSelId, (m, role, name) => isUnitEntry(scope, m, role, name));
}

/**
 * Whether a root entry, with its effective primary category name and name, is a unit: unit- and model-typed entries,
 * and upgrade-typed ones with a battlefield role or with No Force Org Slot. A No Force Org Slot upgrade named "[…"
 * (a reference entry) or holding a unit or model entry (Brotherhood of the Cog, which holds a Tech-Priest) is not.
 * Audited safe for BSData v9.8.0: in every playable catalogue, the Rogue Psyker is the only upgrade-typed unit that
 * takes no slot; the other No Force Org Slot upgrades are wrappers (Brotherhood of the Cog, Dynastic Advisor). Re-audit
 * on a data bump, since a slot-free unit that holds a model entry would be hidden.
 */
function isUnitEntry(scope: Scope, m: Merged, role: string | null, name: string): boolean {
  if (m.type === 'unit' || m.type === 'model') return true;
  if (m.type !== 'upgrade') return false;
  return isBattlefieldRole(role) || (role === NO_FORCE_ORG_SLOT && !name.startsWith('[') && !holdsUnit(scope, m, new Set([m.target.id])));
}

/** Whether a unit- or model-typed entry is anywhere below the entry. */
function holdsUnit(scope: Scope, m: Merged, seen: Set<string>): boolean {
  return m.children.some((n) => {
    const c = resolve(scope, n);
    if (c.type === 'unit' || c.type === 'model') return true;
    if (seen.has(c.target.id)) return false;
    seen.add(c.target.id);
    return holdsUnit(scope, c, seen);
  });
}

/** Configuration and Stratagems upgrades (Battle Size, Dynasty Choice…), not hidden, without [Reference] entries. */
export function armyOptions(scope: Scope, r: Roster, forceSelId: string): UnitOption[] {
  return rootOptions(scope, r, forceSelId, (m, role, name) => m.type === 'upgrade' && ARMY_ROLES.has(role ?? '') && !name.startsWith('['));
}

type Wanted = (m: Merged, role: string | null, name: string) => boolean;

function rootOptions(scope: Scope, r: Roster, forceSelId: string, wanted: Wanted): UnitOption[] {
  const view = evaluate(scope, r);
  const fv = view.forces.find((f) => f.force.id === forceSelId);
  if (!fv?.entry) return [];
  const slots = new Set(fv.entry.cats.map((c) => c.targetId));
  const price = pricer(scope, view, forceSelId);
  const out: UnitOption[] = [];
  for (const { node } of childIndex(scope, rootEntriesFor(scope, fv.force.catalogueId)).values()) {
    const c = evaluateCandidate(scope, view, fv, node);
    if (c.hidden || c.primary === null || !slots.has(c.primary)) continue;
    const role = scope.category(c.primary)?.name ?? null;
    if (!wanted(resolve(scope, node), role, c.name)) continue;
    out.push({ entryId: node.id, name: c.name, role, points: price(node.id), legends: LEGENDS.test(c.name) });
  }
  return out.sort(byRoleThenName);
}

const priceCache = new WeakMap<Scope, Map<string, Map<string, number>>>();

/**
 * pts of a root entry once addUnit has filled in its defaults. Simulated on a minimal roster (the same forces holding
 * only their Configuration selections) and cached per scope and configuration, so units already in the list don't
 * slow the picker down.
 */
function pricer(scope: Scope, view: RosterView, forceSelId: string): (entryId: string) => number {
  const isConfig = (v: SelView) => v.primary !== null && scope.category(v.primary)?.name === CONFIGURATION;
  const minimal: Roster = {
    ...view.roster,
    forces: view.forces.map((fv) => ({ ...fv.force, selections: fv.selections.filter(isConfig).map((v) => v.sel) })),
  };
  const shape = (s: Sel): string => `${s.entryId}*${s.count}(${(s.children ?? []).map(shape).join(',')})`;
  const key = JSON.stringify([
    minimal.catalogueId,
    minimal.forces.findIndex((f) => f.id === forceSelId),
    minimal.forces.map((f) => [f.forceId, f.catalogueId, f.selections.map(shape).sort()]),
  ]);
  let byConfig = priceCache.get(scope);
  if (!byConfig) priceCache.set(scope, (byConfig = new Map()));
  let prices = byConfig.get(key);
  if (!prices) byConfig.set(key, (prices = new Map()));
  return (entryId) => {
    let pts = prices.get(entryId);
    if (pts === undefined) {
      const { roster, selId } = addUnit(scope, minimal, forceSelId, entryId);
      prices.set(entryId, (pts = findSelView(evaluate(scope, roster), selId)?.total[COST_PTS] ?? 0));
    }
    return pts;
  };
}

/** Battlefield roles in rulebook order, then any other category alphabetically. */
function roleRank(role: string | null): number {
  const i = BATTLEFIELD_ROLES.indexOf(role as BattlefieldRole);
  return i < 0 ? BATTLEFIELD_ROLES.length : i;
}
function byRoleThenName(a: UnitOption, b: UnitOption): number {
  return roleRank(a.role) - roleRank(b.role) || (a.role ?? '').localeCompare(b.role ?? '') || a.name.localeCompare(b.name);
}

/** The options under a selection: its child entries and groups (nested), skipping hidden ones that aren't selected. */
export function childOptions(scope: Scope, r: Roster, selId: string): OptionNode[] {
  const view = evaluate(scope, r);
  const v = findSelView(view, selId);
  return v?.merged ? optionNodes(scope, view, v, v.merged.children, new Set()) : [];
}

function optionNodes(scope: Scope, view: RosterView, container: SelView, nodes: RNode[], open: Set<string>): OptionNode[] {
  const out: OptionNode[] = [];
  for (const n of nodes) {
    const m = resolve(scope, n);
    const c = evaluateCandidate(scope, view, container, n);
    const base = { id: n.id, name: c.name, ...childLimits(scope, view, container, n), collective: m.collective };
    if (m.target.kind === 'group') {
      if (open.has(m.target.id)) continue;
      const children = optionNodes(scope, view, container, m.children, new Set([...open, m.target.id]));
      const count = children.reduce((k, o) => k + o.count, 0);
      if (!children.length || (c.hidden && count === 0)) continue;
      out.push({ kind: 'group', ...base, count, pointsEach: 0, selIds: children.flatMap((o) => o.selIds), children });
      continue;
    }
    const sels = container.children.filter((s) => s.sel.entryId === n.id);
    const count = sels.reduce((k, s) => k + s.sel.count, 0);
    if (c.hidden && count === 0) continue;
    // A selected option's pts come from its evaluation; an unselected one's from the candidate.
    const pointsEach = sels.length ? (sels[0].own[COST_PTS] ?? 0) / sels[0].sel.count : (c.costs[COST_PTS] ?? 0);
    out.push({ kind: 'option', ...base, count, pointsEach, selIds: sels.map((s) => s.sel.id), children: [] });
  }
  return out;
}
