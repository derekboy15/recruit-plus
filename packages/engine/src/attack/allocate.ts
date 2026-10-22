/** Allocating attacks and wounds to models (TS §5.6), losing wounds, Feel No Pain (TS §5.9) and mortal wounds (TS §5.8). */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import type { GameState } from '../core/state';
import type { Cmd, Evt } from '../core/types';
import { effectsFor } from '../interact/effects';
import { livingModels, profileOf, removeModels, type ModelState } from '../setup/units';
import { inBattle } from '../turn/phases';

declare module '../core/types' {
  interface CommandMap {
    /** Toolkit: inflict mortal wounds on a unit (faction rules, Explodes, Perils by hand…). */
    inflictMortalWounds: Cmd<'inflictMortalWounds'> & { unitId: string; count: number; note?: string };
  }
  interface EventMap {
    attackAllocated: Evt<'attackAllocated'> & { modelId: string };
    woundsLost: Evt<'woundsLost'> & { modelId: string; wounds: number; mortal: boolean };
    woundIgnored: Evt<'woundIgnored'> & { modelId: string; roll: number; fnp: number };
  }
}

registerApplier('attackAllocated', (s, e) => {
  s.models[e.modelId].allocatedThisPhase = true;
});
registerApplier('woundsLost', (s, e) => {
  const m = s.models[e.modelId];
  m.woundsLeft = Math.max(0, m.woundsLeft - e.wounds);
  m.allocatedThisPhase = true;
});
registerApplier('woundIgnored', () => {});

/** True when the model has lost wounds (a "wounded" model must receive the next attack). */
export const hasLostWounds = (s: GameState, m: ModelState) => m.woundsLeft < profileOf(s, m).chars.W;

/**
 * Who the next attack or mortal wound goes to (TS §5.6): a model that has lost wounds or already had an attack
 * allocated this phase must take it; otherwise the next model in the owner's casualty order (R-14).
 */
export function allocationTarget(s: GameState, unitId: string): ModelState | null {
  const alive = livingModels(s, unitId).filter((m) => m.pos || s.units[unitId].location !== 'battlefield');
  if (!alive.length) return null;
  const forced = alive.find((m) => hasLostWounds(s, m) || m.allocatedThisPhase);
  if (forced) return forced;
  const order = s.units[unitId].casualtyOrder;
  return order.map((id) => alive.find((m) => m.id === id)).find((m): m is ModelState => !!m) ?? alive[0];
}

/** Living models in the order they'd be removed as casualties (R-14). */
export function casualtyOrder(s: GameState, unitId: string): ModelState[] {
  const alive = livingModels(s, unitId);
  const order = s.units[unitId].casualtyOrder;
  const ranked = order.map((id) => alive.find((m) => m.id === id)).filter((m): m is ModelState => !!m);
  return [...ranked, ...alive.filter((m) => !ranked.includes(m))];
}

/** The best Feel No Pain the unit has (one rule per wound, TS §5.9), or null. */
export function feelNoPain(s: GameState, unitId: string): number | null {
  const values = effectsFor(s, unitId, 'defending').flatMap((e) => (e.kind === 'fnp' ? [e.value] : []));
  return values.length ? Math.min(...values) : null;
}

/** One wound at a time: Feel No Pain, then the wound is lost; a model at 0 wounds is destroyed. Returns wounds lost. */
export function loseWounds(ctx: Ctx, m: ModelState, wounds: number, reason: string, mortal: boolean): number {
  const fnp = feelNoPain(ctx.state, m.unitId);
  let lost = 0;
  for (let i = 0; i < wounds && !ctx.state.models[m.id].destroyed; i++) {
    if (fnp) {
      const roll = ctx.roll(1, 6, 'fnp', ctx.state.units[m.unitId].player, { context: `Feel No Pain ${fnp}+` }).dice[0].value;
      if (roll >= fnp) {
        ctx.emit({ type: 'woundIgnored', modelId: m.id, roll, fnp });
        continue;
      }
    }
    ctx.emit({ type: 'woundsLost', modelId: m.id, wounds: 1, mortal });
    lost++;
    if (ctx.state.models[m.id].woundsLeft <= 0) removeModels(ctx, [m.id], reason, true);
  }
  return lost;
}

/** Mortal wounds: one at a time, each 1 damage, no saves; excess carries over to the next model (TS §5.8). */
export function inflictMortalWounds(ctx: Ctx, unitId: string, count: number, reason: string): number {
  let lost = 0;
  for (let i = 0; i < count; i++) {
    const target = allocationTarget(ctx.state, unitId);
    if (!target) break;
    lost += loseWounds(ctx, target, 1, reason, true);
  }
  return lost;
}

registerHandler('inflictMortalWounds', (ctx, cmd) => {
  inBattle(ctx);
  const u = ctx.state.units[cmd.unitId];
  if (!u || u.location === 'destroyed') ctx.reject('unknown-unit', 'Pick a unit that is still in the game.', '[TS §5.8]');
  if (cmd.count < 1) ctx.reject('bad-amount', 'Inflict at least 1 mortal wound.', '[TS §5.8]');
  inflictMortalWounds(ctx, cmd.unitId, cmd.count, cmd.note ?? 'mortal wounds');
});
