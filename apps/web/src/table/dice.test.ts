import { expect, test } from 'vitest';
import { rollD6, rollDice } from './dice';

test('rollDice with a seed is repeatable', () => {
  expect(rollDice(10, 6, 42)).toEqual(rollDice(10, 6, 42));
  expect(rollDice(10, 6, 42)).not.toEqual(rollDice(10, 6, 43));
});
test('D6 and D3 stay in range', () => {
  const d6 = rollDice(600, 6, 7);
  const d3 = rollDice(600, 3, 7);
  expect(d6.every((v) => v >= 1 && v <= 6)).toBe(true);
  expect(new Set(d6).size).toBe(6);
  expect(d3.every((v) => v >= 1 && v <= 3)).toBe(true);
  expect(new Set(d3).size).toBe(3);
});
test('unseeded rolls work', () => {
  const v = rollD6();
  expect(v).toBeGreaterThanOrEqual(1);
  expect(v).toBeLessThanOrEqual(6);
  expect(rollDice(3, 6)).toHaveLength(3);
});
