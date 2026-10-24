import { expect, test } from 'vitest';
import { necronWarriors } from '../../factions/__fixtures__/necrons';
import { keyStats, sizeLabel, weaponLine } from './format';

test('weaponLine: ranged and melee profiles on one line', () => {
  expect(weaponLine({ chars: { Range: '24"', Type: 'Rapid Fire 1', S: '4', AP: '-1', D: '1' } })).toBe('24" · Rapid Fire 1 · S4 · AP -1 · D1');
  expect(weaponLine({ chars: { Range: 'Melee', Type: 'Melee', S: 'User', AP: '-3', D: '2' } })).toBe('Melee · S User · AP -3 · D2');
  expect(weaponLine({ chars: { Range: 'Melee', Type: 'Melee', S: '+2', AP: '-4', D: '3' } })).toBe('Melee · S +2 · AP -4 · D3');
  expect(weaponLine({ chars: { Range: '12"', Type: 'Pistol 1', S: '4', AP: '0', D: '1' } })).toBe('12" · Pistol 1 · S4 · AP 0 · D1');
});

test('weaponLine: dice damage keeps a space so it reads "D D3", not "DD3"', () => {
  expect(weaponLine({ chars: { Range: '36"', Type: 'Heavy D6', S: '8', AP: '-2', D: 'D3' } })).toBe('36" · Heavy D6 · S8 · AP -2 · D D3');
});

test('weaponLine: a missing value is a dash', () => {
  expect(weaponLine({ chars: { Range: '24"', Type: 'Assault 2' } })).toBe('24" · Assault 2 · S - · AP - · D -');
});

test('keyStats reads the first model profile', () => {
  expect(keyStats(necronWarriors)).toEqual({ M: '5"', T: '4', Sv: '4+', W: '1', inv: null });
});

test('keyStats finds an invulnerable save in an ability', () => {
  expect(keyStats({ ...necronWarriors, abilities: [{ name: 'Phase Shifter', text: 'This model has a 4+ invulnerable save.', source: 'bsdata' }] }).inv).toBe('4+');
  expect(
    keyStats({ ...necronWarriors, abilities: [{ name: 'Shield', text: 'Official text.', plain: 'It has a 5+ invulnerable save.', source: 'bsdata' }] }).inv,
  ).toBe('5+');
});

test('keyStats: no models, or a missing stat, is a dash', () => {
  expect(keyStats({ ...necronWarriors, models: [] })).toEqual({ M: '-', T: '-', Sv: '-', W: '-', inv: null });
  expect(keyStats({ ...necronWarriors, models: [{ name: 'Odd', chars: { M: '6"' } }] })).toEqual({ M: '6"', T: '-', Sv: '-', W: '-', inv: null });
});

test('sizeLabel', () => {
  expect(sizeLabel({ ...necronWarriors, minModels: 1, maxModels: 1 })).toBe('1 model');
  expect(sizeLabel({ ...necronWarriors, minModels: 5, maxModels: 5 })).toBe('5 models');
  expect(sizeLabel(necronWarriors)).toBe('10–20 models');
  expect(sizeLabel({ ...necronWarriors, minModels: null, maxModels: null })).toBeNull();
});
