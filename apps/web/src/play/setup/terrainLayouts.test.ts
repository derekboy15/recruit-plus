import { BOARD_SIZES, hasTrait, type Pt } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { TERRAIN_LAYOUTS } from './terrainLayouts';

const boards = Object.values(BOARD_SIZES);
const close = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

describe('terrain layouts', () => {
  test('there are open, city and mixed layouts', () => {
    expect(TERRAIN_LAYOUTS.map((l) => l.id)).toEqual(['open', 'city', 'mixed']);
  });

  test('each layout lies inside the board and is point-symmetric', () => {
    for (const layout of TERRAIN_LAYOUTS)
      for (const board of boards) {
        const fs = layout.features(board);
        expect(fs.length).toBeGreaterThan(0);
        expect(new Set(fs.map((f) => f.id)).size).toBe(fs.length);
        for (const f of fs) {
          for (const p of f.footprint) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(board.w);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(board.h);
          }
          const mirrored = f.footprint.map((p) => ({ x: board.w - p.x, y: board.h - p.y }));
          const twin = fs.find((g) => g.name === f.name && g.footprint.length === mirrored.length && mirrored.every((m) => g.footprint.some((q) => close(q, m))));
          expect(twin, `${layout.id} ${f.id} on ${board.w}x${board.h}`).toBeDefined();
        }
      }
  });

  test('no terrain within 3" of a board edge where a player deploys', () => {
    for (const layout of TERRAIN_LAYOUTS)
      for (const board of boards)
        for (const f of layout.features(board))
          for (const p of f.footprint) {
            expect(p.y).toBeGreaterThanOrEqual(3);
            expect(p.y).toBeLessThanOrEqual(board.h - 3);
          }
  });

  test('city ruins are Obscuring and at least 5" tall; mixed woods are Dense and at least 3" tall', () => {
    const city = TERRAIN_LAYOUTS.find((l) => l.id === 'city')!.features(BOARD_SIZES['strike-force']);
    const ruins = city.filter((f) => f.name === 'Ruins');
    expect(ruins).toHaveLength(4);
    for (const r of ruins) {
      expect(hasTrait(r, 'obscuring')).toBe(true);
      expect(r.height).toBeGreaterThanOrEqual(5);
    }
    expect(city.filter((f) => f.name === 'Crater')).toHaveLength(2);
    const mixed = TERRAIN_LAYOUTS.find((l) => l.id === 'mixed')!.features(BOARD_SIZES['strike-force']);
    const woods = mixed.filter((f) => f.name === 'Woods');
    expect(woods).toHaveLength(2);
    for (const w of woods) {
      expect(hasTrait(w, 'dense-cover')).toBe(true);
      expect(w.height).toBeGreaterThanOrEqual(3);
    }
    expect(mixed.filter((f) => f.name === 'Ruins')).toHaveLength(2);
    const open = TERRAIN_LAYOUTS.find((l) => l.id === 'open')!.features(BOARD_SIZES['strike-force']);
    expect(open.map((f) => f.name)).toEqual(['Crater', 'Crater']);
    expect(open.every((f) => hasTrait(f, 'difficult-ground') && f.category === 'area')).toBe(true);
  });
});
