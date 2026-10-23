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
  /** Plain-English versions of the TEXT_CHARS values, by characteristic name (only those that passed the checks). */
  plain?: Record<string, string>;
}

/** Profile characteristics that hold rules text (weapon abilities, psychic power details, psyker notes). */
export const TEXT_CHARS = ['Abilities', 'Details', 'Powers Known', 'Other'] as const;

export interface AbilityOut {
  name: string;
  text: string;
  source: 'bsdata' | 'wahapedia';
  /** Our note of a final GW change the sources missed. */
  amended?: string;
  /** Our plain-English version (only when it passed the checks). */
  plain?: string;
}

export interface UnitOut {
  id: string;
  slug: string;
  name: string;
  catalogueId: string;
  role: BattlefieldRole | null;
  /** Unit-level keywords: the unit's own plus every keyword any of its models has (core rules). */
  keywords: string[];
  factionKeywords: string[];
  /**
   * Present only when the models in the unit have different keywords (e.g. Thunderfire Cannon: the
   * cannon is a VEHICLE, its Techmarine Gunner is INFANTRY). Model-level rules use these.
   */
  modelKeywords?: { model: string; keywords: string[] }[];
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
  /** Our note of a final GW change to the unit (e.g. a keyword) the sources missed. */
  amended?: string;
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
  /** `amended`: our note of a final GW change the sources missed. */
  rules: { id: string; name: string; text: string; amended?: string; plain?: string }[];
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

/** Rules Reference and faction guide content, compiled from packages/content Markdown (a strict subset, no HTML). */
export type Inline = { t: 'text'; v: string } | { t: 'b'; c: Inline[] } | { t: 'i'; c: Inline[] } | { t: 'a'; href: string; c: Inline[] };
export type Block =
  | { t: 'h3'; id: string; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Block[][] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'note'; kind: 'tip' | 'unconfirmed'; c: Inline[] };
export interface RulesSection {
  id: string;
  title: string;
  blocks: Block[];
  /** Plain text for search. */
  text: string;
}
export interface RulesArticle {
  id: string;
  title: string;
  order: number;
  summary: string;
  intro: Block[];
  sections: RulesSection[];
}
export interface GlossaryTerm {
  id: string;
  term: string;
  blocks: Block[];
  text: string;
}
export interface RulesData {
  articles: RulesArticle[];
  glossary: GlossaryTerm[];
}
/** A Learn lesson (packages/content/lessons): short text that points to the Rules Reference, plus a drill. */
export interface LessonRef { article: string; section: string; title: string }
export interface Lesson {
  id: string;
  title: string;
  order: number;
  minutes: number;
  summary: string;
  /** The drill's id; the app checks that drill exists. */
  drill: string;
  intro: Block[];
  sections: RulesSection[];
  /** "In the Rules Reference": article sections, with their titles. */
  rules: LessonRef[];
  /** Glossary term ids shown as the lesson's key words. */
  glossary: string[];
}
export interface LessonsData {
  lessons: Lesson[];
}
export interface KeyUnit {
  name: string;
  unitSlug: string;
  why: Inline[];
}
export interface FactionGuide {
  slug: string;
  title: string;
  plays: Block[];
  armyRules: Block[];
  keyUnits: KeyUnit[];
}
