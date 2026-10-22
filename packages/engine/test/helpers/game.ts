/** Building and playing test games. Everything goes through the public engine API (src/index.ts). */
import { expect } from 'vitest';
import {
  dispatch,
  missionRulesFor,
  newGame,
  stateOf,
  BOARD_SIZES,
  type BattleSizeId,
  type Command,
  type Datasheet,
  type GameRecord,
  type GameSetup,
  type PlayerId,
  type Pos,
  type Pt,
  type TerrainFeature,
  type UnitInput,
} from '../../src';
import { guardsmen, marines } from '../fixtures/units';

export const at = (x: number, y: number, z = 0, rot = 0): Pos => ({ x, y, z, rot });

/** A unit of `count` models of the datasheet's first profile (the rest of the count; the first model uses the first profile). */
export function unitInput(id: string, ds: Datasheet, count = 1): UnitInput {
  const weapons = ds.weapons.filter((w) => w.type !== 'Grenade' || count === 1).map((w) => w.name);
  if (ds.models.length > 1 && count > 1)
    return { id, datasheet: ds, models: [{ profile: ds.models[0].name, weapons, count: 1 }, { profile: ds.models[1].name, weapons, count: count - 1 }] };
  return { id, datasheet: ds, models: [{ profile: ds.models[0].name, weapons, count }] };
}

/**
 * Positions for n models of a unit along x starting at (x, y): a row 1.5" apart for up to 5 models, a zigzag
 * (1.2" along, 1" up and down) for 6+ so each model has two neighbours. Coherent for 25–40mm bases.
 */
export function line(x: number, y: number, unitId: string, n = 5): Record<string, Pos> {
  const out: Record<string, Pos> = {};
  for (let i = 0; i < n; i++) out[`${unitId}.m${i + 1}`] = n < 6 ? at(x + i * 1.5, y) : at(x + i * 1.2, y + (i % 2));
  return out;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

export interface TestGameOpts {
  a?: UnitInput[];
  b?: UnitInput[];
  terrain?: TerrainFeature[];
  size?: BattleSizeId;
  dice?: number[];
  windows?: boolean;
  reactions?: boolean;
  zones?: Record<PlayerId, Pt[]>;
  objectives?: { id: string; pos: Pt }[];
  /** Default 'A'; null to roll off. */
  firstTurn?: PlayerId | null;
  seed?: number;
}

/** A 44"×60" board (90" at Onslaught); A deploys in y < 12 (south edge), B in y > board.h − 12 (north edge); A attacks. */
export function testSetup(o: TestGameOpts = {}): GameSetup {
  const size = o.size ?? 'strike-force';
  const board = { ...BOARD_SIZES[size], h: size === 'combat-patrol' ? 60 : BOARD_SIZES[size].h };
  const h = board.h;
  return {
    seed: o.seed ?? 1,
    scriptedDice: o.dice,
    battleSize: size,
    rules: missionRulesFor(size),
    board,
    armies: [
      { player: 'A', name: 'Army A', units: o.a ?? [unitInput('a1', marines(), 5)], cpSpentPreBattle: 0 },
      { player: 'B', name: 'Army B', units: o.b ?? [unitInput('b1', guardsmen(), 5)], cpSpentPreBattle: 0 },
    ],
    terrain: o.terrain ?? [],
    objectives: o.objectives ?? [
      { id: 'o1', pos: { x: 22, y: 6 } },
      { id: 'o2', pos: { x: 10, y: h / 2 } },
      { id: 'o3', pos: { x: 34, y: h / 2 } },
      { id: 'o4', pos: { x: 22, y: h - 6 } },
    ],
    zones: o.zones ?? { A: rect(0, 0, board.w, 12), B: rect(0, h - 12, board.w, h) },
    edges: { A: 'south', B: 'north' },
    attacker: 'A',
    ...(o.firstTurn === null ? {} : { firstTurn: o.firstTurn ?? 'A' }),
    settings: { rollWindows: o.windows ?? false, reactions: o.reactions ?? false },
  };
}

export const newTestGame = (o: TestGameOpts = {}) => newGame(testSetup(o));

export const deploy = (by: PlayerId, unitId: string, positions: Record<string, Pos>): Command => ({ type: 'deploy', by, unitId, positions }) as Command;

/** Dispatches commands in order; throws with the problems if one is refused. */
export function play(game: GameRecord, ...cmds: Command[]): GameRecord {
  for (const c of cmds) {
    const r = dispatch(game, c);
    if (!r.ok) throw new Error(`${(c as { type: string }).type} refused: ${r.problems.map((p) => `${p.code}: ${p.message}`).join(' | ')}`);
    game = r.game;
  }
  return game;
}

export function expectRejected(game: GameRecord, cmd: Command, code: string): void {
  const r = dispatch(game, cmd);
  expect(r.ok, `expected ${(cmd as { type: string }).type} to be refused with ${code}`).toBe(false);
  if (!r.ok) expect(r.problems.map((p) => p.code)).toContain(code);
}

/**
 * Sets up every unit with positions in the deployment order (units without positions go into Strategic Reserves,
 * or are left where they are if already in reserve), then starts battle round 1. Positions may break deployment-zone
 * rules for test convenience: they are applied with the toolkit after deployment where needed.
 */
export function placeAll(game: GameRecord, positions: Record<string, Record<string, Pos> | { at: Record<string, Pos>; embarked: string[] }>): GameRecord {
  let g = game;
  const s0 = stateOf(g);
  const pending = new Set(Object.keys(s0.units).filter((id) => s0.units[id].location === 'deploying'));
  for (const id of [...pending]) if (!positions[id]) {
    if (Object.values(positions).some((p) => 'embarked' in p && (p.embarked as string[]).includes(id))) continue;
    g = play(g, { type: 'declareReserves', by: s0.units[id].player, unitIds: [id], kind: 'deep-strike' } as Command);
    pending.delete(id);
  }
  for (let guard = 0; guard < 200; guard++) {
    const s = stateOf(g);
    if (s.step !== 'deploy') break;
    const next = s.deploy.next;
    const id = Object.keys(positions).find((u) => s.units[u]?.player === next && s.units[u].location === 'deploying');
    if (!id) throw new Error(`placeAll: no position given for ${next}'s remaining units`);
    const p = positions[id];
    const cmd = 'embarked' in p ? { type: 'deploy', by: next, unitId: id, positions: p.at, embarked: p.embarked } : { type: 'deploy', by: next, unitId: id, positions: p };
    g = play(g, cmd as Command);
  }
  if (!stateOf(g).firstPlayer) throw new Error('placeAll needs firstTurn set');
  return play(g, { type: 'beginBattle', by: stateOf(g).firstPlayer! } as Command);
}
