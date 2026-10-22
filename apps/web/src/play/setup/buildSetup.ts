/** The setup screen's choices → the engine's GameSetup. */
import { BOARD_SIZES, missionRulesFor, newGame, type BattleSizeId, type GameSetup, type PlayerId } from '@recruit/engine';
import type { LoadedArmy } from './loadArmy';
import type { SandboxMission } from './missions';
import type { TerrainLayout } from './terrainLayouts';

export interface SetupOptions {
  battleSize: BattleSizeId;
  mission: SandboxMission;
  layout: TerrainLayout;
  armies: [LoadedArmy, LoadedArmy];
  attacker: PlayerId;
  seed: number;
  rollWindows: boolean;
}

export function buildGameSetup(o: SetupOptions): GameSetup {
  const board = { ...BOARD_SIZES[o.battleSize] };
  const layout = o.mission.layout(board, o.battleSize);
  // A list playing itself: the names say which player is which (pass-and-play prompts and the log use them).
  const same = o.armies[0].army.name === o.armies[1].army.name;
  const name = (i: 0 | 1) => (same ? `${o.armies[i].army.name} (Player ${i + 1})` : o.armies[i].army.name);
  return {
    seed: o.seed,
    battleSize: o.battleSize,
    rules: missionRulesFor(o.battleSize),
    board,
    armies: [
      { ...o.armies[0].army, player: 'A', name: name(0) },
      { ...o.armies[1].army, player: 'B', name: name(1) },
    ],
    terrain: o.layout.features(board),
    objectives: layout.objectives,
    zones: layout.zones,
    edges: layout.edges,
    attacker: o.attacker,
    settings: { rollWindows: o.rollWindows, reactions: true },
  };
}

/** Problems that stop the game starting (an army with no units, or a setup the engine refuses), in plain English. */
export function setupBlockers(o: SetupOptions): string[] {
  const empty = o.armies.filter((a) => !a.army.units.length).map((a) => `${a.army.name} has no units.`);
  if (empty.length) return empty;
  try {
    newGame(buildGameSetup(o));
    return [];
  } catch (e) {
    return [(e as Error).message.replace(/^Invalid game setup: /, '')];
  }
}
