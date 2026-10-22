/**
 * Line of sight on a 2D footprint model (R-3): models see each other unless every line between sample points on their
 * bases passes through an Obscuring feature (TR §3.3). Dense Cover's -1 to hit (TR §3.1, R-4).
 */
import { anyPartWithin, gapToPolygon, within } from '../geometry/measure';
import { polygonOf, segmentCrossesPolygon, type Placed, type Pt } from '../geometry/shapes';
import { hasTrait, type TerrainFeature } from './types';

export interface ModelView extends Placed { keywords: string[]; /** The W characteristic (not wounds left). */ wounds: number }
export interface UnitView { id: string; keywords: string[]; models: ModelView[] }

const kw = (m: { keywords: string[] }, k: string) => m.keywords.some((x) => x.toUpperCase() === k);
/** AIRCRAFT and W18+ models can be seen through Obscuring terrain and ignore Dense Cover (TR §3.1, §3.3). */
export const seenThroughTerrain = (m: ModelView) => kw(m, 'AIRCRAFT') || m.wounds >= 18;

/** The base's centre plus 16 points around its edge. */
export function samplePoints(m: Placed): Pt[] {
  const poly = polygonOf(m.base, m.pos);
  const out: Pt[] = [{ x: m.pos.x, y: m.pos.y }];
  if (poly.length >= 16) {
    for (let i = 0; i < poly.length; i += poly.length / 16) out.push(poly[Math.floor(i)]);
    return out;
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    for (let k = 0; k < 4; k++) out.push({ x: a.x + ((b.x - a.x) * k) / 4, y: a.y + ((b.y - a.y) * k) / 4 });
  }
  return out;
}

const clear = (p: Pt, q: Pt, blockers: TerrainFeature[]) => blockers.every((f) => !segmentCrossesPolygon(p, q, f.footprint));

/** Can `from` see `to`? */
export function canSee(from: ModelView, to: ModelView, terrain: TerrainFeature[]): boolean {
  if (seenThroughTerrain(to)) return true;
  const blockers = terrain.filter(
    (f) => hasTrait(f, 'obscuring') && within(5, f.height) && !anyPartWithin(from, f.footprint) && !anyPartWithin(to, f.footprint),
  );
  if (!blockers.length) return true;
  const ps = samplePoints(from);
  const qs = samplePoints(to);
  return ps.some((p) => qs.some((q) => clear(p, q, blockers)));
}

/** Is any model of the target unit visible to this model? */
export function unitVisibleTo(from: ModelView, target: UnitView, terrain: TerrainFeature[]): boolean {
  return target.models.some((m) => canSee(from, m, terrain));
}

/**
 * Dense Cover: -1 to hit unless, from one point on the firer's base, lines reach every point of at least one target
 * model's base without crossing a Dense feature at least 3" tall. The firer ignores a Dense area feature it is within,
 * and a Dense obstacle within 3"; no penalty against AIRCRAFT or units with a W18+ model (TR §3.1).
 */
export function denseCoverPenalty(firer: ModelView, target: UnitView, terrain: TerrainFeature[]): boolean {
  if (target.models.some(seenThroughTerrain) || kw(target, 'AIRCRAFT')) return false;
  const dense = terrain.filter((f) => {
    if (!hasTrait(f, 'dense-cover') || !within(3, f.height) || f.category === 'hill') return false;
    if (f.category === 'area') return !anyPartWithin(firer, f.footprint);
    return !within(gapToPolygon(firer, f.footprint), 3);
  });
  if (!dense.length) return false;
  const ps = samplePoints(firer);
  return !ps.some((p) => target.models.some((m) => samplePoints(m).every((q) => clear(p, q, dense))));
}

/** True when, from one point on the attacker's base, lines reach every point of the target's base without crossing f. */
export function clearLineToWholeBase(attacker: Placed, target: Placed, f: TerrainFeature): boolean {
  const qs = samplePoints(target);
  return samplePoints(attacker).some((p) => qs.every((q) => !segmentCrossesPolygon(p, q, f.footprint)));
}
