import { expect, test } from 'vitest';
import { cleanLabel } from './labels';

test('cleanLabel drops BattleScribe decoration and a trailing "Selection"/"Selector"', () => {
  expect(cleanLabel('Chapter Selection')).toBe('Chapter');
  expect(cleanLabel('**Chapter Selector**')).toBe('Chapter');
  expect(cleanLabel('Wraith Selections')).toBe('Wraith');
  expect(cleanLabel('Army of Renown selection')).toBe('Army of Renown');
  expect(cleanLabel('-Dynastic Code-')).toBe('Dynastic Code');
  expect(cleanLabel('Hive Fleet')).toBe('Hive Fleet');
  expect(cleanLabel('Selection')).toBe('');
});
