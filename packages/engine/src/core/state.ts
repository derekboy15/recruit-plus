/**
 * The game state every rules module reads. Plain JSON, rebuilt by replaying events (core/record). Modules add their
 * own fields with `declare module '../core/state' { interface GameState { … } }` and an initialiser.
 */
import { seedDice, type DiceState, type RollRecord } from './dice';
import type { PlayerId } from './types';
import type { Datasheet } from '../datasheet/types';
import type { Pt } from '../geometry/shapes';
import type { TerrainFeature } from '../terrain/types';
import type { MissionRules } from '../setup/mission';

export type Phase = 'pre-battle' | 'command' | 'movement' | 'psychic' | 'shooting' | 'charge' | 'fight' | 'morale' | 'ended';
export type Step =
  | 'deploy' | 'first-turn' | 'main' | 'move-units' | 'reinforcements' | 'charges' | 'heroic-interventions'
  | 'morale-tests' | 'coherency';
export type BattleSizeId = 'combat-patrol' | 'incursion' | 'strike-force' | 'onslaught';
export type Edge = 'north' | 'south' | 'east' | 'west';

/** One unit as mustered: its datasheet and its models (each stack: a profile name, its weapons, how many). */
export interface UnitInput {
  id: string;
  datasheet: Datasheet;
  models: { profile: string; weapons: string[]; count: number }[];
  warlord?: boolean;
  /** Model ids in the order the owner wants them removed; default: the reverse of the model list. */
  casualtyOrder?: string[];
}
export interface ArmyInput { player: PlayerId; name: string; units: UnitInput[]; cpSpentPreBattle: number }

export interface GameSetup {
  seed: number;
  scriptedDice?: number[];
  battleSize: BattleSizeId;
  rules: MissionRules;
  board: { w: number; h: number };
  armies: [ArmyInput, ArmyInput];
  terrain: TerrainFeature[];
  /** `label` is what the board shows when it differs from the id (e.g. compass names on a turned mission map). */
  objectives: { id: string; pos: Pt; label?: string }[];
  zones: Record<PlayerId, Pt[]>;
  /** Each player's own battlefield edge. North is y = board.h, south is y = 0. */
  edges: Record<PlayerId, Edge>;
  attacker: PlayerId;
  /** Set when the first player is decided outside the game (lessons, drills); otherwise players roll off. */
  firstTurn?: PlayerId;
  settings: { rollWindows: boolean; reactions: boolean };
}

export interface GameState {
  /** The setup this state was built from (shared, never changed). */
  readonly setup: GameSetup;
  phase: Phase;
  step: Step;
  round: number;
  turn: 'first' | 'second' | null;
  active: PlayerId;
  firstPlayer: PlayerId | null;
  rollOffWinner: PlayerId | null;
  dice: DiceState;
  nextRoll: number;
  /** Rolls whose window is still open, by id. */
  rolls: Record<string, RollRecord>;
}

/** Hooks modules use to add their part of the initial state. */
const initialisers: ((s: GameState, setup: GameSetup) => void)[] = [];
export function registerInitialiser(f: (s: GameState, setup: GameSetup) => void): void {
  initialisers.push(f);
}

export function initialState(setup: GameSetup): GameState {
  const dice = seedDice(setup.seed);
  const s = {
    setup,
    phase: 'pre-battle',
    step: 'deploy',
    round: 0,
    turn: null,
    active: setup.attacker === 'A' ? 'B' : 'A',
    firstPlayer: setup.firstTurn ?? null,
    rollOffWinner: null,
    dice: { ...dice, queue: [...(setup.scriptedDice ?? [])] },
    nextRoll: 1,
    rolls: {},
  } as GameState;
  for (const f of initialisers) f(s, setup);
  return s;
}

/** A map's compass codes ("nw", "se2"): ids, or the label a turned map gets from its id, never a name a player would use. */
const COMPASS_CODE = /^(nw|ne|sw|se|n|e|s|w)\d*$/i;

/**
 * What players call an objective: its label when the mission gives it a real one ("A", "Relic"); otherwise (an id such
 * as "n1", a compass code, or a game saved before labels existed) its place in setup order, 1–n, as the Practice
 * screens number it (objectiveLabels in apps/web). An id not in the setup is named by the id.
 */
export function objectiveName(objectives: readonly { id: string; label?: string }[], id: string): string {
  const at = objectives.findIndex((o) => o.id === id);
  const label = objectives[at]?.label;
  if (label && !COMPASS_CODE.test(label)) return label;
  return at >= 0 ? String(at + 1) : id;
}
