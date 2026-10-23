/**
 * Milestone 7's mission data (deployment maps drawn as on Wahapedia: inches, origin top-left, y down, some boards
 * landscape) turned into sandbox missions (engine board: y up with south at y = 0, Strike Force and Onslaught portrait).
 */
import type { BattleSizeId, Edge, Pt } from '@recruit/engine';
import type { Area, MissionMap, MissionOut, MissionsOut, Shape } from '@recruit/data/missions';
import type { MissionLayout, MissionProvider, SandboxMission } from './missions';

type XY = [number, number];
const ARC_STEP = Math.PI / 36; // 5° steps along a cut-out circle

function shapeOutline(s: Shape): XY[] {
  if (s.kind === 'rect') return [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]];
  if (s.kind === 'polygon') return s.points.map(([x, y]) => [x, y]);
  const n = Math.ceil((2 * Math.PI) / ARC_STEP);
  return Array.from({ length: n }, (_, i) => [s.cx + s.r * Math.cos((i / n) * 2 * Math.PI), s.cy + s.r * Math.sin((i / n) * 2 * Math.PI)]);
}

function insideOutline(p: XY, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Where segment p→q crosses the circle, as fractions 0 < t < 1 along it, in order. */
function crossings(p: XY, q: XY, c: { cx: number; cy: number; r: number }): number[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const fx = p[0] - c.cx;
  const fy = p[1] - c.cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * (fx * fx + fy * fy - c.r * c.r);
  if (a === 0 || disc <= 0) return [];
  const s = Math.sqrt(disc);
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)].filter((t) => t > 1e-9 && t < 1 - 1e-9);
}

/** Cuts a circle out of an outline: runs of the outline inside the circle are replaced by the arc that stays in the area. */
function cutCircle(poly: XY[], c: { cx: number; cy: number; r: number }): XY[] {
  const inCircle = (p: XY) => Math.hypot(p[0] - c.cx, p[1] - c.cy) < c.r - 1e-9;
  const marks: { p: XY; kind: 'vertex' | 'enter' | 'exit' }[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    if (!inCircle(p)) marks.push({ p, kind: 'vertex' });
    let inside = inCircle(p);
    for (const t of crossings(p, q, c)) {
      inside = !inside;
      marks.push({ p: [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])], kind: inside ? 'enter' : 'exit' });
    }
  });
  if (!marks.some((m) => m.kind === 'enter')) return poly;
  const angle = (p: XY) => Math.atan2(p[1] - c.cy, p[0] - c.cx);
  const out: XY[] = [];
  marks.forEach((m, i) => {
    out.push(m.p);
    if (m.kind !== 'enter') return;
    const exit = marks.slice(i + 1).concat(marks.slice(0, i + 1)).find((x) => x.kind === 'exit')!;
    const a0 = angle(m.p);
    const ccw = (((angle(exit.p) - a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    // Of the two arcs between entry and exit, follow the one that runs through the area.
    const mid = (sweep: number): XY => [c.cx + c.r * Math.cos(a0 + sweep / 2), c.cy + c.r * Math.sin(a0 + sweep / 2)];
    const sweep = insideOutline(mid(ccw), poly) ? ccw : ccw - 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP));
    for (let k = 1; k < n; k++) out.push([c.cx + c.r * Math.cos(a0 + (sweep * k) / n), c.cy + c.r * Math.sin(a0 + (sweep * k) / n)]);
  });
  return out;
}

/** One outline for a deployment zone: a single shape, minus any circles (the mission data uses nothing else). */
export function areaToPolygon(area: Area): XY[] {
  if (area.include.length !== 1) throw new Error('A deployment zone must be one shape');
  let poly = shapeOutline(area.include[0]);
  for (const ex of area.exclude ?? []) {
    if (ex.kind !== 'circle') throw new Error(`Can't cut a ${ex.kind} out of a deployment zone`);
    poly = cutCircle(poly, ex);
  }
  return poly;
}

const COMPASS_TURN: Record<string, string> = { n: 'e', e: 's', s: 'w', w: 'n' };

/**
 * A compass-named objective ("nw", "se1") renamed for a map turned a quarter turn clockwise, so the name still says
 * where it is on the board: nw → ne, n → e and so on. Any other name is unchanged.
 */
export function turnCompassLabel(name: string): string {
  const m = /^(nw|ne|sw|se|n|e|s|w)(\d*)$/i.exec(name);
  if (!m) return name;
  const turned = [...m[1]].map((ch) => {
    const t = COMPASS_TURN[ch.toLowerCase()];
    return ch === ch.toUpperCase() ? t.toUpperCase() : t;
  });
  // Keep the usual order: north/south first (ne, not en).
  const ordered = turned.length === 2 && /[ew]/i.test(turned[0]) ? [turned[1], turned[0]] : turned;
  return ordered.join('') + m[2];
}

/**
 * Map coordinates → engine coordinates. A map the same shape as the board is flipped so y points up; a landscape map
 * on a portrait board is turned a quarter turn (as you'd turn the printed map), not mirrored.
 */
function toEngine(map: MissionMap, board: { w: number; h: number }): (x: number, y: number) => Pt {
  const { width: W, height: H } = map.board;
  if (W === board.w && H === board.h) return (x, y) => ({ x, y: board.h - y });
  if (W === board.h && H === board.w) return (x, y) => ({ x: H - y, y: W - x });
  throw new Error(`Map ${W}"×${H}" doesn't fit a ${board.w}"×${board.h}" board`);
}

function edgeAt(p: Pt, board: { w: number; h: number }): Edge {
  const d: [Edge, number][] = [['south', p.y], ['north', board.h - p.y], ['west', p.x], ['east', board.w - p.x]];
  return d.sort((a, b) => a[1] - b[1])[0][0];
}

const MAP_EDGE_MIDPOINT = {
  top: (W: number) => [W / 2, 0],
  bottom: (W: number, H: number) => [W / 2, H],
  left: (_: number, H: number) => [0, H / 2],
  right: (W: number, H: number) => [W, H / 2],
} as const;

export function missionLayout(map: MissionMap, board: { w: number; h: number }): MissionLayout {
  const f = toEngine(map, board);
  const turned = map.board.width !== board.w;
  const edge = (k: 'A' | 'B'): Edge => {
    const [x, y] = MAP_EDGE_MIDPOINT[map.edges[k]](map.board.width, map.board.height);
    return edgeAt(f(x, y), board);
  };
  const zone = (k: 'A' | 'B') => areaToPolygon(map.zones[k]).map(([x, y]) => f(x, y));
  return {
    zones: { A: zone('A'), B: zone('B') },
    edges: { A: edge('A'), B: edge('B') },
    objectives: map.objectives.map((o) => {
      const label = turned ? turnCompassLabel(o.label ?? o.id) : o.label;
      return { id: o.id, pos: f(o.x, o.y), ...(label && label !== o.id ? { label } : {}) };
    }),
  };
}

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

export function toSandboxMission(m: MissionOut): SandboxMission {
  const pack = m.pack === 'arks-of-omen' ? 'Arks of Omen' : 'Core Book';
  const scoring = firstSentence(m.primary.plain ?? m.primary.text);
  const estimate = m.map.verified ? '' : ' Some positions on this map are estimated from the source image.';
  return {
    id: m.id,
    name: m.name,
    source: m.pack,
    description: `${pack} mission. ${scoring}${estimate}`,
    sizes: [m.battleSize],
    layout: (board) => missionLayout(m.map, board),
  };
}

/** The table companion's missions, offered in the sandbox for their own battle size. */
export function missionDataProvider(data: MissionsOut): MissionProvider {
  return { missions: (size: BattleSizeId) => data.missions.filter((m) => m.battleSize === size).map(toSandboxMission) };
}
