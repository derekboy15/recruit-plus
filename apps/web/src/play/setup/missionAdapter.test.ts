import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOARD_SIZES, pointInPolygon, type Edge, type Pt } from '@recruit/engine';
import { areaContains, onAreaEdge, type Area, type MissionsOut } from '@recruit/data/missions';
import { describe, expect, test } from 'vitest';
import { areaToPolygon, missionDataProvider, toSandboxMission } from './missionAdapter';

// The generated mission data from Milestone 7 (built by `npm run data:build`).
const data: MissionsOut = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated', 'missions.json'), 'utf8'));

const grid = (w: number, h: number, step = 0.5): Pt[] => {
  const out: Pt[] = [];
  for (let x = step / 2; x < w; x += step) for (let y = step / 2; y < h; y += step) out.push({ x, y });
  return out;
};

describe('areaToPolygon', () => {
  test('a rectangle minus a circle becomes one outline that matches the area away from its edges', () => {
    const area: Area = { include: [{ kind: 'rect', x: 0, y: 0, w: 44, h: 12 }], exclude: [{ kind: 'circle', cx: 22, cy: 15, r: 9 }] };
    const poly = areaToPolygon(area).map(([x, y]) => ({ x, y }));
    for (const p of grid(44, 30)) {
      if (onAreaEdge(area, p) || nearBoundary(area, p)) continue;
      expect(pointInPolygon(p, poly), `(${p.x}, ${p.y})`).toBe(areaContains(area, p));
    }
  });

  test('a triangle stays the same triangle', () => {
    const area: Area = { include: [{ kind: 'polygon', points: [[0, 0], [30, 0], [0, 44]] }] };
    expect(areaToPolygon(area)).toEqual([[0, 0], [30, 0], [0, 44]]);
  });
});

/** Within 0.3" of the area's outline, where a sampled arc may differ from the true circle. */
function nearBoundary(area: Area, p: Pt): boolean {
  const d = 0.3;
  return [[d, 0], [-d, 0], [0, d], [0, -d]].some(([dx, dy]) => areaContains(area, { x: p.x + dx, y: p.y + dy }) !== areaContains(area, p));
}

const EDGE_DISTANCE: Record<Edge, (p: Pt, b: { w: number; h: number }) => number> = {
  south: (p) => p.y,
  north: (p, b) => b.h - p.y,
  west: (p) => p.x,
  east: (p, b) => b.w - p.x,
};

describe('every mission from the table companion data', () => {
  for (const m of data.missions) {
    test(`${m.id}: fits the sandbox board, keeps objectives in their zones, and each zone touches its own edge`, () => {
      const board = BOARD_SIZES[m.battleSize];
      const sandbox = toSandboxMission(m);
      expect(sandbox.sizes).toEqual([m.battleSize]);
      const layout = sandbox.layout(board, m.battleSize);
      const inBoard = (p: Pt) => p.x >= -1e-6 && p.y >= -1e-6 && p.x <= board.w + 1e-6 && p.y <= board.h + 1e-6;
      for (const k of ['A', 'B'] as const) {
        expect(layout.zones[k].every(inBoard), `zone ${k} inside the board`).toBe(true);
        const touches = Math.min(...layout.zones[k].map((p) => EDGE_DISTANCE[layout.edges[k]](p, board)));
        expect(touches, `zone ${k} touches its ${layout.edges[k]} edge`).toBeLessThan(1e-6);
      }
      expect(layout.edges.A).not.toBe(layout.edges.B);
      expect(layout.objectives).toHaveLength(m.map.objectives.length);
      m.map.objectives.forEach((o, i) => {
        const p = layout.objectives[i].pos;
        expect(inBoard(p)).toBe(true);
        if (onAreaEdge(m.map.zones.A, o) || onAreaEdge(m.map.zones.B, o)) return;
        expect(pointInPolygon(p, layout.zones.A), `objective ${o.id} in A`).toBe(o.in === 'A');
        expect(pointInPolygon(p, layout.zones.B), `objective ${o.id} in B`).toBe(o.in === 'B');
      });
    });
  }

  test('Strike Force and Onslaught maps, drawn landscape, are turned to the portrait sandbox board', () => {
    const sf = data.missions.find((m) => m.battleSize === 'strike-force')!;
    expect(sf.map.board).toEqual({ width: 60, height: 44 });
    const layout = toSandboxMission(sf).layout(BOARD_SIZES['strike-force'], 'strike-force');
    expect(Math.max(...layout.zones.A.concat(layout.zones.B).map((p) => p.y))).toBeCloseTo(60);
  });

  test('the provider offers only the missions for the chosen battle size', () => {
    const provider = missionDataProvider(data);
    const incursion = provider.missions('incursion');
    expect(incursion.length).toBeGreaterThan(0);
    expect(incursion.every((m) => m.sizes.includes('incursion') && m.source === 'arks-of-omen')).toBe(true);
    expect(provider.missions('combat-patrol').every((m) => m.source === 'core-book')).toBe(true);
    expect(incursion.map((m) => m.name)).toContain('Cleanse the Land');
  });
});
