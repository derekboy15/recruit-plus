/**
 * The manual adjust toolkit (spec §3.3, R-19): what faction rules need that the core doesn't automate — move or
 * redeploy a model, add / return / remove models, set wounds, replace a die, give an extra activation, change CP and VP,
 * set an objective's owner, choose the casualty order, switch a unit flag. Every use is an event: logged and undoable.
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import type { Cmd, Evt, PlayerId } from '../core/types';
import type { Pos } from '../geometry/shapes';
import { failActionIfAny } from '../phases/actions';
import { placedAt, placementProblems } from '../move/placement';
import { profileOf, removeModels, sheetOf, type ActivationKind } from '../setup/units';
import { changeCp } from '../turn/command';
import { scoreVp } from '../turn/objectives';
import { overlaps, whollyWithinPolygon } from '../geometry/measure';
import { boardPolygon } from '../move/placement';

declare module '../core/types' {
  interface CommandMap {
    placeModel: Cmd<'placeModel'> & { modelId: string; pos: Pos };
    addModel: Cmd<'addModel'> & { unitId: string; profile: string; weapons: string[]; pos: Pos };
    returnModel: Cmd<'returnModel'> & { modelId: string; pos: Pos; countsAsDestroyed: boolean };
    removeModel: Cmd<'removeModel'> & { modelId: string; destroyed: boolean };
    setWounds: Cmd<'setWounds'> & { modelId: string; woundsLeft: number };
    replaceDie: Cmd<'replaceDie'> & { rollId: string; index: number; value: number };
    extraActivation: Cmd<'extraActivation'> & { unitId: string; kind: ActivationKind };
    adjustCp: Cmd<'adjustCp'> & { player: PlayerId; delta: number };
    adjustVp: Cmd<'adjustVp'> & { player: PlayerId; category: 'primary' | 'secondary' | 'painted'; name?: string; delta: number };
    setObjective: Cmd<'setObjective'> & { objectiveId: string; owner: PlayerId | null; sticky: boolean };
    setCasualtyOrder: Cmd<'setCasualtyOrder'> & { unitId: string; modelIds: string[] };
    setUnitFlag: Cmd<'setUnitFlag'> & { unitId: string; flag: 'counts-as-stationary' | 'objective-secured'; value: boolean };
  }
  interface EventMap {
    modelPlaced: Evt<'modelPlaced'> & { modelId: string; pos: Pos };
    modelAdded: Evt<'modelAdded'> & { unitId: string; modelId: string; profile: string; weapons: string[]; pos: Pos; woundsLeft: number };
    modelReturned: Evt<'modelReturned'> & { modelId: string; pos: Pos; woundsLeft: number; countsAsDestroyed: boolean };
    woundsSet: Evt<'woundsSet'> & { modelId: string; woundsLeft: number };
    dieReplaced: Evt<'dieReplaced'> & { rollId: string; index: number; value: number };
    extraActivationGranted: Evt<'extraActivationGranted'> & { unitId: string; kind: ActivationKind };
    casualtyOrderSet: Evt<'casualtyOrderSet'> & { unitId: string; modelIds: string[] };
    unitFlagSet: Evt<'unitFlagSet'> & { unitId: string; flag: 'counts-as-stationary' | 'objective-secured'; value: boolean };
  }
}

registerApplier('modelPlaced', (s, e) => {
  s.models[e.modelId].pos = e.pos;
});
registerApplier('modelAdded', (s, e) => {
  s.models[e.modelId] = { id: e.modelId, unitId: e.unitId, profile: e.profile, weapons: e.weapons, woundsLeft: e.woundsLeft, pos: e.pos, destroyed: false, allocatedThisPhase: false };
  const u = s.units[e.unitId];
  u.modelIds.push(e.modelId);
  u.casualtyOrder.unshift(e.modelId);
  if (u.location === 'destroyed') u.location = 'battlefield';
});
registerApplier('modelReturned', (s, e) => {
  const m = s.models[e.modelId];
  Object.assign(m, { destroyed: false, pos: e.pos, woundsLeft: e.woundsLeft, allocatedThisPhase: false });
  const u = s.units[m.unitId];
  if (u.location === 'destroyed') u.location = 'battlefield';
  if (!e.countsAsDestroyed) u.turn.lostThisTurn = Math.max(0, u.turn.lostThisTurn - 1);
});
registerApplier('woundsSet', (s, e) => {
  s.models[e.modelId].woundsLeft = e.woundsLeft;
});
registerApplier('dieReplaced', (s, e) => {
  const r = s.rolls[e.rollId];
  r.dice[e.index] = { ...r.dice[e.index], value: e.value, replaced: true };
});
registerApplier('extraActivationGranted', (s, e) => {
  const t = s.units[e.unitId].turn;
  t.extra[e.kind] = (t.extra[e.kind] ?? 0) + 1;
  if (e.kind === 'fight') t.fought = false;
});
registerApplier('casualtyOrderSet', (s, e) => {
  s.units[e.unitId].casualtyOrder = e.modelIds;
});
registerApplier('unitFlagSet', (s, e) => {
  const f = s.units[e.unitId].flags;
  if (e.flag === 'counts-as-stationary') f.countsAsStationary = e.value;
  else f.objectiveSecured = e.value;
});

const RULE = '[R-19]';
function live(ctx: Ctx): void {
  if (ctx.state.ended) ctx.reject('game-over', 'The game is over.', '[MP §4]');
}
function modelOf(ctx: Ctx, id: string) {
  const m = ctx.state.models[id];
  if (!m) return ctx.reject('unknown-model', 'Pick a model.', RULE);
  return m;
}
/** Standing on the battlefield and not on another model. */
function spotProblems(ctx: Ctx, unitId: string, modelId: string, pos: Pos) {
  const s = ctx.state;
  const base = sheetOf(s, unitId).base;
  const p = { id: modelId, base, pos };
  if (!whollyWithinPolygon(p, boardPolygon(s))) ctx.reject('off-board', 'Models must be wholly on the battlefield.', '[TS §3.1]', { modelIds: [modelId] });
  const clash = Object.values(s.models).some((m) => m.id !== modelId && m.pos && !m.destroyed && overlaps(p, { id: m.id, base: sheetOf(s, m.unitId).base, pos: m.pos }));
  if (clash) ctx.reject('overlap', "Models can't stand on top of other models.", '[TS §3.1]', { modelIds: [modelId] });
}

registerHandler('placeModel', (ctx, cmd) => {
  live(ctx);
  const m = modelOf(ctx, cmd.modelId);
  if (m.destroyed) ctx.reject('destroyed', 'That model has been destroyed: return it instead.', RULE);
  if (ctx.state.units[m.unitId].location !== 'battlefield') ctx.reject('not-on-battlefield', "That model's unit isn't on the battlefield.", RULE);
  spotProblems(ctx, m.unitId, m.id, cmd.pos);
  ctx.emit({ type: 'modelPlaced', modelId: m.id, pos: cmd.pos });
  // Jan 2021 (TS §10): a unit repositioned mid-action fails it.
  failActionIfAny(ctx, m.unitId, 'the unit was repositioned');
});

registerHandler('addModel', (ctx, cmd) => {
  live(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u) return ctx.reject('unknown-unit', 'Pick a unit.', RULE);
  const profile = sheetOf(s, u.id).models.find((p) => p.name === cmd.profile);
  if (!profile) ctx.reject('unknown-profile', `${u.name} has no model profile called ${cmd.profile}.`, RULE);
  const id = `${u.id}.m${u.modelIds.length + 1}`;
  spotProblems(ctx, u.id, id, cmd.pos);
  ctx.emit({ type: 'modelAdded', unitId: u.id, modelId: id, profile: cmd.profile, weapons: cmd.weapons, pos: cmd.pos, woundsLeft: profile!.chars.W });
});

registerHandler('returnModel', (ctx, cmd) => {
  live(ctx);
  const m = modelOf(ctx, cmd.modelId);
  if (!m.destroyed) ctx.reject('not-destroyed', "That model hasn't been destroyed.", RULE);
  spotProblems(ctx, m.unitId, m.id, cmd.pos);
  ctx.emit({ type: 'modelReturned', modelId: m.id, pos: cmd.pos, woundsLeft: profileOf(ctx.state, m).chars.W, countsAsDestroyed: cmd.countsAsDestroyed });
});

registerHandler('removeModel', (ctx, cmd) => {
  live(ctx);
  const m = modelOf(ctx, cmd.modelId);
  if (m.destroyed) ctx.reject('destroyed', 'That model has already been removed.', RULE);
  removeModels(ctx, [m.id], cmd.destroyed ? 'destroyed by hand' : 'removed by hand', cmd.destroyed);
});

registerHandler('setWounds', (ctx, cmd) => {
  live(ctx);
  const m = modelOf(ctx, cmd.modelId);
  const W = profileOf(ctx.state, m).chars.W;
  if (m.destroyed || !Number.isInteger(cmd.woundsLeft) || cmd.woundsLeft < 1 || cmd.woundsLeft > W)
    ctx.reject('bad-wounds', `Wounds left must be between 1 and ${W}; remove the model to destroy it.`, RULE);
  ctx.emit({ type: 'woundsSet', modelId: m.id, woundsLeft: cmd.woundsLeft });
});

registerHandler('replaceDie', (ctx, cmd) => {
  live(ctx);
  const p = ctx.state.pending;
  if (!p || p.kind !== 'roll' || p.rollId !== cmd.rollId) return ctx.reject('no-roll-window', 'A die can only be replaced on the roll that is waiting to be accepted.', RULE);
  const r = ctx.state.rolls[cmd.rollId];
  if (!r.dice[cmd.index]) ctx.reject('bad-die', 'Pick a die from this roll.', RULE);
  if (!Number.isInteger(cmd.value) || cmd.value < 1 || cmd.value > r.dice[cmd.index].sides) ctx.reject('bad-value', `A D${r.dice[cmd.index].sides} shows 1 to ${r.dice[cmd.index].sides}.`, RULE);
  ctx.emit({ type: 'dieReplaced', rollId: cmd.rollId, index: cmd.index, value: cmd.value });
});

registerHandler('extraActivation', (ctx, cmd) => {
  live(ctx);
  if (!ctx.state.units[cmd.unitId]) ctx.reject('unknown-unit', 'Pick a unit.', RULE);
  ctx.emit({ type: 'extraActivationGranted', unitId: cmd.unitId, kind: cmd.kind });
});

registerHandler('adjustCp', (ctx, cmd) => {
  live(ctx);
  const delta = Math.max(-ctx.state.cp[cmd.player], cmd.delta);
  if (delta !== 0) changeCp(ctx, cmd.player, delta, 'adjusted by hand');
});

registerHandler('adjustVp', (ctx, cmd) => {
  live(ctx);
  scoreVp(ctx, cmd.player, cmd.category, cmd.delta, 'adjusted by hand', cmd.category === 'secondary' ? (cmd.name ?? 'Secondary') : undefined);
});

registerHandler('setObjective', (ctx, cmd) => {
  live(ctx);
  if (!ctx.state.objectives[cmd.objectiveId]) ctx.reject('unknown-objective', 'Pick an objective marker.', '[TS §9]');
  ctx.emit({ type: 'objectiveSet', objectiveId: cmd.objectiveId, owner: cmd.owner, sticky: cmd.sticky && !!cmd.owner });
});

registerHandler('setCasualtyOrder', (ctx, cmd) => {
  const u = ctx.state.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Only the owner chooses the order their models are removed in.', '[R-14]');
  const all = new Set(u.modelIds);
  if (cmd.modelIds.length !== all.size || !cmd.modelIds.every((id) => all.has(id)) || new Set(cmd.modelIds).size !== all.size)
    ctx.reject('every-model', `List every model of ${u.name} once.`, '[R-14]');
  ctx.emit({ type: 'casualtyOrderSet', unitId: u.id, modelIds: cmd.modelIds });
});

registerHandler('setUnitFlag', (ctx, cmd) => {
  live(ctx);
  if (!ctx.state.units[cmd.unitId]) ctx.reject('unknown-unit', 'Pick a unit.', RULE);
  ctx.emit({ type: 'unitFlagSet', unitId: cmd.unitId, flag: cmd.flag, value: cmd.value });
});

export { placedAt, placementProblems };
