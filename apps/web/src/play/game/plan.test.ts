import type { Pos } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { planReducer, toMoves, toPositions, type Plan } from './plan';

const at = (x: number, y: number, rot = 0): Pos => ({ x, y, z: 0, rot });
const start = (together = true): Plan => planReducer(null, { type: 'start', unitId: 'u', origin: { a: at(1, 1), b: at(3, 1) }, together })!;

describe('move plans', () => {
  test('dragging with together on moves the whole unit by the same delta', () => {
    const p = planReducer(start(), { type: 'drag', modelId: 'a', to: { x: 2, y: 4 } })!;
    expect(p.positions).toEqual({ a: at(2, 4), b: at(4, 4) });
  });

  test('together off moves one model', () => {
    const p = planReducer(planReducer(start(), { type: 'together', value: false }), { type: 'drag', modelId: 'b', to: { x: 5, y: 2 } })!;
    expect(p.positions).toEqual({ a: at(1, 1), b: at(5, 2) });
  });

  test('rotate changes only rot', () => {
    const p = planReducer(start(), { type: 'rotate', modelId: 'a', radians: -Math.PI / 12 })!;
    expect(p.positions.a).toEqual(at(1, 1, -Math.PI / 12));
    expect(p.positions.b).toEqual(at(3, 1));
  });

  test('toMoves leaves out unmoved models', () => {
    const p = planReducer(planReducer(start(false), { type: 'together', value: false }), { type: 'drag', modelId: 'a', to: { x: 1, y: 3 } })!;
    expect(toMoves(p)).toEqual({ a: { to: at(1, 3) } });
    expect(toPositions(p)).toEqual({ a: at(1, 3), b: at(3, 1) });
  });

  test('reset returns to the origin and clear ends the plan', () => {
    const moved = planReducer(start(), { type: 'drag', modelId: 'a', to: { x: 9, y: 9 } });
    expect(planReducer(moved, { type: 'reset' })!.positions).toEqual(start().positions);
    expect(planReducer(moved, { type: 'clear' })).toBeNull();
  });

  test('a unit set up from off the battlefield starts with no positions and takes placed ones', () => {
    const p = planReducer(null, { type: 'start', unitId: 'u', origin: { a: null, b: null } })!;
    expect(p.positions).toEqual({});
    const placed = planReducer(p, { type: 'place', positions: { a: at(5, 5), b: at(7, 5) } })!;
    expect(toPositions(placed)).toEqual({ a: at(5, 5), b: at(7, 5) });
    expect(toMoves(placed)).toEqual({});
  });
});
