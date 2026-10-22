/** Test-only: sandbox games built from the real generated faction data (`npm run data:build`). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueOut } from '@recruit/data/model';
import {
  BOARD_SIZES,
  dispatch,
  missionRulesFor,
  newGame,
  stateOf,
  type Command,
  type Datasheet,
  type GameRecord,
  type GameSetup,
  type PlayerId,
  type Pos,
  type UnitInput,
} from '@recruit/engine';
import { toDatasheet } from '@recruit/engine/data';
import { PRACTICE } from '../setup/missions';
import { TERRAIN_LAYOUTS } from '../setup/terrainLayouts';

const GENERATED = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated');
const catalogues = new Map<string, CatalogueOut>();

export function realCatalogue(slug: string): CatalogueOut {
  let c = catalogues.get(slug);
  if (!c) {
    c = JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8')) as CatalogueOut;
    catalogues.set(slug, c);
  }
  return c;
}

export function realSheet(catalogueSlug: string, unitName: string): Datasheet {
  const c = realCatalogue(catalogueSlug);
  const unit = c.units.find((u) => u.name === unitName);
  if (!unit) throw new Error(`${unitName} isn't in ${catalogueSlug}`);
  return toDatasheet(unit, c.name).datasheet;
}

export const ULTRAMARINES = 'imperium-adeptus-astartes-ultramarines';

export interface SampleOpts { rollWindows: boolean; firstTurn: PlayerId; scriptedDice: number[]; librarian: boolean }

/** A Combat Patrol game: Necron Warriors ×10 (A) vs an Intercessor Squad ×5 (B), plus a Librarian for B when asked. */
export function sampleSetup(o: Partial<SampleOpts> = {}): GameSetup {
  const board = BOARD_SIZES['combat-patrol'];
  const layout = PRACTICE.layout(board, 'combat-patrol');
  const warriors: UnitInput = { id: 'A:war', datasheet: realSheet('necrons', 'Necron Warriors'), models: [{ profile: 'Necron Warrior', weapons: ['Gauss Flayer'], count: 10 }] };
  const intercessors: UnitInput = {
    id: 'B:int',
    datasheet: realSheet(ULTRAMARINES, 'Intercessor Squad'),
    models: [
      { profile: 'Intercessor Sergeant', weapons: ['Bolt rifle', 'Bolt pistol'], count: 1 },
      { profile: 'Intercessor', weapons: ['Bolt rifle', 'Bolt pistol'], count: 4 },
    ],
  };
  const librarian: UnitInput = { id: 'B:lib', datasheet: realSheet(ULTRAMARINES, 'Librarian'), models: [{ profile: 'Librarian', weapons: ['Bolt pistol', 'Force sword'], count: 1 }] };
  return {
    seed: 42,
    ...(o.scriptedDice ? { scriptedDice: o.scriptedDice } : {}),
    battleSize: 'combat-patrol',
    rules: missionRulesFor('combat-patrol'),
    board: { ...board },
    armies: [
      { player: 'A', name: 'Necrons', units: [warriors], cpSpentPreBattle: 0 },
      { player: 'B', name: 'Ultramarines', units: o.librarian ? [intercessors, librarian] : [intercessors], cpSpentPreBattle: 0 },
    ],
    terrain: TERRAIN_LAYOUTS[0].features(board),
    objectives: layout.objectives,
    zones: layout.zones,
    edges: layout.edges,
    attacker: 'A',
    firstTurn: o.firstTurn ?? 'A',
    settings: { rollWindows: o.rollWindows ?? true, reactions: true },
  };
}

export function must(g: GameRecord, cmd: Command): GameRecord {
  const r = dispatch(g, cmd);
  if (!r.ok) throw new Error(`${(cmd as { type: string }).type}: ${r.problems.map((p) => p.message).join(' ')}`);
  return r.game;
}

const at = (x: number, y: number): Pos => ({ x, y, z: 0, rot: 0 });
const row = (g: GameRecord, unitId: string, x0: number, y: number) =>
  Object.fromEntries(stateOf(g).units[unitId].modelIds.map((id, i) => [id, at(x0 + i * 1.5, y)]));

/**
 * sampleSetup deployed in a line per unit (A at y = aY, default 4; B at y = bY, default 26), in A's Command phase of
 * battle round 1. Rows outside the deployment zones are reached by moving the models by hand after deploying.
 */
export function deployedGame(o: Partial<SampleOpts & { aY: number; bY: number }> = {}): GameRecord {
  let g = newGame(sampleSetup(o));
  g = must(g, { type: 'deploy', by: 'B', unitId: 'B:int', positions: row(g, 'B:int', 18, 26) } as Command);
  if (o.librarian) g = must(g, { type: 'deploy', by: 'B', unitId: 'B:lib', positions: row(g, 'B:lib', 12, 26) } as Command);
  g = must(g, { type: 'deploy', by: 'A', unitId: 'A:war', positions: row(g, 'A:war', 14, 4) } as Command);
  for (const [unitId, x0, y] of [['A:war', 14, o.aY ?? 4], ['B:int', 18, o.bY ?? 26], ...(o.librarian ? [['B:lib', 12, o.bY ?? 26]] : [])] as [string, number, number][]) {
    if (y === (unitId.startsWith('A') ? 4 : 26)) continue;
    for (const [modelId, pos] of Object.entries(row(g, unitId, x0, y))) g = must(g, { type: 'placeModel', by: unitId[0] as PlayerId, modelId, pos } as Command);
  }
  return must(g, { type: 'beginBattle', by: 'A' } as Command);
}
