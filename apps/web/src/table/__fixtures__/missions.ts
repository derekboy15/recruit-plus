import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MissionOut, MissionsOut } from '@recruit/data/missions';

const FILE = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated', 'missions.json');

let cached: MissionsOut | null = null;
/** The generated missions.json (npm run data:build), the same file the site serves. */
export function generatedMissions(): MissionsOut {
  cached ??= JSON.parse(readFileSync(FILE, 'utf8')) as MissionsOut;
  return cached;
}
export const mission = (id: string): MissionOut => {
  const m = generatedMissions().missions.find((x) => x.id === id);
  if (!m) throw new Error(`no mission ${id}`);
  return m;
};
