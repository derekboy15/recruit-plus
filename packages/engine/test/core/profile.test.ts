import { describe, expect, test } from 'vitest';
import { CLOSE_COMBAT_WEAPON, currentChars, has } from '../../src/datasheet/profile';
import { captain, marines, tank } from '../fixtures/units';

describe('model profiles', () => {
  test('[TS §1.1] degrading profile: the tank on 4 wounds uses BS4', () => {
    const t = tank();
    const profile = t.models[0];
    expect(currentChars({ woundsLeft: 11 }, profile).BS).toBe(3);
    expect(currentChars({ woundsLeft: 6 }, profile).BS).toBe(3);
    expect(currentChars({ woundsLeft: 4 }, profile).BS).toBe(4);
    expect(currentChars({ woundsLeft: 1 }, profile).BS).toBe(5);
    expect(currentChars({ woundsLeft: 4 }, profile).W).toBe(11);
  });

  test('a profile without brackets is unchanged', () => {
    const m = marines().models[0];
    expect(currentChars({ woundsLeft: 1 }, m)).toEqual(m.chars);
  });

  test('keywords match case-insensitively', () => {
    expect(has(captain(), 'character')).toBe(true);
    expect(has(captain(), 'VEHICLE')).toBe(false);
    expect(has({ keywords: ['Infantry'] }, 'INFANTRY')).toBe(true);
  });

  test('[TS §7.3] the close combat weapon is S User, AP 0, D 1', () => {
    expect(CLOSE_COMBAT_WEAPON).toMatchObject({ type: 'Melee', s: { kind: 'user' }, ap: 0, d: { n: 0, sides: 6, plus: 1 } });
  });
});
