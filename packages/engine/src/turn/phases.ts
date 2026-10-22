/**
 * Moving between steps, phases, turns and battle rounds (TS §1.9). Modules hook in with registerEnter/registerLeave
 * (at a step or a whole phase), registerTurnEnd and registerEndCheck ("can't end this step yet because …").
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { registerInitialiser, type GameState, type Phase, type Step } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId, type Problem } from '../core/types';
import { freshTurnFlags } from '../setup/units';

declare module '../core/types' {
  interface CommandMap {
    endStep: Cmd<'endStep'>;
    endPhase: Cmd<'endPhase'>;
  }
  interface EventMap {
    phaseChanged: Evt<'phaseChanged'> & { round: number; turn: 'first' | 'second' | null; active: PlayerId; phase: Phase; step: Step };
    turnStarted: Evt<'turnStarted'> & { round: number; active: PlayerId };
    gameEnded: Evt<'gameEnded'> & { winner: PlayerId | null; reason: 'battle-rounds' | 'concede' | 'agreed' };
  }
}

declare module '../core/state' {
  interface GameState {
    ended: { winner: PlayerId | null; reason: 'battle-rounds' | 'concede' | 'agreed' } | null;
  }
}

export const PHASE_ORDER: Phase[] = ['command', 'movement', 'psychic', 'shooting', 'charge', 'fight', 'morale'];
export const PHASE_STEPS: Record<Phase, Step[]> = {
  'pre-battle': ['deploy', 'first-turn'],
  command: ['main'],
  movement: ['move-units', 'reinforcements'],
  psychic: ['main'],
  shooting: ['main'],
  charge: ['charges', 'heroic-interventions'],
  fight: ['main'],
  morale: ['morale-tests', 'coherency'],
  ended: ['main'],
};

registerApplier('phaseChanged', (s, e) => {
  const newPhase = s.phase !== e.phase || s.turn !== e.turn || s.round !== e.round;
  s.round = e.round;
  s.turn = e.turn;
  s.active = e.active;
  s.phase = e.phase;
  s.step = e.step;
  if (newPhase)
    for (const u of Object.values(s.units)) {
      u.turn.selected = {};
      u.turn.extra = {};
      u.turn.embarkedThisPhase = false;
      u.turn.disembarkedThisPhase = false;
    }
  if (newPhase) for (const m of Object.values(s.models)) m.allocatedThisPhase = false;
});

registerInitialiser((s) => {
  s.ended = null;
});

registerApplier('turnStarted', (s) => {
  for (const u of Object.values(s.units)) u.turn = freshTurnFlags();
});

registerApplier('gameEnded', (s, e) => {
  s.ended = { winner: e.winner, reason: e.reason };
  s.phase = 'ended';
  s.step = 'main';
});

type Hook = (ctx: Ctx) => void;
type Where = { phase: Phase; step: Step | null };
const enter: (Where & { fn: Hook })[] = [];
const leave: (Where & { fn: Hook })[] = [];
const turnEnd: Hook[] = [];
const roundEnd: Hook[] = [];
const checks: (Where & { fn: (s: GameState) => Problem | null })[] = [];

/** Runs when the game enters the phase (step null) or the step. */
export function registerEnter(phase: Phase, step: Step | null, fn: Hook): void {
  enter.push({ phase, step, fn });
}
/** Runs when the game leaves the step, or (step null) the phase, before moving on. */
export function registerLeave(phase: Phase, step: Step | null, fn: Hook): void {
  leave.push({ phase, step, fn });
}
/** Runs at the end of each player turn (after the Morale phase), before the next turn starts. */
export function registerTurnEnd(fn: Hook): void {
  turnEnd.push(fn);
}
/** Runs at the end of each battle round (after the second turn). */
export function registerRoundEnd(fn: Hook): void {
  roundEnd.push(fn);
}
/** A step (or, with step null, every step of the phase) can't be ended while this returns a problem. */
export function registerEndCheck(phase: Phase, step: Step | null, fn: (s: GameState) => Problem | null): void {
  checks.push({ phase, step, fn });
}

const at = (w: Where, phase: Phase, step: Step | null) => w.phase === phase && w.step === step;

/** Moves to a phase/step, emitting the change, a new turn if the turn changed, and the entry hooks. */
export function goTo(ctx: Ctx, to: { round?: number; turn?: 'first' | 'second' | null; active?: PlayerId; phase: Phase; step?: Step }): void {
  const s = ctx.state;
  const before = { round: s.round, turn: s.turn, phase: s.phase };
  const e = {
    type: 'phaseChanged' as const,
    round: to.round ?? s.round,
    turn: to.turn === undefined ? s.turn : to.turn,
    active: to.active ?? s.active,
    phase: to.phase,
    step: to.step ?? PHASE_STEPS[to.phase][0],
  };
  const newTurn = e.round !== before.round || e.turn !== before.turn;
  if (newTurn && e.turn) ctx.emit({ type: 'turnStarted', round: e.round, active: e.active });
  ctx.emit(e);
  const phaseEntered = newTurn || e.phase !== before.phase;
  if (phaseEntered) for (const h of enter.filter((h) => at(h, e.phase, null))) h.fn(ctx);
  for (const h of enter.filter((h) => at(h, e.phase, e.step))) h.fn(ctx);
}

/** Ends the current step: checks, leave hooks, then the next step / phase / turn / round, or the end of the game. */
export function advance(ctx: Ctx): void {
  const s = ctx.state;
  const { phase, step } = s;
  const problems = checks.filter((c) => c.phase === phase && (c.step === step || c.step === null)).map((c) => c.fn(s)).filter((p): p is Problem => !!p);
  if (problems.length) ctx.fail(problems);
  for (const h of leave.filter((h) => at(h, phase, step))) h.fn(ctx);
  const steps = PHASE_STEPS[phase];
  const i = steps.indexOf(step);
  if (i < steps.length - 1) {
    goTo(ctx, { phase, step: steps[i + 1] });
    return;
  }
  for (const h of leave.filter((h) => at(h, phase, null))) h.fn(ctx);
  if (ctx.state.ended) return;
  const p = PHASE_ORDER.indexOf(phase);
  if (p < PHASE_ORDER.length - 1) {
    goTo(ctx, { phase: PHASE_ORDER[p + 1] });
    return;
  }
  for (const h of turnEnd) h(ctx);
  if (ctx.state.ended) return;
  if (s.turn === 'first') {
    goTo(ctx, { turn: 'second', active: other(s.active), phase: 'command' });
    return;
  }
  for (const h of roundEnd) h(ctx);
  if (ctx.state.ended) return;
  if (s.round >= s.setup.rules.battleRounds) {
    endGame(ctx, 'battle-rounds');
    return;
  }
  goTo(ctx, { round: s.round + 1, turn: 'first', active: s.firstPlayer ?? s.active, phase: 'command' });
}

/** The winner is the player with more VP (MP §4.16); a concession hands the game to the opponent. */
export function endGame(ctx: Ctx, reason: 'battle-rounds' | 'concede' | 'agreed', conceder?: PlayerId): void {
  let winner: PlayerId | null = null;
  if (reason === 'concede' && conceder) winner = other(conceder);
  else {
    const a = totalVp(ctx.state, 'A');
    const b = totalVp(ctx.state, 'B');
    winner = a === b ? null : a > b ? 'A' : 'B';
  }
  ctx.emit({ type: 'gameEnded', winner, reason });
}

/** Total VP; VP live in the objectives module's state (0 before it initialises them). */
export function totalVp(s: GameState, p: PlayerId): number {
  const v = (s as GameState & { vp?: Record<PlayerId, { primary: number; secondary: Record<string, number>; painted: number }> }).vp?.[p];
  if (!v) return 0;
  return v.primary + Object.values(v.secondary).reduce((a, x) => a + x, 0) + v.painted;
}

export function inBattle(ctx: Ctx): void {
  if (ctx.state.ended) ctx.reject('game-over', 'The game is over.', '[MP §4]');
  if (ctx.state.phase === 'pre-battle') ctx.reject('not-started', 'The battle hasn\'t started yet.', '[MP §4]');
}

function activeOnly(ctx: Ctx, by: PlayerId): void {
  inBattle(ctx);
  if (ctx.state.pending || ctx.state.placements?.length) ctx.reject('pending-decision', 'Finish the current roll or decision first.', '[R-19]');
  if (by !== ctx.state.active) ctx.reject('not-your-turn', 'Only the player whose turn it is can move the game on.', '[TS §1.9]');
}

registerHandler('endStep', (ctx, cmd) => {
  activeOnly(ctx, cmd.by);
  advance(ctx);
});

registerHandler('endPhase', (ctx, cmd) => {
  activeOnly(ctx, cmd.by);
  const { round, turn, phase } = ctx.state;
  for (let guard = 0; guard < 10; guard++) {
    advance(ctx);
    const s = ctx.state;
    if (s.ended || s.round !== round || s.turn !== turn || s.phase !== phase) return;
  }
});

export const isActive = (s: GameState, p: PlayerId) => s.active === p;
export { other };
