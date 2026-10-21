/**
 * Roster edits. Every edit is pure: it returns a new Roster (sharing untouched parts) and never mutates its input.
 * Edits given an unknown selection or force id return the roster unchanged. Browser-safe.
 */
import { resolve, rootEntriesFor, type Scope } from './scope';
import { childLimits, evaluateCandidate } from './children';
import { childIndex, evaluate, type Found, type RosterView, type SelView } from './evaluate';
import type { RNode, Roster, Sel } from './types';

/** Required children nest a few levels at most (unit → model → weapon); this only guards against cyclic data. */
const MAX_FILL_DEPTH = 12;
const CONFIGURATION = 'Configuration';

export function newId(): string {
  return crypto.randomUUID();
}

export function findSelView(view: RosterView, selId: string): SelView | undefined {
  const walk = (vs: SelView[]): SelView | undefined => {
    for (const v of vs) {
      if (v.sel.id === selId) return v;
      const hit = walk(v.children);
      if (hit) return hit;
    }
  };
  return walk(view.forces.flatMap((f) => f.selections));
}

function findSel(r: Roster, selId: string): Sel | undefined {
  const walk = (ss: Sel[]): Sel | undefined => {
    for (const s of ss) {
      if (s.id === selId) return s;
      const hit = walk(s.children ?? []);
      if (hit) return hit;
    }
  };
  return walk(r.forces.flatMap((f) => f.selections));
}

/** Replaces the selection `selId` with `fn(sel)` (empty = remove), copying only the path to it. */
function editSel(r: Roster, selId: string, fn: (s: Sel) => Sel[]): Roster {
  let hit = false;
  const walk = (sels: Sel[]): Sel[] => {
    let changed = false;
    const out: Sel[] = [];
    for (const s of sels) {
      if (!hit && s.id === selId) {
        hit = changed = true;
        out.push(...fn(s));
        continue;
      }
      const kids = !hit && s.children?.length ? walk(s.children) : s.children;
      if (kids !== s.children) {
        changed = true;
        out.push({ ...s, children: kids });
      } else out.push(s);
    }
    return changed ? out : sels;
  };
  const forces = r.forces.map((f) => {
    if (hit) return f;
    const selections = walk(f.selections);
    return selections === f.selections ? f : { ...f, selections };
  });
  return hit ? { ...r, forces } : r;
}

const blank = (entryId: string, count: number): Sel => ({ id: newId(), entryId, count, children: [] });
const freshCopy = (s: Sel): Sel => ({ ...s, id: newId(), children: (s.children ?? []).map(freshCopy) });
const appendChildren = (r: Roster, selId: string, kids: Sel[]) => editSel(r, selId, (s) => [{ ...s, children: [...(s.children ?? []), ...kids] }]);

export function addForce(_scope: Scope, r: Roster, forceId: string, catalogueId: string): Roster {
  return { ...r, forces: [...r.forces, { id: newId(), forceId, catalogueId, selections: [] }] };
}

/** Removing the first force moves its Configuration selections (battle size, army choices) to the new first force. */
export function removeForce(scope: Scope, r: Roster, forceSelId: string): Roster {
  const index = r.forces.findIndex((f) => f.id === forceSelId);
  if (index < 0) return r;
  const forces = r.forces.filter((_, i) => i !== index);
  if (index === 0 && forces.length) {
    const config = evaluate(scope, r).forces[0].selections.filter((v) => v.primary !== null && scope.category(v.primary)?.name === CONFIGURATION);
    if (config.length) forces[0] = { ...forces[0], selections: [...config.map((v) => v.sel), ...forces[0].selections] };
  }
  return { ...r, forces };
}

/** Adds a root entry to the force with its required children. selId is '' when nothing was added. */
export function addUnit(scope: Scope, r: Roster, forceSelId: string, entryId: string): { roster: Roster; selId: string } {
  const force = r.forces.find((f) => f.id === forceSelId);
  if (!force || !childIndex(scope, rootEntriesFor(scope, force.catalogueId)).has(entryId)) return { roster: r, selId: '' };
  const sel = blank(entryId, 1);
  const roster = { ...r, forces: r.forces.map((f) => (f === force ? { ...f, selections: [...f.selections, sel] } : f)) };
  return { roster: fillRequired(scope, roster, [sel.id]), selId: sel.id };
}

/** Adds an option under a selection with its required children. count defaults to the option's minimum (at least 1). */
export function addChild(scope: Scope, r: Roster, parentSelId: string, entryId: string, count?: number): Roster {
  const view = evaluate(scope, r);
  const parent = findSelView(view, parentSelId);
  const found = parent?.merged ? childIndex(scope, parent.merged.children).get(entryId) : undefined;
  if (!parent || !found) return r;
  const n = count ?? Math.max(1, childLimits(scope, view, parent, found.node).min);
  if (n <= 0) return r;
  const sel = blank(entryId, n);
  return fillRequired(scope, appendChildren(r, parentSelId, [sel]), [sel.id]);
}

/** Sets one selection's copy count; 0 or less removes it. */
export function setCount(_scope: Scope, r: Roster, selId: string, count: number): Roster {
  if (count <= 0) return removeSelection(r, selId);
  return editSel(r, selId, (s) => [{ ...s, count }]);
}

export function removeSelection(r: Roster, selId: string): Roster {
  return editSel(r, selId, () => []);
}

/** Peels one copy off a stack into a deep copy right after it. A single copy is returned as is. */
export function splitSelection(r: Roster, selId: string): { roster: Roster; selId: string } {
  const s = findSel(r, selId);
  if (!s) return { roster: r, selId: '' };
  if (s.count <= 1) return { roster: r, selId };
  const copy = { ...freshCopy(s), count: 1 };
  return { roster: editSel(r, selId, (orig) => [{ ...orig, count: orig.count - 1 }, copy]), selId: copy.id };
}

export function duplicateSelection(r: Roster, selId: string): Roster {
  return editSel(r, selId, (s) => [s, freshCopy(s)]);
}

/** Makes entryId the group's only choice under the parent (removing the others), unless it already is. */
export function chooseInGroup(scope: Scope, r: Roster, parentSelId: string, groupId: string, entryId: string): Roster {
  const parent = findSelView(evaluate(scope, r), parentSelId);
  if (!parent?.merged) return r;
  const index = childIndex(scope, parent.merged.children);
  const inGroup = (id: string) => index.get(id)?.groups.includes(groupId) ?? false;
  if (!inGroup(entryId)) return r;
  const current = (parent.sel.children ?? []).filter((c) => inGroup(c.entryId));
  if (current.length === 1 && current[0].entryId === entryId) return r;
  const cleared = editSel(r, parentSelId, (s) => [{ ...s, children: (s.children ?? []).filter((c) => !inGroup(c.entryId)) }]);
  return addChild(scope, cleared, parentSelId, entryId);
}

// ---------- required children ----------

/** Adds required children to freshly added (childless) selections, level by level, re-evaluating between levels. */
function fillRequired(scope: Scope, r: Roster, selIds: string[]): Roster {
  let roster = r;
  let pending = selIds;
  for (let depth = 0; pending.length && depth < MAX_FILL_DEPTH; depth++) {
    const view = evaluate(scope, roster);
    const next: string[] = [];
    for (const id of pending) {
      const v = findSelView(view, id);
      if (!v?.merged) continue;
      const kids = [...requiredChildren(scope, view, v)].map(([entryId, count]) => blank(entryId, count));
      if (!kids.length) continue;
      roster = appendChildren(roster, id, kids);
      next.push(...kids.map((k) => k.id));
    }
    pending = next;
  }
  return roster;
}

/**
 * Entry id → count for an empty container: every non-hidden entry or link with a minimum ≥ 1, then, for each group whose
 * minimum isn't met by those, the shortfall as copies of its default (or of its only non-hidden entry; a group with
 * several choices and no visible default is left for the user). One count per id, so a model minimum becomes one stack.
 */
function requiredChildren(scope: Scope, view: RosterView, container: SelView): Map<string, number> {
  const index = childIndex(scope, container.merged!.children);
  const out = new Map<string, number>();
  const add = (id: string, n: number) => out.set(id, (out.get(id) ?? 0) + n);
  const hidden = (f: Found) => evaluateCandidate(scope, view, container, f.node).hidden;
  const visit = (nodes: RNode[], open: Set<string>): number => {
    let added = 0;
    for (const n of nodes) {
      if (evaluateCandidate(scope, view, container, n).hidden) continue;
      const m = resolve(scope, n);
      const { min } = childLimits(scope, view, container, n);
      if (m.target.kind !== 'group') {
        if (min > 0) add(n.id, min);
        added += min;
        continue;
      }
      if (open.has(m.target.id)) continue;
      let inGroup = visit(m.children, new Set([...open, m.target.id]));
      if (min > inGroup) {
        const members = [...index.values()].filter((f) => f.groups.includes(m.target.id) && !hidden(f));
        const def = m.target.defaultId ?? n.defaultId;
        // Without a usable default, only a single visible choice is made for the user.
        const pick = members.find((f) => f.node.id === def) ?? (members.length === 1 ? members[0] : undefined);
        if (pick) {
          add(pick.node.id, min - inGroup);
          inGroup = min;
        }
      }
      added += inGroup;
    }
    return added;
  };
  visit(container.merged!.children, new Set());
  return out;
}
