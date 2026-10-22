/** Measuring between models: closest points of bases, horizontal and vertical (TS §1.3, §1.4). */
import { convexGap, EPS, pointInPolygon, polygonOf, segmentsIntersect, signedDistToPolygon, type Placed, type Pt } from './shapes';

export const within = (d: number, x: number) => d <= x + EPS;
export const moreThan = (d: number, x: number) => d > x + EPS;

/** Base-to-base horizontal gap, negative when the bases overlap (circle pairs exact, others by polygon). */
export function signedGap(a: Placed, b: Placed): number {
  if (a.base.kind === 'circle' && b.base.kind === 'circle')
    return Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) - a.base.d / 2 - b.base.d / 2;
  if (a.base.kind === 'circle') return signedDistToPolygon(a.pos, polygonOf(b.base, b.pos)) - a.base.d / 2;
  if (b.base.kind === 'circle') return signedDistToPolygon(b.pos, polygonOf(a.base, a.pos)) - b.base.d / 2;
  return convexGap(polygonOf(a.base, a.pos), polygonOf(b.base, b.pos));
}

/** Closest base-to-base horizontal distance; 0 when touching or overlapping. */
export const horizontalGap = (a: Placed, b: Placed) => Math.max(0, signedGap(a, b));
export const verticalGap = (a: Placed, b: Placed) => Math.abs(a.pos.z - b.pos.z);
export const distance3d = (a: Placed, b: Placed) => Math.hypot(horizontalGap(a, b), verticalGap(a, b));
/** Bases may touch but not overlap. */
export const overlaps = (a: Placed, b: Placed) => signedGap(a, b) < -1e-4;

/** TS §1.3: within 1" horizontally and 5" vertically. */
export const inEngagementRange = (a: Placed, b: Placed) => within(horizontalGap(a, b), 1) && within(verticalGap(a, b), 5);

/** Distance from a model's base to a point (0 if the point is under the base). */
export function gapToPoint(m: Placed, p: Pt): number {
  if (m.base.kind === 'circle') return Math.max(0, Math.hypot(m.pos.x - p.x, m.pos.y - p.y) - m.base.d / 2);
  return Math.max(0, signedDistToPolygon(p, polygonOf(m.base, m.pos)));
}

/** Gap from a model's base to a polygon's area (0 when touching or inside). */
export function gapToPolygon(m: Placed, poly: Pt[]): number {
  const fp = polygonOf(m.base, m.pos);
  if (anyPartWithin(m, poly)) return 0;
  let d = Infinity;
  for (const v of poly) d = Math.min(d, gapToPoint(m, v));
  for (const v of fp) d = Math.min(d, Math.max(0, signedDistToPolygon(v, poly)));
  return d;
}

export function whollyWithinPolygon(m: Placed, poly: Pt[]): boolean {
  return polygonOf(m.base, m.pos).every((v) => pointInPolygon(v, poly));
}

export function anyPartWithin(m: Placed, poly: Pt[]): boolean {
  const fp = polygonOf(m.base, m.pos);
  if (fp.some((v) => pointInPolygon(v, poly)) || poly.some((v) => pointInPolygon(v, fp))) return true;
  for (let i = 0, j = fp.length - 1; i < fp.length; j = i++)
    for (let k = 0, l = poly.length - 1; k < poly.length; l = k++) if (segmentsIntersect(fp[j], fp[i], poly[l], poly[k])) return true;
  return false;
}

/** Closest gap between any model of one group and any model of the other. */
export function unitGap(a: Placed[], b: Placed[]): number {
  let d = Infinity;
  for (const x of a) for (const y of b) d = Math.min(d, horizontalGap(x, y));
  return d;
}
