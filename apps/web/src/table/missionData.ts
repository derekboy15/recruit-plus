/** The generated mission data (/data/missions.json), fetched once. The M5 sandbox can use these too. */
import type { MissionOut, MissionsOut } from '@recruit/data/missions';

let cached: Promise<MissionsOut> | null = null;

export function getMissions(): Promise<MissionsOut> {
  if (!cached) {
    cached = fetch('/data/missions.json').then(async (res) => {
      if (!res.ok) throw new Error(`Could not load /data/missions.json (HTTP ${res.status})`);
      return (await res.json()) as MissionsOut;
    });
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

export const missionById = (all: MissionsOut, id: string): MissionOut | undefined => all.missions.find((m) => m.id === id);

/** Test helper. */
export function resetMissionCache() {
  cached = null;
}
