import { describe, expect, test } from 'vitest';
import { coherencyRemovals, inCoherency } from '../../src/geometry/coherency';
import { distance3d, horizontalGap, inEngagementRange, moreThan, overlaps, whollyWithinPolygon, within, anyPartWithin } from '../../src/geometry/measure';
import type { BaseShape } from '../../src/datasheet/types';
import type { Placed } from '../../src/geometry/shapes';

const mm = (v: number) => v / 25.4;
const c32: BaseShape = { kind: 'circle', d: mm(32) };
const R32 = mm(16);
const m = (id: string, x: number, y: number, z = 0, base: BaseShape = c32, rot = 0): Placed => ({ id, base, pos: { x, y, z, rot } });
/** Two 32mm models whose bases are exactly `gap` apart horizontally. */
const pairAt = (gap: number, dz = 0) => [m('a', 0, 0), m('b', 2 * R32 + gap, 0, dz)] as const;

describe('measuring', () => {
  test('[TS §1.4] measure base to base', () => {
    expect(horizontalGap(m('a', 0, 0), m('b', 3, 0))).toBeCloseTo(3 - 32 / 25.4, 9);
  });

  test('[TS §1.4] touching and overlapping bases have a gap of 0', () => {
    expect(horizontalGap(...pairAt(0))).toBeCloseTo(0, 9);
    expect(horizontalGap(m('a', 0, 0), m('b', 0.5, 0))).toBe(0);
    expect(overlaps(...pairAt(0))).toBe(false);
    expect(overlaps(m('a', 0, 0), m('b', 0.5, 0))).toBe(true);
  });

  test('[TS §1.3] Engagement Range is 1" horizontally and 5" vertically', () => {
    expect(inEngagementRange(...pairAt(1, 5))).toBe(true);
    expect(inEngagementRange(...pairAt(1.01))).toBe(false);
    expect(inEngagementRange(...pairAt(0.5, 5.01))).toBe(false);
  });

  test('[TS §1.4] boundaries: exactly 1" is within Engagement Range; exactly 9" is not more than 9"', () => {
    expect(inEngagementRange(...pairAt(1 + 1e-9))).toBe(true);
    expect(within(1 + 1e-9, 1)).toBe(true);
    expect(moreThan(9 - 1e-9, 9)).toBe(false);
    expect(moreThan(9 + 1e-9, 9)).toBe(false);
    expect(moreThan(9.001, 9)).toBe(true);
  });

  test('[TS §1.4] range between models on different floors counts the vertical distance', () => {
    const [a, b] = pairAt(3, 4);
    expect(distance3d(a, b)).toBeCloseTo(5, 9);
  });

  test('[TS §1.4] an oval base is measured along its rotated axes', () => {
    const oval: BaseShape = { kind: 'oval', w: mm(60), h: mm(35) };
    // Unrotated: the long axis (30mm half-width) faces the circle along x.
    expect(horizontalGap(m('o', 0, 0, 0, oval), m('c', 3, 0))).toBeCloseTo(3 - mm(30) - R32, 6);
    // Rotated 90°: the short axis (17.5mm) faces it.
    expect(horizontalGap(m('o', 0, 0, 0, oval, Math.PI / 2), m('c', 3, 0))).toBeCloseTo(3 - mm(17.5) - R32, 6);
  });

  test('[TS §1.4] a rectangular hull is measured to its closest edge', () => {
    const hull: BaseShape = { kind: 'rect', w: 3, h: 5 };
    expect(horizontalGap(m('r', 0, 0, 0, hull), m('c', 4, 0))).toBeCloseTo(4 - 1.5 - R32, 9);
    expect(horizontalGap(m('r', 0, 0, 0, hull), m('s', 5, 0, 0, hull))).toBeCloseTo(2, 9);
  });

  test('[TS §1.4] "within" means any part, "wholly within" means every part', () => {
    const zone = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(whollyWithinPolygon(m('a', 5, 5), zone)).toBe(true);
    expect(whollyWithinPolygon(m('a', 10, 5), zone)).toBe(false);
    expect(anyPartWithin(m('a', 10, 5), zone)).toBe(true);
    expect(anyPartWithin(m('a', 12, 5), zone)).toBe(false);
  });
});

describe('unit coherency', () => {
  /** n models in a line, centres `step` apart. */
  const line = (n: number, step: number) => Array.from({ length: n }, (_, i) => m(`m${i}`, i * step, 0));

  test('[TS §1.2] 5-model unit: each model needs one neighbour within 2"', () => {
    expect(inCoherency(line(5, 2 * R32 + 2))).toBe(true);
    expect(inCoherency(line(5, 2 * R32 + 2.01))).toBe(false);
  });

  test('[TS §1.2] 6+ models need two neighbours', () => {
    expect(inCoherency(line(6, 2 * R32 + 1.9))).toBe(false); // the end models have only one neighbour
    const cluster = [m('a', 0, 0), m('b', 2, 0), m('c', 1, 1.7), m('d', 3, 1.7), m('e', 4, 0), m('f', 5, 1.7)];
    expect(inCoherency(cluster)).toBe(true);
  });

  test('[R-2] two separate coherent clumps are not in coherency', () => {
    const clumps = [m('a', 0, 0), m('b', 2, 0), m('c', 20, 0), m('d', 22, 0)];
    expect(inCoherency(clumps)).toBe(false);
  });

  test('[TS §1.2] vertical 5" counts for coherency', () => {
    expect(inCoherency([m('a', 0, 0, 0), m('b', 2, 0, 5)])).toBe(true);
    expect(inCoherency([m('a', 0, 0, 0), m('b', 2, 0, 5.1)])).toBe(false);
  });

  test('[TS §1.2] a single model is always in coherency', () => {
    expect(inCoherency([m('a', 0, 0)])).toBe(true);
  });

  test('[TS §8.3] coherency removals keep the largest group', () => {
    const near = [m('a', 0, 0), m('b', 2, 0), m('c', 1, 1.7), m('d', 3, 1.7), m('e', 4, 0)];
    const far = [m('x', 30, 0), m('y', 32, 0)];
    const removed = coherencyRemovals([...near, ...far], ['a', 'b', 'c', 'd', 'e', 'x', 'y']);
    expect(removed.sort()).toEqual(['x', 'y']);
  });

  test('[TS §8.3] a coherent unit loses nothing', () => {
    expect(coherencyRemovals(line(3, 2), ['m0', 'm1', 'm2'])).toEqual([]);
  });

  test('[TS §8.3] removals drop the model with fewest neighbours until coherent', () => {
    // 6 models: a 5-model cluster plus one hanging off the end with a single neighbour.
    const units = [m('a', 0, 0), m('b', 2, 0), m('c', 1, 1.7), m('d', 3, 1.7), m('e', 4, 0), m('t', 6.5, 0)];
    const removed = coherencyRemovals(units, ['t', 'a', 'b', 'c', 'd', 'e']);
    expect(removed).toEqual(['t']);
  });
});
