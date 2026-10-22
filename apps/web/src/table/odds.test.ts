import { describe, expect, test } from 'vitest';
import { attackOdds, DEFAULT_ODDS, type OddsInput } from './odds';

const base: OddsInput = { ...DEFAULT_ODDS, weapons: 10, attacks: '1', skill: 3, strength: 4, toughness: 4, ap: 0, save: 3, invuln: null, damage: '1', fnp: null, woundsPerModel: 1, targetModels: 10 };
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('attackOdds', () => {
  test('10 shots BS3+ S4 T4 Sv3+ AP0 D1: expected unsaved 10*(4/6)*(3/6)*(2/6)', () => {
    const r = attackOdds(base);
    close(r.hits, 10 * (4 / 6));
    close(r.wounds, 10 * (4 / 6) * (3 / 6));
    close(r.unsaved, 10 * (4 / 6) * (3 / 6) * (2 / 6));
    close(r.damage, r.unsaved);
    close(r.kills, r.unsaved);
  });
  test('wound table via engine: S8 vs T4 needs 2+', () => {
    const r = attackOdds({ ...base, strength: 8, save: null });
    close(r.wounds, 10 * (4 / 6) * (5 / 6));
    close(attackOdds({ ...base, strength: 2, save: null }).wounds, 10 * (4 / 6) * (1 / 6));
  });
  test('re-roll 1s to hit at BS3+ gives 4/6 + 1/6*4/6 per shot', () => {
    close(attackOdds({ ...base, rerollHits: 'ones' }).hits, 10 * (4 / 6 + (1 / 6) * (4 / 6)));
  });
  test('re-rolling failed hits judges failure before modifiers (engine TS §1.6 ruling)', () => {
    // +1 to hit at BS3+: unmodified 1s and 2s failed, so both are re-rolled; re-rolls hit on 2+ with the +1.
    close(attackOdds({ ...base, hitMod: 1, rerollHits: 'failed' }).hits, 10 * (4 / 6 + (2 / 6) * (5 / 6)));
    // -1 to hit: an unmodified 3 is not a failed roll, so it isn't re-rolled (and misses).
    close(attackOdds({ ...base, hitMod: -1, rerollHits: 'failed' }).hits, 10 * (3 / 6 + (2 / 6) * (3 / 6)));
  });
  test('hit and wound modifiers are capped at ±1', () => {
    close(attackOdds({ ...base, hitMod: 3 }).hits, attackOdds({ ...base, hitMod: 1 }).hits);
    close(attackOdds({ ...base, woundMod: -2 }).wounds, attackOdds({ ...base, woundMod: -1 }).wounds);
  });
  test('invuln used when better than armour after AP', () => {
    const r = attackOdds({ ...base, ap: -3, invuln: 5, save: 3 });
    close(r.unsaved, r.wounds * (4 / 6));
    const noInv = attackOdds({ ...base, ap: -3, save: 3 });
    close(noInv.unsaved, noInv.wounds * (5 / 6));
  });
  test('blast minimum 3 against 6 models', () => {
    const r = attackOdds({ ...base, weapons: 1, attacks: 'D3', blast: true, targetModels: 6, skill: 'auto' });
    close(r.hits, 3);
    const eleven = attackOdds({ ...base, weapons: 1, attacks: 'D6', blast: true, targetModels: 11, skill: 'auto' });
    close(eleven.hits, 6);
    close(attackOdds({ ...base, weapons: 1, attacks: 'D6', blast: true, targetModels: 5, skill: 'auto' }).hits, 3.5);
  });
  test('FNP 5+ removes a third of damage', () => {
    const r = attackOdds({ ...base, save: null, fnp: 5, damage: '2', woundsPerModel: 10, targetModels: 5 });
    close(r.damage, r.unsaved * 2 * (2 / 3));
  });
  test('D3 damage vs W2 models never kills two models with one attack', () => {
    const r = attackOdds({ ...base, weapons: 1, attacks: '1', skill: 'auto', strength: 10, toughness: 1, save: null, damage: 'D3', woundsPerModel: 2, targetModels: 2 });
    close(r.atLeast[1], 0);
    // Wounds on a 2+ even at S10 v T1 (a natural 1 always fails), then 2+ damage on a D3.
    close(r.atLeast[0], (5 / 6) * (2 / 3));
    close(r.kills, (5 / 6) * (2 / 3));
  });
  test('kills never exceed the models there', () => {
    const r = attackOdds({ ...base, weapons: 30, save: null, strength: 10, skill: 2, targetModels: 3 });
    expect(r.kills).toBeLessThanOrEqual(3);
    expect(r.atLeast).toHaveLength(3);
    expect(r.atLeast[2]).toBeGreaterThan(0.99);
  });
  test('odd inputs never give NaN', () => {
    for (const i of [
      { ...base, attacks: '2D3' },
      { ...base, attacks: 'D6+1', damage: 'D3+1' },
      { ...base, save: null, invuln: 5 },
      { ...base, ap: -6, save: 2 },
      { ...base, targetModels: 1, woundsPerModel: 24, damage: '2D6' },
      { ...base, attacks: 'nonsense' },
      { ...base, weapons: 0 },
    ]) {
      const r = attackOdds(i);
      for (const v of [r.hits, r.wounds, r.unsaved, r.damage, r.kills, ...r.atLeast]) {
        expect(Number.isNaN(v), JSON.stringify(i)).toBe(false);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      for (const p of r.atLeast) expect(p).toBeLessThanOrEqual(1);
    }
  });
});
