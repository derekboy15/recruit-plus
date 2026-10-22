/** Point-in-area tests and consistency checks for mission maps. Boundaries count as inside. */
import type { Area, MissionMap, PlayerKey, Point, Shape } from './types';

const EPS = 1e-6;

export function shapeContains(s: Shape, p: Point): boolean {
  if (s.kind === 'rect') return p.x >= s.x - EPS && p.x <= s.x + s.w + EPS && p.y >= s.y - EPS && p.y <= s.y + s.h + EPS;
  if (s.kind === 'circle') return (p.x - s.cx) ** 2 + (p.y - s.cy) ** 2 <= s.r ** 2 + EPS;
  const pts = s.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (onSegment(p, xi, yi, xj, yj)) return true;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function onSegment(p: Point, x1: number, y1: number, x2: number, y2: number): boolean {
  const cross = (p.x - x1) * (y2 - y1) - (p.y - y1) * (x2 - x1);
  if (Math.abs(cross) > EPS * Math.hypot(x2 - x1, y2 - y1)) return false;
  return p.x >= Math.min(x1, x2) - EPS && p.x <= Math.max(x1, x2) + EPS && p.y >= Math.min(y1, y2) - EPS && p.y <= Math.max(y1, y2) + EPS;
}

/** Inside an excluded shape counts as outside; a point on an excluded shape's boundary stays inside. */
export function areaContains(a: Area, p: Point): boolean {
  if (!a.include.some((s) => shapeContains(s, p))) return false;
  return !(a.exclude ?? []).some((s) => strictlyInside(s, p));
}

function strictlyInside(s: Shape, p: Point): boolean {
  if (s.kind === 'circle') return (p.x - s.cx) ** 2 + (p.y - s.cy) ** 2 < s.r ** 2 - EPS;
  if (s.kind === 'rect') return p.x > s.x + EPS && p.x < s.x + s.w - EPS && p.y > s.y + EPS && p.y < s.y + s.h - EPS;
  return shapeContains(s, p) && !s.points.some(([x, y], i) => {
    const [x2, y2] = s.points[(i + 1) % s.points.length];
    return onSegment(p, x, y, x2, y2);
  });
}

export function objectiveArea(map: MissionMap, p: Point): PlayerKey | 'nml' {
  if (areaContains(map.zones.A, p)) return 'A';
  if (areaContains(map.zones.B, p)) return 'B';
  return 'nml';
}

/** The image of a point under the map's symmetry, or null when it has none. */
export function mirrorPoint(map: MissionMap, p: Point): Point | null {
  const { width: W, height: H } = map.board;
  if (map.symmetry === 'rotate180') return { x: W - p.x, y: H - p.y };
  if (map.symmetry === 'mirror') {
    const horizontal = map.edges.A === 'left' || map.edges.A === 'right';
    return horizontal ? { x: W - p.x, y: p.y } : { x: p.x, y: H - p.y };
  }
  return null;
}

/** Problems with a map; empty when it is consistent. Zones are sampled on a 0.5" grid. */
export function validateMap(map: MissionMap): string[] {
  const problems: string[] = [];
  const { width: W, height: H } = map.board;
  const onBoard = (p: Point) => p.x >= -EPS && p.x <= W + EPS && p.y >= -EPS && p.y <= H + EPS;
  for (const o of map.objectives) {
    if (!onBoard(o)) problems.push(`objective ${o.id} is off the ${W}x${H} board`);
    else if (objectiveArea(map, o) !== o.in) problems.push(`objective ${o.id} is declared in ${o.in} but lies in ${objectiveArea(map, o)}`);
  }
  for (const key of ['A', 'B'] as const) {
    for (const s of map.zones[key].include) {
      const corners: Point[] =
        s.kind === 'rect' ? [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y + s.h }]
        : s.kind === 'polygon' ? s.points.map(([x, y]) => ({ x, y }))
        : [];
      if (corners.some((c) => !onBoard(c))) problems.push(`zone ${key} goes off the board`);
    }
  }
  let overlap = false;
  let asymmetric = false;
  for (let x = 0.25; x < W; x += 0.5) {
    for (let y = 0.25; y < H; y += 0.5) {
      const p = { x, y };
      const inA = areaContains(map.zones.A, p);
      const inB = areaContains(map.zones.B, p);
      if (inA && inB) overlap = true;
      const m = mirrorPoint(map, p);
      if (m && inA !== areaContains(map.zones.B, m)) asymmetric = true;
    }
  }
  if (overlap) problems.push('deployment zones overlap');
  if (asymmetric) problems.push(`zones break ${map.symmetry} symmetry`);
  for (const o of map.objectives) {
    const m = mirrorPoint(map, o);
    if (m && !map.objectives.some((q) => Math.abs(q.x - m.x) < 0.01 && Math.abs(q.y - m.y) < 0.01)) {
      problems.push(`objective ${o.id} breaks ${map.symmetry} symmetry`);
    }
  }
  return problems;
}
