import { BOARD_SIZES, type BattleSizeId } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { missionById, missionsFor, PRACTICE, registerMissionProvider, type SandboxMission } from './missions';

const SIZES: BattleSizeId[] = ['combat-patrol', 'incursion', 'strike-force', 'onslaught'];
const layout = (size: BattleSizeId) => PRACTICE.layout(BOARD_SIZES[size], size);
const ys = (poly: { y: number }[]) => poly.map((p) => p.y);

describe('the Practice layout', () => {
  test('Practice has 4, 5, 5 and 6 objectives for Combat Patrol, Incursion, Strike Force and Onslaught', () => {
    expect(SIZES.map((s) => layout(s).objectives.length)).toEqual([4, 5, 5, 6]);
  });

  test('Practice zones are 9" deep on a 30" board and 12" deep on 60" and 90" boards, along each player\'s own edge', () => {
    const cp = layout('combat-patrol');
    expect(cp.edges).toEqual({ A: 'south', B: 'north' });
    expect([Math.min(...ys(cp.zones.A)), Math.max(...ys(cp.zones.A))]).toEqual([0, 9]);
    expect([Math.min(...ys(cp.zones.B)), Math.max(...ys(cp.zones.B))]).toEqual([21, 30]);
    for (const s of ['strike-force', 'onslaught'] as const) {
      const l = layout(s);
      const h = BOARD_SIZES[s].h;
      expect(Math.max(...ys(l.zones.A))).toBe(12);
      expect(Math.min(...ys(l.zones.B))).toBe(h - 12);
      expect(l.zones.A.map((p) => p.x).sort((a, b) => a - b)).toEqual([0, 0, 44, 44]);
    }
  });

  test('every objective is on the battlefield', () => {
    for (const s of SIZES) {
      const { w, h } = BOARD_SIZES[s];
      for (const o of layout(s).objectives) {
        expect(o.pos.x).toBeGreaterThan(0);
        expect(o.pos.x).toBeLessThan(w);
        expect(o.pos.y).toBeGreaterThan(0);
        expect(o.pos.y).toBeLessThan(h);
      }
      expect(new Set(layout(s).objectives.map((o) => o.id)).size).toBe(layout(s).objectives.length);
    }
  });

  test('Onslaught replaces the centre objective with two either side of it', () => {
    const pos = layout('onslaught').objectives.map((o) => `${o.pos.x},${o.pos.y}`);
    expect(pos).not.toContain('22,45');
    expect(pos).toEqual(expect.arrayContaining(['22,30', '22,60', '11,45', '33,45']));
  });

  test('it says it is not an official mission', () => {
    expect(PRACTICE.description).toMatch(/isn't an official mission/);
    expect(missionsFor('strike-force')[0]).toBe(PRACTICE);
  });
});

test("a registered provider's missions come after Practice, and missionById finds them", () => {
  const gt: SandboxMission = { ...PRACTICE, id: 'gt-test', name: 'GT test', source: 'arks-of-omen', sizes: ['strike-force'] };
  registerMissionProvider({ missions: (size) => (size === 'strike-force' ? [gt] : []) });
  expect(missionsFor('strike-force').map((m) => m.id)).toEqual(['practice', 'gt-test']);
  expect(missionsFor('combat-patrol').map((m) => m.id)).toEqual(['practice']);
  expect(missionById('gt-test', 'strike-force')).toBe(gt);
  expect(missionById('gt-test', 'combat-patrol')).toBeUndefined();
});
