/**
 * Writes e2e-prod/data/crowded-game.json: a saved sandbox game on a Strike Force board with 100 models deployed
 * (3 × 20 Necron Warriors against 4 × 10 Intercessors), for the board frame-rate budget in e2e-prod/perf.spec.ts.
 * Rerun after engine changes to the saved-game format:  npx tsx scripts/make-crowded-game.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOARD_SIZES, missionRulesFor, newGame, stateOf, type Command, type GameRecord, type GameSetup, type PlayerId, type UnitInput } from '@recruit/engine';
import type { GameData } from '../src/play/store/gameStore';

// The test fixtures find the generated data through __dirname, which an ES module script doesn't have.
(globalThis as { __dirname?: string }).__dirname = join(import.meta.dirname, '..', 'src', 'play', '__fixtures__');
const { must, realSheet, ULTRAMARINES } = await import('../src/play/__fixtures__/game');
const { PRACTICE } = await import('../src/play/setup/missions');
const { TERRAIN_LAYOUTS } = await import('../src/play/setup/terrainLayouts');
const { summarise } = await import('../src/play/store/gameStore');

const board = BOARD_SIZES['strike-force'];
const layout = PRACTICE.layout(board, 'strike-force');
const warriors = (n: number): UnitInput => ({ id: `A:war${n}`, datasheet: realSheet('necrons', 'Necron Warriors'), models: [{ profile: 'Necron Warrior', weapons: ['Gauss Flayer'], count: 20 }] });
const intercessors = (n: number): UnitInput => ({
  id: `B:int${n}`,
  datasheet: realSheet(ULTRAMARINES, 'Intercessor Squad'),
  models: [
    { profile: 'Intercessor Sergeant', weapons: ['Bolt rifle', 'Bolt pistol'], count: 1 },
    { profile: 'Intercessor', weapons: ['Bolt rifle', 'Bolt pistol'], count: 9 },
  ],
});
const setup: GameSetup = {
  seed: 7,
  battleSize: 'strike-force',
  rules: missionRulesFor('strike-force'),
  board: { ...board },
  armies: [
    { player: 'A', name: 'Necrons', units: [1, 2, 3].map(warriors), cpSpentPreBattle: 0 },
    { player: 'B', name: 'Ultramarines', units: [1, 2, 3, 4].map(intercessors), cpSpentPreBattle: 0 },
  ],
  terrain: TERRAIN_LAYOUTS[0].features(board),
  objectives: layout.objectives,
  zones: layout.zones,
  edges: layout.edges,
  attacker: 'A',
  firstTurn: 'A',
  settings: { rollWindows: false, reactions: true },
};

/** Two rows of up to 10 models, 1.5" apart, starting at (x0, y). */
const block = (g: GameRecord, unitId: string, x0: number, y: number) =>
  Object.fromEntries(stateOf(g).units[unitId].modelIds.map((id, i) => [id, { x: x0 + (i % 10) * 1.5, y: y + Math.floor(i / 10) * 1.5, z: 0, rot: 0 }]));

let g = newGame(setup);
const order: [PlayerId, string, number, number][] = [
  ['B', 'B:int1', 3, 49],
  ['A', 'A:war1', 3, 1.5],
  ['B', 'B:int2', 25, 49],
  ['A', 'A:war2', 25, 1.5],
  ['B', 'B:int3', 3, 54],
  ['A', 'A:war3', 3, 6.5],
  ['B', 'B:int4', 25, 54],
];
for (const [by, unitId, x0, y] of order) g = must(g, { type: 'deploy', by, unitId, positions: block(g, unitId, x0, y) } as Command);
g = must(g, { type: 'beginBattle', by: 'A' } as Command);

const data: GameData = {
  record: g,
  meta: {
    title: 'Necrons vs Ultramarines',
    createdAt: 1,
    hints: false,
    handOver: false,
    missionId: 'practice',
    layoutId: TERRAIN_LAYOUTS[0].id,
    armies: [
      { player: 'A', listId: '00000000-0000-4000-8000-00000000a001', name: 'Necrons', faction: 'Necrons', catalogueSlugs: ['necrons'] },
      { player: 'B', listId: '00000000-0000-4000-8000-00000000b001', name: 'Ultramarines', faction: 'Ultramarines', catalogueSlugs: [ULTRAMARINES] },
    ],
  },
  summary: summarise(g),
};
const out = join(import.meta.dirname, '..', 'e2e-prod', 'data', 'crowded-game.json');
writeFileSync(out, JSON.stringify(data));
console.log(`wrote ${out}: ${Object.keys(stateOf(g).models).length} models`);
