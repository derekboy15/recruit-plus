/** The engine's view of a datasheet: parsed characteristics, weapons, base and the few core-rule facts it needs. */
import type { DiceExpr } from '../core/dice';

/** "–" (can't move) is 'none'; Aircraft have a min–max range (TS §1.1). */
export type Move = { kind: 'fixed'; inches: number } | { kind: 'range'; min: number; max: number } | { kind: 'none' };
export type StrengthExpr = { kind: 'user' } | { kind: 'fixed'; v: number } | { kind: 'add'; v: number } | { kind: 'mul'; v: number };
export type WeaponType = 'Melee' | 'Assault' | 'Heavy' | 'Rapid Fire' | 'Grenade' | 'Pistol' | 'Dakka' | 'Other';

export interface WeaponProfile {
  name: string;
  type: WeaponType;
  /** Inches; null for melee weapons. */
  range: number | null;
  /** A minimum range: units wholly within it can't be targeted (TS §1.1). */
  minRange: number | null;
  shots: DiceExpr;
  /** Dakka X/Y: `shots` is Y (beyond half range), `dakkaShort` is X (within half range). */
  dakkaShort?: DiceExpr;
  s: StrengthExpr;
  ap: number;
  d: DiceExpr;
  blast: boolean;
  autoHit: boolean;
  indirect: boolean;
  text: string;
}

export interface ModelChars {
  M: Move; WS: number | null; BS: number | null; S: number; T: number; W: number; A: DiceExpr; Ld: number; Sv: number | null;
  invuln: number | null;
}
/** One row of a degrading profile: the characteristics that apply while wounds left are in [minW, maxW]. */
export interface Bracket { minW: number; maxW: number; chars: Partial<ModelChars> }
export interface ModelProfile { name: string; chars: ModelChars; brackets: Bracket[] }

/** Inches. Ovals and rects are given unrotated: w along x, h along y. */
export type BaseShape = { kind: 'circle'; d: number } | { kind: 'oval'; w: number; h: number } | { kind: 'rect'; w: number; h: number };

export interface PsychicPower { name: string; wc: number | null; smite?: true }
export interface PsykerProfile { cast: number; deny: number; powers: PsychicPower[] }

export interface Datasheet {
  id: string;
  name: string;
  role: string | null;
  /** Upper case, faction keywords not included. */
  keywords: string[];
  factionKeywords: string[];
  models: ModelProfile[];
  weapons: WeaponProfile[];
  base: BaseShape;
  baseEstimated: boolean;
  transportCapacity: number | null;
  psyker: PsykerProfile | null;
  objectiveSecured: boolean;
  /** Models this model counts as for objective control (Knights 10, BD §2). */
  ocPerModel: number;
  powerRating: number;
  points: number;
}
