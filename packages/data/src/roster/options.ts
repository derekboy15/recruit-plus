/** Roster option queries: what can be added to a force or a selection, with limits and pts. Browser-safe. */
import { BATTLEFIELD_ROLES, type BattlefieldRole } from '../model/types';
import { addUnit, findSelView } from './edit';
import { childIndex, childLimits, evaluate, evaluateCandidate, type RosterView, type SelView } from './evaluate';
import { resolve, rootEntriesFor, type Scope } from './scope';
import { COST_PTS, type RNode, type Roster } from './types';

export interface UnitOption { entryId: string; name: string; role: string | null; points: number; legends: boolean }
export interface OptionNode {
  kind: 'option' | 'group'; id: string; name: string;
  min: number; max: number /* -1 = no limit */;
  count: number; pointsEach: number; collective: boolean; selIds: string[]; children: OptionNode[];
}

const LEGENDS = /\[legends\]/i;

/** Unit and model root entries that aren't hidden and whose primary category is one of the force's, by role then name. */
export function availableUnits(scope: Scope, r: Roster, forceSelId: string): UnitOption[] {
  return rootOptions(scope, r, forceSelId, (t) => t === 'unit' || t === 'model');
}

/** Upgrade root entries (Configuration, Stratagems) that aren't hidden and whose primary category is one of the force's. */
export function armyOptions(scope: Scope, r: Roster, forceSelId: string): UnitOption[] {
  return rootOptions(scope, r, forceSelId, (t) => t === 'upgrade');
}

function rootOptions(scope: Scope, r: Roster, forceSelId: string, wanted: (type: RNode['type']) => boolean): UnitOption[] {
  const view = evaluate(scope, r);
  const fv = view.forces.find((f) => f.force.id === forceSelId);
  if (!fv?.entry) return [];
  const slots = new Set(fv.entry.cats.map((c) => c.targetId));
  const out: UnitOption[] = [];
  for (const { node } of childIndex(scope, rootEntriesFor(scope, fv.force.catalogueId)).values()) {
    if (!wanted(resolve(scope, node).type)) continue;
    const c = evaluateCandidate(scope, view, fv, node);
    if (c.hidden || c.primary === null || !slots.has(c.primary)) continue;
    out.push({
      entryId: node.id,
      name: c.name,
      role: scope.category(c.primary)?.name ?? null,
      points: pointsAfterAdd(scope, r, forceSelId, node.id),
      legends: LEGENDS.test(c.name),
    });
  }
  return out.sort(byRoleThenName);
}

/** pts of the new selection once addUnit has filled in its defaults. */
function pointsAfterAdd(scope: Scope, r: Roster, forceSelId: string, entryId: string): number {
  const { roster, selId } = addUnit(scope, r, forceSelId, entryId);
  return findSelView(evaluate(scope, roster), selId)?.total[COST_PTS] ?? 0;
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
