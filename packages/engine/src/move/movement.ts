/** The Movement phase's Move Units step (TS §3.1): Normal Move, Advance, Fall Back, Remain Stationary; Aircraft (TS §3.5). */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { total } from '../core/dice';
import type { GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId, type Problem } from '../core/types';
import { currentChars, has } from '../datasheet/profile';
import type { Pos } from '../geometry/shapes';
import { inflictMortalWounds } from '../attack/allocate';
import { noActivation, selectedOut } from '../interact/activation';
import { effectsFor } from '../interact/effects';
import { canAfford, spendStratagem } from '../interact/stratagems';
import { noPending, offerReaction, registerContinuation, rollWindowed } from '../interact/windows';
import { livingModels, onBoard, placedModel, profileOf, sheetOf, unitHas, unitsOf, type ModelState, type UnitState } from '../setup/units';
import { inEngagementRange } from '../geometry/measure';
import { inBattle, registerEndCheck, registerLeave } from '../turn/phases';
import { checkMoves, moveInches, type MoveSpec } from './moves';
import { embarkProblems } from './transports';

export type MoveKind = 'normal' | 'advance' | 'fall-back';

declare module '../interact/activation' {
  interface ActivationMap {
    move: { kind: 'move'; unitId: string; moveKind: MoveKind; bonus: number; rolled: boolean; breakout?: true };
  }
}
declare module '../core/types' {
  interface CommandMap {
    beginMove: Cmd<'beginMove'> & { unitId: string; kind: MoveKind };
    completeMove: Cmd<'completeMove'> & { unitId: string; moves: Record<string, MoveSpec>; embarkInto?: string };
    cancelMove: Cmd<'cancelMove'> & { unitId: string };
    remainStationary: Cmd<'remainStationary'> & { unitId: string };
  }
  interface EventMap {
    unitMoved: Evt<'unitMoved'> & { unitId: string; moveKind: MoveKind; positions: Record<string, Pos>; embarkInto?: string };
    unitsStayed: Evt<'unitsStayed'> & { unitIds: string[] };
  }
}

registerApplier('unitMoved', (s, e) => {
  const u = s.units[e.unitId];
  for (const [id, pos] of Object.entries(e.positions)) s.models[id].pos = pos;
  u.turn.moved = e.moveKind;
  // Embarked units count as having made the same type of move as their transport (TS §3.4).
  for (const x of Object.values(s.units)) if (x.location === 'embarked' && x.embarkedIn === u.id) x.turn.moved = e.moveKind;
  if (e.embarkInto) {
    u.location = 'embarked';
    u.embarkedIn = e.embarkInto;
    u.turn.embarkedThisPhase = true;
    for (const id of u.modelIds) s.models[id].pos = null;
  }
});
registerApplier('unitsStayed', (s, e) => {
  for (const id of e.unitIds) s.units[id].turn.moved = 'stationary';
});

const isAircraftModel = (s: GameState, m: ModelState) => unitHas(s, m.unitId, 'AIRCRAFT');

/** Enemy models (not AIRCRAFT) within Engagement Range of any of the unit's models. */
export function engagingEnemies(s: GameState, unitId: string, includeAircraft = false): ModelState[] {
  const own = onBoard(s, unitId);
  const out: ModelState[] = [];
  for (const e of unitsOf(s, other(s.units[unitId].player)))
    for (const m of onBoard(s, e.id))
      if ((includeAircraft || !isAircraftModel(s, m)) && own.some((o) => inEngagementRange(placedModel(s, o), placedModel(s, m)))) out.push(m);
  return out;
}

/** Is the unit within Engagement Range of enemy models (enemy AIRCRAFT don't count for moving, TS §3.5)? */
export const isEngaged = (s: GameState, unitId: string, includeAircraft = false) => engagingEnemies(s, unitId, includeAircraft).length > 0;

export function moveGuards(ctx: Ctx, by: PlayerId, unitId: string): UnitState {
  inBattle(ctx);
  noPending(ctx);
  const s = ctx.state;
  if (by !== s.active) ctx.reject('not-your-turn', "It's not your turn.", '[TS §1.9]');
  const u = s.units[unitId];
  if (!u || u.player !== by) ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §3.1]');
  if (s.phase !== 'movement' || s.step !== 'move-units') ctx.reject('wrong-phase', 'Units move in the Move Units step of your Movement phase.', '[TS §3.1]');
  if (u.location !== 'battlefield') ctx.reject('not-on-battlefield', `${u.name} isn't on the battlefield.`, '[TS §3.1]', { unitId });
  return u;
}

registerHandler('beginMove', (ctx, cmd) => {
  const u = moveGuards(ctx, cmd.by, cmd.unitId);
  const s = ctx.state;
  noActivation(ctx);
  if (selectedOut(u, 'move')) ctx.reject('already-moved', `${u.name} has already been selected to move this phase.`, '[TS §3.1]', { unitId: u.id });
  if (u.turn.brokeOut) ctx.reject('broke-out', `${u.name} made a Desperate Breakout and can do nothing else this turn.`, '[CS §2]', { unitId: u.id });
  if (u.turn.arrived) ctx.reject('arrived', `${u.name} arrived this turn: it can't move again.`, '[TS §3.2]', { unitId: u.id });
  const aircraft = unitHas(s, u.id, 'AIRCRAFT');
  const engaged = !aircraft && isEngaged(s, u.id);
  if (engaged && cmd.kind !== 'fall-back')
    ctx.reject('engaged', `${u.name} is within 1" of the enemy: it can only Fall Back or stay where it is.`, '[TS §3.1]', { unitId: u.id });
  if (!engaged && cmd.kind === 'fall-back') ctx.reject('not-engaged', `${u.name} isn't within 1" of an enemy unit, so it has nothing to Fall Back from.`, '[TS §3.1]', { unitId: u.id });
  ctx.emit({ type: 'unitSelected', unitId: u.id, kind: 'move', delta: 1 });
  ctx.emit({ type: 'activationSet', activation: { kind: 'move', unitId: u.id, moveKind: cmd.kind, bonus: 0, rolled: cmd.kind !== 'advance' } });
  if (cmd.kind === 'advance')
    rollWindowed(ctx, 1, 6, 'advance', cmd.by, { context: `${u.name} Advance roll`, then: { module: 'movement', step: 'advanceRolled', data: { unitId: u.id } } });
  if (cmd.kind === 'fall-back') offerCutThemDown(ctx, u);
});

registerContinuation('movement', 'advanceRolled', (ctx, d: { unitId: string; rollId: string }) => {
  const mod = effectsFor(ctx.state, d.unitId, 'self').reduce((a, e) => a + (e.kind === 'mod' && e.roll === 'advance' ? e.value : 0), 0);
  const bonus = Math.max(0, total(ctx.state.rolls[d.rollId]) + mod);
  ctx.emit({ type: 'activationSet', activation: { kind: 'move', unitId: d.unitId, moveKind: 'advance', bonus, rolled: true } });
});

/** CS §2 Cut Them Down: when an enemy unit Falls Back, before it moves, 1 CP: a D6 per model in Engagement Range, each 6 is a mortal wound. */
function offerCutThemDown(ctx: Ctx, u: UnitState): void {
  const s = ctx.state;
  const foe = other(u.player);
  const options = canAfford(s, foe, 'Cut Them Down', 1) && engagingEnemies(s, u.id).length ? ['cut-them-down'] : [];
  offerReaction(ctx, { reaction: 'cut-them-down', player: foe, subjectUnitId: u.id, options, then: { module: 'movement', step: 'cutThemDown', data: { unitId: u.id } } });
}

registerContinuation('movement', 'cutThemDown', (ctx, d: { unitId: string; choice: string }) => {
  if (d.choice !== 'cut-them-down') return;
  const s = ctx.state;
  const foe = other(s.units[d.unitId].player);
  spendStratagem(ctx, foe, 'Cut Them Down', 1, [d.unitId]);
  const models = engagingEnemies(s, d.unitId);
  const sixes = ctx.roll(models.length, 6, 'other', foe, { context: 'Cut Them Down' }).dice.filter((x) => x.value === 6).length;
  if (sixes) inflictMortalWounds(ctx, d.unitId, sixes, 'Cut Them Down');
});

registerHandler('completeMove', (ctx, cmd) => {
  const u = moveGuards(ctx, cmd.by, cmd.unitId);
  const s = ctx.state;
  const a = s.activation;
  if (!a || a.kind !== 'move' || a.unitId !== u.id) return ctx.reject('not-moving', `Start ${u.name}'s move first.`, '[TS §3.1]');
  if (!a.rolled) ctx.reject('roll-first', 'Roll for the Advance first.', '[TS §3.1]');
  const check = checkMoves(s, u.id, cmd.moves, {
    type: a.breakout ? 'breakout' : a.moveKind,
    allowance: (m) => moveInches(s, m) + a.bonus,
    difficultGround: true,
  });
  let problems: Problem[] = check.problems;
  if (a.breakout) problems = problems.filter((p) => p.code !== 'engagement-range' && p.code !== 'coherency');
  if (cmd.embarkInto) problems.push(...embarkProblems(s, u.id, cmd.embarkInto, check.placed));
  if (problems.length) ctx.fail(problems);
  const moved = Object.fromEntries(Object.keys(cmd.moves).map((id) => [id, check.final[id]]));
  ctx.emit({ type: 'unitMoved', unitId: u.id, moveKind: a.moveKind, positions: moved, ...(cmd.embarkInto ? { embarkInto: cmd.embarkInto } : {}) });
  ctx.emit({ type: 'activationCleared' });
  if (a.breakout) {
    // CS §2: any model that ends a Desperate Breakout within Engagement Range is destroyed.
    const caught = onBoard(ctx.state, u.id).filter((m) => engagingEnemies(ctx.state, u.id).length && isModelEngaged(ctx.state, m));
    if (caught.length) removeCaught(ctx, caught.map((m) => m.id));
  }
  afterMove(ctx, u.id);
});

function isModelEngaged(s: GameState, m: ModelState): boolean {
  const foe = other(s.units[m.unitId].player);
  return unitsOf(s, foe).some((e) => onBoard(s, e.id).some((x) => !unitHas(s, x.unitId, 'AIRCRAFT') && inEngagementRange(placedModel(s, m), placedModel(s, x))));
}

type AfterMove = (ctx: Ctx, unitId: string) => void;
const afterMoveHooks: AfterMove[] = [];
/** Runs after a unit completes a move of any kind (actions fail, Task 18). */
export function registerAfterMove(fn: AfterMove): void {
  afterMoveHooks.push(fn);
}
export function afterMove(ctx: Ctx, unitId: string): void {
  for (const h of afterMoveHooks) h(ctx, unitId);
}

let removeCaught: (ctx: Ctx, ids: string[]) => void = () => {};
/** Wired by breakout.ts to avoid an import cycle. */
export function setBreakoutRemoval(fn: (ctx: Ctx, ids: string[]) => void): void {
  removeCaught = fn;
}

registerHandler('cancelMove', (ctx, cmd) => {
  const u = moveGuards(ctx, cmd.by, cmd.unitId);
  const a = ctx.state.activation;
  if (!a || a.kind !== 'move' || a.unitId !== u.id) return ctx.reject('not-moving', `${u.name} isn't moving.`, '[TS §3.1]');
  if (a.moveKind === 'advance') ctx.reject('advance-rolled', 'The Advance roll has been made: the unit must move (it can move 0").', '[TS §3.1]');
  if (a.breakout) ctx.reject('breakout', 'A Desperate Breakout must be finished.', '[CS §2]');
  ctx.emit({ type: 'activationCleared' });
  ctx.emit({ type: 'unitSelected', unitId: u.id, kind: 'move', delta: -1 });
});

registerHandler('remainStationary', (ctx, cmd) => {
  const u = moveGuards(ctx, cmd.by, cmd.unitId);
  noActivation(ctx);
  if (selectedOut(u, 'move')) ctx.reject('already-moved', `${u.name} has already been selected to move this phase.`, '[TS §3.1]', { unitId: u.id });
  ctx.emit({ type: 'unitSelected', unitId: u.id, kind: 'move', delta: 1 });
  ctx.emit({ type: 'unitsStayed', unitIds: [u.id] });
});

/** Units that weren't moved in the Move Units step Remained Stationary (TS §3.1); embarked units do as their transport did. */
registerLeave('movement', 'move-units', (ctx) => {
  const s = ctx.state;
  const ids = unitsOf(s, s.active)
    .filter((u) => u.turn.moved === 'none' && (u.location === 'battlefield' || (u.location === 'embarked' && s.units[u.embarkedIn!]?.location === 'battlefield')))
    .map((u) => u.id);
  if (ids.length) ctx.emit({ type: 'unitsStayed', unitIds: ids });
});

registerEndCheck('movement', 'move-units', (s) => {
  if (s.activation?.kind === 'move') return { code: 'activation-open', message: `Finish moving ${s.units[s.activation.unitId].name} first.`, rule: '[TS §3.1]' };
  const idle = unitsOf(s, s.active).find((u) => u.location === 'battlefield' && unitHas(s, u.id, 'AIRCRAFT') && u.turn.moved === 'none');
  if (idle)
    return { code: 'aircraft-must-move', message: `${idle.name} must move at least its minimum Move, or leave the battlefield into Strategic Reserves.`, rule: '[TS §3.5]', unitId: idle.id };
  return null;
});

export { currentChars, has, livingModels, profileOf, sheetOf };
