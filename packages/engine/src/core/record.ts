/**
 * A game is its setup plus every accepted command's events (one batch per command). The state is the events
 * replayed over the initial state; undo drops the last batch; saved games are the record as JSON.
 */
import { apply, hasApplier } from './apply';
import { handlerFor, makeCtx, RejectError } from './context';
import { initialState, type GameSetup, type GameState } from './state';
import { R } from './rules';
import type { Command, DispatchResult, GameEvent, Rejected } from './types';

export interface Batch { seq: number; command: Command; events: GameEvent[]; stepStart?: true }
export interface GameRecord { schema: 1; setup: GameSetup; batches: Batch[] }

export class EngineLoadError extends Error {}

/** Checks newGame runs on the setup (setup/setup.ts registers validateSetup). */
const setupChecks: ((s: GameSetup) => string[])[] = [];
export function registerSetupCheck(f: (s: GameSetup) => string[]): void {
  setupChecks.push(f);
}

const cache = new WeakMap<GameRecord, GameState>();

export function newGame(setup: GameSetup): GameRecord {
  const problems = setupChecks.flatMap((f) => f(setup));
  if (problems.length) throw new Error(`Invalid game setup: ${problems.join(' ')}`);
  return { schema: 1, setup, batches: [] };
}

function replay(game: GameRecord): GameState {
  const s = initialState(game.setup);
  for (const b of game.batches) for (const e of b.events) apply(s, e);
  return s;
}

export function stateOf(game: GameRecord): GameState {
  let s = cache.get(game);
  if (!s) {
    s = replay(game);
    cache.set(game, s);
  }
  return s;
}

const rejected = (code: string, message: string, rule: string): Rejected => ({ ok: false, problems: [{ code, message, rule }] });

export function dispatch(game: GameRecord, command: Command): DispatchResult {
  const type = (command as { type: string }).type;
  const handler = handlerFor(type);
  if (!handler) return rejected('unknown-command', `The engine doesn't know the action "${type}".`, R.undo);
  const before = stateOf(game);
  const draft = structuredClone(before);
  const events: GameEvent[] = [];
  try {
    handler(makeCtx(draft, command as never, events), command as never);
  } catch (e) {
    if (e instanceof RejectError) return { ok: false, problems: e.problems };
    throw e;
  }
  if (!events.length) return { ok: true, game, events };
  const last = game.batches[game.batches.length - 1];
  const batch: Batch = { seq: (last?.seq ?? 0) + 1, command, events };
  if (draft.phase !== before.phase || draft.step !== before.step || draft.round !== before.round) batch.stepStart = true;
  const next: GameRecord = { ...game, batches: [...game.batches, batch] };
  cache.set(next, draft);
  return { ok: true, game: next, events };
}

/** Undo the last command, but never back past the start of the current phase or step (spec §3.3 "undo within a phase"). */
export function undo(game: GameRecord): DispatchResult {
  const last = game.batches[game.batches.length - 1];
  if (!last) return rejected('nothing-to-undo', 'There is nothing to undo.', R.undo);
  if (last.stepStart) return rejected('undo-phase-start', "You can't undo past the start of this phase.", R.undo);
  return { ok: true, game: { ...game, batches: game.batches.slice(0, -1) }, events: [] };
}

export function saveGame(game: GameRecord): string {
  return JSON.stringify(game);
}

/** Null when the raw value is a record this engine can replay, else a plain reason. */
export function validateRecord(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return "The file isn't a saved game.";
  const r = raw as Partial<GameRecord> & { schema?: unknown };
  if (typeof r.schema === 'number' && r.schema > 1) return 'This saved game was made by a newer version of the app.';
  if (r.schema !== 1) return "The file isn't a saved game.";
  if (!r.setup || typeof r.setup !== 'object') return 'The saved game has no setup.';
  if (!Array.isArray(r.batches)) return 'The saved game has no moves.';
  for (const b of r.batches) {
    if (!b || !Array.isArray(b.events)) return 'The saved game is damaged.';
    for (const e of b.events) {
      const t = (e as { type?: unknown } | null)?.type;
      if (typeof t !== 'string' || !hasApplier(t)) return `The saved game contains something this version can't read ("${String(t)}").`;
    }
  }
  return null;
}

export function loadGame(json: string): GameRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new EngineLoadError("This saved game couldn't be opened: the file isn't valid.");
  }
  const reason = validateRecord(raw);
  if (reason) throw new EngineLoadError(reason);
  const game = raw as GameRecord;
  try {
    stateOf(game);
  } catch (e) {
    throw new EngineLoadError(`This saved game couldn't be opened: ${(e as Error).message}`);
  }
  return game;
}
