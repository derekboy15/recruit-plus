/** The Morale phase (TS §8): Morale tests, Combat Attrition, Insane Bravery (CS §2), then Unit Coherency Checks. */
import { registerApplier } from '../core/apply';
import { registerHandler } from '../core/context';
import { registerInitialiser, type GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId } from '../core/types';
import { coherencyRemovals } from '../geometry/coherency';
import { casualtyOrder } from '../attack/allocate';
import { spendStratagem } from '../interact/stratagems';
import { noActivation } from '../interact/activation';
import { noPending } from '../interact/windows';
import { charsOf, livingModels, onBoard, placedModel, removeModels, unitsOf, unitView } from '../setup/units';
import { inspiringBonus } from '../terrain/ld';
import { inBattle, registerEndCheck, registerEnter } from '../turn/phases';

declare module '../core/types' {
  interface CommandMap {
    moraleTest: Cmd<'moraleTest'> & { unitId: string; insaneBravery?: boolean };
  }
  interface EventMap {
    moraleTested: Evt<'moraleTested'> & { unitId: string; roll: number | null; result: number | null; ld: number; passed: boolean; insaneBravery: boolean };
    moraleStarted: Evt<'moraleStarted'> & { first: PlayerId };
  }
}
declare module '../core/state' {
  interface GameState {
    morale: { next: PlayerId; tested: string[] };
    insaneBraveryUsed: Record<PlayerId, boolean>;
  }
}

registerInitialiser((s) => {
  s.morale = { next: 'A', tested: [] };
  s.insaneBraveryUsed = { A: false, B: false };
});
registerApplier('moraleStarted', (s, e) => {
  s.morale = { next: e.first, tested: [] };
});
registerApplier('moraleTested', (s, e) => {
  s.morale.tested.push(e.unitId);
  s.morale.next = other(s.units[e.unitId].player);
  if (e.insaneBravery) s.insaneBraveryUsed[s.units[e.unitId].player] = true;
});

registerEnter('morale', null, (ctx) => ctx.emit({ type: 'moraleStarted', first: ctx.state.active }));

/** Units that lost models this turn, are still on the battlefield and haven't tested yet (TS §8.1). */
export function needsMoraleTest(s: GameState, p?: PlayerId): string[] {
  return Object.values(s.units)
    .filter((u) => (!p || u.player === p) && u.location === 'battlefield' && u.turn.lostThisTurn > 0 && !s.morale.tested.includes(u.id))
    .map((u) => u.id);
}

/** The unit's highest Leadership, +1 from Inspiring terrain (TR §3.3). */
export function leadership(s: GameState, unitId: string): number {
  const best = Math.max(...livingModels(s, unitId).map((m) => charsOf(s, m).Ld));
  return best + inspiringBonus(unitView(s, unitId), s.setup.terrain);
}

registerHandler('moraleTest', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §8.1]');
  if (s.phase !== 'morale' || s.step !== 'morale-tests') ctx.reject('wrong-phase', 'Morale tests are taken in the Morale phase.', '[TS §8.1]');
  if (!needsMoraleTest(s).includes(u.id)) ctx.reject('no-test-needed', `${u.name} doesn't need a Morale test: only units that lost models this turn test, once.`, '[TS §8.1]', { unitId: u.id });
  // TS §8.1: players alternate, starting with the player whose turn it is.
  const next = needsMoraleTest(s, s.morale.next).length ? s.morale.next : other(s.morale.next);
  if (cmd.by !== next) ctx.reject('not-your-test', "It's the other player's turn to take a Morale test.", '[TS §8.1]');
  const ld = leadership(s, u.id);
  if (cmd.insaneBravery) {
    if (s.insaneBraveryUsed[cmd.by]) ctx.reject('insane-bravery-used', 'Insane Bravery can only be used once per battle.', '[CS §2]');
    spendStratagem(ctx, cmd.by, 'Insane Bravery', 2, [u.id]);
    ctx.emit({ type: 'moraleTested', unitId: u.id, roll: null, result: null, ld, passed: true, insaneBravery: true });
    return;
  }
  const roll = ctx.roll(1, 6, 'morale', cmd.by, { context: `${u.name}: Morale test` }).dice[0].value;
  const result = roll + u.turn.lostThisTurn;
  // WCR: an unmodified 1 always passes.
  const passed = roll === 1 || result <= ld;
  ctx.emit({ type: 'moraleTested', unitId: u.id, roll, result, ld, passed, insaneBravery: false });
  if (passed) return;
  removeModels(ctx, casualtyOrder(ctx.state, u.id).slice(0, 1).map((m) => m.id), 'fled', true);
  // TS §8.2 Combat Attrition: a D6 per remaining model, -1 if below Half-strength; each 1 flees one more.
  const left = livingModels(ctx.state, u.id).length;
  if (!left) return;
  const below = left * 2 < u.startingStrength;
  const ones = ctx.roll(left, 6, 'attrition', cmd.by, { context: `${u.name}: Combat Attrition` }).dice.filter((d) => d.value - (below ? 1 : 0) <= 1).length;
  if (ones) removeModels(ctx, casualtyOrder(ctx.state, u.id).slice(0, ones).map((m) => m.id), 'fled (Combat Attrition)', true);
});

registerEndCheck('morale', 'morale-tests', (s) => {
  const left = needsMoraleTest(s);
  return left.length ? { code: 'morale-tests-left', message: `${s.units[left[0]].name} still has to take a Morale test.`, rule: '[TS §8.1]', unitId: left[0] } : null;
});

/** TS §8.3: each unit not in coherency loses models until one coherent group is left (no Morale test for these). */
registerEnter('morale', 'coherency', (ctx) => {
  const s = ctx.state;
  for (const p of [s.active, other(s.active)])
    for (const u of unitsOf(s, p)) {
      if (u.location !== 'battlefield') continue;
      const models = onBoard(s, u.id);
      const removed = coherencyRemovals(models.map((m) => placedModel(s, m)), u.casualtyOrder);
      if (removed.length) removeModels(ctx, removed, 'out of unit coherency', false);
    }
});
