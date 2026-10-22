import { polygonOf } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { hitTest } from './hitTest';

const model = (id: string, x: number, y: number, mm: number) => {
  const pos = { x, y, z: 0, rot: 0 };
  return { id, poly: polygonOf({ kind: 'circle', d: mm / 25.4 }, pos), center: { x, y } };
};

describe('hitTest', () => {
  test('a point inside a base hits it', () => {
    expect(hitTest([model('a', 10, 10, 32)], { x: 10.3, y: 10.2 }, 0)).toBe('a');
  });

  test('a point within the slop of a tiny base hits it', () => {
    // 25 mm base, a fitted phone board at 8 px per inch: the 22 px slop is 2.75".
    const slop = 22 / 8;
    expect(hitTest([model('a', 10, 10, 25)], { x: 12.9, y: 10 }, slop)).toBe('a');
    expect(hitTest([model('a', 10, 10, 25)], { x: 13.4, y: 10 }, slop)).toBeNull();
  });

  test('the nearest base wins when two are within the slop', () => {
    const ms = [model('far', 10, 10, 25), model('near', 13, 10, 25)];
    expect(hitTest(ms, { x: 12, y: 10 }, 2.75)).toBe('near');
  });

  test('nothing within the slop is a miss', () => {
    expect(hitTest([model('a', 10, 10, 32)], { x: 30, y: 30 }, 1)).toBeNull();
  });
});
