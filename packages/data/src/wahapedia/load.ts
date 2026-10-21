import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseWahapediaCsv, type Row } from './csv';

export type { Row };

export interface Wahapedia {
  lastUpdate: string;
  factions: Row[];
  source: Row[];
  datasheets: Row[];
  datasheetsModels: Row[];
  datasheetsAbilities: Row[];
  datasheetsKeywords: Row[];
  datasheetsWargear: Row[];
  abilities: Row[];
  wargearList: Row[];
  stratagems: Row[];
  stratagemPhases: Row[];
  warlordTraits: Row[];
  psychicPowers: Row[];
  secondaries: Row[];
}

const FILES: Record<Exclude<keyof Wahapedia, 'lastUpdate'>, string> = {
  factions: 'Factions',
  source: 'Source',
  datasheets: 'Datasheets',
  datasheetsModels: 'Datasheets_models',
  datasheetsAbilities: 'Datasheets_abilities',
  datasheetsKeywords: 'Datasheets_keywords',
  datasheetsWargear: 'Datasheets_wargear',
  abilities: 'Abilities',
  wargearList: 'Wargear_list',
  stratagems: 'Stratagems',
  stratagemPhases: 'StratagemPhases',
  warlordTraits: 'Warlord_traits',
  psychicPowers: 'PsychicPowers',
  secondaries: 'Secondaries',
};

export function loadWahapedia(dir: string): Wahapedia {
  const read = (name: string) => parseWahapediaCsv(readFileSync(join(dir, `${name}.csv`), 'utf8'));
  const out = { lastUpdate: read('Last_update')[0]?.last_update ?? '' } as Wahapedia;
  for (const [key, file] of Object.entries(FILES)) (out as unknown as Record<string, Row[]>)[key] = read(file);
  return out;
}
