/**
 * Where armies deploy and where the objectives are: the built-in practice layout here, plus the table companion's
 * Arks of Omen and Core Book missions, which the setup screen adds through missionAdapter.ts.
 */
import type { BattleSizeId, Edge, PlayerId, Pt } from '@recruit/engine';

export interface MissionLayout { zones: Record<PlayerId, Pt[]>; edges: Record<PlayerId, Edge>; objectives: { id: string; pos: Pt; label?: string }[] }

export interface SandboxMission {
  id: string;
  name: string;
  source: 'practice' | 'core-book' | 'arks-of-omen';
  /** Plain-English summary shown on the setup screen. */
  description: string;
  sizes: BattleSizeId[];
  layout(board: { w: number; h: number }, size: BattleSizeId): MissionLayout;
}

export interface MissionProvider { missions(size: BattleSizeId): SandboxMission[] }

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

export const PRACTICE: SandboxMission = {
  id: 'practice',
  name: 'Practice',
  source: 'practice',
  description:
    "A simple practice layout for the sandbox: deploy along your own edge, objectives in the middle and in each deployment zone. It isn't an official mission; primary objectives score as in the battle size's mission pack.",
  sizes: ['combat-patrol', 'incursion', 'strike-force', 'onslaught'],
  layout({ w, h }, size) {
    const depth = Math.min(12, (h - 12) / 2);
    const middle: Pt[] =
      size === 'combat-patrol'
        ? []
        : size === 'onslaught'
          ? [
              { x: w / 2, y: h / 3 },
              { x: w / 2, y: (2 * h) / 3 },
            ]
          : [{ x: w / 2, y: h / 2 }];
    const points: Pt[] = [{ x: w / 2, y: depth / 2 }, { x: w / 4, y: h / 2 }, ...middle, { x: (3 * w) / 4, y: h / 2 }, { x: w / 2, y: h - depth / 2 }];
    return {
      zones: { A: rect(0, 0, w, depth), B: rect(0, h - depth, w, h) },
      edges: { A: 'south', B: 'north' },
      objectives: points.map((pos, i) => ({ id: String(i + 1), pos })),
    };
  },
};

const providers: MissionProvider[] = [];

/** Adds missions from another source (Milestone 7's mission data). */
export function registerMissionProvider(p: MissionProvider): void {
  providers.push(p);
}

/** The missions offered for a battle size: the built-in practice layout first, then the providers'. */
export function missionsFor(size: BattleSizeId): SandboxMission[] {
  return [PRACTICE, ...providers.flatMap((p) => p.missions(size))];
}

export function missionById(id: string, size: BattleSizeId): SandboxMission | undefined {
  return missionsFor(size).find((m) => m.id === id);
}
