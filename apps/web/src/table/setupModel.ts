/** The rules a new table game is set up by: which pack and missions a battle size uses, rolling a mission, secondaries. */
import type { BattleSizeId, MissionOut, MissionsOut, Pack, PackOut, SecondaryOut } from '@recruit/data/missions';

export const packFor = (size: BattleSizeId): Pack => (size === 'incursion' || size === 'strike-force' ? 'arks-of-omen' : 'core-book');

const rollOrder = (r: string) => Number(r.split('-')[0]);
export const missionsFor = (all: MissionsOut, size: BattleSizeId): MissionOut[] =>
  all.missions.filter((m) => m.battleSize === size).sort((a, b) => rollOrder(a.roll) - rollOrder(b.roll));

/** Arks of Omen: a D33 (two D3s: tens, then units). Core Book: a D6 read against ranges like "1-2". */
export function missionForRoll(all: MissionsOut, size: BattleSizeId, d1: number, d2?: number): MissionOut {
  const list = missionsFor(all, size);
  const hit =
    d2 !== undefined
      ? list.find((m) => m.roll === `${d1}${d2}`)
      : list.find((m) => {
          const [lo, hi = lo] = m.roll.split('-').map(Number);
          return d1 >= lo && d1 <= hi;
        });
  if (!hit) throw new Error(`No ${size} mission for roll ${d1}${d2 ?? ''}`);
  return hit;
}

export interface SecondaryChoices {
  universal: SecondaryOut[];
  faction: (SecondaryOut & { note?: string })[];
  mission?: SecondaryOut;
}
/** The secondaries a player of this catalogue may pick in this pack and mission. */
export function secondaryChoices(all: MissionsOut, pack: Pack, catalogueSlug: string, missionId: string): SecondaryChoices {
  const p = all.packs.find((x) => x.id === pack);
  const allowed = all.secondaryFactions[catalogueSlug] ?? [];
  const secondaries = p?.secondaries ?? [];
  return {
    universal: secondaries.filter((s) => !s.factionId),
    faction: secondaries.flatMap((s) => {
      const f = allowed.find((a) => a.factionId === s.factionId);
      return f ? [{ ...s, ...(f.note ? { note: f.note } : {}) }] : [];
    }),
    mission: all.missions.find((m) => m.id === missionId)?.missionSecondary,
  };
}

/** Plain-language problems with a choice of secondaries; empty when it's legal. */
export function secondaryProblems(pack: PackOut, chosen: SecondaryOut[]): string[] {
  const problems: string[] = [];
  if (chosen.length !== pack.secondaryCount) problems.push(`Pick exactly ${pack.secondaryCount} secondary objectives.`);
  const counts = new Map<string, number>();
  for (const s of chosen) if (s.category !== 'Mission') counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  for (const [category, n] of counts) if (n > pack.maxPerCategory) problems.push(`You can only pick one from ${category}.`);
  return problems;
}

export const defaultSetup = (pack: PackOut, size: BattleSizeId) => ({ secondaries: [...pack.defaultSecondaries], startingCp: pack.startingCp[size] ?? 0 });
