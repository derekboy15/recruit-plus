/**
 * The Charge phase (TS §6): declaring charges, the targets' reaction (Fire Overwatch, CS §2; Hold Steady / Set to
 * Defend on Defensible terrain, TR §3.3), the 2D6 charge roll and charge move, then Heroic Interventions (TS §6.2).
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { total } from '../core/dice';
import type { GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId, type Problem } from '../core/types';
import { distance3d, gapToPolygon, horizontalGap, inEngagementRange, anyPartWithin, within } from '../geometry/measure';
import { segmentCrossesPolygon, type Pos } from '../geometry/shapes';
import { startAttacks } from '../attack/sequence';
import { noActivation, selectedOut } from '../interact/activation';
import { addEffect, effectsFor } from '../interact/effects';
import { canAfford, spendStratagem } from '../interact/stratagems';
import { noPending, offerReaction, registerContinuation, rollWindowed } from '../interact/windows';
import { checkMoves, closerProblems, type MoveSpec } from '../move/moves';
import { afterMove, isEngaged } from '../move/movement';
import { livingModels, modelView, onBoard, placedModel, sheetOf, unitHas, unitView } from '../setup/units';
import { defenceLineBetween } from '../terrain/cover';
import { hasTrait } from '../terrain/types';
import { unitVisibleTo } from '../terrain/visibility';
import { inBattle, registerEndCheck } from '../turn/phases';
import { buildShootingGroups, weaponBase, type Assignment } from './shooting';

declare module '../interact/activation' {
  interface ActivationMap {
    charge: { kind: 'charge'; unitId: string; targets: string[]; roll: number | null };
  }
}
declare module '../core/types' {
  interface CommandMap {
    declareCharge: Cmd<'declareCharge'> & { unitId: string; targetIds: string[] };
    chargeMove: Cmd<'chargeMove'> & { unitId: string; moves: Record<string, MoveSpec> };
    failCharge: Cmd<'failCharge'> & { unitId: string };
    heroicIntervention: Cmd<'heroicIntervention'> & { unitId: string; moves: Record<string, MoveSpec> };
  }
  interface EventMap {
    chargeDeclared: Evt<'chargeDeclared'> & { unitId: string; targetIds: string[] };
    chargeReaction: Evt<'chargeReaction'> & { unitId: string; choice: string };
    unitCharged: Evt<'unitCharged'> & { unitId: string; positions: Record<string, Pos>; targetIds: string[] };
    chargeFailed: Evt<'chargeFailed'> & { unitId: string };
    heroicIntervened: Evt<'heroicIntervened'> & { unitId: string; positions: Record<string, Pos> };
  }
}

registerApplier('chargeDeclared', () => {});
registerApplier('chargeReaction', () => {});
registerApplier('chargeFailed', () => {});
registerApplier('unitCharged', (s, e) => {
  for (const [id, pos] of Object.entries(e.positions)) s.models[id].pos = pos;
  Object.assign(s.units[e.unitId].turn, { charged: true, chargeTargets: e.targetIds });
});
registerApplier('heroicIntervened', (s, e) => {
  for (const [id, pos] of Object.entries(e.positions)) s.models[id].pos = pos;
  s.units[e.unitId].turn.heroic = true;
});

const unitDistance = (s: GameState, a: string, b: string) =>
  Math.min(...onBoard(s, a).flatMap((x) => onBoard(s, b).map((y) => distance3d(placedModel(s, x), placedModel(s, y)))));

registerHandler('declareCharge', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §6.1]');
  if (cmd.by !== s.active || s.phase !== 'charge' || s.step !== 'charges') ctx.reject('wrong-phase', 'Units charge in the Charges step of your Charge phase.', '[TS §6.1]');
  if (u.location !== 'battlefield') ctx.reject('not-on-battlefield', `${u.name} isn't on the battlefield.`, '[TS §6.1]');
  if (selectedOut(u, 'charge')) ctx.reject('already-charged', `${u.name} has already declared a charge this phase.`, '[TS §6.1]', { unitId: u.id });
  const rule = '[TS §6.1]';
  if (u.turn.moved === 'advance') ctx.reject('advanced', `${u.name} Advanced this turn, so it can't charge.`, rule, { unitId: u.id });
  if (u.turn.moved === 'fall-back') ctx.reject('fell-back', `${u.name} Fell Back this turn, so it can't charge.`, rule, { unitId: u.id });
  if (u.turn.disembarkedFromDestroyed) ctx.reject('disembarked-from-destroyed', `${u.name} got out of a destroyed transport this turn, so it can't charge.`, '[TS §3.4]', { unitId: u.id });
  if (u.turn.brokeOut || u.turn.arrivedLarge) ctx.reject('cannot-act', `${u.name} can't do anything else this turn.`, '[CS §2]', { unitId: u.id });
  if (unitHas(s, u.id, 'AIRCRAFT') && u.turn.arrived) ctx.reject('aircraft-arrived', `${u.name} is an Aircraft that arrived this turn: it can't charge.`, '[TS §3.5]', { unitId: u.id });
  if (isEngaged(s, u.id, true)) ctx.reject('engaged', `${u.name} is already within 1" of the enemy.`, rule, { unitId: u.id });
  if (!cmd.targetIds.length) ctx.reject('no-targets', 'Choose at least one enemy unit to charge.', rule);
  for (const t of cmd.targetIds) {
    const target = s.units[t];
    if (!target || target.player === u.player || target.location !== 'battlefield') ctx.reject('bad-target', 'Charge targets must be enemy units on the battlefield.', rule);
    if (!within(unitDistance(s, u.id, t), 12)) ctx.reject('out-of-charge-range', `${target.name} is more than 12" from ${u.name}.`, rule, { unitId: u.id });
  }
  ctx.emit({ type: 'unitSelected', unitId: u.id, kind: 'charge', delta: 1 });
  ctx.emit({ type: 'activationSet', activation: { kind: 'charge', unitId: u.id, targets: cmd.targetIds, roll: null } });
  ctx.emit({ type: 'chargeDeclared', unitId: u.id, targetIds: cmd.targetIds });
  afterChargeDeclared(ctx, u.id);
  offerChargeReaction(ctx, u.id, cmd.targetIds);
});

/** TR §3.3: every model of an INFANTRY target is in a Defensible area feature, or within 3" of a Defensible obstacle between it and the charger. */
export function defensible(s: GameState, targetId: string, chargerId: string): boolean {
  if (!unitHas(s, targetId, 'INFANTRY') || isEngaged(s, targetId, true)) return false;
  const chargers = onBoard(s, chargerId).map((m) => placedModel(s, m));
  return onBoard(s, targetId).every((m) => {
    const p = placedModel(s, m);
    return s.setup.terrain.some((f) => {
      if (!hasTrait(f, 'defensible')) return false;
      if (f.category === 'area') return anyPartWithin(p, f.footprint);
      if (f.category !== 'obstacle' || !within(gapToPolygon(p, f.footprint), 3) || !chargers.length) return false;
      const nearest = chargers.reduce((a, c) => (horizontalGap(p, c) < horizontalGap(p, a) ? c : a));
      return segmentCrossesPolygon(p.pos, nearest.pos, f.footprint);
    });
  });
}

/** The weapons a unit fires in Overwatch: every ranged weapon in range of a visible charger, Pistols only if nothing else can (R-26). */
export function overwatchAssignments(s: GameState, unitId: string, chargerId: string): Assignment[] {
  const ds = sheetOf(s, unitId);
  const charger = onBoard(s, chargerId).map((m) => placedModel(s, m));
  const out: Assignment[] = [];
  for (const m of onBoard(s, unitId)) {
    if (!unitVisibleTo(modelView(s, m), unitView(s, chargerId), s.setup.terrain)) continue;
    const from = placedModel(s, m);
    const closest = Math.min(...charger.map((c) => distance3d(from, c)));
    const usable = m.weapons
      .map((w) => ds.weapons.find((x) => x.name === w))
      .filter((w): w is NonNullable<typeof w> => !!w && w.type !== 'Melee' && w.type !== 'Grenade' && w.range !== null && closest <= w.range + 1e-6);
    const main = usable.filter((w) => w.type !== 'Pistol');
    const pick = (main.length ? main : usable).filter((w, i, all) => all.findIndex((x) => weaponBase(x.name) === weaponBase(w.name)) === i);
    for (const w of pick) out.push({ modelId: m.id, weapon: w.name, targetUnitId: chargerId });
  }
  return out;
}

/** Overwatch attack groups, leaving out any weapon that can't legally fire. */
function overwatchGroups(s: GameState, unitId: string, chargerId: string, needs: 5 | 6) {
  let assignments = overwatchAssignments(s, unitId, chargerId);
  for (let i = 0; i < 5 && assignments.length; i++) {
    const r = buildShootingGroups(s, unitId, assignments, { overwatch: { needs, chargerId } });
    if (!r.problems.length) return r.groups;
    const bad = new Set(r.problems.flatMap((p) => p.modelIds ?? []));
    assignments = assignments.filter((a) => !bad.has(a.modelId));
  }
  return [];
}

function offerChargeReaction(ctx: Ctx, chargerId: string, targets: string[]): void {
  const s = ctx.state;
  const foe = other(s.units[chargerId].player);
  const options = new Set<string>();
  for (const t of targets) {
    if (isEngaged(s, t, true)) continue;
    const canOverwatch = canAfford(s, foe, 'Fire Overwatch', 1) && overwatchGroups(s, t, chargerId, 6).length > 0;
    if (canOverwatch) options.add('overwatch');
    if (defensible(s, t, chargerId)) {
      if (canOverwatch) options.add('hold-steady');
      options.add('set-to-defend');
    }
  }
  offerReaction(ctx, { reaction: 'charge-declared', player: foe, subjectUnitId: chargerId, options: [...options], then: { module: 'charge', step: 'reacted', data: { chargerId, targets } } });
}

registerContinuation('charge', 'reacted', (ctx, d: { chargerId: string; targets: string[]; choice: string }) => {
  const s = ctx.state;
  const [kind, unitId] = d.choice.split(':');
  if (kind === 'decline') return chargeRoll(ctx, d.chargerId);
  const foe = other(s.units[d.chargerId].player);
  if (!unitId || !d.targets.includes(unitId)) ctx.reject('bad-choice', 'Only a unit being charged can react.', '[CS §2]');
  if ((kind === 'hold-steady' || kind === 'set-to-defend') && !defensible(s, unitId, d.chargerId))
    ctx.reject('not-defensible', `${s.units[unitId].name} isn't wholly in Defensible terrain.`, '[TR §3.3]');
  ctx.emit({ type: 'chargeReaction', unitId, choice: kind });
  if (kind === 'set-to-defend') {
    addEffect(ctx, { unitId, side: 'attacking', effect: { kind: 'mod', roll: 'hit', value: 1 }, until: 'fight', note: 'Set to Defend' });
    return chargeRoll(ctx, d.chargerId);
  }
  if (isEngaged(s, unitId, true)) ctx.reject('cannot-overwatch', "A unit within 1\" of the enemy can't fire Overwatch.", '[WCR]');
  const groups = overwatchGroups(s, unitId, d.chargerId, kind === 'hold-steady' ? 5 : 6);
  if (!groups.length) ctx.reject('cannot-overwatch', `${s.units[unitId].name} has nothing that can shoot at the charging unit.`, '[CS §2]');
  spendStratagem(ctx, foe, 'Fire Overwatch', 1, [unitId]);
  startAttacks(ctx, groups, 'overwatch', { module: 'charge', step: 'afterOverwatch', data: { chargerId: d.chargerId } });
});

registerContinuation('charge', 'afterOverwatch', (ctx, d: { chargerId: string }) => chargeRoll(ctx, d.chargerId));

function chargeRoll(ctx: Ctx, chargerId: string): void {
  if (!livingModels(ctx.state, chargerId).length) {
    ctx.emit({ type: 'chargeFailed', unitId: chargerId });
    ctx.emit({ type: 'activationCleared' });
    return;
  }
  rollWindowed(ctx, 2, 6, 'charge', ctx.state.units[chargerId].player, { whole: true, context: `${ctx.state.units[chargerId].name}: charge roll`, then: { module: 'charge', step: 'rolled', data: { chargerId } } });
}

registerContinuation('charge', 'rolled', (ctx, d: { chargerId: string; rollId: string }) => {
  const a = ctx.state.activation;
  if (!a || a.kind !== 'charge') return;
  const mod = effectsFor(ctx.state, d.chargerId, 'self').reduce((x, e) => x + (e.kind === 'mod' && e.roll === 'charge' ? e.value : 0), 0);
  ctx.emit({ type: 'activationSet', activation: { ...a, roll: Math.max(0, total(ctx.state.rolls[d.rollId]) + mod) } });
});

function currentCharge(ctx: Ctx, by: PlayerId, unitId: string) {
  inBattle(ctx);
  noPending(ctx);
  const a = ctx.state.activation;
  if (!a || a.kind !== 'charge' || a.unitId !== unitId || ctx.state.units[unitId].player !== by) return ctx.reject('not-charging', 'That unit isn\'t charging.', '[TS §6.1]');
  if (a.roll === null) return ctx.reject('roll-first', 'Make the charge roll first.', '[TS §6.1]');
  return a;
}

registerHandler('chargeMove', (ctx, cmd) => {
  const a = currentCharge(ctx, cmd.by, cmd.unitId);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  const rule = '[TS §6.1]';
  const check = checkMoves(s, u.id, cmd.moves, { type: 'charge', allowance: () => a.roll!, difficultGround: true });
  const problems: Problem[] = [...check.problems];
  const flies = unitHas(s, u.id, 'FLY');
  const engagedWith = (unitId: string) =>
    onBoard(s, unitId).some((e) => check.placed.some((p) => inEngagementRange(p, placedModel(s, e)) || defenceLineBetween(p, placedModel(s, e), s.setup.terrain)));
  const missed = a.targets.filter((t) => !engagedWith(t));
  if (missed.length) problems.push({ code: 'charge-not-reached', message: `The charge must end within 1" of every target: ${missed.map((t) => s.units[t].name).join(', ')}.`, rule, unitId: u.id });
  const others = Object.values(s.units).filter((x) => x.player !== u.player && x.location === 'battlefield' && !a.targets.includes(x.id) && engagedWith(x.id));
  if (others.length) problems.push({ code: 'charge-non-target', message: `The charge can't end within 1" of ${others.map((x) => x.name).join(', ')}, which wasn't a target.`, rule, unitId: u.id });
  const aircraft = a.targets.filter((t) => unitHas(s, t, 'AIRCRAFT') && engagedWith(t));
  if (aircraft.length && !flies) problems.push({ code: 'charge-aircraft', message: 'Only units that can FLY can end a charge next to an Aircraft.', rule: '[TS §3.5]', unitId: u.id });
  if (problems.length) ctx.fail(problems);
  const moved = Object.fromEntries(Object.keys(cmd.moves).map((id) => [id, check.final[id]]));
  ctx.emit({ type: 'unitCharged', unitId: u.id, positions: moved, targetIds: a.targets });
  ctx.emit({ type: 'activationCleared' });
});

registerHandler('failCharge', (ctx, cmd) => {
  currentCharge(ctx, cmd.by, cmd.unitId);
  ctx.emit({ type: 'chargeFailed', unitId: cmd.unitId });
  ctx.emit({ type: 'activationCleared' });
});

registerEndCheck('charge', 'charges', (s) =>
  s.activation?.kind === 'charge' || s.attack ? { code: 'activation-open', message: 'Finish the current charge first.', rule: '[TS §6.1]' } : null,
);

/** TS §6.2 / WCR: after all charges, the opponent's CHARACTERS within 3" (5" vertically) of an enemy may move up to 3" closer. */
registerHandler('heroicIntervention', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  const rule = '[TS §6.2]';
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', rule);
  if (cmd.by === s.active) ctx.reject('own-charge-phase', "Units can't Heroically Intervene in their own Charge phase.", '[WCR]');
  if (s.phase !== 'charge' || s.step !== 'heroic-interventions') ctx.reject('wrong-phase', 'Heroic Interventions happen after all charges, in the Charge phase.', rule);
  if (!unitHas(s, u.id, 'CHARACTER')) ctx.reject('not-a-character', `${u.name} isn't a CHARACTER.`, rule, { unitId: u.id });
  if (u.location !== 'battlefield') ctx.reject('not-on-battlefield', `${u.name} isn't on the battlefield.`, rule);
  if (u.turn.heroic) ctx.reject('already-intervened', `${u.name} has already made a Heroic Intervention this phase.`, rule, { unitId: u.id });
  if (u.turn.disembarkedFromDestroyed) ctx.reject('disembarked-from-destroyed', `${u.name} got out of a destroyed transport this turn.`, rule, { unitId: u.id });
  if (isEngaged(s, u.id, true)) ctx.reject('engaged', `${u.name} is already within 1" of the enemy.`, rule, { unitId: u.id });
  const own = onBoard(s, u.id).map((m) => placedModel(s, m));
  const enemyNear = Object.values(s.models).some(
    (m) => m.pos && !m.destroyed && s.units[m.unitId].player !== u.player && own.some((p) => within(horizontalGap(p, placedModel(s, m)), 3) && Math.abs(p.pos.z - m.pos!.z) <= 5),
  );
  if (!enemyNear) ctx.reject('too-far-to-intervene', `${u.name} must be within 3" of an enemy unit to Heroically Intervene.`, rule, { unitId: u.id });
  const check = checkMoves(s, u.id, cmd.moves, { type: 'heroic', allowance: () => 3, difficultGround: false });
  const problems = [...check.problems, ...closerProblems(s, u.id, cmd.moves, rule)];
  if (problems.length) ctx.fail(problems);
  ctx.emit({ type: 'heroicIntervened', unitId: u.id, positions: Object.fromEntries(Object.keys(cmd.moves).map((id) => [id, check.final[id]])) });
  afterMove(ctx, u.id);
});

type Hook = (ctx: Ctx, unitId: string) => void;
const declaredHooks: Hook[] = [];
/** Runs when a unit declares a charge (its action fails, Task 18). */
export function registerChargeHook(fn: Hook): void {
  declaredHooks.push(fn);
}
function afterChargeDeclared(ctx: Ctx, unitId: string): void {
  for (const h of declaredHooks) h(ctx, unitId);
}
