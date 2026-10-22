/**
 * One-tap effects (spec §3.3 faction assistance): re-rolls, ±1 to hit/wound/save, +AP/D, Feel No Pain, extra attacks,
 * ignore cover, an invulnerable save, fights first/last, Objective Secured. The rules modules read them; they expire
 * at the end of the phase, turn, battle round or Fight phase, or after the unit's next activation.
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { registerInitialiser, type GameState } from '../core/state';
import type { Cmd, Evt } from '../core/types';
import { inBattle, PHASE_ORDER, registerLeave, registerRoundEnd, registerTurnEnd } from '../turn/phases';

export type EffectKind =
  | { kind: 'reroll'; roll: 'hit' | 'wound' | 'save'; which: 'ones' | 'failed' }
  | { kind: 'mod'; roll: 'hit' | 'wound' | 'save' | 'charge' | 'advance' | 'psychic'; value: number; armourOnly?: true }
  | { kind: 'ap'; value: number }
  | { kind: 'damage'; value: number }
  | { kind: 'attacks'; value: number }
  | { kind: 'fnp'; value: number }
  | { kind: 'invuln'; value: number }
  | { kind: 'ignore-cover' }
  | { kind: 'fights-first' }
  | { kind: 'fights-last' };

export type EffectUntil = 'next-activation' | 'phase' | 'turn' | 'round' | 'battle' | 'fight';
export interface Effect { id: string; unitId: string; side: 'attacking' | 'defending' | 'self'; effect: EffectKind; until: EffectUntil; note: string }

declare module '../core/state' {
  interface GameState {
    effects: Effect[];
    nextEffect: number;
  }
}
declare module '../core/types' {
  interface CommandMap {
    addEffect: Cmd<'addEffect'> & { effect: Omit<Effect, 'id'> };
    removeEffect: Cmd<'removeEffect'> & { effectId: string };
  }
  interface EventMap {
    effectAdded: Evt<'effectAdded'> & { effect: Effect };
    effectsRemoved: Evt<'effectsRemoved'> & { ids: string[] };
  }
}

registerInitialiser((s) => {
  s.effects = [];
  s.nextEffect = 1;
});
registerApplier('effectAdded', (s, e) => {
  s.effects.push(e.effect);
  s.nextEffect += 1;
});
registerApplier('effectsRemoved', (s, e) => {
  s.effects = s.effects.filter((x) => !e.ids.includes(x.id));
});

export function effectsFor(s: GameState, unitId: string, side: Effect['side']): EffectKind[] {
  return s.effects.filter((e) => e.unitId === unitId && e.side === side).map((e) => e.effect);
}

export function addEffect(ctx: Ctx, effect: Omit<Effect, 'id'>): void {
  ctx.emit({ type: 'effectAdded', effect: { ...effect, id: `e${ctx.state.nextEffect}` } });
}

/** After a unit's shooting, fight or psychic activation, its next-activation effects are used up. */
export function consumeNextActivation(ctx: Ctx, unitId: string): void {
  const ids = ctx.state.effects.filter((e) => e.unitId === unitId && e.until === 'next-activation').map((e) => e.id);
  if (ids.length) ctx.emit({ type: 'effectsRemoved', ids });
}

function expire(ctx: Ctx, kinds: EffectUntil[]): void {
  const ids = ctx.state.effects.filter((e) => kinds.includes(e.until)).map((e) => e.id);
  if (ids.length) ctx.emit({ type: 'effectsRemoved', ids });
}

for (const phase of PHASE_ORDER) registerLeave(phase, null, (ctx) => expire(ctx, phase === 'fight' ? ['phase', 'fight'] : ['phase']));
registerTurnEnd((ctx) => expire(ctx, ['turn', 'next-activation']));
registerRoundEnd((ctx) => expire(ctx, ['round']));

registerHandler('addEffect', (ctx, cmd) => {
  inBattle(ctx);
  if (!ctx.state.units[cmd.effect.unitId]) ctx.reject('unknown-unit', 'Pick a unit for the effect.', '[R-19]');
  addEffect(ctx, cmd.effect);
});

registerHandler('removeEffect', (ctx, cmd) => {
  if (!ctx.state.effects.some((e) => e.id === cmd.effectId)) ctx.reject('unknown-effect', 'That effect has already ended.', '[R-19]');
  ctx.emit({ type: 'effectsRemoved', ids: [cmd.effectId] });
});
