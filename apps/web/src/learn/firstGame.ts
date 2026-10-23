/** "Your first game": a 500-point Combat Patrol sandbox game with the two starter lists, hints on. */
import { buildGameSetup, setupBlockers } from '../play/setup/buildSetup';
import { loadArmy } from '../play/setup/loadArmy';
import { toSandboxMission } from '../play/setup/missionAdapter';
import { TERRAIN_LAYOUTS } from '../play/setup/terrainLayouts';
import { createGame, type GameMeta } from '../play/store/gameStore';
import type { Repository } from '../storage/repository';
import { getMissions } from '../table/missionData';
import { starterList } from './starterLists';

export const FIRST_GAME_MISSION = 'cb-incisive-attack';
const LAYOUT = 'mixed';

/** Builds both starter armies and saves a sandbox game: Player 1 the Ultramarines (the Defender), Player 2 the Necrons. */
export async function createFirstGame(repo: Repository, ownerId: string, seed: number): Promise<string> {
  const [lists, missions] = await Promise.all([Promise.all([starterList('ultramarines'), starterList('necrons')]), getMissions()]);
  const armies = await Promise.all([loadArmy(lists[0], 'A'), loadArmy(lists[1], 'B')]);
  const data = missions.missions.find((m) => m.id === FIRST_GAME_MISSION);
  const layout = TERRAIN_LAYOUTS.find((l) => l.id === LAYOUT);
  if (!data || !layout) throw new Error('The first game’s mission or terrain is missing.');
  const options = { battleSize: 'combat-patrol' as const, mission: toSandboxMission(data), layout, armies: [armies[0], armies[1]] as [typeof armies[0], typeof armies[1]], attacker: 'B' as const, seed, rollWindows: true };
  const blockers = setupBlockers(options);
  if (blockers.length) throw new Error(blockers.join(' '));
  const meta: GameMeta = {
    title: 'Your first game: Ultramarines vs Necrons',
    createdAt: Date.now(),
    hints: true,
    handOver: true,
    missionId: FIRST_GAME_MISSION,
    layoutId: LAYOUT,
    armies: armies.map((a, i) => ({
      player: i === 0 ? ('A' as const) : ('B' as const),
      listId: lists[i].id,
      name: lists[i].data.roster.name,
      faction: lists[i].data.summary.faction,
      catalogueSlugs: a.catalogueSlugs,
    })),
  };
  return createGame(repo, ownerId, buildGameSetup(options), meta);
}
