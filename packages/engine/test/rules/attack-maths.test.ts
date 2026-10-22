import { describe, expect, test } from 'vitest';
import { bestSave, blastShots, capMod, hitSucceeds, majorityToughness, saveSucceeds, strengthOf, woundNeeded } from '../../src/attack/resolve';
import { chars, weapon } from '../fixtures/units';

describe('attack maths', () => {
  test('[TS §5.6] wound table', () => {
    expect(woundNeeded(8, 4)).toBe(2);
    expect(woundNeeded(5, 4)).toBe(3);
    expect(woundNeeded(4, 4)).toBe(4);
    expect(woundNeeded(3, 4)).toBe(5);
    expect(woundNeeded(4, 8)).toBe(6);
    expect(woundNeeded(4, 9)).toBe(6);
    expect(woundNeeded(7, 4)).toBe(3);
  });

  test('[TS §1.6] strength: a x2 weapon and a +1 buff apply together: S4 → 9, not 10', () => {
    expect(strengthOf(chars({ S: 4 }), weapon('Power fist', { s: { kind: 'mul', v: 2 } }), 1)).toBe(9);
    expect(strengthOf(chars({ S: 4 }), weapon('Sword', { s: { kind: 'add', v: 1 } }))).toBe(5);
    expect(strengthOf(chars({ S: 4 }), weapon('Gun', { s: 7 }))).toBe(7);
    expect(strengthOf(chars({ S: 4 }), weapon('Fist', { s: { kind: 'user' } }))).toBe(4);
  });

  test('[TS §5.6] hit and wound modifiers are capped at +1 / -1', () => {
    expect(capMod(-2)).toBe(-1);
    expect(capMod(3)).toBe(1);
    expect(capMod(0)).toBe(0);
  });

  test('[TS §5.6] an unmodified 6 always hits, even at -1 with BS 6+', () => {
    expect(hitSucceeds(6, 6, -1)).toBe(true);
    expect(hitSucceeds(5, 6, 1)).toBe(true);
    expect(hitSucceeds(5, 6, 0)).toBe(false);
  });

  test('[TS §5.6] an unmodified 1 always fails, even with +1', () => {
    expect(hitSucceeds(1, 2, 1)).toBe(false);
  });

  test('[TS §5.6] an unmodified 1 always fails a save, even with +2', () => {
    expect(saveSucceeds(1, 2, 2)).toBe(false);
    expect(saveSucceeds(2, 3, 1)).toBe(true);
  });

  test('[TS §5.7] an invulnerable save ignores AP, and cover does not improve it', () => {
    const c = chars({ Sv: 3, invuln: 4 });
    expect(bestSave(c, null, -3, 1, 0, false)).toEqual({ needed: 4, mod: 0, kind: 'invuln' });
    expect(bestSave(c, null, -1, 1, 0, false)).toEqual({ needed: 3, mod: 0, kind: 'armour' });
  });

  test('[TS §5.6] saves are not capped: Light Cover and a +1 effect both apply', () => {
    expect(bestSave(chars({ Sv: 3 }), null, 0, 1, 1, false)).toEqual({ needed: 3, mod: 2, kind: 'armour' });
  });

  test('[TS §5.7] no save at all when AP takes it past 6+ and there is no invulnerable save', () => {
    expect(bestSave(chars({ Sv: 5 }), null, -3, 0, 0, false)).toBeNull();
    expect(bestSave(chars({ Sv: null }), null, 0, 0, 0, false)).toBeNull();
  });

  test('[R-21] a Daemonic Save uses its melee or ranged value and is never modified', () => {
    const c = { ...chars({ Sv: null }), daemonicSave: { melee: 5, ranged: 4 } };
    expect(bestSave(c, null, -3, 1, 1, false)).toEqual({ needed: 4, mod: 0, kind: 'daemonic' });
    expect(bestSave(c, null, -3, 1, 1, true)).toEqual({ needed: 5, mod: 0, kind: 'daemonic' });
  });

  test('[TS §5.5] Blast against 6–10 models makes at least 3 attacks per weapon', () => {
    expect(blastShots({ n: 1, sides: 6, plus: 0 }, 1, 6)).toBe(3);
    expect(blastShots({ n: 2, sides: 3, plus: 0 }, 2, 10)).toBe(3);
    expect(blastShots({ n: 1, sides: 6, plus: 0 }, 5, 8)).toBe(5);
    expect(blastShots({ n: 1, sides: 6, plus: 0 }, 1, 5)).toBe(1);
  });

  test('[TS §5.5] Blast against 11+ models makes the maximum number of attacks', () => {
    expect(blastShots({ n: 1, sides: 6, plus: 0 }, 2, 11)).toBe(6);
    expect(blastShots({ n: 2, sides: 6, plus: 0 }, 3, 20)).toBe(12);
    expect(blastShots({ n: 1, sides: 3, plus: 3 }, 4, 11)).toBe(6);
  });

  test('[R-24] a unit with different Toughness uses the majority value (the higher on a tie)', () => {
    expect(majorityToughness([4, 4, 4, 5, 5])).toBe(4);
    expect(majorityToughness([4, 4, 5, 5])).toBe(5);
    expect(majorityToughness([6])).toBe(6);
  });
});
