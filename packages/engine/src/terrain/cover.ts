/** Which cover a model receives (TR §2, §3.1) and Defence Line engagement (R-6). */
import { anyPartWithin, gapToPolygon, horizontalGap, within } from '../geometry/measure';
import { segmentCrossesPolygon, type Placed } from '../geometry/shapes';
import { hasTrait, type TerrainFeature } from './types';
import { clearLineToWholeBase, type ModelView } from './visibility';

const COVER_KEYWORDS = ['INFANTRY', 'BEAST', 'SWARM'];
const takesCover = (m: ModelView) => m.keywords.some((k) => COVER_KEYWORDS.includes(k.toUpperCase()));

/** True when the model is on top of (z > 0 within) a feature with Exposed Position. */
export function exposed(m: Placed, terrain: TerrainFeature[]): boolean {
  return m.pos.z > 0 && terrain.some((f) => hasTrait(f, 'exposed-position') && anyPartWithin(m, f.footprint));
}

/**
 * Light / Heavy Cover a model receives against an attack from `attacker` (null: no attacker position to test).
 * - Only INFANTRY, BEAST and SWARM models (TR §2).
 * - Area Terrain: any part of the base within the footprint.
 * - Obstacle: within 3", unless the attacker can draw lines from one point to every part of the base without
 *   crossing it.
 * - Hills give none; a model on an Exposed Position feature gets none from anything (TR §3.1).
 */
export function coverFor(model: ModelView, attacker: Placed | null, _attack: 'ranged' | 'melee', terrain: TerrainFeature[]): { light: boolean; heavy: boolean } {
  const none = { light: false, heavy: false };
  if (!takesCover(model) || exposed(model, terrain)) return none;
  const giving = terrain.filter((f) => {
    if (f.category === 'hill' || !(hasTrait(f, 'light-cover') || hasTrait(f, 'heavy-cover'))) return false;
    if (f.category === 'area') return anyPartWithin(model, f.footprint);
    if (!within(gapToPolygon(model, f.footprint), 3)) return false;
    return !attacker || !clearLineToWholeBase(attacker, model, f);
  });
  return { light: giving.some((f) => hasTrait(f, 'light-cover')), heavy: giving.some((f) => hasTrait(f, 'heavy-cover')) };
}

/** R-6: two models within 2" horizontally whose centre line crosses a Defence Line feature count as engaged. */
export function defenceLineBetween(a: Placed, b: Placed, terrain: TerrainFeature[]): boolean {
  if (!within(horizontalGap(a, b), 2)) return false;
  return terrain.some((f) => hasTrait(f, 'defence-line') && segmentCrossesPolygon(a.pos, b.pos, f.footprint));
}
