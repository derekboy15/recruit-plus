/** The game state every rules module reads. Plain JSON; rebuilt by replaying events (core/record). */
import { seedDice, type DiceState, type RollRecord } from './dice';

export type Phase = 'pre-battle' | 'command' | 'movement' | 'psychic' | 'shooting' | 'charge' | 'fight' | 'morale' | 'ended';
export type Step =
  | 'deploy' | 'first-turn' | 'main' | 'move-units' | 'reinforcements' | 'charges' | 'heroic-interventions'
  | 'morale-tests' | 'coherency';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GameSetupBase {}
export interface GameSetup extends GameSetupBase { seed: number; scriptedDice?: number[] }

export interface GameState {
  phase: Phase; step: Step; round: number;
  dice: DiceState; nextRoll: number;
  /** Rolls whose window is still open, by id. */
  rolls: Record<string, RollRecord>;
}

/** Hooks later modules use to add their part of the initial state. */
const initialisers: ((s: GameState, setup: GameSetup) => void)[] = [];
export function registerInitialiser(f: (s: GameState, setup: GameSetup) => void): void {
  initialisers.push(f);
}

export function initialState(setup: GameSetup): GameState {
  const dice = seedDice(setup.seed);
  const s: GameState = { phase: 'pre-battle', step: 'deploy', round: 0, dice: { ...dice, queue: [...(setup.scriptedDice ?? [])] }, nextRoll: 1, rolls: {} };
  for (const f of initialisers) f(s, setup);
  return s;
}
