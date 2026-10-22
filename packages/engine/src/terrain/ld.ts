/** Inspiring terrain: +1 Ld for units wholly within 6" (TR §3.3). */
import { polygonOf, signedDistToPolygon } from '../geometry/shapes';
import { hasTrait, type TerrainFeature } from './types';
import type { UnitView } from './visibility';

export function inspiringBonus(unit: UnitView, terrain: TerrainFeature[]): number {
  const keywords = unit.keywords.map((k) => k.toUpperCase());
  const ok = terrain.some((f) => {
    if (!hasTrait(f, 'inspiring')) return false;
    if (f.inspiringKeywords?.length && !f.inspiringKeywords.some((k) => keywords.includes(k.toUpperCase()))) return false;
    return unit.models.every((m) => polygonOf(m.base, m.pos).every((v) => Math.max(0, signedDistToPolygon(v, f.footprint)) <= 6 + 1e-6));
  });
  return ok ? 1 : 0;
}
