/** Output data model shared by the pipeline and the web app. */

export type BattlefieldRole =
  | 'HQ'
  | 'Troops'
  | 'Elites'
  | 'Fast Attack'
  | 'Heavy Support'
  | 'Flyer'
  | 'Dedicated Transport'
  | 'Lord of War'
  | 'Fortification';

export const BATTLEFIELD_ROLES: BattlefieldRole[] = [
  'HQ',
  'Troops',
  'Elites',
  'Fast Attack',
  'Heavy Support',
  'Flyer',
  'Dedicated Transport',
  'Lord of War',
  'Fortification',
];

export type FactionGroup = 'Imperium' | 'Chaos' | 'Xenos' | 'Unaligned';

export interface ProfileOut {
  name: string;
  chars: Record<string, string>;
}

export interface AbilityOut {
  name: string;
  text: string;
  source: 'bsdata' | 'wahapedia';
}

export interface UnitOut {
  id: string;
  slug: string;
  name: string;
  catalogueId: string;
  role: BattlefieldRole | null;
  keywords: string[];
  factionKeywords: string[];
  models: ProfileOut[];
  weapons: ProfileOut[];
  abilities: AbilityOut[];
  psychic: ProfileOut[];
  woundTrack: ProfileOut[];
  transport: ProfileOut | null;
  minModels: number | null;
  maxModels: number | null;
  powerLevel: number | null;
  points: number | null;
  baseSize: string | null;
  wahapediaId: string | null;
  legends: boolean;
  forgeWorld: boolean;
}

/** A matched-play stratagem from Wahapedia. */
export interface StratagemOut {
  /** Wahapedia id. */
  id: string;
  /** Title case of the Wahapedia name: "Command Re-roll". */
  name: string;
  /** CP cost as printed: "1", "2", "1/2". */
  cp: string;
  /** The type's prefix before " – " ("Necrons", "Annihilation Legion"), else the Wahapedia faction name. */
  group: string;
  /** The type after the prefix, without " Stratagem": "Battle Tactic", "Epic Deed", "Wargear", "Strategic Ploy", "Core". */
  kind: string;
  /** When it can be used (Wahapedia's StratagemPhases values, file order). */
  phases: string[];
  /** Official text (Wahapedia description as plain text). */
  text: string;
  /** Our note of a final GW change the sources missed. */
  amended?: string;
  /** Plain-English version of the text. */
  plain?: string;
}

export interface CatalogueOut {
  id: string;
  slug: string;
  name: string;
  group: FactionGroup;
  library: boolean;
  units: UnitOut[];
  rules: { id: string; name: string; text: string }[];
  /** Matched-play stratagems; [] for library catalogues. */
  stratagems: StratagemOut[];
}

export interface CatalogueSummary {
  id: string;
  slug: string;
  name: string;
  group: FactionGroup;
  library: boolean;
  unitCount: number;
  /** Roster file slugs (generated/roster/<slug>.json) of the catalogue's scope: itself, linked catalogues, then 'system'. */
  rosterScope: string[];
  /**
   * The "Faction: …" category names on the root entries of the catalogue and the catalogues it imports (not the .gst's
   * shared fortifications), sorted: the faction keywords its units can have. Core Book battle sizes offer another
   * catalogue as an ally only when the two share one other than UNALIGNED.
   */
  factions: string[];
}

export interface DataIndex {
  generatedAt: string;
  sources: { bsdata: 'v9.8.0'; wahapediaLastUpdate: string };
  catalogues: CatalogueSummary[];
}
