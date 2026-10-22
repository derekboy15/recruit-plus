import { describe, expect, test } from 'vitest';
import { parseAp, parseBase, parseMove, parseRange, parseStrength, parseTarget, parseWeaponType, parseWoundRange } from '../../src/data/parse';

const mm = (v: number) => v / 25.4;

describe('characteristic parsers', () => {
  test('Move', () => {
    expect(parseMove('6"')).toEqual({ kind: 'fixed', inches: 6 });
    expect(parseMove('7""')).toEqual({ kind: 'fixed', inches: 7 });
    expect(parseMove('20-60"')).toEqual({ kind: 'range', min: 20, max: 60 });
    expect(parseMove('20"-50"')).toEqual({ kind: 'range', min: 20, max: 50 });
    expect(parseMove('-')).toEqual({ kind: 'none' });
    expect(parseMove('12+D6"')).toBeNull();
    expect(parseMove('*')).toBeNull();
  });
  test('target numbers', () => {
    expect(parseTarget('3+')).toBe(3);
    expect(parseTarget('5\t+')).toBe(5);
    expect(parseTarget('4')).toBe(4);
    expect(parseTarget('-')).toBeNull();
  });
  test('weapon types', () => {
    expect(parseWeaponType('Heavy 2D6+1')).toEqual({ type: 'Heavy', shots: { n: 2, sides: 6, plus: 1 } });
    expect(parseWeaponType('Asssault D6')).toEqual({ type: 'Assault', shots: { n: 1, sides: 6, plus: 0 } });
    expect(parseWeaponType('Rapid fire 2')).toEqual({ type: 'Rapid Fire', shots: { n: 0, sides: 6, plus: 2 } });
    expect(parseWeaponType('Assault D6 + 1')).toEqual({ type: 'Assault', shots: { n: 1, sides: 6, plus: 1 } });
    expect(parseWeaponType('Grenade D6')).toEqual({ type: 'Grenade', shots: { n: 1, sides: 6, plus: 0 } });
    expect(parseWeaponType('Pistol 1')).toEqual({ type: 'Pistol', shots: { n: 0, sides: 6, plus: 1 } });
    expect(parseWeaponType('Dakka 3/2')).toEqual({ type: 'Dakka', shots: { n: 0, sides: 6, plus: 2 }, dakkaShort: { n: 0, sides: 6, plus: 3 } });
    expect(parseWeaponType('Melee')).toEqual({ type: 'Melee', shots: { n: 0, sides: 6, plus: 1 } });
    expect(parseWeaponType('HunTR 3')).toEqual({ type: 'Other', shots: { n: 0, sides: 6, plus: 3 } });
    expect(parseWeaponType('-')).toBeNull();
  });
  test('strength', () => {
    expect(parseStrength('User')).toEqual({ kind: 'user' });
    expect(parseStrength('+2')).toEqual({ kind: 'add', v: 2 });
    expect(parseStrength('x2')).toEqual({ kind: 'mul', v: 2 });
    expect(parseStrength('X2')).toEqual({ kind: 'mul', v: 2 });
    expect(parseStrength('8')).toEqual({ kind: 'fixed', v: 8 });
    expect(parseStrength('*')).toBeNull();
    expect(parseStrength('2d6')).toBeNull();
  });
  test('AP', () => {
    expect(parseAp('-1')).toBe(-1);
    expect(parseAp('0')).toBe(0);
    expect(parseAp('-')).toBe(0);
    expect(parseAp('--')).toBe(0);
    expect(parseAp('--1')).toBe(-1);
    expect(parseAp('- 2')).toBe(-2);
    expect(parseAp('*')).toBeNull();
  });
  test('range', () => {
    expect(parseRange('24"')).toEqual({ range: 24, minRange: null });
    expect(parseRange('Melee')).toEqual({ range: null, minRange: null });
    expect(parseRange('24"-200"')).toEqual({ range: 200, minRange: 24 });
    expect(parseRange('0-24"')).toEqual({ range: 24, minRange: null });
    expect(parseRange('12')).toEqual({ range: 12, minRange: null });
    expect(parseRange('-')).toBeUndefined();
  });
  test('bases', () => {
    expect(parseBase('32mm', [])).toEqual({ base: { kind: 'circle', d: mm(32) }, estimated: false });
    expect(parseBase('60 x 35.5mm flying base', [])).toEqual({ base: { kind: 'oval', w: mm(60), h: mm(35.5) }, estimated: false });
    expect(parseBase('60mm flying base', [])).toEqual({ base: { kind: 'circle', d: mm(60) }, estimated: false });
    expect(parseBase('Use model', ['VEHICLE'])).toEqual({ base: { kind: 'rect', w: 3, h: 5 }, estimated: true });
    expect(parseBase(null, ['VEHICLE', 'TITANIC'])).toEqual({ base: { kind: 'rect', w: 5, h: 9 }, estimated: true });
    expect(parseBase(null, ['MONSTER'])).toEqual({ base: { kind: 'circle', d: mm(60) }, estimated: true });
    expect(parseBase(null, ['INFANTRY'])).toEqual({ base: { kind: 'circle', d: mm(32) }, estimated: true });
  });
  test('wound ranges of degrading profiles', () => {
    expect(parseWoundRange('9-16+', 16)).toEqual({ minW: 9, maxW: 16 });
    expect(parseWoundRange('6+', 11)).toEqual({ minW: 6, maxW: 11 });
    expect(parseWoundRange('6-+', 12)).toEqual({ minW: 6, maxW: 12 });
    expect(parseWoundRange('1-4', 16)).toEqual({ minW: 1, maxW: 4 });
    expect(parseWoundRange('1', 16)).toEqual({ minW: 1, maxW: 1 });
    expect(parseWoundRange('foo', 16)).toBeNull();
  });
});
