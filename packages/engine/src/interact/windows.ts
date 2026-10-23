/**
 * Roll windows and other pauses. After a roll the Command Re-roll stratagem can target (CS §2), the game waits so the
 * roller can re-roll (Command Re-roll or an ability), replace a die (toolkit) or confirm. What happens next is a
 * serialisable Continuation, so a saved game can resume mid-roll.
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { WINDOWED, type DiceState, type Die, type RollKind } from '../core/dice';
import { registerInitialiser } from '../core/state';
import type { Cmd, Evt, PlayerId } from '../core/types';
import { spendStratagem } from './stratagems';

export interface Continuation { module: string; step: string; data: unknown }
export type ReactionKind = 'cut-them-down' | 'charge-declared' | 'counter-offensive' | 'deny' | 'emergency-disembark';

export type Pending =
  | { kind: 'roll'; rollId: string; player: PlayerId; then: Continuation }
  | { kind: 'reaction'; reaction: ReactionKind; player: PlayerId; subjectUnitId: string; options: string[]; then: Continuation }
  | { kind: 'placement'; player: PlayerId; transportId: string; unitIds: string[]; then: Continuation };

declare module '../core/state' {
  interface GameState {
    pending: Pending | null;
  }
}
declare module '../core/types' {
  interface CommandMap {
    confirmRoll: Cmd<'confirmRoll'>;
    reroll: Cmd<'reroll'> & { dice: number[]; source: 'command-reroll' | 'ability'; note?: string };
    respond: Cmd<'respond'> & { choice: string };
  }
  interface EventMap {
    pendingSet: Evt<'pendingSet'> & { pending: Pending };
    pendingCleared: Evt<'pendingCleared'>;
    diceRerolled: Evt<'diceRerolled'> & { rollId: string; indices: number[]; values: number[]; source: 'command-reroll' | 'ability' | 'auto'; dice: DiceState };
    rollClosed: Evt<'rollClosed'> & { rollId: string };
  }
}

/**
 * A reaction choice is "kind" or "kind:unitId". Unit ids may themselves contain ":" (the sandbox prefixes them with the
 * player, e.g. "B:3f2a"), so only the first ":" separates the two.
 */
export function choiceParts(choice: string): { kind: string; unitId: string | undefined } {
  const i = choice.indexOf(':');
  return i < 0 ? { kind: choice, unitId: undefined } : { kind: choice.slice(0, i), unitId: choice.slice(i + 1) };
}

registerInitialiser((s) => {
  s.pending = null;
});
registerApplier('pendingSet', (s, e) => {
  s.pending = e.pending;
});
registerApplier('pendingCleared', (s) => {
  s.pending = null;
});
registerApplier('diceRerolled', (s, e) => {
  const r = s.rolls[e.rollId];
  e.indices.forEach((i, k) => {
    r.dice[i] = { ...r.dice[i], value: e.values[k], rerolled: true };
  });
  s.dice = e.dice;
});
registerApplier('rollClosed', (s, e) => {
  delete s.rolls[e.rollId];
});

type ContinuationFn = (ctx: Ctx, data: never) => void;
const continuations = new Map<string, ContinuationFn>();
export function registerContinuation<D>(module: string, step: string, fn: (ctx: Ctx, data: D) => void): void {
  continuations.set(`${module}:${step}`, fn as ContinuationFn);
}
export function runContinuation(ctx: Ctx, c: Continuation, extra: object = {}): void {
  const fn = continuations.get(`${c.module}:${c.step}`);
  if (!fn) throw new Error(`No continuation ${c.module}:${c.step}`);
  fn(ctx, { ...(c.data as object), ...extra } as never);
}

/** Refuses the command while the game is waiting on a roll, a reaction or a placement. */
export function noPending(ctx: Ctx): void {
  if (ctx.state.pending) ctx.reject('pending-decision', 'Finish the current roll or decision first.', '[R-19]');
  if (ctx.state.placements?.length) ctx.reject('pending-decision', 'Set up the passengers of the destroyed transport first.', '[TS §3.4]');
}

/** Re-rolls the given dice of a roll (each at most once, TS §1.6) and records them. */
export function rerollDice(ctx: Ctx, rollId: string, indices: number[], source: 'command-reroll' | 'ability' | 'auto'): void {
  const r = ctx.state.rolls[rollId];
  if (!indices.length) return;
  const { dice, state } = ctx.draw(indices.length, r.dice[indices[0]].sides);
  ctx.emit({ type: 'diceRerolled', rollId, indices, values: dice.map((d) => d.value), source, dice: state });
}

export interface WindowOpts {
  whole?: boolean;
  context: string;
  /** Dice an ability re-rolls automatically (e.g. "re-roll hit rolls of 1"); applied before any modifier, once. */
  autoReroll?: (d: Die, i: number) => boolean;
  then: Continuation;
}

/**
 * Rolls n dice; applies automatic re-rolls; then, if roll windows are on and the kind is one Command Re-roll can
 * target, waits for the roller. Otherwise continues at once. The continuation gets `{ ...then.data, rollId }`.
 */
export function rollWindowed(ctx: Ctx, n: number, sides: 3 | 6, kind: RollKind, player: PlayerId, o: WindowOpts): void {
  const roll = ctx.roll(n, sides, kind, player, { whole: o.whole, context: o.context });
  if (o.autoReroll) {
    const r = ctx.state.rolls[roll.id];
    const idx = r.dice.map((d, i) => (!d.rerolled && o.autoReroll!(d, i) ? i : -1)).filter((i) => i >= 0);
    rerollDice(ctx, roll.id, idx, 'auto');
  }
  const then: Continuation = { ...o.then, data: { ...(o.then.data as object), rollId: roll.id } };
  if (ctx.state.setup.settings.rollWindows && WINDOWED.includes(kind) && n > 0) {
    ctx.emit({ type: 'pendingSet', pending: { kind: 'roll', rollId: roll.id, player, then } });
    return;
  }
  runContinuation(ctx, then);
  ctx.emit({ type: 'rollClosed', rollId: roll.id });
}

function openRoll(ctx: Ctx, by: PlayerId) {
  const p = ctx.state.pending;
  if (!p || p.kind !== 'roll') return ctx.reject('no-roll-window', 'There is no roll waiting.', '[R-19]');
  if (p.player !== by) return ctx.reject('not-your-roll', 'Only the player who made this roll can re-roll or accept it.', '[R-19]');
  return p;
}

registerHandler('confirmRoll', (ctx, cmd) => {
  const p = openRoll(ctx, cmd.by);
  ctx.emit({ type: 'pendingCleared' });
  runContinuation(ctx, p.then);
  ctx.emit({ type: 'rollClosed', rollId: p.rollId });
});

registerHandler('reroll', (ctx, cmd) => {
  const p = openRoll(ctx, cmd.by);
  const r = ctx.state.rolls[p.rollId];
  let indices = [...new Set(cmd.dice)].sort((a, b) => a - b);
  if (!indices.length || indices.some((i) => i < 0 || i >= r.dice.length)) ctx.reject('bad-die', 'Pick dice from this roll.', '[R-19]');
  if (cmd.source === 'command-reroll') {
    if (!WINDOWED.includes(r.kind)) ctx.reject('not-rerollable', "Command Re-roll can't be used on this roll.", '[CS §2]');
    if (r.whole) indices = r.dice.map((_, i) => i);
    else if (indices.length !== 1) ctx.reject('one-die', 'Command Re-roll re-rolls a single die.', '[CS §2]');
  }
  if (indices.some((i) => r.dice[i].rerolled)) ctx.reject('already-rerolled', 'A die can never be re-rolled more than once.', '[TS §1.6]');
  if (cmd.source === 'command-reroll') spendStratagem(ctx, cmd.by, 'Command Re-roll', 1);
  rerollDice(ctx, p.rollId, indices, cmd.source);
});

/** Offers the other player a choice (a reaction). Without reactions enabled, or with no options, it is declined at once. */
export function offerReaction(ctx: Ctx, r: { reaction: ReactionKind; player: PlayerId; subjectUnitId: string; options: string[]; then: Continuation }): void {
  if (!ctx.state.setup.settings.reactions || !r.options.length) {
    runContinuation(ctx, r.then, { choice: 'decline' });
    return;
  }
  ctx.emit({ type: 'pendingSet', pending: { kind: 'reaction', ...r } });
}

registerHandler('respond', (ctx, cmd) => {
  const p = ctx.state.pending;
  if (!p || p.kind !== 'reaction') return ctx.reject('no-reaction', 'Nothing is waiting for an answer.', '[R-19]');
  if (p.player !== cmd.by) ctx.reject('not-your-choice', "It's the other player's choice.", '[R-19]');
  const base = choiceParts(cmd.choice).kind;
  if (cmd.choice !== 'decline' && !p.options.includes(base)) ctx.reject('bad-choice', "That isn't one of the choices.", '[R-19]');
  ctx.emit({ type: 'pendingCleared' });
  runContinuation(ctx, p.then, { choice: cmd.choice });
});
