/**
 * Actions (TS §10): starting one (not engaged, didn't Advance or Fall Back, not Aircraft or Fortifications, one per
 * battle round), failing it (moving, shooting, charging, Heroic Intervention, psychic powers, being destroyed or
 * repositioned) and completing it. Scoring it is the mission's job (Milestone 7) or a manual VP entry.
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { registerInitialiser, type Phase } from '../core/state';
import type { Cmd, Evt } from '../core/types';
import { noActivation } from '../interact/activation';
import { noPending } from '../interact/windows';
import { isEngaged, registerAfterMove } from '../move/movement';
import { registerRemovedHook, sheetOf, unitHas } from '../setup/units';
import { inBattle, PHASE_ORDER, registerLeave, registerRoundEnd, registerTurnEnd } from '../turn/phases';
import { registerChargeHook } from './charge';
import { registerPsychicHook } from './psychic';
import { registerShootHook } from './shooting';

export interface ActionSpec { name: string; startPhase: Phase; completes: 'end-of-turn' | 'end-of-phase' | 'immediately' }

declare module '../core/types' {
  interface CommandMap {
    startAction: Cmd<'startAction'> & { unitId: string; action: ActionSpec };
  }
  interface EventMap {
    actionStarted: Evt<'actionStarted'> & { unitId: string; action: ActionSpec };
    actionFailed: Evt<'actionFailed'> & { unitId: string; name: string; reason: string };
    actionCompleted: Evt<'actionCompleted'> & { unitId: string; name: string };
    actionsRoundReset: Evt<'actionsRoundReset'>;
  }
}
declare module '../core/state' {
  interface GameState {
    /** Actions in progress, by unit. */
    actions: Record<string, ActionSpec & { phase: Phase }>;
    /** Units that started an action this battle round (TS §10: one per battle round). */
    actedThisRound: string[];
  }
}

registerInitialiser((s) => {
  s.actions = {};
  s.actedThisRound = [];
});
registerApplier('actionStarted', (s, e) => {
  s.actions[e.unitId] = { ...e.action, phase: s.phase };
  s.actedThisRound.push(e.unitId);
});
const end = (s: { actions: Record<string, unknown> }, unitId: string) => {
  delete s.actions[unitId];
};
registerApplier('actionFailed', (s, e) => end(s, e.unitId));
registerApplier('actionCompleted', (s, e) => end(s, e.unitId));
registerApplier('actionsRoundReset', (s) => {
  s.actedThisRound = [];
});

registerHandler('startAction', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  const rule = '[TS §10]';
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', rule);
  if (cmd.by !== s.active) ctx.reject('not-your-turn', 'Actions are started in your own turn.', rule);
  if (s.phase !== cmd.action.startPhase) ctx.reject('wrong-phase', `${cmd.action.name} starts in the ${cmd.action.startPhase} phase.`, rule);
  if (u.location !== 'battlefield') ctx.reject('not-on-battlefield', `${u.name} isn't on the battlefield.`, rule);
  if (unitHas(s, u.id, 'AIRCRAFT')) ctx.reject('aircraft', 'Aircraft can\'t perform actions.', rule, { unitId: u.id });
  if (sheetOf(s, u.id).role === 'Fortification' || unitHas(s, u.id, 'FORTIFICATION')) ctx.reject('fortification', "Fortifications can't perform actions.", rule, { unitId: u.id });
  if (isEngaged(s, u.id)) ctx.reject('engaged', `${u.name} is within 1" of the enemy, so it can't start an action.`, rule, { unitId: u.id });
  if (u.turn.moved === 'advance') ctx.reject('advanced', `${u.name} Advanced this turn, so it can't start an action.`, rule, { unitId: u.id });
  if (u.turn.moved === 'fall-back') ctx.reject('fell-back', `${u.name} Fell Back this turn, so it can't start an action.`, rule, { unitId: u.id });
  if (s.actedThisRound.includes(u.id)) ctx.reject('one-action-per-round', `${u.name} has already started an action this battle round.`, rule, { unitId: u.id });
  ctx.emit({ type: 'actionStarted', unitId: u.id, action: cmd.action });
  if (cmd.action.completes === 'immediately') ctx.emit({ type: 'actionCompleted', unitId: u.id, name: cmd.action.name });
});

/** Fails the unit's action in progress, if any. */
export function failActionIfAny(ctx: Ctx, unitId: string, reason: string): void {
  const a = ctx.state.actions[unitId];
  if (a) ctx.emit({ type: 'actionFailed', unitId, name: a.name, reason });
}

registerAfterMove((ctx, unitId) => failActionIfAny(ctx, unitId, 'the unit moved'));
registerShootHook((ctx, unitId) => failActionIfAny(ctx, unitId, 'the unit shot'));
registerChargeHook((ctx, unitId) => failActionIfAny(ctx, unitId, 'the unit declared a charge'));
registerPsychicHook((ctx, unitId) => failActionIfAny(ctx, unitId, 'the unit attempted a psychic power'));
registerRemovedHook((ctx, ids) => {
  for (const unitId of new Set(ids.map((id) => ctx.state.models[id].unitId)))
    if (ctx.state.units[unitId].location === 'destroyed') failActionIfAny(ctx, unitId, 'the unit was destroyed');
});

for (const phase of PHASE_ORDER)
  registerLeave(phase, null, (ctx) => {
    for (const [unitId, a] of Object.entries(ctx.state.actions))
      if (a.completes === 'end-of-phase' && a.phase === phase) ctx.emit({ type: 'actionCompleted', unitId, name: a.name });
  });
registerTurnEnd((ctx) => {
  for (const [unitId, a] of Object.entries(ctx.state.actions)) ctx.emit({ type: 'actionCompleted', unitId, name: a.name });
});
registerRoundEnd((ctx) => ctx.emit({ type: 'actionsRoundReset' }));
