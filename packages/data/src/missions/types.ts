/**
 * Missions for the table companion and the sandbox: Arks of Omen GT (Incursion, Strike Force) and Core Book Eternal
 * War (Combat Patrol, Onslaught). Map coordinates are inches, origin at the top-left of the map as Wahapedia draws it,
 * x to the right and y down.
 */
import type { BattleSizeId } from '../roster/types';

export type { BattleSizeId };
export type Pack = 'core-book' | 'arks-of-omen';
/** "Player A" / "Player B" exactly as the deployment map labels them. */
export type PlayerKey = 'A' | 'B';

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'polygon'; points: [number, number][] }
  | { kind: 'circle'; cx: number; cy: number; r: number };
/** The union of `include`, minus the union of `exclude`. */
export interface Area { include: Shape[]; exclude?: Shape[] }
export interface Point { x: number; y: number }

export interface MapObjective { id: string; x: number; y: number; label?: string; in: PlayerKey | 'nml' }
export interface MissionMap {
  board: { width: number; height: number };
  edges: Record<PlayerKey, 'top' | 'bottom' | 'left' | 'right'>;
  zones: Record<PlayerKey, Area>;
  territories?: Record<PlayerKey, Area>;
  /** Named areas a rule refers to, e.g. Pathway to Glory's search area. */
  areas?: { id: string; name: string; area: Area }[];
  objectives: MapObjective[];
  symmetry: 'rotate180' | 'mirror' | 'none';
  /** False when a position or distance is implied by the image rather than printed on it (see `notes`). */
  verified: boolean;
  notes: string[];
  /** The Wahapedia map image this was transcribed from. */
  image: string;
}

export interface RulesText { id: string; name: string; text: string; plain?: string; amended?: string }

export type When = 'end-of-command-phase' | 'end-of-turn' | 'end-of-round' | 'end-of-battle' | 'on-action';
/** A plain-English prompt (our words), per player when it differs. */
export type Label = string | Record<PlayerKey, string>;
export type ScoreLine =
  /** A yes/no condition. A gate scores nothing itself; the component scores 0 unless it is set. */
  | { kind: 'flag'; id: string; label: Label; vp: number; gate?: true }
  /** VP per thing counted; a record is keyed by battle round. */
  | { kind: 'count'; id: string; label: Label; vpEach: number | Record<string, number> }
  /** VP looked up by the count (index), the last entry for anything higher. */
  | { kind: 'table'; id: string; label: Label; vpByCount: number[] }
  /** One option; `null` means that player can't score it. */
  | { kind: 'pick'; id: string; label: Label; options: { id: string; label: string; vp: Record<PlayerKey, number | null> }[] };

interface ComponentBase {
  id: string;
  when: When;
  rounds: number[];
  /** 'active': the player whose turn it is; 'each': both players. */
  who: 'active' | 'each';
  /** The most one scoring can give. */
  max?: number;
  source: string;
}
export type ScoringComponent = ComponentBase &
  (
    | {
        kind: 'hold';
        mode: 'take-and-hold' | 'domination';
        vpPerCondition: number;
        /** Arks of Omen: in round 5 the player going second scores this at the end of their turn instead. */
        round5SecondPlayer?: 'end-of-turn';
      }
    | { kind: 'lines'; lines: ScoreLine[]; combine: 'sum' | 'max' | { byCount: number[] } }
  );

export interface CpGate { id: string; rounds?: number[]; question?: string; onNo: 'lose' | 'roll-1-3-lose' }
export interface CpExtra { id: string; rounds?: number[]; question?: string; cp: number }
/** The Command phase CP bonus: who gets it, mission conditions that can take it away, and extra CP. */
export interface CpRule {
  who: 'both' | 'active';
  /** A gate with no question always applies in its rounds. */
  gates: CpGate[];
  /** Extras go to the player whose turn it is. */
  extras: CpExtra[];
  source: string;
}

export interface SecondaryOut {
  id: string;
  name: string;
  category: string;
  type: 'progressive' | 'end-game' | 'progressive-and-end-game';
  faction?: string;
  text: string;
  plain?: string;
  amended?: string;
  /** Structured scoring: mission secondaries only. */
  components?: ScoringComponent[];
}

export interface MissionOut {
  id: string;
  name: string;
  pack: Pack;
  battleSize: BattleSizeId;
  /** '11' for D33 tables, '1-2' for D6 tables. */
  roll: string;
  rules: RulesText[];
  primary: RulesText & { components: ScoringComponent[] };
  missionSecondary?: SecondaryOut;
  cp: CpRule;
  map: MissionMap;
  verified: boolean;
  unverified: string[];
  source: { url: string; retrieved: string };
}

export interface PackOut {
  id: Pack;
  name: string;
  battleSizes: BattleSizeId[];
  startingCp: Partial<Record<BattleSizeId, number>>;
  caps: { primary: number; secondaryEach: number; secondaryTotal: number; battleReady: number };
  defaultSecondaries: string[];
  maxPerCategory: number;
  secondaryCount: number;
  firstTurn: 'winner-takes-first' | 'winner-chooses';
  concede: 'opponent-wins' | 'conceder-scores-0';
  setupSteps: RulesText[];
  secondaries: SecondaryOut[];
  source: string;
}

export interface SecondaryFaction { faction: string; note?: string }
export interface MissionsOut {
  generatedAt: string;
  packs: PackOut[];
  missions: MissionOut[];
  /** Catalogue slug -> the Wahapedia secondary faction names its player may pick from. */
  secondaryFactions: Record<string, SecondaryFaction[]>;
}
