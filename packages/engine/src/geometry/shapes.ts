/** Points, polygons and model footprints (inches; the board is the x/y plane, z is elevation). */
import type { BaseShape } from '../datasheet/types';

export const EPS = 1e-6;
export interface Pt { x: number; y: number }
/** z: elevation (ruin floors); rot: radians, counter-clockwise. */
export interface Pos { x: number; y: number; z: number; rot: number }
export type Placed = { id: string; base: BaseShape; pos: Pos };

const SEGMENTS = 64;

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** The footprint as a convex polygon (circles and ovals as 64-gons with vertices on the curve, including both axes). */
export function polygonOf(base: BaseShape, p: Pos): Pt[] {
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  const place = (x: number, y: number): Pt => ({ x: p.x + x * cos - y * sin, y: p.y + x * sin + y * cos });
  if (base.kind === 'rect') {
    const w = base.w / 2;
    const h = base.h / 2;
    return [place(-w, -h), place(w, -h), place(w, h), place(-w, h)];
  }
  const rx = base.kind === 'circle' ? base.d / 2 : base.w / 2;
  const ry = base.kind === 'circle' ? base.d / 2 : base.h / 2;
  const out: Pt[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    out.push(place(rx * Math.cos(a), ry * Math.sin(a)));
  }
  return out;
}

/** Half the base's largest extent. */
export function outerRadius(base: BaseShape): number {
  if (base.kind === 'circle') return base.d / 2;
  if (base.kind === 'oval') return Math.max(base.w, base.h) / 2;
  return Math.hypot(base.w, base.h) / 2;
}
export function smallestDimension(base: BaseShape): number {
  return base.kind === 'circle' ? base.d : Math.min(base.w, base.h);
}

export function distPointSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ray casting; points on the boundary count as inside. Works for any simple polygon. */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (distPointSegment(p, poly[j], poly[i]) <= EPS) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance from p to the polygon's boundary, negative when p is inside. */
export function signedDistToPolygon(p: Pt, poly: Pt[]): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distPointSegment(p, poly[j], poly[i]));
  return pointInPolygon(p, poly) ? -d : d;
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** True when segments ab and cd share any point. */
export function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return distPointSegment(a, c, d) <= EPS || distPointSegment(b, c, d) <= EPS || distPointSegment(c, a, b) <= EPS || distPointSegment(d, a, b) <= EPS;
}

export function segmentDistance(a: Pt, b: Pt, c: Pt, d: Pt): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(distPointSegment(a, c, d), distPointSegment(b, c, d), distPointSegment(c, a, b), distPointSegment(d, a, b));
}

/** True when the segment touches the polygon's area (crosses its boundary or lies inside it). */
export function segmentTouchesPolygon(a: Pt, b: Pt, poly: Pt[]): boolean {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segmentsIntersect(a, b, poly[j], poly[i])) return true;
  return false;
}

/** True when the segment passes through the polygon's interior (not just grazing an edge or vertex). */
export function segmentCrossesPolygon(a: Pt, b: Pt, poly: Pt[]): boolean {
  // Split the segment where it meets the polygon's edges; it crosses the interior iff some piece's midpoint is inside.
  const ts = [0, 1];
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const sx = poly[i].x - poly[j].x;
    const sy = poly[i].y - poly[j].y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) continue;
    const qx = poly[j].x - a.x;
    const qy = poly[j].y - a.y;
    const t = (qx * sy - qy * sx) / den;
    const u = (qx * ry - qy * rx) / den;
    if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  for (let i = 1; i < ts.length; i++) {
    if (ts[i] - ts[i - 1] < 1e-9) continue;
    const t = (ts[i] + ts[i - 1]) / 2;
    if (signedDistToPolygon({ x: a.x + rx * t, y: a.y + ry * t }, poly) < -EPS) return true;
  }
  return false;
}

/**
 * Signed gap between two convex polygons: the closest distance when apart, minus the penetration depth when they
 * overlap (separating axis test).
 */
export function convexGap(p: Pt[], q: Pt[]): number {
  let minOverlap = Infinity;
  for (const poly of [p, q]) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const nx = poly[i].y - poly[j].y;
      const ny = poly[j].x - poly[i].x;
      const len = Math.hypot(nx, ny);
      if (!len) continue;
      let pMin = Infinity, pMax = -Infinity, qMin = Infinity, qMax = -Infinity;
      for (const v of p) {
        const s = (v.x * nx + v.y * ny) / len;
        pMin = Math.min(pMin, s);
        pMax = Math.max(pMax, s);
      }
      for (const v of q) {
        const s = (v.x * nx + v.y * ny) / len;
        qMin = Math.min(qMin, s);
        qMax = Math.max(qMax, s);
      }
      const overlap = Math.min(pMax - qMin, qMax - pMin);
      if (overlap <= 0) return polygonDistance(p, q);
      minOverlap = Math.min(minOverlap, overlap);
    }
  }
  return -minOverlap;
}

function polygonDistance(p: Pt[], q: Pt[]): number {
  let d = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    for (let k = 0, l = q.length - 1; k < q.length; l = k++) d = Math.min(d, segmentDistance(p[j], p[i], q[l], q[k]));
  return d;
}

export function centroid(poly: Pt[]): Pt {
  return { x: poly.reduce((a, p) => a + p.x, 0) / poly.length, y: poly.reduce((a, p) => a + p.y, 0) / poly.length };
}
