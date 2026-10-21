/**
 * Roster validation against BSData constraints. Browser-safe; never throws on roster content.
 *
 * Checked, in order per force (issues come out by force, then selection, then constraint order):
 * - the force entry's constraints, and each category link's (counting that category in the force);
 * - each category entry in scope that has constraints: per force for force scope, once per roster for roster scope;
 * - each container (the force's root, then every selection depth-first): the `selections` constraints of the
 *   container's non-hidden child nodes, evaluated by the children.ts convention (at the container, as candidates, so
 *   scope `parent` is the container). A force's root children are its root entries whose primary category is one of
 *   the force's, as availableUnits filters them (without availableUnits' unit/role type filter, so Configuration
 *   entries such as Battle Size are checked too). Nodes inside hidden groups are skipped with the group;
 * - every hidden selection (`hidden-selected`): hidden itself, or inside a group that is hidden at its container;
 *   and every unknown one (`unknown-entry`).
 * A limit of -1 means no limit. A constraint that several containers reach with the same count (a roster-wide max on a
 * shared Relic, say) is checked once.
 *
 * Self-scope constraints: childConstraintCount counts 0 for scope `self` in candidate context, so these are checked per
 * existing selection of the node, with `at` = that selection, the selection counting itself (its copies) plus its
 * matching descendants. A node with no selection isn't checked: BattleScribe doesn't check a self-scope min on an
 * unselected entry. (No v9.8.0 file has a self-scope constraint.)
 */
import { childConstraintCount, childConstraints, evaluateCandidate } from './children';
import { childIndex, countIn, countsAs, effectiveConstraints, type EvalContext, type ForceView, type RosterView, type SelView } from './evaluate';
import { availableUnits } from './options';
import { resolve, rootEntriesFor, type Merged, type Scope } from './scope';
import type { Constraint, Fix, Issue, RCategory, RNode, RuleKind } from './types';

const WARLORD = 'Warlord';
/** Most suggested units for an unfilled slot. */
const MAX_SUGGESTIONS = 3;

type Container = SelView | ForceView;
type CountScope = Container | RosterView;
interface Counted { view: SelView; weight: number }

const isSel = (x: CountScope): x is SelView => 'sel' in x;
const isRoster = (x: CountScope): x is RosterView => 'roster' in x;
const forceOf = (x: Container): ForceView => (isSel(x) ? x.force : x);
const fails = (c: Constraint, n: number) => (c.type === 'min' ? n < c.value : n > c.value);
const countOpts = (c: Constraint) => ({ childSel: !!c.childSel, childForces: !!c.childForces, percent: !!c.percent, shared: c.shared !== false });
/** The root selection (the unit) a selection belongs to. */
const unitOf = (s: SelView): SelView => (s.parent ? unitOf(s.parent) : s);

export interface ValidateOptions {
  /** Force-level constraints (force entries, their category links and categories) on these fields aren't checked. */
  ignoreFields?: string[];
}

export function validateConstraints(scope: Scope, view: RosterView, opts: ValidateOptions = {}): Issue[] {
  return new Validator(scope, view, new Set(opts.ignoreFields ?? [])).run();
}

class Validator {
  private readonly issues: Issue[] = [];
  /** Constraint checks already made against the same container and count. */
  private readonly checked = new Set<string>();

  constructor(private readonly scope: Scope, private readonly view: RosterView, private readonly ignoreFields: Set<string>) {}

  run(): Issue[] {
    const categories = categoriesWithConstraints(this.scope);
    for (const fv of this.view.forces) {
      this.forceRules(fv, categories);
      if (fv.entry) this.children(fv, rootEntriesFor(this.scope, fv.force.catalogueId), new Set(fv.entry.cats.map((c) => c.targetId)), new Set());
      fv.selections.forEach((s) => this.selection(s));
    }
    return this.issues;
  }

  // ---------- force level ----------

  private forceRules(fv: ForceView, categories: RCategory[]): void {
    const { scope } = this;
    const ctx: EvalContext = { scope, view: this.view, at: fv };
    if (fv.entry) {
      const entry = fv.entry;
      for (const c of effectiveConstraints(scope, entry, ctx)) {
        const actual = this.forceCount(ctx, c, entry.id);
        if (actual !== null) this.push(fv, c, { rule: 'other', subject: { id: entry.id, name: fv.name }, limit: c.value, actual }, this.scopeContainer(fv, c.scope, false));
      }
      for (const link of entry.cats) {
        const name = scope.category(link.targetId)?.name ?? link.targetId;
        for (const c of effectiveConstraints(scope, link, ctx)) this.categoryRule(ctx, c, link.targetId, name, true);
      }
    }
    for (const cat of categories) for (const c of effectiveConstraints(scope, cat, ctx)) this.categoryRule(ctx, c, cat.id, cat.name, false);
  }

  /** The count when a force-level constraint fails (and wasn't already checked), else null. */
  private forceCount(ctx: EvalContext, c: Constraint, childId: string): number | null {
    if (c.value < 0 || this.ignoreFields.has(c.field) || !this.firstCheck(ctx.at, c, childId, false)) return null;
    const n = countIn(ctx, c.scope, c.field, childId, countOpts(c));
    return fails(c, n) ? n : null;
  }

  private categoryRule(ctx: EvalContext, c: Constraint, catId: string, name: string, slot: boolean): void {
    const actual = this.forceCount(ctx, c, catId);
    if (actual === null) return;
    const fv = ctx.at as ForceView;
    const min = c.type === 'min';
    const rule: RuleKind = name === WARLORD ? (min ? 'warlord-missing' : 'warlord-extra') : slot ? (min ? 'slot-min' : 'slot-max') : 'other';
    const counted = this.counted(this.scopeContainer(fv, c.scope, false), catId, true, !!c.childSel);
    const newest = min ? undefined : counted.at(-1)?.view;
    let fix: Fix | undefined;
    if (rule === 'slot-min') fix = this.suggestUnits(fv, name);
    else if (rule === 'slot-max') fix = removeNewest(counted, actual - c.value, c);
    else if (rule === 'warlord-extra' && newest) fix = { kind: 'open', selId: unitOf(newest).sel.id };
    else if (rule === 'warlord-missing') {
      // Core Book §5: the Warlord must be a CHARACTER only if the army has one, and BSData only offers the Warlord
      // upgrade to such units (or to a model inside them). With no unit that can take it at any depth (a lone Titan or
      // Damned Legionnaires), any model may be the Warlord and there is nothing for the list to record, so nothing is
      // missing. The fix opens the unit that holds the option.
      const candidate = this.warlordCandidate(this.scopeContainer(fv, c.scope, false), catId);
      if (!candidate) return;
      fix = { kind: 'open', selId: candidate.sel.id };
    }
    this.push(fv, c, { rule, selId: newest?.sel.id, subject: { id: catId, name }, limit: c.value, actual, fix }, this.scopeContainer(fv, c.scope, false));
  }

  /** Up to three units the force can take in that role, cheapest first. */
  private suggestUnits(fv: ForceView, role: string): Fix | undefined {
    const units = availableUnits(this.scope, this.view.roster, fv.force.id).filter((u) => u.role === role);
    const entryIds = units.sort((a, b) => a.points - b.points).slice(0, MAX_SUGGESTIONS).map((u) => u.entryId);
    return entryIds.length ? { kind: 'add-unit', forceSelId: fv.force.id, entryIds } : undefined;
  }

  /**
   * The first unit with a visible option that is the Warlord upgrade (by category or name), on the unit itself or on
   * any selection inside it (many units carry it on a model: a Cadian Command Squad's Company Commander, say).
   */
  private warlordCandidate(where: CountScope | null, catId: string): SelView | undefined {
    if (!where) return undefined;
    const units = isRoster(where) ? where.forces.flatMap((f) => f.selections) : isSel(where) ? where.children : where.selections;
    const offers = (s: SelView): boolean =>
      (!!s.merged &&
        [...childIndex(this.scope, s.merged.children).values()].some(({ node }) => {
          const t = evaluateCandidate(this.scope, this.view, s, node);
          return !t.hidden && (t.categories.includes(catId) || t.name === WARLORD);
        })) ||
      s.children.some(offers);
    return units.find(offers);
  }

  // ---------- containers ----------

  /** Checks the child nodes of a container, descending into non-hidden groups. `slots` filters a force's root entries. */
  private children(container: Container, nodes: RNode[], slots: Set<string> | null, open: Set<string>): void {
    for (const n of nodes) {
      const traits = evaluateCandidate(this.scope, this.view, container, n);
      if (traits.hidden) continue;
      const m = resolve(this.scope, n);
      const group = m.target.kind === 'group';
      if (slots && !group && (traits.primary === null || !slots.has(traits.primary))) continue;
      this.childNode(container, n, m, traits.name);
      if (group && !open.has(m.target.id)) this.children(container, m.children, slots, new Set([...open, m.target.id]));
    }
  }

  private childNode(container: Container, n: RNode, m: Merged, name: string): void {
    for (const c of childConstraints(this.scope, this.view, container, n)) {
      if (c.field !== 'selections' || c.value < 0) continue;
      const childId = c.shared !== false ? m.target.id : n.id;
      if (c.scope === 'self') {
        if (m.target.kind !== 'group') this.selfScope(container, n, m, name, c.id, childId);
        continue;
      }
      if (!this.firstCheck(container, c, childId, true)) continue;
      const actual = childConstraintCount(this.scope, this.view, container, n, c);
      if (fails(c, actual)) this.childIssue(container, this.scopeContainer(container, c.scope, true), n, m, name, c, childId, actual);
    }
  }

  private selfScope(container: Container, n: RNode, m: Merged, name: string, constraintId: string, childId: string): void {
    const sels = (isSel(container) ? container.children : container.selections).filter((s) => s.merged && s.sel.entryId === n.id);
    for (const s of sels) {
      const ctx: EvalContext = { scope: this.scope, view: this.view, at: s };
      for (const c of effectiveConstraints(this.scope, s.merged!, ctx)) {
        if (c.id !== constraintId || c.value < 0) continue;
        const opts = countOpts(c);
        const actual = countIn(ctx, 'self', c.field, childId, opts) + (countsAs(this.view, s, childId, opts.shared) ? s.sel.count : 0);
        if (fails(c, actual)) this.childIssue(container, s, n, m, name, c, childId, actual);
      }
    }
  }

  /** `where` is the container the constraint counts in. */
  private childIssue(container: Container, where: CountScope | null, n: RNode, m: Merged, name: string, c: Constraint, childId: string, actual: number): void {
    const root = !isSel(container);
    const group = m.target.kind === 'group';
    const max = c.type === 'max';
    const counted = this.counted(where, childId, c.shared !== false, !!c.childSel);
    const newest = counted.at(-1)?.view;
    const openUnit = (s: SelView | undefined): Fix | undefined => (s ? { kind: 'open', selId: unitOf(s).sel.id } : undefined);
    const addThis: Fix = { kind: 'add-unit', forceSelId: forceOf(container).force.id, entryIds: [n.id] };
    const holder = isSel(container) ? container : undefined;

    let rule: RuleKind;
    let selId = holder?.sel.id;
    let fix: Fix | undefined;
    if (root && !group && (m.type === 'unit' || m.type === 'model')) {
      rule = max && (c.scope === 'roster' || c.scope === 'force') && c.value <= 1 ? 'unique' : 'unit-limit';
      selId = max ? newest?.sel.id : undefined;
      fix = max ? removeNewest(counted, actual - c.value, c) : addThis;
    } else if (m.type === 'model' || (group && onlyModels(this.scope, m))) {
      rule = 'model-count';
      fix = setCountFix(counted, c.value - actual) ?? openUnit(holder);
    } else if (m.type === 'upgrade' || group) {
      rule = max ? 'wargear-max' : 'option-required';
      if (max) {
        selId = (newest?.parent ?? newest ?? holder)?.sel.id;
        fix = openUnit(newest ?? holder);
      } else fix = root ? addThis : openUnit(holder);
    } else rule = 'other';
    this.push(forceOf(container), c, { rule, selId, subject: { id: n.id, name }, limit: c.value, actual, fix }, where);
  }

  // ---------- selections ----------

  private selection(s: SelView): void {
    const base = { forceSelId: s.force.force.id, selId: s.sel.id, subject: { id: s.sel.entryId, name: s.name }, limit: 0, actual: s.sel.count };
    const remove: Fix = { kind: 'remove', selIds: [s.sel.id] };
    if (!s.merged) {
      this.issues.push({ rule: 'unknown-entry', ...base, fix: remove });
      return;
    }
    if (s.hidden || this.inHiddenGroup(s)) this.issues.push({ rule: 'hidden-selected', ...base, fix: remove });
    this.children(s, s.merged.children, null, new Set());
    s.children.forEach((c) => this.selection(c));
  }

  /**
   * Whether a group between the selection's container and its entry is hidden at that container (a Warlord Trait
   * left behind when the Warlord upgrade is removed). A link to a group is evaluated as the link, not its target alone.
   */
  private inHiddenGroup(s: SelView): boolean {
    const container: Container = s.parent ?? s.force;
    const nodes = isSel(container) ? container.merged!.children : rootEntriesFor(this.scope, container.force.catalogueId);
    let prev: RNode | undefined;
    for (const id of childIndex(this.scope, nodes).get(s.sel.entryId)?.groups ?? []) {
      const node = this.scope.node(id);
      const linked = prev?.kind === 'link' && prev.targetId === id;
      prev = node;
      if (node && !linked && evaluateCandidate(this.scope, this.view, container, node).hidden) return true;
    }
    return false;
  }

  // ---------- helpers ----------

  /**
   * The issue's force is its selection's, else (unless the limit is roster-wide) the force being checked. `where` is the
   * container the constraint counts in: the issue's `scope` is its key, except that a limit counting in the whole roster
   * is `roster` and one counting in a detachment is `force` however it was written (scope `parent` on a detachment's root
   * entries, say, or the detachment type's own id).
   */
  private push(fv: ForceView, c: Constraint, issue: Omit<Issue, 'forceSelId' | 'scope'>, where: CountScope | null): void {
    const forceSelId = issue.selId ? this.findForce(issue.selId) : c.scope === 'roster' ? undefined : fv.force.id;
    const out: Issue = { rule: issue.rule, ...(forceSelId ? { forceSelId } : {}), subject: issue.subject, limit: issue.limit, actual: issue.actual, scope: where && isRoster(where) ? 'roster' : where && !isSel(where) ? 'force' : c.scope };
    if (issue.selId) out.selId = issue.selId;
    if (issue.fix) out.fix = issue.fix;
    this.issues.push(out);
  }

  private findForce(selId: string): string | undefined {
    const has = (vs: SelView[]): boolean => vs.some((v) => v.sel.id === selId || has(v.children));
    return this.view.forces.find((f) => has(f.selections))?.force.id;
  }

  /**
   * False when the same constraint was already checked against the same container and count (a roster-wide limit on
   * a shared entry is reached from every unit that offers it). Self scope and unresolvable scopes are never shared.
   */
  private firstCheck(at: Container, c: Constraint, childId: string, candidate: boolean): boolean {
    const where = this.scopeContainer(at, c.scope, candidate);
    if (!where || c.scope === 'self') return true;
    const id = isRoster(where) ? 'roster' : isSel(where) ? `s:${where.sel.id}` : `f:${where.force.id}`;
    const key = `${id}\n${childId}\n${c.id}\n${c.value}`;
    if (this.checked.has(key)) return false;
    this.checked.add(key);
    return true;
  }

  /** The container a scope key names (as evaluate.ts resolves it; an unselected candidate's own scope is null here). */
  private scopeContainer(at: Container, key: string, candidate: boolean): CountScope | null {
    const atSel = isSel(at) ? at : null;
    switch (key) {
      case 'self':
        return candidate ? null : at;
      case 'parent':
        return candidate || !atSel ? at : (atSel.parent ?? atSel.force);
      case 'force':
        return forceOf(at);
      case 'roster':
        return this.view;
      default: {
        for (let s = atSel; s; s = s.parent) if (s.merged?.ids.includes(key)) return s;
        return forceOf(at).force.forceId === key ? forceOf(at) : null;
      }
    }
  }

  /** The selections a `selections` count in `where` includes, in roster order, with their weights (copies). */
  private counted(where: CountScope | null, childId: string, shared: boolean, childSel: boolean): Counted[] {
    const out: Counted[] = [];
    if (!where) return out;
    const visit = (vs: SelView[], copies: number) => {
      for (const s of vs) {
        if (!s.merged) continue;
        const weight = copies * s.sel.count;
        if (countsAs(this.view, s, childId, shared)) out.push({ view: s, weight });
        if (childSel) visit(s.children, weight);
      }
    };
    visit(isRoster(where) ? where.forces.flatMap((f) => f.selections) : isSel(where) ? where.children : where.selections, 1);
    return out;
  }
}

/** Scope order: the first file defining a category wins. */
function categoriesWithConstraints(scope: Scope): RCategory[] {
  const seen = new Set<string>();
  const out: RCategory[] = [];
  for (const f of scope.files) {
    for (const c of f.categories) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      if (c.constraints?.length) out.push(c);
    }
  }
  return out;
}

/** A group whose selectable entries are all models. */
function onlyModels(scope: Scope, m: Merged): boolean {
  const entries = [...childIndex(scope, m.children).values()];
  return entries.length > 0 && entries.every(({ node }) => resolve(scope, node).type === 'model');
}

/**
 * Removes the newest counted selections until the excess is gone; when the newest stack alone has copies to spare, it
 * shrinks instead. No fix for percentage or cost limits (selection counts can't measure those).
 */
function removeNewest(counted: Counted[], excess: number, c: Constraint): Fix | undefined {
  if (c.percent || c.field !== 'selections') return undefined;
  const last = counted.at(-1);
  if (last && last.weight > excess) {
    const drop = Math.ceil(excess / (last.weight / last.view.sel.count));
    if (drop < last.view.sel.count) return { kind: 'set-count', selId: last.view.sel.id, count: last.view.sel.count - drop };
  }
  const selIds: string[] = [];
  let removed = 0;
  for (let i = counted.length - 1; i >= 0 && removed < excess; i--) {
    selIds.unshift(counted[i].view.sel.id);
    removed += counted[i].weight;
  }
  return selIds.length ? { kind: 'remove', selIds } : undefined;
}

/** Changes the newest counted stack by `delta` copies' worth, when that leaves it at least one copy. */
function setCountFix(counted: Counted[], delta: number): Fix | undefined {
  const last = counted.at(-1);
  if (!last) return undefined;
  const perCopy = last.weight / last.view.sel.count;
  if (delta % perCopy !== 0) return undefined;
  const count = last.view.sel.count + delta / perCopy;
  return count >= 1 ? { kind: 'set-count', selId: last.view.sel.id, count } : undefined;
}
