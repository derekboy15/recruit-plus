/** Setting up a unit in rows around a point: a starting layout the player then adjusts by dragging. */
import type { BaseShape, Pos, Pt } from '@recruit/engine';

const ROW = 5;
const GAP = 1;

const extent = (b: BaseShape) => (b.kind === 'circle' ? { w: b.d, h: b.d } : { w: b.w, h: b.h });

function bounds(points: Pt[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/**
 * Rows of up to 5 (or `perRow`) with 1" (or `gap`) between bases (so they are in coherency), centred on `at`, then nudged wholly
 * inside `zone`. Narrower, tighter rows keep a unit close to a transport it gets out of.
 */
export function formation(bases: { id: string; base: BaseShape }[], at: Pt, zone?: Pt[], perRow = ROW, gap = GAP): Record<string, Pos> {
  if (!bases.length) return {};
  const cellW = Math.max(...bases.map((b) => extent(b.base).w)) + gap;
  const cellH = Math.max(...bases.map((b) => extent(b.base).h)) + gap;
  // A zone narrower than the row (e.g. a 10" strip along a short edge): shorter rows, so the unit can fit wholly inside.
  if (zone) {
    const z = bounds(zone);
    while (perRow > 1 && Math.min(perRow, bases.length) * cellW - gap > z.x1 - z.x0) perRow -= 1;
  }
  const rows = Math.ceil(bases.length / perRow);
  const cols = Math.min(perRow, bases.length);
  let pos = bases.map((b, i) => ({
    id: b.id,
    x: at.x + ((i % perRow) - (cols - 1) / 2) * cellW,
    y: at.y - (Math.floor(i / perRow) - (rows - 1) / 2) * cellH,
  }));
  if (zone) {
    const z = bounds(zone);
    const half = (b: BaseShape) => extent(b);
    const f = {
      x0: Math.min(...pos.map((p, i) => p.x - half(bases[i].base).w / 2)),
      x1: Math.max(...pos.map((p, i) => p.x + half(bases[i].base).w / 2)),
      y0: Math.min(...pos.map((p, i) => p.y - half(bases[i].base).h / 2)),
      y1: Math.max(...pos.map((p, i) => p.y + half(bases[i].base).h / 2)),
    };
    const margin = 0.01;
    const dx = f.x0 < z.x0 ? z.x0 - f.x0 + margin : f.x1 > z.x1 ? z.x1 - f.x1 - margin : 0;
    const dy = f.y0 < z.y0 ? z.y0 - f.y0 + margin : f.y1 > z.y1 ? z.y1 - f.y1 - margin : 0;
    pos = pos.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
  }
  return Object.fromEntries(pos.map((p) => [p.id, { x: p.x, y: p.y, z: 0, rot: 0 }]));
}
