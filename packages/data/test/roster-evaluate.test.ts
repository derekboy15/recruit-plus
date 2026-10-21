import { test, expect, describe } from 'vitest';
import {
  buildScope,
  checkCond,
  countIn,
  effectiveConstraints,
  evaluate,
  resolve,
  rootEntriesFor,
  COST_PL,
  COST_PTS,
  type Cond,
  type EvalContext,
  type ForceSel,
  type Roster,
  type RosterView,
  type Scope,
  type Sel,
  type SelView,
} from '../src/roster';
import * as M from './fixtures/roster/mini';
import { realCatalogueId, realScope } from './helpers/realScope';

const scope = buildScope(M.miniFiles);

let seq = 0;
const sel = (entryId: string, count = 1, children: Sel[] = []): Sel => ({ id: `sel-${++seq}`, entryId, count, children });
const force = (selections: Sel[], forceId = M.FORCE_PATROL, catalogueId = M.CAT_ID): ForceSel => ({ id: `force-${++seq}`, forceId, catalogueId, selections });
const roster = (...forces: ForceSel[]): Roster => ({ schema: 1, name: 'Test', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces });
const warriors = (models: number, count = 1) => sel(M.L_WARRIORS, count, [sel(M.L_WARRIOR_MODEL, models, [sel(M.L_GAUSS)])]);
const lord = (...children: Sel[]) => sel(M.L_LORD, 1, children);

function find(view: RosterView, selId: string): SelView {
  const walk = (vs: SelView[]): SelView | undefined => {
    for (const v of vs) {
      if (v.sel.id === selId) return v;
      const hit = walk(v.children);
      if (hit) return hit;
    }
  };
  const hit = walk(view.forces.flatMap((f) => f.selections));
  if (!hit) throw new Error(`no view for ${selId}`);
  return hit;
}
const ctxAt = (view: RosterView, at: SelView): EvalContext => ({ scope, view, at });
const opts = (childSel: boolean) => ({ childSel, childForces: false });

describe('scope', () => {
  test('first id wins across files in scope order', () => {
    const shadow = { ...M.system, rootEntries: [{ id: M.E_WARRIORS, kind: 'entry' as const, name: 'Shadow' }] };
    expect(buildScope([M.catalogue, M.library, shadow]).node(M.E_WARRIORS)?.name).toBe('Warriors');
    expect(scope.system.id).toBe(M.SYSTEM_ID);
    expect(scope.catalogue(M.LIB_ID)?.name).toBe('Mini Library');
    expect(scope.category(M.CAT_HQ)?.name).toBe('HQ');
    expect(scope.force(M.FORCE_PATROL)?.name).toBe('Patrol Detachment');
  });

  test('rootEntriesFor: catalogue, imported root entries, then system', () => {
    expect(rootEntriesFor(scope, M.CAT_ID).map((n) => n.id)).toEqual([M.L_WARRIORS, M.L_LORD, M.L_SQUAD, M.L_IMP, M.L_HORDE, M.E_BEAST, M.E_PACT]);
  });

  test('parentGroups lists enclosing groups innermost first, up to the nearest entry', () => {
    expect(scope.parentGroups(M.L_WARRIOR_MODEL)).toEqual([M.G_WARRIORS]);
    expect(scope.parentGroups(M.E_PLASMA)).toEqual([M.G_SQUAD_WEAPON]);
    expect(scope.parentGroups(M.E_WARRIOR_MODEL)).toEqual([]);
  });

  test('resolve merges link over target', () => {
    const m = resolve(scope, scope.node(M.L_WARRIORS)!);
    expect(m.ids).toEqual([M.L_WARRIORS, M.E_WARRIORS]);
    expect(m.type).toBe('unit');
    expect(m.cats.map((c) => c.targetId)).toEqual([M.CAT_TROOPS]);
    expect(m.mods).toHaveLength(2);
    expect(m.children.map((c) => c.id)).toEqual([M.G_WARRIORS]);
    expect(resolve(scope, scope.node(M.E_GAUSS)!).ids).toEqual([M.E_GAUSS]);
  });
});

describe('evaluate', () => {
  test('10 warriors cost 110 pts and 6 PL', () => {
    const w = warriors(10);
    const view = evaluate(scope, roster(force([w])));
    expect(view.total).toEqual({ [COST_PTS]: 110, [COST_PL]: 6 });
    expect(find(view, w.id).own).toEqual({ [COST_PL]: 6 });
    expect(find(view, w.id).models).toBe(10);
    expect(view.unknown).toEqual([]);
  });

  test('11 warriors cost 121 pts and 12 PL', () => {
    const view = evaluate(scope, roster(force([warriors(11)])));
    expect(view.total).toEqual({ [COST_PTS]: 121, [COST_PL]: 12 });
  });

  test('link costs override target costs per type', () => {
    expect(resolve(scope, scope.node(M.L_LORD_BLADE)!).costs).toEqual({ [COST_PTS]: 5, [COST_PL]: 1 });
    expect(resolve(scope, scope.node(M.L_LORD_CLAWS)!).costs).toEqual({ [COST_PTS]: 0, [COST_PL]: 1 });
    const blade = sel(M.L_LORD_BLADE);
    const l = lord(blade);
    const view = evaluate(scope, roster(force([l])));
    expect(find(view, blade.id).own).toEqual({ [COST_PTS]: 5, [COST_PL]: 1 });
    expect(find(view, l.id).total).toEqual({ [COST_PTS]: 85, [COST_PL]: 6 });
    const claws = sel(M.L_LORD_CLAWS);
    expect(find(evaluate(scope, roster(force([lord(claws)]))), claws.id).own).toEqual({ [COST_PL]: 1 });
  });

  test('count multiplies through ancestor copies', () => {
    const w = warriors(10);
    const twice = warriors(10, 2);
    const view = evaluate(scope, roster(force([w, twice])));
    expect(countIn(ctxAt(view, find(view, w.id)), 'self', 'selections', M.E_GAUSS, opts(true))).toBe(10);
    expect(countIn(ctxAt(view, find(view, w.id)), 'roster', 'selections', M.E_GAUSS, opts(true))).toBe(30);
    expect(find(view, twice.id).total).toEqual({ [COST_PTS]: 220, [COST_PL]: 12 });
  });

  test('childSel false counts only direct children', () => {
    const w = warriors(10);
    const view = evaluate(scope, roster(force([w])));
    const ctx = ctxAt(view, find(view, w.id));
    expect(countIn(ctx, 'self', 'selections', M.E_GAUSS, opts(false))).toBe(0);
    expect(countIn(ctx, 'self', 'selections', 'model', opts(false))).toBe(10);
    expect(countIn(ctx, 'parent', 'selections', M.CAT_TROOPS, opts(false))).toBe(1);
    expect(countIn(ctx, 'parent', 'selections', 'model', opts(false))).toBe(0);
  });

  test('a group owner counts selections of entries inside it', () => {
    const w = warriors(12);
    const view = evaluate(scope, roster(force([w])));
    expect(countIn(ctxAt(view, find(view, w.id)), 'self', 'selections', M.G_WARRIORS, opts(false))).toBe(12);
  });

  test('shared counts every link to a target; shared false counts only the named node', () => {
    // Blade and Claws are two links to the same target (E_BLADE).
    const l = lord(sel(M.L_LORD_BLADE), sel(M.L_LORD_CLAWS));
    const view = evaluate(scope, roster(force([l])));
    const ctx = ctxAt(view, find(view, l.id));
    expect(countIn(ctx, 'self', 'selections', M.E_BLADE, opts(false))).toBe(2);
    expect(countIn(ctx, 'self', 'selections', M.E_BLADE, { ...opts(false), shared: false })).toBe(0);
    expect(countIn(ctx, 'self', 'selections', M.L_LORD_CLAWS, opts(false))).toBe(1);
    expect(countIn(ctx, 'self', 'selections', M.L_LORD_CLAWS, { ...opts(false), shared: false })).toBe(1);
    // Groups and categories still match with shared false.
    expect(countIn(ctx, 'self', 'selections', M.G_LORD_MELEE, { ...opts(false), shared: false })).toBe(2);
    expect(countIn(ctx, 'parent', 'selections', M.CAT_HQ, { ...opts(false), shared: false })).toBe(1);
    // Conditions and repeats carry the flag through.
    const cond = (shared?: false): Cond => ({ type: 'atLeast', field: 'selections', scope: 'self', childId: M.E_BLADE, value: 1, ...(shared === false ? { shared } : {}) });
    expect(checkCond(ctx, cond())).toBe(true);
    expect(checkCond(ctx, cond(false))).toBe(false);
  });

  test('a repeat with shared false counts only its own node', () => {
    const files = structuredClone(M.miniFiles);
    const horde = files[0].shared.find((n) => n.id === M.E_HORDE)!;
    // +10 pts per Horde model selected through the link (shared) vs. per selection of the target entry id (not shared).
    horde.mods = [
      { type: 'increment', field: COST_PTS, value: '10', repeats: [{ field: 'selections', scope: 'self', childId: M.E_HORDE_MODEL, value: 1, repeats: 1, childSel: true }] },
      { type: 'increment', field: COST_PTS, value: '100', repeats: [{ field: 'selections', scope: 'self', childId: M.E_HORDE_MODEL, value: 1, repeats: 1, childSel: true, shared: false }] },
    ];
    const s = buildScope(files);
    const h = sel(M.L_HORDE, 1, [sel(M.L_HORDE_MODEL, 3)]);
    expect(find(evaluate(s, roster(force([h]))), h.id).own[COST_PTS]).toBe(30);
  });

  test('add category modifier makes Lord count as Warlord', () => {
    const plain = evaluate(scope, roster(force([lord()])));
    const anyCtx = (view: RosterView) => ctxAt(view, view.forces[0].selections[0]);
    expect(countIn(anyCtx(plain), 'roster', 'selections', M.CAT_WARLORD, opts(true))).toBe(0);
    const l = lord(sel(M.E_WARLORD_UPG));
    const view = evaluate(scope, roster(force([l])));
    expect(countIn(anyCtx(view), 'roster', 'selections', M.CAT_WARLORD, opts(true))).toBe(1);
    expect(find(view, l.id).categories).toEqual([M.CAT_HQ, M.CAT_CHARACTER, M.CAT_WARLORD]);
    expect(find(view, l.id).primary).toBe(M.CAT_HQ);
  });

  test('category modifiers reach a fixed point', () => {
    // Warriors come first and their Bodyguard modifier depends on the Warlord category the Lord's modifier adds.
    const w = warriors(10);
    const view = evaluate(scope, roster(force([w, lord(sel(M.E_WARLORD_UPG))])));
    expect(find(view, w.id).categories).toContain(M.CAT_BODYGUARD);
    const w2 = warriors(10);
    expect(find(evaluate(scope, roster(force([w2, lord()]))), w2.id).categories).not.toContain(M.CAT_BODYGUARD);
  });

  test('repeat applies floor(count/value)×repeats times', () => {
    // +10 pts per full 3 models, 2 repeats each: 7 models → 2×2 applications; 9 → 3×2. A repeat with value 0 never applies.
    const h7 = sel(M.L_HORDE, 1, [sel(M.L_HORDE_MODEL, 7)]);
    const h9 = sel(M.L_HORDE, 1, [sel(M.L_HORDE_MODEL, 9)]);
    const view = evaluate(scope, roster(force([h7, h9])));
    expect(find(view, h7.id).own[COST_PTS]).toBe(40);
    expect(find(view, h7.id).total[COST_PTS]).toBe(47);
    expect(find(view, h9.id).own[COST_PTS]).toBe(60);
    expect(find(view, h7.id).own).not.toHaveProperty('2d3b-b544-ad49-fb75');
  });

  test('roundUp uses ceil', () => {
    // +1 PL per 4 models rounded up on a base of 2 PL: 8 → 2, 9 → 3.
    const h8 = sel(M.L_HORDE, 1, [sel(M.L_HORDE_MODEL, 8)]);
    const h9 = sel(M.L_HORDE, 1, [sel(M.L_HORDE_MODEL, 9)]);
    const view = evaluate(scope, roster(force([h8, h9])));
    expect(find(view, h8.id).own[COST_PL]).toBe(4);
    expect(find(view, h9.id).own[COST_PL]).toBe(5);
  });

  test('percent condition compares against the container total', () => {
    const pactMax = (imps: number) => {
      const pact = sel(M.E_PACT);
      const view = evaluate(scope, roster(force([warriors(10), sel(M.L_IMP, imps), pact])));
      const pv = find(view, pact.id);
      return effectiveConstraints(scope, pv.merged!, ctxAt(view, pv)).find((c) => c.id === M.C_PACT_MAX)!.value;
    };
    expect(pactMax(1)).toBe(1); // 2 of 8 PL = 25%
    expect(pactMax(2)).toBe(0); // 4 of 10 PL = 40%
    const view = evaluate(scope, roster(force([warriors(10), sel(M.L_IMP, 2)])));
    const ctx = ctxAt(view, view.forces[0].selections[0]);
    expect(countIn(ctx, 'roster', COST_PL, M.CAT_DAEMON, { childSel: true, childForces: true, percent: true })).toBe(40);
    expect(countIn(ctx, 'roster', COST_PTS, M.CAT_DAEMON, { childSel: true, childForces: true })).toBe(60);
    // A matching selection's total includes its subtree, so its matching descendants aren't added again.
    expect(countIn(ctx, 'roster', COST_PTS, 'any', { childSel: true, childForces: true })).toBe(170);
    expect(countIn(ctx, 'roster', COST_PTS, 'model', { childSel: true, childForces: true })).toBe(110);
  });

  test('instanceOf ancestor and primary-catalogue conditions', () => {
    const w = warriors(10);
    const view = evaluate(scope, roster(force([w])));
    const gauss = find(view, w.id).children[0].children[0];
    const ctx = ctxAt(view, gauss);
    const c = (type: Cond['type'], scopeKey: string, childId: string): Cond => ({ type, field: 'selections', scope: scopeKey, childId, value: 0 });
    expect(checkCond(ctx, c('instanceOf', 'ancestor', M.E_WARRIORS))).toBe(true);
    expect(checkCond(ctx, c('instanceOf', 'ancestor', M.L_WARRIOR_MODEL))).toBe(true);
    expect(checkCond(ctx, c('instanceOf', 'ancestor', M.CAT_TROOPS))).toBe(true); // an ancestor's category
    expect(checkCond(ctx, c('instanceOf', 'ancestor', M.FORCE_PATROL))).toBe(true); // the enclosing force
    expect(checkCond(ctx, c('instanceOf', 'ancestor', M.E_LORD))).toBe(false);
    expect(checkCond(ctx, c('instanceOf', 'ancestor', M.E_GAUSS))).toBe(false); // self is not an ancestor
    expect(checkCond(ctx, c('notInstanceOf', 'ancestor', M.E_LORD))).toBe(true);
    expect(checkCond(ctx, c('instanceOf', 'primary-catalogue', M.CAT_ID))).toBe(true);
    expect(checkCond(ctx, c('instanceOf', 'primary-catalogue', M.LIB_ID))).toBe(false);
    expect(checkCond(ctx, c('notInstanceOf', 'primary-catalogue', M.LIB_ID))).toBe(true);
    expect(checkCond(ctx, c('instanceOf', 'parent', M.E_WARRIOR_MODEL))).toBe(true);
    expect(checkCond(ctx, c('instanceOf', 'force', M.FORCE_PATROL))).toBe(true);
    expect(checkCond(ctx, c('instanceOf', 'force', M.FORCE_BATTALION))).toBe(false);
  });

  test('a scope id with no matching ancestor makes the condition false and skips the constraint', () => {
    const l = lord();
    const view = evaluate(scope, roster(force([l])));
    const ctx = ctxAt(view, find(view, l.id));
    const missing: Cond = { type: 'lessThan', field: 'selections', scope: M.E_WARRIORS, childId: 'model', value: 100 };
    expect(checkCond(ctx, missing)).toBe(false);
    const owner = { ...resolve(scope, scope.node(M.L_LORD)!), constraints: [{ id: 'x', type: 'max' as const, field: 'selections', scope: M.E_WARRIORS, value: 1 }] };
    expect(effectiveConstraints(scope, owner, ctx)).toEqual([]);
  });

  test('constraints on force category links resolve against the force', () => {
    const view = evaluate(scope, roster(force([warriors(10), warriors(10)])));
    const fv = view.forces[0];
    const troops = fv.entry!.cats.find((c) => c.targetId === M.CAT_TROOPS)!;
    const ctx: EvalContext = { scope, view, at: fv };
    expect(effectiveConstraints(scope, troops, ctx).map((c) => c.value)).toEqual([1, 3]);
    expect(countIn(ctx, 'force', 'selections', M.CAT_TROOPS, opts(true))).toBe(2);
    expect(countIn(ctx, 'parent', 'selections', M.CAT_TROOPS, opts(true))).toBe(2);
  });

  test('an unselected candidate is evaluated in the container it would join', () => {
    const view = evaluate(scope, roster(force([warriors(10)])));
    const fv = view.forces[0];
    const candidate = resolve(scope, scope.node(M.L_WARRIORS)!);
    const ctx: EvalContext = { scope, view, at: fv, candidate };
    expect(countIn(ctx, 'parent', 'selections', M.E_WARRIORS, opts(false))).toBe(1);
    expect(countIn(ctx, 'self', 'selections', 'model', opts(true))).toBe(0);
    expect(checkCond(ctx, { type: 'greaterThan', field: 'selections', scope: M.E_WARRIORS, childId: 'model', value: -1, childSel: true })).toBe(true);
  });

  test('unknown entry id is reported, not thrown', () => {
    const ghost = sel('no-such-entry', 3, [sel(M.L_GAUSS)]);
    const ghostModel = sel('no-such-model', 2);
    const w = sel(M.L_WARRIORS, 1, [sel(M.L_WARRIOR_MODEL, 10, [sel(M.L_GAUSS)]), ghostModel]);
    const lost = force([sel(M.L_WARRIORS)], 'no-such-force', 'no-such-catalogue');
    let view!: RosterView;
    expect(() => (view = evaluate(scope, roster(force([ghost, w]), lost)))).not.toThrow();
    expect(view.unknown).toEqual([
      { selId: ghost.id, entryId: 'no-such-entry' },
      { selId: ghostModel.id, entryId: 'no-such-model' },
      { selId: lost.selections[0].id, entryId: M.L_WARRIORS },
    ]);
    const gv = find(view, ghost.id);
    expect(gv).toMatchObject({ merged: null, name: 'Unknown item', children: [] });
    expect(gv.own).toEqual({});
    expect(gv.total).toEqual({});
    expect(view.forces[1]).toMatchObject({ entry: null });
    expect(view.total).toEqual({ [COST_PTS]: 110, [COST_PL]: 6 });
  });
});

describe('real BSData v9.8.0', () => {
  test('a Necrons roster with one Necron Warriors (10 × Gauss Flayer model) totals 110 pts and 6 PL', () => {
    const real: Scope = realScope('necrons');
    const necrons = realCatalogueId('necrons');
    const unit = (models: number) =>
      sel('881a-dcaf-c88b-8ff1', 1, [sel('a881-d8ce-8c45-b8d6', models, [sel('d7e8-7123-841a-1ba5')])]);
    const build = (models: number): Roster => ({
      schema: 1,
      name: 'Necrons',
      catalogueId: necrons,
      battleSize: 'strike-force',
      forces: [{ id: 'f', forceId: 'a0c7-2a71-bae0-215d', catalogueId: necrons, selections: [unit(models)] }],
    });
    const ten = evaluate(real, build(10));
    expect(ten.unknown).toEqual([]);
    expect(ten.total).toEqual({ [COST_PTS]: 110, [COST_PL]: 6 });
    expect(ten.forces[0].selections[0]).toMatchObject({ name: 'Necron Warriors', type: 'unit', models: 10, primary: '5d76b6f5-20ae-4d70-8f59-ade72a2add3a' });
    // The PL modifier is scoped by the unit's own id (12ec-…): the nearest ancestor-or-self selection rule.
    expect(evaluate(real, build(11)).total).toEqual({ [COST_PTS]: 121, [COST_PL]: 12 });
  });
});
