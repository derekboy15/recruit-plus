/**
 * Child nodes: a child node (entry, link or group) of a container is evaluated at the container (the holding selection,
 * or the force for root entries) as an unselected candidate, so scope `parent` is the container. Edits, option queries
 * and the validator all use these. Browser-safe.
 */
import { countIn, effectiveConstraints, nodeTraits, type EvalContext, type ForceView, type NodeTraits, type RosterView, type SelView } from './evaluate';
import { resolve, type Scope } from './scope';
import type { Constraint, RNode } from './types';

export function childContext(scope: Scope, view: RosterView, container: SelView | ForceView, node: RNode): EvalContext {
  return { scope, view, at: container, candidate: resolve(scope, node) };
}

/** Effective name, hidden, categories and cost of one copy of a child node before it is selected. */
export function evaluateCandidate(scope: Scope, view: RosterView, container: SelView | ForceView, node: RNode): NodeTraits {
  const ctx = childContext(scope, view, container, node);
  return nodeTraits(ctx, ctx.candidate!);
}

/** A child node's constraints with its constraint modifiers applied. */
export function childConstraints(scope: Scope, view: RosterView, container: SelView | ForceView, node: RNode): Constraint[] {
  const ctx = childContext(scope, view, container, node);
  return effectiveConstraints(scope, ctx.candidate!, ctx);
}

/**
 * What a child node's constraint counts: selections of its resolved target (through any link) when shared, else only
 * selections made through the node itself. A group's constraint counts the selections inside the group.
 */
export function childConstraintCount(scope: Scope, view: RosterView, container: SelView | ForceView, node: RNode, c: Constraint): number {
  const ctx = childContext(scope, view, container, node);
  const shared = c.shared !== false;
  const childId = shared ? ctx.candidate!.target.id : node.id;
  return countIn(ctx, c.scope, c.field, childId, { childSel: !!c.childSel, childForces: !!c.childForces, percent: !!c.percent, shared });
}

/** How many of a child node the container may hold: its effective parent-scope selection limits. max -1 = no limit. */
export function childLimits(scope: Scope, view: RosterView, container: SelView | ForceView, node: RNode): { min: number; max: number } {
  let min = 0;
  let max = -1;
  for (const c of childConstraints(scope, view, container, node)) {
    if (c.field !== 'selections' || c.scope !== 'parent' || c.percent || c.value < 0) continue;
    if (c.type === 'min') min = Math.max(min, c.value);
    else max = max === -1 ? c.value : Math.min(max, c.value);
  }
  return { min, max };
}
