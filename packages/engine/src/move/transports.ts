/**
 * Transports (TS §3.4): embarking at the end of a move, disembarking before the transport moves, and passengers getting
 * out when their transport is destroyed (Emergency Disembarkation, CS §2).
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { registerInitialiser, type GameState } from '../core/state';
import type { Cmd, Evt, PlayerId, Problem } from '../core/types';
import { horizontalGap, within } from '../geometry/measure';
import { polygonOf, signedDistToPolygon, smallestDimension, type Placed, type Pos } from '../geometry/shapes';
import { casualtyOrder } from '../attack/allocate';
import { spendStratagem } from '../interact/stratagems';
import { livingModels, onBoard, placedModel, registerRemovedHook, removeModels, sheetOf, unitHas } from '../setup/units';
import { inBattle } from '../turn/phases';
import { placedAt, placementProblems } from './placement';

declare module '../core/types' {
  interface CommandMap {
    disembark: Cmd<'disembark'> & { unitId: string; positions: Record<string, Pos> };
    placePassengers: Cmd<'placePassengers'> & { transportId: string; placements: Record<string, Record<string, Pos>>; emergency: boolean };
  }
  interface EventMap {
    unitDisembarked: Evt<'unitDisembarked'> & { unitId: string; positions: Record<string, Pos>; fromDestroyed: boolean };
    placementRequired: Evt<'placementRequired'> & { request: PlacementRequest };
    placementDone: Evt<'placementDone'> & { transportId: string };
  }
}

/** Passengers waiting to be set up around a destroyed transport (its last hull positions are kept to measure from). */
export interface PlacementRequest { transportId: string; player: PlayerId; unitIds: string[]; hull: Placed[] }
declare module '../core/state' {
  interface GameState {
    placements: PlacementRequest[];
  }
}

registerInitialiser((s) => {
  s.placements = [];
});
registerApplier('unitDisembarked', (s, e) => {
  const u = s.units[e.unitId];
  for (const [id, pos] of Object.entries(e.positions)) s.models[id].pos = pos;
  u.location = 'battlefield';
  u.embarkedIn = null;
  u.turn.disembarked = true;
  u.turn.disembarkedThisPhase = true;
  if (e.fromDestroyed) u.turn.disembarkedFromDestroyed = true;
  // It counts as having moved and never as having Remained Stationary (TS §3.1, §3.4).
  if (u.turn.moved === 'none' || u.turn.moved === 'stationary') u.turn.moved = 'normal';
});
registerApplier('placementRequired', (s, e) => {
  s.placements.push(e.request);
});
registerApplier('placementDone', (s, e) => {
  s.placements = s.placements.filter((p) => p.transportId !== e.transportId);
});

/** Models already aboard. */
export function passengers(s: GameState, transportId: string): number {
  return Object.values(s.units)
    .filter((u) => u.location === 'embarked' && u.embarkedIn === transportId)
    .reduce((a, u) => a + livingModels(s, u.id).length, 0);
}

const enemyNear = (s: GameState, player: PlayerId, hull: Placed[]) =>
  Object.values(s.models).some(
    (m) => m.pos && !m.destroyed && s.units[m.unitId].player !== player && hull.some((h) => within(horizontalGap(h, placedModel(s, m)), 1) && Math.abs(h.pos.z - m.pos!.z) <= 5),
  );

/** Problems with embarking: every model ends within 3" of a friendly TRANSPORT not in enemy Engagement Range, with room. */
export function embarkProblems(s: GameState, unitId: string, transportId: string, placed: Placed[]): Problem[] {
  const u = s.units[unitId];
  const t = s.units[transportId];
  const rule = '[TS §3.4]';
  if (!t || t.player !== u.player || t.location !== 'battlefield' || !unitHas(s, t.id, 'TRANSPORT'))
    return [{ code: 'not-a-transport', message: 'Pick one of your Transports on the battlefield.', rule, unitId }];
  if (u.turn.disembarkedThisPhase) return [{ code: 'disembarked-this-phase', message: `${u.name} got out this phase, so it can't get back in.`, rule, unitId }];
  const out: Problem[] = [];
  const hull = onBoard(s, t.id).map((m) => placedModel(s, m));
  const far = placed.filter((p) => !hull.some((h) => within(horizontalGap(p, h), 3)));
  if (far.length) out.push({ code: 'too-far-to-embark', message: `Every model of ${u.name} must end within 3" of ${t.name} to embark.`, rule, unitId, modelIds: far.map((p) => p.id) });
  if (enemyNear(s, u.player, hull)) out.push({ code: 'transport-engaged', message: `${t.name} is within 1" of the enemy, so nothing can embark.`, rule, unitId });
  const capacity = sheetOf(s, t.id).transportCapacity;
  const count = passengers(s, t.id) + livingModels(s, unitId).length;
  if (capacity !== null && count > capacity) out.push({ code: 'transport-full', message: `${t.name} can carry ${capacity} models; that would be ${count}.`, rule, unitId });
  return out;
}

/** Wholly within `range` of the hull; a model too big to fit (smallest dimension over 3") needs only its base within 1" (TS §3.4). */
function nearHull(p: Placed, hull: Placed[], range: number): boolean {
  if (smallestDimension(p.base) > 3) return hull.some((h) => within(horizontalGap(p, h), 1));
  const verts = polygonOf(p.base, p.pos);
  return hull.some((h) => {
    const hp = polygonOf(h.base, h.pos);
    return verts.every((v) => Math.max(0, signedDistToPolygon(v, hp)) <= range + 1e-6);
  });
}

function getOutProblems(s: GameState, unitId: string, positions: Record<string, Pos>, hull: Placed[], range: number, allowMissing: boolean): Problem[] {
  const u = s.units[unitId];
  const { placed, problems } = placedAt(s, unitId, positions);
  const out = allowMissing ? problems.filter((p) => p.code !== 'missing-model') : problems;
  const far = placed.filter((p) => !nearHull(p, hull, range));
  if (far.length)
    out.push({ code: 'too-far-to-disembark', message: `Every model of ${u.name} must be set up wholly within ${range}" of the transport.`, rule: range === 6 ? '[CS §2]' : '[TS §3.4]', unitId, modelIds: far.map((p) => p.id) });
  out.push(...placementProblems(s, unitId, placed));
  return out;
}

registerHandler('disembark', (ctx, cmd) => {
  inBattle(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §3.4]');
  if (cmd.by !== s.active || s.phase !== 'movement' || s.step !== 'move-units')
    ctx.reject('wrong-phase', 'Units disembark in the Move Units step of your Movement phase.', '[TS §3.4]');
  if (s.pending || s.activation) ctx.reject('activation-open', 'Finish the current move first.', '[R-19]');
  if (u.location !== 'embarked' || !u.embarkedIn) ctx.reject('not-embarked', `${u.name} isn't in a transport.`, '[TS §3.4]');
  if (u.turn.embarkedThisPhase) ctx.reject('embarked-this-phase', `${u.name} got in this phase, so it can't get out again.`, '[TS §3.4]');
  const t = s.units[u.embarkedIn!];
  if ((t.turn.selected.move ?? 0) > 0 || (t.turn.moved !== 'none' && t.turn.moved !== 'stationary'))
    ctx.reject('transport-moved', `${t.name} has already moved this phase, so ${u.name} can't get out.`, '[WCR]');
  const hull = onBoard(s, t.id).map((m) => placedModel(s, m));
  const problems = getOutProblems(s, u.id, cmd.positions, hull, 3, false);
  if (problems.length) ctx.fail(problems);
  ctx.emit({ type: 'unitDisembarked', unitId: u.id, positions: cmd.positions, fromDestroyed: false });
});

/** When a transport's last model is destroyed with units aboard, they must get out (or die with it if it was off the table). */
registerRemovedHook((ctx, ids) => {
  const s = ctx.state;
  for (const t of new Set(ids.map((id) => s.models[id].unitId))) {
    const unit = s.units[t];
    if (unit.location !== 'destroyed') continue;
    const riders = Object.values(s.units).filter((u) => u.location === 'embarked' && u.embarkedIn === t).map((u) => u.id);
    if (!riders.length) continue;
    const hull = unit.modelIds.map((id) => s.models[id]).flatMap((m) => (m.lastPos ? [placedModel(s, m, m.lastPos)] : []));
    if (!hull.length) {
      removeModels(ctx, riders.flatMap((r) => livingModels(s, r).map((m) => m.id)), `aboard ${unit.name} when it was destroyed`, true);
      continue;
    }
    ctx.emit({ type: 'placementRequired', request: { transportId: t, player: unit.player, unitIds: riders, hull } });
  }
});

registerHandler('placePassengers', (ctx, cmd) => {
  inBattle(ctx);
  const s = ctx.state;
  if (s.pending) ctx.reject('pending-decision', 'Finish the current roll or decision first.', '[R-19]');
  const req = s.placements.find((p) => p.transportId === cmd.transportId);
  if (!req) return ctx.reject('no-placement', 'Nothing is waiting to get out of that transport.', '[TS §3.4]');
  if (req.player !== cmd.by) ctx.reject('not-your-unit', "Those are the other player's models.", '[TS §3.4]');
  const range = cmd.emergency ? 6 : 3;
  const problems = req.unitIds.flatMap((id) => getOutProblems(s, id, cmd.placements[id] ?? {}, req.hull, range, true));
  if (problems.length) ctx.fail(problems);
  if (cmd.emergency) spendStratagem(ctx, cmd.by, 'Emergency Disembarkation', 1, req.unitIds);
  ctx.emit({ type: 'placementDone', transportId: req.transportId });
  for (const id of req.unitIds) {
    const positions = cmd.placements[id] ?? {};
    const missing = livingModels(ctx.state, id).filter((m) => !positions[m.id]).map((m) => m.id);
    if (missing.length) removeModels(ctx, missing, 'could not be set up when its transport was destroyed', true);
    if (!Object.keys(positions).length) continue;
    ctx.emit({ type: 'unitDisembarked', unitId: id, positions, fromDestroyed: true });
    // TS §3.4: a D6 per model set up; each 1 (1–2 with Emergency Disembarkation, CS §2) kills one, owner's choice.
    const placed = Object.keys(positions).length;
    const dead = ctx.roll(placed, 6, 'transport', cmd.by, { context: 'destroyed transport' }).dice.filter((d) => d.value <= (cmd.emergency ? 2 : 1)).length;
    if (dead) removeModels(ctx, casualtyOrder(ctx.state, id).slice(0, dead).map((m) => m.id), 'hurt when its transport was destroyed', true);
  }
});
