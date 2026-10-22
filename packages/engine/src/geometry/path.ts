/** Paths models move along: length and the positions sampled along the way (for collision and Engagement Range checks). */
import { dist, type Pt } from './shapes';

export function pathLength(points: Pt[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += dist(points[i - 1], points[i]);
  return d;
}

/** Points along the path at most `step` apart, including both ends. */
export function samplePath(points: Pt[], step = 0.25): Pt[] {
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}
