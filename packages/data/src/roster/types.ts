/** Roster data: each BattleScribe file's selection tree as compact JSON (see emit.ts). Pure types, no Node imports. */
export const COST_PTS = 'points';
export const COST_PL = 'e356-c769-5920-6e14';
export const COST_CP = '2d3b-b544-ad49-fb75';
export type CostMap = Record<string, number>;

export type CondType = 'lessThan' | 'greaterThan' | 'equalTo' | 'notEqualTo' | 'atLeast' | 'atMost' | 'instanceOf' | 'notInstanceOf';
/** Flags default to BattleScribe's defaults: shared=true, includeChild*=false, percent=false. */
export interface Cond { type: CondType; field: string; scope: string; childId: string; value: number; percent?: true; shared?: false; childSel?: true; childForces?: true }
export interface CondGroup { type: 'and' | 'or'; conds: Cond[]; groups: CondGroup[] }
export interface Repeat { field: string; scope: string; childId: string; value: number; repeats: number; roundUp?: true; shared?: false; childSel?: true; childForces?: true }
export type ModType = 'set' | 'increment' | 'decrement' | 'append' | 'add' | 'remove' | 'set-primary' | 'unset-primary';
export interface Mod { type: ModType; field: string; value: string; when?: CondGroup; repeats?: Repeat[] }
export interface Constraint { id: string; type: 'min' | 'max'; field: string; scope: string; value: number; percent?: true; shared?: false; childSel?: true; childForces?: true }
export interface CatLink { id: string; targetId: string; primary?: true; constraints?: Constraint[]; mods?: Mod[] }
export interface RNode {
  id: string; kind: 'entry' | 'group' | 'link'; name: string;
  type?: 'unit' | 'model' | 'upgrade';            // entries
  targetId?: string; targetKind?: 'entry' | 'group'; // links
  hidden?: true; collective?: true; defaultId?: string; // defaultId: a group's defaultSelectionEntryId
  costs?: CostMap; cats?: CatLink[]; constraints?: Constraint[]; mods?: Mod[]; children?: RNode[];
}
export interface RCategory { id: string; name: string; hidden?: true; constraints?: Constraint[]; mods?: Mod[] }
export interface RForce { id: string; name: string; hidden?: true; cats: CatLink[]; constraints?: Constraint[]; mods?: Mod[] }
export interface RosterFile {
  schema: 1; id: string; name: string; slug: string; library: boolean;
  links: { targetId: string; importRootEntries: boolean }[];
  rootEntries: RNode[];   // root entryLinks + root selectionEntries, document order
  shared: RNode[];        // sharedSelectionEntries + sharedSelectionEntryGroups
  categories: RCategory[];
  forces: RForce[];       // top-level forceEntries only
}

/** Roster documents: what the user builds. */
export type BattleSizeId = 'combat-patrol' | 'incursion' | 'strike-force' | 'onslaught';
/** count = identical copies; children apply to each copy. entryId = id of the chosen child node (a link id for links). */
export interface Sel { id: string; entryId: string; count: number; children: Sel[] }
export interface ForceSel { id: string; forceId: string; catalogueId: string; selections: Sel[] }
export interface Roster { schema: 1; name: string; catalogueId: string; battleSize: BattleSizeId; forces: ForceSel[] }

/** Validation: a broken BSData constraint or roster rule, with a suggested fix. */
export type RuleKind =
  | 'points-over' | 'cp-negative' | 'slot-min' | 'slot-max' | 'warlord-missing' | 'warlord-extra'
  | 'unique' | 'unit-limit' | 'model-count' | 'wargear-max' | 'option-required' | 'hidden-selected'
  | 'unknown-entry' | 'rule-of-three' | 'detachment-not-allowed' | 'detachment-count'
  | 'detachment-faction' | 'army-faction' | 'other';
export type Fix =
  | { kind: 'add-unit'; forceSelId: string; entryIds: string[] }
  | { kind: 'remove'; selIds: string[] }
  | { kind: 'set-count'; selId: string; count: number }
  | { kind: 'open'; selId: string };
export interface Issue {
  rule: RuleKind; forceSelId?: string; selId?: string;
  subject: { id: string; name: string };  // the entry, category or force the rule is about
  limit: number; actual: number; fix?: Fix;
  /** BSData constraint issues: the constraint's scope key (`roster`, `force`, `parent`, `self`, or an id), which says what its count covers. */
  scope?: string;
  /**
   * A policy `warlord-missing` for units that must be the Warlord (must-be-warlord.json): those units in the army, any
   * one of which may be the Warlord (`subject` is the first). Absent on BSData's own "no Warlord" issue.
   */
  subjects?: { id: string; name: string }[];
}
