/** Pre-battle: declaring reserves, deploying (alternating, Defender first), the first-turn roll-off, starting the battle (MP §4). */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { total } from '../core/dice';
import type { GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId } from '../core/types';
import { whollyWithinPolygon } from '../geometry/measure';
import type { Pos } from '../geometry/shapes';
import { placedAt, placementProblems } from '../move/placement';
import { goTo } from '../turn/phases';
import { livingModels, sheetOf, unitHas, unitsOf, type UnitState } from './units';

declare module '../core/types' {
  interface CommandMap {
    declareReserves: Cmd<'declareReserves'> & { unitIds: string[]; kind: 'strategic' | 'deep-strike' };
    deploy: Cmd<'deploy'> & { unitId: string; positions: Record<string, Pos>; embarked?: string[] };
    rollOffFirstTurn: Cmd<'rollOffFirstTurn'>;
    chooseFirstTurn: Cmd<'chooseFirstTurn'> & { first: PlayerId };
    beginBattle: Cmd<'beginBattle'>;
  }
  interface EventMap {
    reservesDeclared: Evt<'reservesDeclared'> & { player: PlayerId; unitIds: string[]; kind: 'strategic' | 'deep-strike'; cp: number };
    unitDeployed: Evt<'unitDeployed'> & { unitId: string; positions: Record<string, Pos>; embarked: string[]; next: PlayerId };
    deploymentEnded: Evt<'deploymentEnded'> & { destroyed: string[] };
    firstTurnRolled: Evt<'firstTurnRolled'> & { winner: PlayerId; first: PlayerId | null };
    firstTurnChosen: Evt<'firstTurnChosen'> & { first: PlayerId };
  }
}

/** TS §3.3: 1 CP for 1–9 combined Power Rating, 2 for 10–19, 3 for 20–29 … (+1 CP per 10 PR). */
export function strategicReservesCost(pr: number): number {
  return pr <= 0 ? 0 : Math.floor(pr / 10) + 1;
}

const isAircraft = (s: GameState, u: UnitState) => unitHas(s, u.id, 'AIRCRAFT');
const isFortification = (s: GameState, u: UnitState) => sheetOf(s, u.id).role === 'Fortification' || unitHas(s, u.id, 'FORTIFICATION');
const pointsOf = (s: GameState, u: UnitState) => sheetOf(s, u.id).points;

function inPreBattle(ctx: Ctx, step: 'deploy' | 'first-turn'): void {
  if (ctx.state.phase !== 'pre-battle' || ctx.state.step !== step)
    ctx.reject('wrong-step', step === 'deploy' ? 'Deployment is over.' : 'Finish deploying first.', '[MP §4]');
}

registerHandler('declareReserves', (ctx, cmd) => {
  inPreBattle(ctx, 'deploy');
  const s = ctx.state;
  const units = cmd.unitIds.map((id) => s.units[id]);
  if (!units.length || units.some((u) => !u || u.player !== cmd.by || u.location !== 'deploying'))
    ctx.reject('not-deployable', 'Pick your own units that are still waiting to deploy.', '[MP §4]');
  const fort = units.find((u) => isFortification(s, u));
  if (fort) ctx.reject('fortification-reserves', `${fort.name} is a Fortification: Fortifications can never be placed in reserve.`, '[TS §3.3]', { unitId: fort.id });
  // R-22: Aircraft (who must start in Strategic Reserves) don't count toward the limits.
  const army = unitsOf(s, cmd.by);
  const off = [...army.filter((u) => u.location === 'reserves' && !isAircraft(s, u)), ...units.filter((u) => !isAircraft(s, u))];
  const offPts = off.reduce((a, u) => a + pointsOf(s, u), 0);
  const allPts = army.reduce((a, u) => a + pointsOf(s, u), 0);
  if (off.length * 2 > army.length || (offPts > 0 && offPts * 2 >= allPts))
    ctx.reject('too-many-in-reserve', 'No more than half your units, and less than half your points, can start off the battlefield.', '[MP §4]');
  const aircraftPts = army.filter((u) => isAircraft(s, u)).reduce((a, u) => a + pointsOf(s, u), 0);
  if (aircraftPts * 2 > allPts) ctx.reject('aircraft-fill-reserves', 'Your Aircraft are more than half your points, so no other unit can start in reserve.', '[MP §3]');
  let cp = 0;
  if (cmd.kind === 'strategic' && !s.setup.rules.strategicReservesFree) {
    const pr = (list: UnitState[]) => list.filter((u) => u.reserveKind === 'strategic' && !isAircraft(s, u)).reduce((a, u) => a + sheetOf(s, u.id).powerRating, 0);
    const before = pr(army);
    const after = before + units.filter((u) => !isAircraft(s, u)).reduce((a, u) => a + sheetOf(s, u.id).powerRating, 0);
    cp = strategicReservesCost(after) - strategicReservesCost(before);
    if (cp > s.cp[cmd.by]) ctx.reject('not-enough-cp', `Strategic Reserves cost ${cp} CP here and you have ${s.cp[cmd.by]}.`, '[TS §3.3]');
  }
  ctx.emit({ type: 'reservesDeclared', player: cmd.by, unitIds: cmd.unitIds, kind: cmd.kind, cp });
  afterDeploymentChange(ctx);
});

registerApplier('reservesDeclared', (s, e) => {
  for (const id of e.unitIds) Object.assign(s.units[id], { location: 'reserves', reserveKind: e.kind });
  s.cp[e.player] -= e.cp;
  if (!deploying(s, s.deploy.next).length) s.deploy.next = other(s.deploy.next);
});

const deploying = (s: GameState, p: PlayerId) => unitsOf(s, p).filter((u) => u.location === 'deploying');
function nextDeployer(s: GameState, justDeployed: PlayerId): PlayerId {
  return deploying(s, other(justDeployed)).length ? other(justDeployed) : justDeployed;
}

registerHandler('deploy', (ctx, cmd) => {
  inPreBattle(ctx, 'deploy');
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) ctx.reject('not-your-unit', 'Pick one of your own units.', '[MP §4]');
  if (isAircraft(s, u) && s.setup.rules.aircraftStartInReserves)
    ctx.reject('aircraft-in-reserves', `${u.name} is an Aircraft: Aircraft must start the battle in Strategic Reserves.`, '[BD §6]', { unitId: u.id });
  if (u.location !== 'deploying') ctx.reject('not-deployable', `${u.name} has already been set up or placed in reserve.`, '[MP §4]', { unitId: u.id });
  if (s.deploy.next !== cmd.by && deploying(s, s.deploy.next).length)
    ctx.reject('not-your-deployment', `It's the other player's turn to set up a unit.`, '[MP §4]');
  const { placed, problems } = placedAt(s, u.id, cmd.positions);
  if (problems.length) ctx.fail(problems);
  const zone = s.setup.zones[cmd.by];
  const outside = placed.filter((p) => !whollyWithinPolygon(p, zone));
  if (outside.length)
    ctx.reject('outside-deployment-zone', `Every model of ${u.name} must be wholly within your deployment zone.`, '[MP §4]', { unitId: u.id, modelIds: outside.map((p) => p.id) });
  const issues = placementProblems(s, u.id, placed);
  if (issues.length) ctx.fail(issues);
  const embarked = cmd.embarked ?? [];
  if (embarked.length) {
    if (!unitHas(s, u.id, 'TRANSPORT')) ctx.reject('not-a-transport', `${u.name} isn't a Transport.`, '[TS §3.4]');
    const riders = embarked.map((id) => s.units[id]);
    if (riders.some((r) => !r || r.player !== cmd.by || r.location !== 'deploying' || r.id === u.id))
      ctx.reject('not-deployable', 'Only your own units still waiting to deploy can start embarked.', '[TS §3.4]');
    const capacity = sheetOf(s, u.id).transportCapacity;
    const count = riders.reduce((a, r) => a + livingModels(s, r.id).length, 0);
    if (capacity !== null && count > capacity)
      ctx.reject('transport-full', `${u.name} can carry ${capacity} models; that would be ${count}.`, '[TS §3.4]', { unitId: u.id });
  }
  ctx.emit({ type: 'unitDeployed', unitId: u.id, positions: cmd.positions, embarked, next: cmd.by });
  afterDeploymentChange(ctx);
});

registerApplier('unitDeployed', (s, e) => {
  s.units[e.unitId].location = 'battlefield';
  for (const [id, pos] of Object.entries(e.positions)) s.models[id].pos = pos;
  for (const id of e.embarked) Object.assign(s.units[id], { location: 'embarked', embarkedIn: e.unitId });
  s.deploy.next = nextDeployer(s, e.next);
});

/** When nobody has units left to deploy, deployment ends (and Arks of Omen removes empty Dedicated Transports, GT §5). */
function afterDeploymentChange(ctx: Ctx): void {
  const s = ctx.state;
  if (deploying(s, 'A').length || deploying(s, 'B').length) return;
  const destroyed = s.setup.rules.emptyDedicatedTransportsDestroyed
    ? Object.values(s.units)
        .filter((u) => u.location === 'battlefield' && sheetOf(s, u.id).role === 'Dedicated Transport')
        .filter((t) => !Object.values(s.units).some((x) => x.embarkedIn === t.id && x.location === 'embarked'))
        .map((t) => t.id)
    : [];
  ctx.emit({ type: 'deploymentEnded', destroyed });
}

registerApplier('deploymentEnded', (s, e) => {
  for (const id of e.destroyed) {
    s.units[id].location = 'destroyed';
    for (const m of s.units[id].modelIds) Object.assign(s.models[m], { destroyed: true, pos: null });
  }
  s.step = 'first-turn';
});

registerHandler('rollOffFirstTurn', (ctx) => {
  inPreBattle(ctx, 'first-turn');
  const s = ctx.state;
  if (s.firstPlayer || s.rollOffWinner) ctx.reject('first-turn-decided', 'Who goes first has already been decided.', '[MP §4]');
  // TS §1.6: each player rolls a D6; ties are rolled again; roll-offs can't be re-rolled or modified.
  for (;;) {
    const a = total(ctx.roll(1, 6, 'roll-off', 'A', { context: 'first turn' }));
    const b = total(ctx.roll(1, 6, 'roll-off', 'B', { context: 'first turn' }));
    if (a === b) continue;
    const winner: PlayerId = a > b ? 'A' : 'B';
    ctx.emit({ type: 'firstTurnRolled', winner, first: s.setup.rules.firstTurn === 'winner-first' ? winner : null });
    return;
  }
});

registerApplier('firstTurnRolled', (s, e) => {
  s.rollOffWinner = e.winner;
  s.firstPlayer = e.first;
  s.rolls = {};
});

registerHandler('chooseFirstTurn', (ctx, cmd) => {
  inPreBattle(ctx, 'first-turn');
  const s = ctx.state;
  if (s.firstPlayer) ctx.reject('first-turn-decided', 'Who goes first has already been decided.', '[MP §4]');
  if (s.rollOffWinner !== cmd.by) ctx.reject('not-roll-off-winner', 'The player who won the roll-off chooses who goes first.', '[MP §4]');
  ctx.emit({ type: 'firstTurnChosen', first: cmd.first });
});

registerApplier('firstTurnChosen', (s, e) => {
  s.firstPlayer = e.first;
});

registerHandler('beginBattle', (ctx) => {
  inPreBattle(ctx, 'first-turn');
  const first = ctx.state.firstPlayer;
  if (!first) return ctx.reject('first-turn-undecided', 'Decide who goes first.', '[MP §4]');
  goTo(ctx, { round: 1, turn: 'first', active: first, phase: 'command' });
});
