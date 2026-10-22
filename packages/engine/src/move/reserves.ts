/**
 * The Reinforcements step (TS §3.2): Strategic Reserves (TS §3.3), Deep Strike-style arrivals (GL §5) and Aircraft
 * (TS §3.5). Set-up distances are horizontal (TS §1.4, FAQ §2.3).
 */
import { registerApplier } from '../core/apply';
import { registerHandler } from '../core/context';
import type { Edge, GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId, type Problem } from '../core/types';
import { horizontalGap, inEngagementRange, moreThan, whollyWithinPolygon, anyPartWithin } from '../geometry/measure';
import { polygonOf, smallestDimension, type Placed, type Pos } from '../geometry/shapes';
import { noActivation, selectedOut } from '../interact/activation';
import { noPending } from '../interact/windows';
import { onBoard, placedModel, unitHas, unitsOf } from '../setup/units';
import { inBattle } from '../turn/phases';
import { placedAt, placementProblems } from './placement';

declare module '../core/types' {
  interface CommandMap {
    arrive: Cmd<'arrive'> & { unitId: string; positions: Record<string, Pos> };
    aircraftLeave: Cmd<'aircraftLeave'> & { unitId: string };
  }
  interface EventMap {
    unitArrived: Evt<'unitArrived'> & { unitId: string; positions: Record<string, Pos>; countsAsCharged: boolean; chargeTargets: string[]; large: boolean };
    unitLeftBattlefield: Evt<'unitLeftBattlefield'> & { unitId: string };
  }
}

registerApplier('unitArrived', (s, e) => {
  const u = s.units[e.unitId];
  for (const [id, pos] of Object.entries(e.positions)) s.models[id].pos = pos;
  u.location = 'battlefield';
  u.reserveKind = null;
  // TS §3.2: Reinforcements count as having moved (their full Move) and can't move again this phase.
  Object.assign(u.turn, { arrived: true, moved: 'normal', arrivedLarge: e.large });
  if (e.countsAsCharged) Object.assign(u.turn, { charged: true, countsAsCharged: true, chargeTargets: e.chargeTargets });
});
registerApplier('unitLeftBattlefield', (s, e) => {
  const u = s.units[e.unitId];
  u.location = 'reserves';
  u.reserveKind = 'strategic';
  u.flags.leftBattlefield = true;
  u.turn.leftThisTurn = true;
  u.turn.selected.move = (u.turn.selected.move ?? 0) + 1;
  for (const id of u.modelIds) s.models[id].pos = null;
});

/** Distance from a point to an edge line. */
function edgeDistance(s: GameState, edge: Edge, p: { x: number; y: number }): number {
  const { w, h } = s.setup.board;
  return edge === 'south' ? p.y : edge === 'north' ? h - p.y : edge === 'west' ? p.x : w - p.x;
}
const EDGES: Edge[] = ['north', 'south', 'east', 'west'];
/** Every part of the model is within `d` of the edge. */
const whollyNearEdge = (s: GameState, m: Placed, edge: Edge, d: number) => polygonOf(m.base, m.pos).every((v) => edgeDistance(s, edge, v) <= d + 1e-6);
/** The closest part of the model is within `d` of the edge. */
const touchesNearEdge = (s: GameState, m: Placed, edge: Edge, d: number) => polygonOf(m.base, m.pos).some((v) => edgeDistance(s, edge, v) <= d + 1e-6);

function arrivalProblems(s: GameState, unitId: string, placed: Placed[], player: PlayerId): { problems: Problem[]; edgeException: boolean; large: boolean } {
  const u = s.units[unitId];
  const out: Problem[] = [];
  const aircraft = unitHas(s, unitId, 'AIRCRAFT');
  const strategic = u.reserveKind === 'strategic' && !aircraft;
  const own = s.setup.edges[player];
  const enemyEdge = s.setup.edges[other(player)];
  const large = strategic && placed.some((p) => smallestDimension(p.base) > 6);
  // TS §3.3: within 1" of your own edge and wholly in your own deployment zone → the 9" rule doesn't apply.
  const edgeException = strategic && placed.every((p) => touchesNearEdge(s, p, own, 1) && whollyWithinPolygon(p, s.setup.zones[player]));
  if (strategic) {
    if (large) {
      if (!placed.every((p) => touchesNearEdge(s, p, own, 0)))
        out.push({ code: 'large-must-touch-edge', message: `${u.name} is too big for the 6" edge band: its models must touch your battlefield edge.`, rule: '[TS §3.3]', unitId });
    } else {
      const ok = (p: Placed) => EDGES.filter((e) => e !== enemyEdge).some((e) => whollyNearEdge(s, p, e, 6));
      const bad = placed.filter((p) => !ok(p));
      if (bad.length)
        out.push({ code: 'not-near-edge', message: `${u.name} must arrive wholly within 6" of a battlefield edge other than your opponent's.`, rule: '[TS §3.3]', unitId, modelIds: bad.map((p) => p.id) });
      if (s.round === 2) {
        const inZone = placed.filter((p) => anyPartWithin(p, s.setup.zones[other(player)]));
        if (inZone.length)
          out.push({ code: 'enemy-zone', message: `In battle round 2, ${u.name} can't arrive in your opponent's deployment zone.`, rule: '[TS §3.3]', unitId, modelIds: inZone.map((p) => p.id) });
      }
    }
  }
  if (!edgeException) {
    const enemies = unitsOf(s, other(player)).flatMap((e) => onBoard(s, e.id)).map((m) => placedModel(s, m));
    const close = placed.filter((p) => enemies.some((e) => !moreThan(horizontalGap(p, e), 9)));
    if (close.length)
      out.push({ code: 'within-9', message: `${u.name} must be set up more than 9" (measured horizontally) from every enemy model.`, rule: '[FAQ §2.3]', unitId, modelIds: close.map((p) => p.id) });
  }
  return { problems: out, edgeException, large };
}

registerHandler('arrive', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §3.2]');
  if (cmd.by !== s.active || s.phase !== 'movement' || s.step !== 'reinforcements')
    ctx.reject('wrong-phase', 'Units arrive in the Reinforcements step of your Movement phase.', '[TS §3.2]');
  if (u.location !== 'reserves') ctx.reject('not-in-reserve', `${u.name} isn't waiting in reserve.`, '[TS §3.2]');
  if (s.round < s.setup.rules.reservesFromRound) ctx.reject('too-early', `Units can't arrive from reserve before battle round ${s.setup.rules.reservesFromRound}.`, '[TS §3.3]');
  if (u.turn.leftThisTurn) ctx.reject('left-this-turn', `${u.name} left the battlefield this turn: it can come back next turn.`, '[TS §3.5]');
  const { placed, problems } = placedAt(s, u.id, cmd.positions);
  if (problems.length) ctx.fail(problems);
  const arrival = arrivalProblems(s, u.id, placed, cmd.by);
  const issues = [...arrival.problems, ...placementProblems(s, u.id, placed, { allowEngagement: arrival.edgeException })];
  if (issues.length) ctx.fail(issues);
  const enemies = unitsOf(s, other(cmd.by)).filter((e) => onBoard(s, e.id).some((m) => placed.some((p) => inEngagementRange(p, placedModel(s, m)))));
  ctx.emit({ type: 'unitArrived', unitId: u.id, positions: cmd.positions, countsAsCharged: enemies.length > 0, chargeTargets: enemies.map((e) => e.id), large: arrival.large });
});

registerHandler('aircraftLeave', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §3.5]');
  if (cmd.by !== s.active || s.phase !== 'movement' || s.step !== 'move-units')
    ctx.reject('wrong-phase', 'Aircraft leave the battlefield in the Move Units step of your Movement phase.', '[TS §3.5]');
  if (!unitHas(s, u.id, 'AIRCRAFT') || u.location !== 'battlefield') ctx.reject('not-aircraft', `${u.name} isn't an Aircraft on the battlefield.`, '[TS §3.5]');
  if (selectedOut(u, 'move')) ctx.reject('already-moved', `${u.name} has already moved this phase.`, '[TS §3.5]');
  ctx.emit({ type: 'unitLeftBattlefield', unitId: u.id });
});
