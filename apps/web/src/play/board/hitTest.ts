/** Which base is under a finger: a base the point is inside wins, else the nearest base edge within the slop. */
import { dist, pointInPolygon, signedDistToPolygon, type Pt } from '@recruit/engine';

export function hitTest(models: { id: string; poly: Pt[]; center: Pt }[], world: Pt, slopInches: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const m of models) {
    // Inside counts as distance -1 (beating any edge), ties among overlapping bases go to the nearest centre.
    const d = pointInPolygon(world, m.poly) ? -1 / (1 + dist(world, m.center)) : signedDistToPolygon(world, m.poly);
    if (d <= slopInches && (!best || d < best.d)) best = { id: m.id, d };
  }
  return best?.id ?? null;
}
