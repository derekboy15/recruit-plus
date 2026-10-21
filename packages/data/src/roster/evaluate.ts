/**
 * Roster engine: evaluates BSData modifiers, conditions, repeats and costs over a user's roster.
 * Browser-safe. Evaluation never throws on roster content: unknown ids become "Unknown item" selections.
 */
import { resolve, rootEntriesFor, type Merged, type Scope } from './scope';
import {
  COST_CP,
  COST_PL,
  COST_PTS,
  type CatLink,
  type Cond,
  type CondGroup,
  type Constraint,
  type CostMap,
  type ForceSel,
  type Mod,
  type RCategory,
  type RForce,
  type RNode,
  type Repeat,
  type Roster,
  type Sel,
} from './types';

export interface SelView {
  sel: Sel; merged: Merged | null; parent: SelView | null; force: ForceView;
  name: string; type: 'unit' | 'model' | 'upgrade'; hidden: boolean;
  categories: string[]; primary: string | null;
  own: CostMap;    // effective cost of one copy × sel.count
  total: CostMap;  // own + children totals × sel.count
  models: number;  // model copies in this subtree (1 per copy for a model-type unit)
  children: SelView[];
}
export interface ForceView { force: ForceSel; entry: RForce | null; name: string; hidden: boolean; selections: SelView[]; total: CostMap }
export interface RosterView { roster: Roster; forces: ForceView[]; total: CostMap; unknown: { selId: string; entryId: string }[] }

/**
 * Where an owner's modifiers, conditions and constraints are evaluated.
 * - `at` a SelView: that selection's own node (self = at, parent = its parent selection or force).
 * - `at` a ForceView: a force-level owner (the force entry or its category links); self = parent = the force.
 * - `candidate` set: an unselected option or root entry being considered for the container `at`
 *   (self = the empty candidate, parent = at).
 */
export interface EvalContext { scope: Scope; view: RosterView; at: SelView | ForceView; candidate?: Merged }
/** shared (default true): a childId matches through any link to it; false: only selections made through that exact node. */
export interface CountOpts { childSel: boolean; childForces: boolean; percent?: boolean; shared?: boolean }

const KNOWN_COST_TYPES = new Set([COST_PTS, COST_PL, COST_CP]);
const UNKNOWN_NAME = 'Unknown item';
const MAX_CATEGORY_PASSES = 5;

/** The (empty) subtree of an unselected candidate. */
const EMPTY = { empty: true } as const;
type Container = SelView | ForceView | RosterView | typeof EMPTY;
const isEmpty = (x: Container): x is typeof EMPTY => x === EMPTY;

interface State {
  /** Count memo per container, reset whenever categories or costs change. */
  memo: WeakMap<object, Map<string, number>>;
  /** Group ids (link and target) between each selection's entry and its parent's node. */
  groups: WeakMap<SelView, string[]>;
}
const states = new WeakMap<RosterView, State>();
function stateOf(view: RosterView): State {
  let s = states.get(view);
  if (!s) states.set(view, (s = { memo: new WeakMap(), groups: new WeakMap() }));
  return s;
}

const isSel = (x: object): x is SelView => 'sel' in x;
const isForce = (x: object): x is ForceView => 'entry' in x;
const isRoster = (x: object): x is RosterView => 'roster' in x;

// ---------- child lookup ----------

/** A selectable child node and the group ids (link and target) between it and its container, innermost first. */
export interface Found { node: RNode; groups: string[] }
const childIndexes = new WeakMap<RNode[], Map<string, Found>>();

/** Selectable entries among `nodes`, looking inside groups (and links to groups) recursively. */
export function childIndex(scope: Scope, nodes: RNode[]): Map<string, Found> {
  let index = childIndexes.get(nodes);
  if (index) return index;
  const out = new Map<string, Found>();
  const visit = (ns: RNode[], groups: string[], open: Set<string>) => {
    for (const n of ns) {
      const m = resolve(scope, n);
      if (m.target.kind === 'group') {
        if (open.has(m.target.id)) continue; // a group that links back into itself
        visit(m.children, [...m.ids, ...groups], new Set([...open, m.target.id]));
      } else if (!out.has(n.id)) out.set(n.id, { node: n, groups });
    }
  };
  visit(nodes, [], new Set());
  childIndexes.set(nodes, (index = out));
  return index;
}

// ---------- evaluate ----------

export function evaluate(scope: Scope, roster: Roster): RosterView {
  const view: RosterView = { roster, forces: [], total: {}, unknown: [] };
  const state = stateOf(view);
  const known: SelView[] = [];
  const baseCats = new Map<SelView, { categories: string[]; primary: string | null }>();

  const build = (sel: Sel, index: Map<string, Found>, parent: SelView | null, force: ForceView): SelView => {
    const found = index.get(sel.entryId);
    const merged = found ? resolve(scope, found.node) : null;
    const v: SelView = {
      sel, merged, parent, force,
      name: merged?.name ?? UNKNOWN_NAME,
      type: merged?.type ?? 'upgrade',
      hidden: merged?.hidden ?? false,
      categories: [], primary: null, own: {}, total: {}, models: 0, children: [],
    };
    if (!found || !merged) {
      view.unknown.push({ selId: sel.id, entryId: sel.entryId });
      return v;
    }
    known.push(v);
    state.groups.set(v, found.groups);
    const base = categoriesOf(merged.cats);
    baseCats.set(v, base);
    Object.assign(v, base);
    const kids = childIndex(scope, merged.children);
    v.children = (sel.children ?? []).map((c) => build(c, kids, v, force));
    return v;
  };

  for (const f of roster.forces ?? []) {
    const entry = scope.force(f.forceId) ?? null;
    const fv: ForceView = { force: f, entry, name: entry?.name ?? 'Unknown detachment', hidden: !!entry?.hidden, selections: [], total: {} };
    view.forces.push(fv);
    const roots = childIndex(scope, rootEntriesFor(scope, f.catalogueId));
    fv.selections = (f.selections ?? []).map((s) => build(s, roots, null, fv));
  }

  // Cost conditions met while modifiers are being evaluated see unmodified costs.
  totals(view, (v) => v.merged!.costs);

  // Categories feed counts and counts feed category modifiers: iterate to a fixed point.
  const withCategoryMods = known.filter((v) => v.merged!.mods.some((m) => m.field === 'category'));
  for (let pass = 0; pass < MAX_CATEGORY_PASSES && withCategoryMods.length; pass++) {
    state.memo = new WeakMap();
    const next = withCategoryMods.map((v) => applyCategoryMods({ scope, view, at: v }, v.merged!.mods, baseCats.get(v)!));
    let changed = false;
    withCategoryMods.forEach((v, i) => {
      const n = next[i];
      if (n.primary !== v.primary || n.categories.join('\n') !== v.categories.join('\n')) changed = true;
      v.categories = n.categories;
      v.primary = n.primary;
    });
    if (!changed) break;
  }

  // Everything else, once, after categories settle.
  state.memo = new WeakMap();
  const unitCosts = new Map<SelView, CostMap>();
  for (const v of known) {
    const ctx: EvalContext = { scope, view, at: v };
    const m = v.merged!;
    v.name = applyName(ctx, m.mods, m.name);
    v.hidden = applyHidden(ctx, m.mods, m.hidden);
    unitCosts.set(v, applyCosts(ctx, m));
  }
  for (const fv of view.forces) {
    if (!fv.entry) continue;
    const ctx: EvalContext = { scope, view, at: fv };
    fv.name = applyName(ctx, fv.entry.mods ?? [], fv.entry.name);
    fv.hidden = applyHidden(ctx, fv.entry.mods ?? [], !!fv.entry.hidden);
  }
  totals(view, (v) => unitCosts.get(v)!);
  state.memo = new WeakMap();
  return view;
}

function categoriesOf(cats: CatLink[]): { categories: string[]; primary: string | null } {
  const categories: string[] = [];
  let primary: string | null = null;
  for (const c of cats) {
    if (!categories.includes(c.targetId)) categories.push(c.targetId);
    if (c.primary && primary === null) primary = c.targetId;
  }
  return { categories, primary };
}

/** Writes own, total and models bottom-up from each known selection's cost of one copy. */
function totals(view: RosterView, unitCost: (v: SelView) => CostMap): void {
  const walk = (v: SelView): void => {
    v.children.forEach(walk);
    if (!v.merged) {
      v.own = {};
      v.total = {};
      v.models = 0;
      return;
    }
    const count = v.sel.count;
    v.own = scaled(unitCost(v), count);
    v.total = add(v.own, scaled(sum(v.children.map((c) => c.total)), count));
    v.models = v.type === 'model' ? count : count * v.children.reduce((n, c) => n + c.models, 0);
  };
  for (const fv of view.forces) {
    fv.selections.forEach(walk);
    fv.total = sum(fv.selections.map((s) => s.total));
  }
  view.total = sum(view.forces.map((f) => f.total));
}

/** Cost maps keep only non-zero entries. */
function clean(m: CostMap): CostMap {
  const out: CostMap = {};
  for (const [k, v] of Object.entries(m)) if (v !== 0) out[k] = v;
  return out;
}
const scaled = (m: CostMap, k: number): CostMap => clean(Object.fromEntries(Object.entries(m).map(([t, v]) => [t, v * k])));
const add = (a: CostMap, b: CostMap): CostMap => sum([a, b]);
function sum(maps: CostMap[]): CostMap {
  const out: CostMap = {};
  for (const m of maps) for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v;
  return clean(out);
}

// ---------- modifiers ----------

/** How many times a modifier applies: 0 when its conditions fail, its repeat multiplier when it has repeats, else 1. */
function applications(ctx: EvalContext, mod: Mod): number {
  if (mod.when && !checkGroup(ctx, mod.when)) return 0;
  return mod.repeats?.length ? multiplier(ctx, mod.repeats) : 1;
}

function multiplier(ctx: EvalContext, repeats: Repeat[]): number {
  let n = 0;
  for (const r of repeats) {
    if (r.value === 0) continue;
    const container = containerFor(ctx, r.scope);
    const opts = { childSel: !!r.childSel, childForces: !!r.childForces, shared: r.shared !== false };
    const count = container ? countInContainer(ctx, container, r.field, r.childId, opts) : 0;
    n += (r.roundUp ? Math.ceil : Math.floor)(count / r.value) * r.repeats;
  }
  return n;
}

/** set assigns; increment/decrement add or subtract the value once per application. Non-numeric values are ignored. */
function applyNumber(current: number, mod: Mod, times: number): number {
  const v = Number(mod.value);
  if (times <= 0 || Number.isNaN(v)) return current;
  if (mod.type === 'set') return v;
  if (mod.type === 'increment') return current + v * times;
  if (mod.type === 'decrement') return current - v * times;
  return current;
}

function applyCategoryMods(ctx: EvalContext, mods: Mod[], base: { categories: string[]; primary: string | null }) {
  let categories = [...base.categories];
  let primary = base.primary;
  for (const m of mods) {
    if (m.field !== 'category' || applications(ctx, m) <= 0) continue;
    const id = m.value;
    if (m.type === 'add' || m.type === 'set-primary') {
      if (!categories.includes(id)) categories.push(id);
      if (m.type === 'set-primary') primary = id;
    } else if (m.type === 'remove') {
      categories = categories.filter((c) => c !== id);
      if (primary === id) primary = null;
    } else if (m.type === 'unset-primary' && primary === id) primary = null;
  }
  return { categories, primary };
}

function applyName(ctx: EvalContext, mods: Mod[], name: string): string {
  for (const m of mods) {
    if (m.field !== 'name') continue;
    const times = applications(ctx, m);
    if (times <= 0) continue;
    if (m.type === 'set') name = m.value;
    else if (m.type === 'append') for (let i = 0; i < times; i++) name = `${name} ${m.value}`;
  }
  return name;
}

function applyHidden(ctx: EvalContext, mods: Mod[], hidden: boolean): boolean {
  for (const m of mods) if (m.field === 'hidden' && m.type === 'set' && applications(ctx, m) > 0) hidden = m.value === 'true';
  return hidden;
}

/** Cost of one copy after modifiers. A field counts as a cost type when it is a known one or already costed on the node. */
function applyCosts(ctx: EvalContext, m: Merged): CostMap {
  const costs: CostMap = { ...m.costs };
  for (const mod of m.mods) {
    if (!KNOWN_COST_TYPES.has(mod.field) && !(mod.field in m.costs)) continue;
    const times = applications(ctx, mod);
    if (times > 0) costs[mod.field] = applyNumber(costs[mod.field] ?? 0, mod, times);
  }
  return costs;
}

/** The owner's constraints with its constraint modifiers applied. Constraints whose scope doesn't exist here are skipped. */
export function effectiveConstraints(_scope: Scope, owner: Merged | RForce | CatLink | RCategory, ctx: EvalContext): Constraint[] {
  const mods = owner.mods ?? [];
  const out: Constraint[] = [];
  for (const c of owner.constraints ?? []) {
    if (!containerFor(ctx, c.scope)) continue;
    let value = c.value;
    for (const m of mods) if (m.field === c.id) value = applyNumber(value, m, applications(ctx, m));
    out.push(value === c.value ? c : { ...c, value });
  }
  return out;
}

// ---------- scopes and counting ----------

/** The container a scope key names from `ctx`, or null when it doesn't exist (or the key is only meaningful for instanceOf). */
function containerFor(ctx: EvalContext, key: string): Container | null {
  const { at, candidate, view } = ctx;
  const atSel = isSel(at) ? at : null;
  const atForce = atSel ? atSel.force : (at as ForceView);
  switch (key) {
    case 'self':
      return candidate ? EMPTY : at;
    case 'parent':
      return candidate || !atSel ? at : (atSel.parent ?? atSel.force);
    case 'force':
      return atForce;
    case 'roster':
      return view;
    case 'ancestor':
    case 'primary-catalogue':
      return null;
    default: {
      if (candidate?.ids.includes(key)) return EMPTY;
      for (let s = atSel; s; s = s.parent) if (s.merged?.ids.includes(key)) return s;
      return atForce.force.forceId === key ? atForce : null;
    }
  }
}

export function countIn(ctx: EvalContext, scopeKey: string, field: string, childId: string, opts: CountOpts): number {
  const container = containerFor(ctx, scopeKey);
  return container ? countInContainer(ctx, container, field, childId, opts) : 0;
}

function countInContainer(ctx: EvalContext, container: Container, field: string, childId: string, opts: CountOpts): number {
  if (isEmpty(container)) return 0;
  if (field === 'forces') {
    if (!isRoster(container)) return 0;
    return container.forces.filter((f) => childId === 'any' || f.force.forceId === childId).length;
  }
  const raw = sumIn(ctx.view, container, field, childId, opts.childSel, opts.shared !== false);
  if (!opts.percent) return raw;
  const all = sumIn(ctx.view, container, field, 'any', opts.childSel, true);
  return all === 0 ? 0 : (raw * 100) / all;
}

/**
 * Selections field: Σ count × (copies of ancestors below the container) over matching selections.
 * Cost field: Σ total[field] × (copies of ancestors below the container) over matching selections; a matching
 * selection's total already includes its subtree, so the walk doesn't descend into it (nothing counts twice).
 */
function sumIn(view: RosterView, container: SelView | ForceView | RosterView, field: string, childId: string, childSel: boolean, shared: boolean): number {
  const state = stateOf(view);
  let memo = state.memo.get(container);
  if (!memo) state.memo.set(container, (memo = new Map()));
  const key = `${field}\n${childId}\n${childSel ? 1 : 0}${shared ? 1 : 0}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const isCost = field !== 'selections';
  let n = 0;
  const visit = (vs: SelView[], copies: number) => {
    for (const s of vs) {
      if (!s.merged) continue;
      const weight = copies * s.sel.count;
      if (matches(state, s, childId, shared)) {
        if (isCost) {
          n += copies * (s.total[field] ?? 0);
          continue;
        }
        n += weight;
      }
      if (childSel) visit(s.children, weight);
    }
  };
  const top = isRoster(container) ? container.forces.flatMap((f) => f.selections) : isForce(container) ? container.selections : container.children;
  visit(top, 1);
  memo.set(key, n);
  return n;
}

/** Whether a (known) selection counts towards childId, exactly as counts and constraints match it. */
export function countsAs(view: RosterView, s: SelView, childId: string, shared: boolean): boolean {
  return !!s.merged && matches(stateOf(view), s, childId, shared);
}

/** Not shared: an entry id matches only the selection's own node (never a link through its target id). */
function matches(state: State, s: SelView, childId: string, shared: boolean): boolean {
  return (
    childId === 'any' ||
    childId === s.type ||
    (shared ? s.merged!.ids.includes(childId) : s.sel.entryId === childId) ||
    s.categories.includes(childId) ||
    (state.groups.get(s)?.includes(childId) ?? false)
  );
}

// ---------- conditions ----------

function checkGroup(ctx: EvalContext, g: CondGroup): boolean {
  const results = [...g.conds.map((c) => () => checkCond(ctx, c)), ...g.groups.map((sub) => () => checkGroup(ctx, sub))];
  if (!results.length) return true;
  return g.type === 'or' ? results.some((r) => r()) : results.every((r) => r());
}

export function checkCond(ctx: EvalContext, c: Cond): boolean {
  if (c.type === 'instanceOf' || c.type === 'notInstanceOf') {
    const is = instanceOf(ctx, c.scope, c.childId);
    if (is === null) return false;
    return c.type === 'instanceOf' ? is : !is;
  }
  const container = containerFor(ctx, c.scope);
  if (!container) return false;
  const opts = { childSel: !!c.childSel, childForces: !!c.childForces, percent: !!c.percent, shared: c.shared !== false };
  const n = countInContainer(ctx, container, c.field, c.childId, opts);
  switch (c.type) {
    case 'lessThan': return n < c.value;
    case 'greaterThan': return n > c.value;
    case 'equalTo': return n === c.value;
    case 'notEqualTo': return n !== c.value;
    case 'atLeast': return n >= c.value;
    case 'atMost': return n <= c.value;
    default: return false;
  }
}

/** A selection is an instance of its entry ids and its effective categories; a force of its force entry id. */
function isInstance(x: SelView | ForceView, childId: string): boolean {
  if (isSel(x)) return (x.merged?.ids.includes(childId) ?? false) || x.categories.includes(childId);
  return x.force.forceId === childId;
}

const candidateIs = (m: Merged, childId: string) => m.ids.includes(childId) || m.cats.some((c) => c.targetId === childId);

/** instanceOf for a scope key; null when the scope doesn't exist (the condition is then false either way). */
function instanceOf(ctx: EvalContext, key: string, childId: string): boolean | null {
  const { at, candidate, view } = ctx;
  // An allied detachment is built as an army of its own catalogue (e.g. an Arks of Omen allied Agents Patrol).
  if (key === 'primary-catalogue') return (isSel(at) ? at.force : (at as ForceView)).force.catalogueId === childId;
  if (key === 'ancestor') {
    if (!candidate && !isSel(at)) return false; // a force-level owner has no ancestors
    const atSel = isSel(at) ? at : null;
    for (let s = candidate ? atSel : atSel!.parent; s; s = s.parent) if (isInstance(s, childId)) return true;
    return isInstance(atSel ? atSel.force : (at as ForceView), childId);
  }
  const container = containerFor(ctx, key);
  if (!container) return null;
  if (isEmpty(container)) return candidateIs(candidate!, childId);
  if (isRoster(container)) return container.roster.catalogueId === childId;
  return isInstance(container, childId);
}

export interface NodeTraits { name: string; hidden: boolean; categories: string[]; primary: string | null; costs: CostMap }

/** A node's effective name, hidden, categories and cost of one copy, evaluated at ctx (see children.ts for candidates). */
export function nodeTraits(ctx: EvalContext, m: Merged): NodeTraits {
  return {
    name: applyName(ctx, m.mods, m.name),
    hidden: applyHidden(ctx, m.mods, m.hidden),
    ...applyCategoryMods(ctx, m.mods, categoriesOf(m.cats)),
    costs: applyCosts(ctx, m),
  };
}
