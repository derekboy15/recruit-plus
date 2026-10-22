/** Moving over terrain: Difficult Ground (TR §3.2), climbing (TR §1, R-5) and where models may end (TR §3.2). */
import type { BaseShape } from '../datasheet/types';
import { anyPartWithin } from '../geometry/measure';
import { samplePath } from '../geometry/path';
import { pointInPolygon, segmentTouchesPolygon, type Pt } from '../geometry/shapes';
import { hasTrait, type TerrainFeature } from './types';

/** Difficult Ground features any part of the base passes over along the path (any height counts, TR §3.2). */
export function difficultGroundOnPath(path: Pt[], base: BaseShape, terrain: TerrainFeature[]): TerrainFeature[] {
  const dg = terrain.filter((f) => hasTrait(f, 'difficult-ground'));
  if (!dg.length) return [];
  const samples = samplePath(path, 0.1);
  return dg.filter((f) => samples.some((p) => anyPartWithin({ id: '', base, pos: { x: p.x, y: p.y, z: 0, rot: 0 } }, f.footprint)));
}

export interface Mover { canBreach: boolean; fliesOverTerrain: boolean }

/**
 * Extra inches the climb costs (R-5). Vertical distance counts (TR §1): |endZ - startZ|, plus, for each non-hill
 * feature over 1" tall the path passes over and the model can't move through, twice its height when the path goes
 * right over it, or twice its height when one end is inside it at ground level. FLY on a Normal Move, Advance or Fall
 * Back ignores vertical distance (TS §3.1); INFANTRY/BEAST/SWARM pass through Breachable features (TR §3.2).
 */
export function climbCost(path: Pt[], startZ: number, endZ: number, terrain: TerrainFeature[], mover: Mover): number {
  if (mover.fliesOverTerrain) return 0;
  let cost = Math.abs(endZ - startZ);
  const start = path[0];
  const end = path[path.length - 1];
  for (const f of terrain) {
    if (f.category === 'hill' || f.height <= 1) continue;
    if (mover.canBreach && hasTrait(f, 'breachable')) continue;
    let touched = false;
    for (let i = 1; i < path.length && !touched; i++) touched = segmentTouchesPolygon(path[i - 1], path[i], f.footprint);
    if (!touched) continue;
    const startIn = pointInPolygon(start, f.footprint);
    const endIn = pointInPolygon(end, f.footprint);
    if (!startIn && !endIn) cost += 2 * f.height;
    else if (startIn !== endIn && (startIn ? startZ : endZ) === 0) cost += 2 * f.height;
  }
  return cost;
}

const UPPER_FLOOR_KEYWORDS = ['INFANTRY', 'BEAST', 'SWARM', 'FLY'];

/** Can a model with these keywords end a move at elevation z on this feature? (TR §3.2) */
export function canEndOn(f: TerrainFeature, keywords: string[], z: number): boolean {
  if (z <= 0) return true;
  if (z > f.height + 1e-6) return false;
  if (hasTrait(f, 'unstable-position')) return false;
  if (hasTrait(f, 'scaleable')) return keywords.some((k) => UPPER_FLOOR_KEYWORDS.includes(k.toUpperCase()));
  return true;
}
