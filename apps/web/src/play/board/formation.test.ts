import { inCoherency, overlaps, whollyWithinPolygon, type BaseShape } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { formation } from './formation';

const b32: BaseShape = { kind: 'circle', d: 32 / 25.4 };
const placed = (pos: ReturnType<typeof formation>, base: BaseShape) => Object.entries(pos).map(([id, p]) => ({ id, base, pos: p }));

describe('formation', () => {
  test('ten 32mm bases form two coherent rows with no overlaps', () => {
    const bases = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, base: b32 }));
    const pos = formation(bases, { x: 20, y: 20 });
    const ms = placed(pos, b32);
    expect(new Set(ms.map((m) => m.pos.y.toFixed(3))).size).toBe(2);
    expect(inCoherency(ms)).toBe(true);
    for (const a of ms) for (const b of ms) if (a !== b) expect(overlaps(a, b)).toBe(false);
    const xs = ms.map((m) => m.pos.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(20);
  });

  test('a formation near the zone edge is nudged wholly inside the zone', () => {
    const zone = [{ x: 0, y: 0 }, { x: 44, y: 0 }, { x: 44, y: 9 }, { x: 0, y: 9 }];
    const bases = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, base: b32 }));
    const ms = placed(formation(bases, { x: 1, y: 8.8 }, zone), b32);
    for (const m of ms) expect(whollyWithinPolygon(m, zone)).toBe(true);
    expect(inCoherency(ms)).toBe(true);
  });

  test('a compact formation puts four in a row, for getting out of a transport', () => {
    const bases = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, base: b32 }));
    const ms = placed(formation(bases, { x: 20, y: 20 }, undefined, 4, 0.5), b32);
    expect(new Set(ms.map((m) => m.pos.y.toFixed(3))).size).toBe(3);
    expect(inCoherency(ms)).toBe(true);
    for (const a of ms) for (const b of ms) if (a !== b) expect(overlaps(a, b)).toBe(false);
    // Every base wholly within 3" of a 60mm transport base centred on the same point.
    for (const m of ms) expect(Math.hypot(m.pos.x - 20, m.pos.y - 20) + 16 / 25.4).toBeLessThanOrEqual(3 + 30 / 25.4);
  });

  test('a single vehicle is centred on the point', () => {
    const hull: BaseShape = { kind: 'rect', w: 3, h: 5 };
    expect(formation([{ id: 'v', base: hull }], { x: 10, y: 12 })).toEqual({ v: { x: 10, y: 12, z: 0, rot: 0 } });
  });
});
