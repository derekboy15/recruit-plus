/** Mission-pack rules the engine applies (spec §4: Core Book for Combat Patrol / Onslaught, Arks of Omen for Incursion / Strike Force). */
import type { BattleSizeId } from '../core/state';

export interface MissionRules {
  pack: 'core-book' | 'arks-of-omen';
  battleRounds: number;
  startingCp: number;
  /** Battle-forged CP each Command phase: the active player only (Core Book) or both players (Nephilim / Arks of Omen). */
  cpEveryCommandPhase: 'active' | 'both';
  strategicReservesFree: boolean;
  /** Reserves can't arrive before this battle round. */
  reservesFromRound: number;
  /** Reserves not on the battlefield at the end of this round are destroyed. */
  reservesDeadlineRound: number;
  aircraftStartInReserves: boolean;
  primary: { kind: 'take-and-hold' | 'domination'; vpPerCondition: number; maxPerTurn: number };
  secondPlayerRound5: 'command-phase' | 'end-of-turn';
  firstTurn: 'winner-chooses' | 'winner-first';
  emptyDedicatedTransportsDestroyed: boolean;
  vpCaps: { primary: number; secondary: number; painted: number };
}

const SHARED = {
  battleRounds: 5,
  reservesFromRound: 2,
  reservesDeadlineRound: 3,
  aircraftStartInReserves: true,
  vpCaps: { primary: 45, secondary: 15, painted: 10 },
};

/** MP §2, §4, §5: Core Book Eternal War. */
export function coreBook(size: 'combat-patrol' | 'onslaught'): MissionRules {
  return {
    ...SHARED,
    pack: 'core-book',
    startingCp: size === 'combat-patrol' ? 3 : 18,
    cpEveryCommandPhase: 'active',
    strategicReservesFree: false,
    primary: { kind: 'take-and-hold', vpPerCondition: 5, maxPerTurn: 15 },
    secondPlayerRound5: 'command-phase',
    firstTurn: 'winner-chooses',
    emptyDedicatedTransportsDestroyed: false,
  };
}

/** GT §5: Arks of Omen Grand Tournament. */
export const ARKS_OF_OMEN: MissionRules = {
  ...SHARED,
  pack: 'arks-of-omen',
  startingCp: 6,
  cpEveryCommandPhase: 'both',
  strategicReservesFree: true,
  primary: { kind: 'take-and-hold', vpPerCondition: 4, maxPerTurn: 12 },
  secondPlayerRound5: 'end-of-turn',
  firstTurn: 'winner-first',
  emptyDedicatedTransportsDestroyed: true,
};

export function missionRulesFor(size: BattleSizeId): MissionRules {
  return size === 'combat-patrol' || size === 'onslaught' ? coreBook(size) : { ...ARKS_OF_OMEN };
}

/** Spec §4 board sizes. */
export const BOARD_SIZES: Record<BattleSizeId, { w: number; h: number }> = {
  'combat-patrol': { w: 44, h: 30 },
  incursion: { w: 44, h: 30 },
  'strike-force': { w: 44, h: 60 },
  onslaught: { w: 44, h: 90 },
};
