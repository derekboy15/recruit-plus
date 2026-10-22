/** The handler contract: what a command handler can do while it runs (read the draft, emit events, roll, reject). */
import { apply, registerApplier } from './apply';
import { d3FromD6, nextD6, type DiceState, type Die, type RollKind, type RollRecord } from './dice';
import type { GameState } from './state';
import type { Cmd, CommandMap, CommandType, Evt, GameEvent, PlayerId, Problem } from './types';

declare module './types' {
  interface EventMap {
    diceRolled: Evt<'diceRolled'> & { roll: RollRecord; dice: DiceState };
  }
}

registerApplier('diceRolled', (s, e) => {
  s.rolls[e.roll.id] = e.roll;
  s.dice = e.dice;
  s.nextRoll += 1;
});

export class RejectError extends Error {
  constructor(readonly problems: Problem[]) {
    super(problems.map((p) => p.message).join(' '));
  }
}

export interface RollOpts { whole?: boolean; context?: string }

export interface Ctx {
  /** The draft, already updated by every event emitted so far. */
  readonly state: GameState;
  readonly command: Cmd<string>;
  emit(e: GameEvent): void;
  /** Rolls n dice (D3s come from D6s), records them in a 'diceRolled' event and returns the record. */
  roll(n: number, sides: 3 | 6, kind: RollKind, player: PlayerId, o?: RollOpts): RollRecord;
  /** Draws dice from the current dice state without emitting anything; the caller emits the result with the new state. */
  draw(n: number, sides: 3 | 6): { dice: Die[]; state: DiceState };
  reject(code: string, message: string, rule: string, extra?: Partial<Problem>): never;
  fail(problems: Problem[]): never;
}

export type Handler<C> = (ctx: Ctx, cmd: C) => void;
const handlers = new Map<string, Handler<never>>();

export function registerHandler<T extends CommandType>(type: T, h: Handler<CommandMap[T]>): void {
  handlers.set(type, h as Handler<never>);
}
export const handlerFor = (type: string) => handlers.get(type) as Handler<Cmd<string>> | undefined;

export function drawDice(d: DiceState, n: number, sides: 3 | 6): { dice: Die[]; state: DiceState } {
  const dice: Die[] = [];
  for (let i = 0; i < n; i++) {
    const r = nextD6(d);
    d = r.next;
    dice.push({ value: sides === 3 ? d3FromD6(r.value) : r.value, sides });
  }
  return { dice, state: d };
}

export function makeCtx(state: GameState, command: Cmd<string>, events: GameEvent[]): Ctx {
  const ctx: Ctx = {
    state,
    command,
    emit(e) {
      apply(state, e);
      events.push(e);
    },
    roll(n, sides, kind, player, o = {}) {
      const { dice, state: after } = drawDice(state.dice, n, sides);
      const roll: RollRecord = { id: `r${state.nextRoll}`, kind, player, dice, whole: !!o.whole, context: o.context ?? '' };
      ctx.emit({ type: 'diceRolled', roll, dice: after });
      return state.rolls[roll.id];
    },
    draw(n, sides) {
      return drawDice(state.dice, n, sides);
    },
    reject(code, message, rule, extra = {}) {
      throw new RejectError([{ code, message, rule, ...extra }]);
    },
    fail(problems) {
      throw new RejectError(problems);
    },
  };
  return ctx;
}
