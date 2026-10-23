/**
 * Drill scenarios: real datasheets set up at exact positions on a Combat Patrol board, ready at a chosen moment.
 * Player A (south) is the learner's Ultramarines; Player B (north) the Necrons.
 */
import {
  BOARD_SIZES,
  currentStep,
  dispatch,
  missionRulesFor,
  needsMoraleTest,
  placedModel,
  newGame,
  stateOf,
  TERRAIN_PRESETS,
  unitGap,
  type Command,
  type GameRecord,
  type GameState,
  type Phase,
  type PlayerId,
  type Pos,
  type Pt,
  type TerrainFeature,
  type TerrainPreset,
  type UnitInput,
} from '@recruit/engine';
import { PRACTICE, type MissionLayout } from '../../play/setup/missions';
import type { DrillCtx } from '../drill/types';

export const ULTRA = 'imperium-adeptus-astartes-ultramarines';
export const NECRONS = 'necrons';
const SPACING = 1.5;

export interface UnitSpec {
  id: string;
  player: PlayerId;
  sheet: [catalogueSlug: string, unitName: string];
  models: UnitInput['models'];
  /** Centre of the front row; models in rows of `perRow` (default 5), 1.5" apart, rows 1.5" behind, away from the enemy. */
  at: Pt;
  perRow?: number;
  warlord?: boolean;
}

export interface ScenarioSpec {
  units: UnitSpec[];
  terrain?: TerrainFeature[];
  /** Default: the Practice layout's objectives. */
  objectives?: { id: string; pos: Pt }[];
  /** Zones, edges and objectives (a real mission map). Default: each player's half of the board. */
  layout?: MissionLayout;
  /** Default true: deployed, and battle round 1 begun in A's Command phase. */
  deploy?: boolean;
  /** Default 'A'; null: the players roll off. */
  firstTurn?: PlayerId | null;
  /** Default 'A'. */
  attacker?: PlayerId;
  /** Starting CP (at most the battle size's). */
  cp?: Partial<Record<PlayerId, number>>;
  /** Dice the scenario's own scripted commands use; ctx.dice come after them. */
  setupDice?: number[];
}

/** Intercessor Squad models: a sergeant and the rest, with bolt rifles, bolt pistols and grenades. */
export const intercessors = (n: number): UnitInput['models'] => {
  const weapons = ['Bolt rifle', 'Bolt pistol', 'Frag grenades', 'Krak grenades'];
  return [
    { profile: 'Intercessor Sergeant', weapons, count: 1 },
    { profile: 'Intercessor', weapons, count: n - 1 },
  ];
};
export const warriors = (n: number): UnitInput['models'] => [{ profile: 'Necron Warrior', weapons: ['Gauss Flayer'], count: n }];

const at = (x: number, y: number): Pos => ({ x, y, z: 0, rot: 0 });

/** Each model's spot: rows centred on `u.at`, the front row nearest the enemy. */
export function spots(u: UnitSpec, count: number): Pos[] {
  const per = u.perRow ?? 5;
  const back = u.player === 'A' ? -1 : 1;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / per);
    const inRow = Math.min(per, count - row * per);
    const col = i % per;
    return at(u.at.x + (col - (inRow - 1) / 2) * SPACING, u.at.y + back * row * SPACING);
  });
}

export function must(g: GameRecord, cmd: Command): GameRecord {
  const r = dispatch(g, cmd);
  if (!r.ok) throw new Error(`${cmd.type}: ${r.problems.map((p) => p.message).join(' ')}`);
  return r.game;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

export const terrainBox = (preset: TerrainPreset, x0: number, y0: number, x1: number, y1: number, height: number, name: string): TerrainFeature => ({
  id: `${preset}-${x0}-${y0}`,
  name,
  ...TERRAIN_PRESETS[preset],
  traits: [...TERRAIN_PRESETS[preset].traits],
  footprint: rect(x0, y0, x1, y1),
  height,
});

/** The engine's gap between two units' living models on the battlefield. */
export function gapBetween(s: GameState, a: string, b: string): number {
  const placed = (u: string) =>
    s.units[u].modelIds
      .map((id) => s.models[id])
      .filter((m) => m.pos && !m.destroyed)
      .map((m) => placedModel(s, m));
  return unitGap(placed(a), placed(b));
}

export function scenario(spec: ScenarioSpec, ctx: DrillCtx): GameRecord {
  const board = { ...BOARD_SIZES['combat-patrol'] };
  const rules = missionRulesFor('combat-patrol');
  const half = board.h / 2;
  const layout: MissionLayout = spec.layout ?? {
    zones: { A: rect(0, 0, board.w, half), B: rect(0, half, board.w, board.h) },
    edges: { A: 'south', B: 'north' },
    objectives: spec.objectives ?? PRACTICE.layout(board, 'combat-patrol').objectives,
  };
  const units = (p: PlayerId) =>
    spec.units.filter((u) => u.player === p).map((u): UnitInput => ({ id: u.id, datasheet: ctx.sheet(...u.sheet), models: u.models, ...(u.warlord ? { warlord: true } : {}) }));
  const spent = (p: PlayerId) => {
    const want = spec.cp?.[p];
    if (want === undefined) return 0;
    if (want > rules.startingCp) throw new Error(`a scenario can't start with more than ${rules.startingCp} CP`);
    return rules.startingCp - want;
  };
  const firstTurn = spec.firstTurn === undefined ? 'A' : spec.firstTurn;
  const dice = [...(spec.setupDice ?? []), ...ctx.dice];
  let g = newGame({
    seed: ctx.seed,
    ...(dice.length ? { scriptedDice: dice } : {}),
    battleSize: 'combat-patrol',
    rules,
    board,
    armies: [
      { player: 'A', name: 'Ultramarines', units: units('A'), cpSpentPreBattle: spent('A') },
      { player: 'B', name: 'Necrons', units: units('B'), cpSpentPreBattle: spent('B') },
    ],
    terrain: spec.terrain ?? [],
    objectives: layout.objectives,
    zones: layout.zones,
    edges: layout.edges,
    attacker: spec.attacker ?? 'A',
    ...(firstTurn ? { firstTurn } : {}),
    settings: { rollWindows: true, reactions: true },
  });
  if (spec.deploy === false) return g;

  // Deploy in the engine's order (alternating, the Defender first): at the spots when the engine allows it, otherwise
  // in a staging row on the player's own edge, then moved to the spots by hand (the toolkit).
  const left = new Set(spec.units.map((u) => u.id));
  const moveLater: UnitSpec[] = [];
  for (let guard = 0; left.size && guard < 50; guard++) {
    const s = stateOf(g);
    const p = currentStep(s).actingPlayer;
    const u = spec.units.find((x) => x.player === p && left.has(x.id));
    if (!u) throw new Error(`no unit left for ${p} to deploy`);
    const ids = s.units[u.id].modelIds;
    const target = spots(u, ids.length);
    const direct = dispatch(g, { type: 'deploy', by: p, unitId: u.id, positions: Object.fromEntries(ids.map((id, i) => [id, target[i]])) } as Command);
    if (direct.ok) g = direct.game;
    else {
      const k = spec.units.filter((x) => x.player === p).indexOf(u);
      const y = p === 'A' ? 1 : board.h - 1;
      const staging = spots({ ...u, at: { x: 4 + k * 9, y }, perRow: 5 }, ids.length);
      g = must(g, { type: 'deploy', by: p, unitId: u.id, positions: Object.fromEntries(ids.map((id, i) => [id, staging[i]])) } as Command);
      moveLater.push(u);
    }
    left.delete(u.id);
  }
  for (const u of moveLater) {
    const ids = stateOf(g).units[u.id].modelIds;
    const target = spots(u, ids.length);
    ids.forEach((modelId, i) => {
      g = must(g, { type: 'placeModel', by: u.player, modelId, pos: target[i] } as Command);
    });
  }
  return must(g, { type: 'beginBattle', by: currentStep(stateOf(g)).actingPlayer } as Command);
}

/** Moves the game on (both sides: confirming rolls, declining reactions, taking Morale tests) until it matches `to`. */
export function advanceTo(g: GameRecord, to: { round?: number; active?: PlayerId; phase: Phase }): GameRecord {
  for (let guard = 0; guard < 300; guard++) {
    const s = stateOf(g);
    if (s.phase === to.phase && (to.active === undefined || s.active === to.active) && (to.round === undefined || s.round === to.round) && !s.pending) return g;
    if (s.phase === 'ended') break;
    const p = s.pending;
    if (p?.kind === 'roll') {
      g = must(g, { type: 'confirmRoll', by: p.player } as Command);
      continue;
    }
    if (p?.kind === 'reaction') {
      g = must(g, { type: 'respond', by: p.player, choice: 'decline' } as Command);
      continue;
    }
    const by = currentStep(s).actingPlayer;
    if (s.step === 'morale-tests') {
      const unitId = needsMoraleTest(s, by)[0];
      if (unitId) {
        const r = dispatch(g, { type: 'moraleTest', by, unitId } as Command);
        if (r.ok) {
          g = r.game;
          continue;
        }
      }
    }
    const end = dispatch(g, { type: 'endPhase', by } as Command);
    if (end.ok) {
      g = end.game;
      continue;
    }
    g = must(g, { type: 'endStep', by } as Command);
  }
  throw new Error(`advanceTo could not reach ${JSON.stringify(to)}`);
}
