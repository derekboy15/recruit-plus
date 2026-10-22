import { describe, expect, test } from 'vitest';
import { d3FromD6, nextD6, parseDice, seedDice, type DiceState } from '../../src/core/dice';

describe('parseDice', () => {
  test('dice expressions', () => {
    expect(parseDice('D3+3')).toEqual({ n: 1, sides: 3, plus: 3 });
    expect(parseDice('2D6')).toEqual({ n: 2, sides: 6, plus: 0 });
    expect(parseDice('3')).toEqual({ n: 0, sides: 6, plus: 3 });
    expect(parseDice('D6')).toEqual({ n: 1, sides: 6, plus: 0 });
    expect(parseDice('2D3')).toEqual({ n: 2, sides: 3, plus: 0 });
    expect(parseDice('D6+2')).toEqual({ n: 1, sides: 6, plus: 2 });
    expect(parseDice('2d6')).toEqual({ n: 2, sides: 6, plus: 0 });
    expect(parseDice('D3 + 1')).toEqual({ n: 1, sides: 3, plus: 1 });
  });
  test('non-dice strings are null', () => {
    expect(parseDice('x2')).toBeNull();
    expect(parseDice('-')).toBeNull();
    expect(parseDice('')).toBeNull();
    expect(parseDice('D4')).toBeNull();
  });
});

function draw(d: DiceState, n: number): { values: number[]; next: DiceState } {
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = nextD6(d);
    values.push(r.value);
    d = r.next;
  }
  return { values, next: d };
}

describe('seeded dice', () => {
  test('the same seed gives the same values', () => {
    expect(draw(seedDice(42), 20).values).toEqual(draw(seedDice(42), 20).values);
    expect(draw(seedDice(42), 20).values).not.toEqual(draw(seedDice(43), 20).values);
  });
  test('values are 1..6 and all faces appear', () => {
    const { values } = draw(seedDice(7), 600);
    expect(values.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)).toBe(true);
    expect(new Set(values).size).toBe(6);
  });
  test('a scripted queue is drawn before the generator', () => {
    const seeded = draw(seedDice(5), 1).values[0];
    const d = { ...seedDice(5), queue: [6, 1] };
    expect(draw(d, 3).values).toEqual([6, 1, seeded]);
  });
  test('dice state is plain JSON', () => {
    const d = draw(seedDice(9), 5).next;
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });
  test('[TS §1.6] D3 is a D6 halved, rounded up', () => {
    expect([1, 2, 3, 4, 5, 6].map(d3FromD6)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
