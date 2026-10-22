/** Node side of the missions: pack rules, Wahapedia secondaries, the faction mapping and amendments. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { htmlToText, slugify, titleCase } from '../text';
import type { Wahapedia } from '../wahapedia/load';
import type { Pack, PackOut, SecondaryFaction, SecondaryOut } from './types';

const GAME: Record<Pack, string> = { 'arks-of-omen': 'Arks of Omen: Grand Tournament', 'core-book': 'Matched Play' };
const PREFIX: Record<Pack, string> = { 'arks-of-omen': 'aoo', 'core-book': 'cb' };
const TYPES: Record<string, SecondaryOut['type']> = {
  'Progressive Objective': 'progressive',
  'End Game Objective': 'end-game',
  'Progressive and End Game Objective': 'progressive-and-end-game',
};

/** The pack's secondary objectives from Wahapedia's Secondaries.csv (flavour `legend` dropped). */
export function extractSecondaries(w: Wahapedia, pack: Pack): SecondaryOut[] {
  return w.secondaries
    .filter((r) => r.game === GAME[pack])
    .map((r) => {
      const name = titleCase(r.name.trim());
      const type = TYPES[r.type.trim()];
      if (!type) throw new Error(`Unknown secondary type "${r.type}" for ${r.name}`);
      const factionId = r.faction_id.trim() || undefined;
      const id = [PREFIX[pack], factionId?.toLowerCase(), slugify(name)].filter(Boolean).join('-');
      return {
        id,
        name,
        category: r.category.trim(),
        type,
        ...(factionId ? { factionId, faction: r.faction_name.trim() } : {}),
        text: htmlToText(r.description),
      };
    });
}

export function loadPacks(missionsDir: string): Omit<PackOut, 'secondaries'>[] {
  return JSON.parse(readFileSync(join(missionsDir, 'packs.json'), 'utf8'));
}

export interface SecondaryFactionEntry { catalogueName: string; factions: SecondaryFaction[]; source: string }
export function loadSecondaryFactions(overridesDir: string): SecondaryFactionEntry[] {
  return JSON.parse(readFileSync(join(overridesDir, 'secondary-factions.json'), 'utf8'));
}

export interface MissionAmendment { target: string; field: string; text: string; source: string }
export function loadAmendments(overridesDir: string): { note?: string; items: MissionAmendment[] } {
  return JSON.parse(readFileSync(join(overridesDir, 'mission-amendments.json'), 'utf8'));
}
