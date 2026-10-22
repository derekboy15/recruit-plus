/**
 * The Fight phase (TS §7, WCR): who fights and in what order (chargers and fights-first effects first, then alternating
 * from the player whose turn it isn't; fights-last effects; Counter-offensive), pile in, melee attacks, consolidate.
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { registerInitialiser, type GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId, type Problem } from '../core/types';
import { CLOSE_COMBAT_WEAPON } from '../datasheet/profile';
import { horizontalGap, inEngagementRange, verticalGap, within } from '../geometry/measure';
import type { Pos } from '../geometry/shapes';
import { startAttacks, type AttackGroup } from '../attack/sequence';
import { noActivation, selectedOut } from '../interact/activation';
import { consumeNextActivation, effectsFor } from '../interact/effects';
import { canAfford, spendStratagem } from '../interact/stratagems';
import { noPending, offerReaction, registerContinuation } from '../interact/windows';
import { checkMoves, closerProblems, type MoveSpec } from '../move/moves';
import { charsOf, onBoard, placedModel, sheetOf, unitsOf, type ModelState } from '../setup/units';
import { defenceLineBetween } from '../terrain/cover';
import { inBattle, registerEndCheck, registerEnter } from '../turn/phases';
import { strengthOf } from '../attack/resolve';

declare module '../interact/activation' {
  interface ActivationMap {
    fight: { kind: 'fight'; unitId: string; stage: 'pile-in' | 'attacks' | 'consolidate' };
  }
}
declare module '../core/types' {
  interface CommandMap {
    selectFighter: Cmd<'selectFighter'> & { unitId: string };
    pileIn: Cmd<'pileIn'> & { unitId: string; moves: Record<string, MoveSpec> };
    fightAttacks: Cmd<'fightAttacks'> & { unitId: string; assignments: { modelId: string; weapon: string; attacks: number; targetUnitId: string }[] };
    consolidate: Cmd<'consolidate'> & { unitId: string; moves: Record<string, MoveSpec> };
  }
  interface EventMap {
    fightStarted: Evt<'fightStarted'> & { picker: PlayerId };
    piledIn: Evt<'piledIn'> & { unitId: string; positions: Record<string, Pos> };
    consolidated: Evt<'consolidated'> & { unitId: string; positions: Record<string, Pos> };
    unitFought: Evt<'unitFought'> & { unitId: string };
    counterOffensive: Evt<'counterOffensive'> & { unitId: string };
  }
}

export interface FightState { picker: PlayerId; next: string | null }
declare module '../core/state' {
  interface GameState {
    fight: FightState;
  }
}

registerInitialiser((s) => {
  s.fight = { picker: 'A', next: null };
});
registerApplier('fightStarted', (s, e) => {
  s.fight = { picker: e.picker, next: null };
});
const place = (s: GameState, positions: Record<string, Pos>) => {
  for (const [id, pos] of Object.entries(positions)) s.models[id].pos = pos;
};
registerApplier('piledIn', (s, e) => place(s, e.positions));
registerApplier('consolidated', (s, e) => place(s, e.positions));
registerApplier('unitFought', (s, e) => {
  const u = s.units[e.unitId];
  u.turn.fought = true;
  s.fight = { picker: other(u.player), next: s.fight.next === e.unitId ? null : s.fight.next };
});
registerApplier('counterOffensive', (s, e) => {
  s.fight.next = e.unitId;
});

registerEnter('fight', null, (ctx) => ctx.emit({ type: 'fightStarted', picker: other(ctx.state.active) }));

/** Models of the two units are within Engagement Range (or engaged across a Defence Line, R-6). */
function modelsEngaged(s: GameState, a: ModelState, b: ModelState): boolean {
  const pa = placedModel(s, a);
  const pb = placedModel(s, b);
  return inEngagementRange(pa, pb) || defenceLineBetween(pa, pb, s.setup.terrain);
}
const enemyModels = (s: GameState, p: PlayerId) => unitsOf(s, other(p)).filter((u) => u.location === 'battlefield').flatMap((u) => onBoard(s, u.id));

/** Eligible to fight: within Engagement Range of an enemy unit, or made a charge move this turn (TS §7.1). */
export function canFight(s: GameState, unitId: string): boolean {
  const u = s.units[unitId];
  if (u.location !== 'battlefield' || selectedOut(u, 'fight')) return false;
  if (u.turn.charged) return true;
  const foes = enemyModels(s, u.player);
  return onBoard(s, unitId).some((m) => foes.some((e) => modelsEngaged(s, m, e)));
}

/** 1: fights first (charged, or a fights-first effect not cancelled by fights-last); 2: normal; 3: fights last (TS §7.2). */
function tier(s: GameState, unitId: string): 1 | 2 | 3 {
  const fx = effectsFor(s, unitId, 'self');
  const first = s.units[unitId].turn.charged || fx.some((e) => e.kind === 'fights-first');
  const last = fx.some((e) => e.kind === 'fights-last');
  return first && !last ? 1 : last && !first ? 3 : 2;
}

/** R-18: who picks the next unit to fight, and which of their units they can pick. */
export function fightOrder(s: GameState): { picker: PlayerId; selectable: string[] } {
  const eligible = Object.values(s.units).filter((u) => canFight(s, u.id));
  if (s.fight.next && eligible.some((u) => u.id === s.fight.next)) return { picker: s.units[s.fight.next].player, selectable: [s.fight.next] };
  const firstTier = eligible.some((u) => tier(s, u.id) === 1);
  const selectableFor = (p: PlayerId) => {
    const mine = eligible.filter((u) => u.player === p);
    if (firstTier) return mine.filter((u) => tier(s, u.id) === 1).map((u) => u.id);
    const normal = mine.filter((u) => tier(s, u.id) === 2);
    return (normal.length ? normal : mine).map((u) => u.id);
  };
  const preferred = s.fight.picker;
  const mine = selectableFor(preferred);
  if (mine.length) return { picker: preferred, selectable: mine };
  return { picker: other(preferred), selectable: selectableFor(other(preferred)) };
}

function fighting(ctx: Ctx, by: PlayerId, unitId: string, stage: 'pile-in' | 'attacks' | 'consolidate') {
  inBattle(ctx);
  noPending(ctx);
  const a = ctx.state.activation;
  if (!a || a.kind !== 'fight' || a.unitId !== unitId || ctx.state.units[unitId].player !== by) return ctx.reject('not-fighting', 'That unit isn\'t fighting.', '[TS §7.3]');
  if (a.stage !== stage) return ctx.reject('wrong-step', `${ctx.state.units[unitId].name} is at the ${a.stage.replace('-', ' ')} step.`, '[TS §7.3]');
  return a;
}

registerHandler('selectFighter', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §7.1]');
  if (s.phase !== 'fight') ctx.reject('wrong-phase', 'Units fight in the Fight phase.', '[TS §7.1]');
  if (!canFight(s, u.id)) ctx.reject('not-eligible', `${u.name} isn't eligible to fight: it must be within 1" of an enemy unit or have charged.`, '[TS §7.1]', { unitId: u.id });
  const order = fightOrder(s);
  if (order.picker !== cmd.by) ctx.reject('not-your-pick', "It's the other player's turn to pick a unit to fight.", '[WCR]');
  if (!order.selectable.includes(u.id)) {
    if (Object.values(s.units).some((x) => canFight(s, x.id) && tier(s, x.id) === 1))
      ctx.reject('fights-first-pending', 'Units that charged (or fight first) must fight before the rest.', '[TS §7.1]', { unitId: u.id });
    ctx.reject('fights-last', `${u.name} fights after your other units.`, '[TS §7.2]', { unitId: u.id });
  }
  ctx.emit({ type: 'unitSelected', unitId: u.id, kind: 'fight', delta: 1 });
  ctx.emit({ type: 'activationSet', activation: { kind: 'fight', unitId: u.id, stage: 'pile-in' } });
});

/** TS §7.3: models in base contact with an enemy model can't move when piling in. */
function baseContactProblems(s: GameState, unitId: string, moves: Record<string, MoveSpec>): Problem[] {
  const foes = enemyModels(s, s.units[unitId].player);
  const stuck = Object.entries(moves).filter(([id, spec]) => {
    const m = s.models[id];
    if (!m?.pos || (Math.abs(spec.to.x - m.pos.x) < 1e-9 && Math.abs(spec.to.y - m.pos.y) < 1e-9)) return false;
    return foes.some((e) => horizontalGap(placedModel(s, m), placedModel(s, e)) <= 0.01);
  });
  return stuck.length ? [{ code: 'base-contact', message: 'Models in base contact with an enemy model stay where they are.', rule: '[TS §7.3]', unitId, modelIds: stuck.map(([id]) => id) }] : [];
}

function fightMove(ctx: Ctx, unitId: string, moves: Record<string, MoveSpec>, type: 'pile-in' | 'consolidate'): Record<string, Pos> {
  const s = ctx.state;
  const check = checkMoves(s, unitId, moves, { type, allowance: () => 3, difficultGround: false });
  const problems = [...check.problems, ...closerProblems(s, unitId, moves, '[TS §7.3]'), ...(type === 'pile-in' ? baseContactProblems(s, unitId, moves) : [])];
  if (problems.length) ctx.fail(problems);
  return Object.fromEntries(Object.keys(moves).map((id) => [id, check.final[id]]));
}

registerHandler('pileIn', (ctx, cmd) => {
  const a = fighting(ctx, cmd.by, cmd.unitId, 'pile-in');
  const positions = fightMove(ctx, cmd.unitId, cmd.moves, 'pile-in');
  ctx.emit({ type: 'piledIn', unitId: cmd.unitId, positions });
  ctx.emit({ type: 'activationSet', activation: { ...a, stage: 'attacks' } });
});

/**
 * TS §7.3: the enemy units a model can attack: those within Engagement Range of it, or within ½" of a friendly model of
 * its unit that is itself within ½" of that enemy unit.
 */
export function meleeTargets(s: GameState, m: ModelState): string[] {
  const u = s.units[m.unitId];
  const out = new Set<string>();
  const near = (a: ModelState, b: ModelState) => within(horizontalGap(placedModel(s, a), placedModel(s, b)), 0.5) && within(verticalGap(placedModel(s, a), placedModel(s, b)), 5);
  const friends = onBoard(s, u.id).filter((f) => f.id !== m.id && near(m, f));
  for (const e of enemyModels(s, u.player)) {
    if (modelsEngaged(s, m, e) || friends.some((f) => near(f, e))) out.add(e.unitId);
  }
  return [...out];
}

registerHandler('fightAttacks', (ctx, cmd) => {
  const a = fighting(ctx, cmd.by, cmd.unitId, 'attacks');
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  const ds = sheetOf(s, u.id);
  const rule = '[TS §7.3]';
  const problems: Problem[] = [];
  const perModel = new Map<string, number>();
  const groups = new Map<string, AttackGroup>();
  const charging = u.turn.charged;
  const allowedForCharger = new Set([...u.turn.chargeTargets, ...Object.values(s.units).filter((x) => x.turn.heroic).map((x) => x.id)]);
  const extra = effectsFor(s, u.id, 'attacking').reduce((x, e) => x + (e.kind === 'attacks' ? e.value : 0), 0);
  for (const as of cmd.assignments) {
    const m = s.models[as.modelId];
    if (!m || m.unitId !== u.id || m.destroyed || !m.pos) {
      problems.push({ code: 'unknown-model', message: `That isn't a model of ${u.name}.`, rule, unitId: u.id, modelIds: [as.modelId] });
      continue;
    }
    const melee = m.weapons.map((w) => ds.weapons.find((x) => x.name === w)).filter((w) => w?.type === 'Melee');
    const weapon = melee.length ? melee.find((w) => w!.name === as.weapon) : as.weapon === CLOSE_COMBAT_WEAPON.name ? CLOSE_COMBAT_WEAPON : undefined;
    if (!weapon) {
      problems.push({ code: 'no-such-weapon', message: `That model can't fight with ${as.weapon}.`, rule, unitId: u.id, modelIds: [m.id] });
      continue;
    }
    if (!Number.isInteger(as.attacks) || as.attacks < 1) problems.push({ code: 'bad-attacks', message: 'Give each weapon a whole number of attacks.', rule, unitId: u.id, modelIds: [m.id] });
    const targets = meleeTargets(s, m);
    if (!targets.length) {
      problems.push({ code: 'cannot-fight', message: 'That model is too far from the enemy to fight.', rule, unitId: u.id, modelIds: [m.id] });
      continue;
    }
    if (!targets.includes(as.targetUnitId)) problems.push({ code: 'out-of-reach', message: "That model can't reach that unit.", rule, unitId: u.id, modelIds: [m.id] });
    if (charging && !allowedForCharger.has(as.targetUnitId))
      problems.push({ code: 'not-a-charge-target', message: `${u.name} charged this turn: it can only attack units it charged or that Heroically Intervened.`, rule, unitId: u.id, modelIds: [m.id] });
    perModel.set(m.id, (perModel.get(m.id) ?? 0) + as.attacks);
    const c = charsOf(s, m);
    const key = `${weapon.name}|${as.targetUnitId}|${c.WS}|${strengthOf(c, weapon)}`;
    const g = groups.get(key);
    if (g) {
      g.modelIds.push(m.id);
      g.attacksPerModel![m.id] = (g.attacksPerModel![m.id] ?? 0) + as.attacks;
    } else
      groups.set(key, {
        attackerUnitId: u.id, modelIds: [m.id], weapon, targetUnitId: as.targetUnitId, melee: true, attacksPerModel: { [m.id]: as.attacks },
        targetModels: onBoard(s, as.targetUnitId).length, hitMods: [],
      });
  }
  for (const [id, n] of perModel) {
    const A = charsOf(s, s.models[id]).A;
    const total = A.n === 0 ? A.plus + extra : null;
    if (total !== null && n !== total)
      problems.push({ code: 'wrong-attack-count', message: `That model makes ${total} attack${total === 1 ? '' : 's'}: share them out between its weapons.`, rule, unitId: u.id, modelIds: [id] });
  }
  if (problems.length) ctx.fail(problems);
  ctx.emit({ type: 'activationSet', activation: { ...a, stage: 'consolidate' } });
  if (groups.size) startAttacks(ctx, [...groups.values()], 'melee', { module: 'fight', step: 'attacked', data: { unitId: u.id } });
  else consumeNextActivation(ctx, u.id);
});

registerContinuation('fight', 'attacked', (ctx, d: { unitId: string }) => consumeNextActivation(ctx, d.unitId));

registerHandler('consolidate', (ctx, cmd) => {
  fighting(ctx, cmd.by, cmd.unitId, 'consolidate');
  if (ctx.state.attack) ctx.reject('attacks-open', 'Finish the attacks first.', '[TS §7.3]');
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (u.location === 'battlefield' && Object.keys(cmd.moves).length) {
    const positions = fightMove(ctx, u.id, cmd.moves, 'consolidate');
    ctx.emit({ type: 'consolidated', unitId: u.id, positions });
  }
  ctx.emit({ type: 'activationCleared' });
  ctx.emit({ type: 'unitFought', unitId: u.id });
  offerCounterOffensive(ctx, u.player);
});

/** CS §2 Counter-offensive: 2 CP, after an enemy unit has fought: one of your eligible units fights next. */
function offerCounterOffensive(ctx: Ctx, fought: PlayerId): void {
  const s = ctx.state;
  const foe = other(fought);
  const candidates = Object.values(s.units).filter((u) => u.player === foe && canFight(s, u.id) && tier(s, u.id) !== 3);
  const options = candidates.length && canAfford(s, foe, 'Counter-offensive', 2) ? ['counter-offensive'] : [];
  offerReaction(ctx, { reaction: 'counter-offensive', player: foe, subjectUnitId: candidates[0]?.id ?? '', options, then: { module: 'fight', step: 'counter', data: { candidates: candidates.map((u) => u.id) } } });
}

registerContinuation('fight', 'counter', (ctx, d: { candidates: string[]; choice: string }) => {
  if (d.choice === 'decline') return;
  const unitId = d.choice.split(':')[1] ?? d.candidates[0];
  if (!d.candidates.includes(unitId)) ctx.reject('bad-choice', "That unit can't be chosen for Counter-offensive.", '[CS §2]');
  spendStratagem(ctx, ctx.state.units[unitId].player, 'Counter-offensive', 2, [unitId]);
  ctx.emit({ type: 'counterOffensive', unitId });
});

registerEndCheck('fight', null, (s) => {
  if (s.activation?.kind === 'fight' || s.attack) return { code: 'activation-open', message: 'Finish the current fight first.', rule: '[TS §7.3]' };
  const left = Object.values(s.units).find((u) => canFight(s, u.id));
  return left ? { code: 'must-fight', message: `${left.name} is still eligible to fight: every eligible unit must fight.`, rule: '[TS §7.1]', unitId: left.id } : null;
});
