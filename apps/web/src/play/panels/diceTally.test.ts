import type { Die } from '@recruit/engine';
import { expect, test } from 'vitest';
import { rerollHelp, rollTally } from './diceTally';

test('rollTally counts successes against the noun, or totals an unjudged roll', () => {
  const d = (v: number) => ({ value: v, sides: 6 as const });
  const hits = { passes: (x: Die) => x.value >= 3, noun: 'hit' as const };
  expect(rollTally([d(1), d(3), d(6)], hits)).toBe('2 hits of 3');
  expect(rollTally([d(5)], { ...hits, noun: 'wound' })).toBe('1 wound of 1');
  expect(rollTally([d(4), d(5), d(1), d(2), d(6), d(3)], { ...hits, noun: 'save' })).toBe('4 saves of 6');
  expect(rollTally([d(1), d(2)], hits)).toBe('0 hits of 2');
  expect(rollTally([d(4), d(5)], null)).toBe('Total 9');
  expect(rollTally([{ value: 2, sides: 3 }], null)).toBe('Total 2');
});

test('rerollHelp says what picking dice does', () => {
  expect(rerollHelp(0, false)).toBe('Tap a die to pick it for a re-roll or a change.');
  expect(rerollHelp(1, false)).toBe('1 die picked.');
  expect(rerollHelp(3, false)).toBe('3 dice picked. A Command Re-roll needs exactly one.');
  expect(rerollHelp(0, true)).toBe('A Command Re-roll re-rolls all of these dice.');
  expect(rerollHelp(1, true)).toBe('1 die picked. A Command Re-roll re-rolls all of these dice.');
});
