import { expect, test } from 'vitest';
import { displayName } from '../src/roster';

test('displayName drops BattleScribe "*…*" and "-…-" decoration', () => {
  expect(displayName('-Dynastic Code-')).toBe('Dynastic Code');
  expect(displayName('*Far-Flung Craftworld*')).toBe('Far-Flung Craftworld');
  expect(displayName('**Chapter Selector**')).toBe('Chapter Selector');
  expect(displayName('* No Psychic Power Selected *')).toBe('No Psychic Power Selected');
  expect(displayName('*Random x 2* (Combat Drug)')).toBe('Random x 2 (Combat Drug)');
  expect(displayName('Faction: *Custom Kabal*')).toBe('Faction: Custom Kabal');
  // Hyphens inside a name are kept.
  expect(displayName(' Hive Fleet: Hyper-adaption ')).toBe('Hive Fleet: Hyper-adaption');
  // Nothing left: the name as written.
  expect(displayName('-')).toBe('-');
});
