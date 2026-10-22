import { describe, expect, test } from 'vitest';
import { stateOf, TERRAIN_PRESETS, type Command, type GameRecord, type Pos, type TerrainFeature } from '../../src';
import { guardsmen, marines } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, placeAll, play, teleport, unitInput, type TestGameOpts } from '../helpers/game';

const test_ = (unitId: string, by: 'A' | 'B' = 'A', extra: object = {}) => ({ type: 'moraleTest', by, unitId, ...extra }) as Command;
const mw = (unitId: string, count: number) => ({ type: 'inflictMortalWounds', by: 'B', unitId, count }) as Command;
const fled = (g: GameRecord, unitId: string) => stateOf(g).units[unitId].modelIds.filter((id) => stateOf(g).models[id].destroyed).length;

/** A: 10 guardsmen (a1, Ld 7 sergeant, Ld 6 others); B: 5 marines (b1). Skips to A's Morale phase. */
function game(o: TestGameOpts & { at?: Record<string, Record<string, Pos>> } = {}): GameRecord {
  let g = placeAll(newTestGame({ zones: FULL_ZONES(), a: [unitInput('a1', guardsmen(), 10)], b: [unitInput('b1', marines(), 5)], ...o }), o.at ?? { a1: line(5, 10, 'a1', 10), b1: line(5, 40, 'b1') });
  for (let i = 0; i < 5; i++) g = play(g, { type: 'endPhase', by: 'A' } as Command);
  return g;
}
const toMorale = (g: GameRecord) => play(g, { type: 'endPhase', by: 'A' } as Command);

describe('Morale tests', () => {
  test('[TS §8.1] only units that lost models this turn take a Morale test', () => {
    expectRejected(toMorale(game()), test_('a1'), 'no-test-needed');
  });

  test('[TS §8.1] D6 + models destroyed this turn against the unit\'s highest Leadership', () => {
    // 2 lost: a roll of 5 makes 7, equal to the sergeant's Ld 7: passed.
    expect(fled(play(toMorale(play(game({ dice: [5] }), mw('a1', 2))), test_('a1')), 'a1')).toBe(2);
    // A roll of 6 makes 8: failed; one flees, then Combat Attrition (all 4s: nobody else).
    expect(fled(play(toMorale(play(game({ dice: [6, 4, 4, 4, 4, 4, 4, 4] }), mw('a1', 2))), test_('a1')), 'a1')).toBe(3);
  });

  test('[WCR] an unmodified 1 always passes a Morale test', () => {
    expect(fled(play(toMorale(play(game({ dice: [1] }), mw('a1', 8))), test_('a1')), 'a1')).toBe(8);
  });

  test('[TS §8.1] players alternate Morale tests, starting with the player whose turn it is', () => {
    const g = toMorale(play(game({ dice: [1, 1] }), mw('a1', 1), mw('b1', 2)));
    expectRejected(g, test_('b1', 'B'), 'not-your-test');
    play(g, test_('a1'), test_('b1', 'B'));
  });

  test('[TS §8.2] Combat Attrition: each 1 makes another model flee', () => {
    // 2 lost; fail with a 6; one flees (7 left); attrition dice 1,1,3,4,5,6,2: two more flee.
    expect(fled(play(toMorale(play(game({ dice: [6, 1, 1, 3, 4, 5, 6, 2] }), mw('a1', 2))), test_('a1')), 'a1')).toBe(5);
  });

  test('[TS §8.2] Combat Attrition: below Half-strength, 1s and 2s make models flee', () => {
    // 5 lost; fail with a 4 (9 > 7); one flees (4 left of 10: below half); attrition 2,2,3,6: two more.
    expect(fled(play(toMorale(play(game({ dice: [4, 2, 2, 3, 6] }), mw('a1', 5))), test_('a1')), 'a1')).toBe(8);
  });

  test('[TS §1.5] 10 models of 20 are not below Half-strength', () => {
    // 9 lost of 20, fail, one flees: 10 left of 20 — not below half: a 2 doesn't make anyone flee.
    const g = game({ a: [unitInput('a1', guardsmen(), 20)], dice: [6, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], at: { a1: line(2, 10, 'a1', 20), b1: line(5, 40, 'b1') } });
    expect(fled(play(toMorale(play(g, mw('a1', 9))), test_('a1')), 'a1')).toBe(10);
  });

  test('[CS §2] Insane Bravery: 2 CP, passes the test with no Combat Attrition, once per battle', () => {
    let g = toMorale(play(game(), mw('a1', 6)));
    const cp = stateOf(g).cp.A;
    g = play(g, test_('a1', 'A', { insaneBravery: true }));
    expect(fled(g, 'a1')).toBe(6);
    expect(stateOf(g).cp.A).toBe(cp - 2);
    expect(stateOf(g).insaneBraveryUsed.A).toBe(true);
  });

  test('[TR §3.3] Inspiring terrain gives +1 Leadership', () => {
    const statue: TerrainFeature = { id: 's', name: 'Statue', ...TERRAIN_PRESETS.statuary, footprint: [{ x: 9, y: 12 }, { x: 12, y: 12 }, { x: 12, y: 13 }, { x: 9, y: 13 }], height: 3, inspiringKeywords: ['IMPERIUM'] };
    // 2 lost, a 6 makes 8: passed only with Ld 8.
    expect(fled(play(toMorale(play(game({ terrain: [statue], dice: [6] }), mw('a1', 2))), test_('a1')), 'a1')).toBe(2);
  });

  test('[TS §8.1] the Morale tests step can not end until every unit that needs a test has taken it', () => {
    expectRejected(toMorale(play(game(), mw('a1', 1))), { type: 'endStep', by: 'A' } as Command, 'morale-tests-left');
  });
});

describe('unit coherency checks', () => {
  test('[TS §8.3] out-of-coherency models are removed until a single coherent group remains', () => {
    let g = toMorale(game({ a: [unitInput('a1', marines(), 5)], at: { a1: line(5, 10, 'a1'), b1: line(5, 40, 'b1') } }));
    g = teleport(g, { 'a1.m5': at(30, 20) });
    g = play(g, { type: 'endStep', by: 'A' } as Command);
    expect(stateOf(g).models['a1.m5'].destroyed).toBe(true);
    expect(fled(g, 'a1')).toBe(1);
  });

  test('[TS §8.3] removals for coherency do not count as losses for Morale', () => {
    let g = toMorale(game({ a: [unitInput('a1', marines(), 5)], at: { a1: line(5, 10, 'a1'), b1: line(5, 40, 'b1') } }));
    g = play(teleport(g, { 'a1.m5': at(30, 20) }), { type: 'endStep', by: 'A' } as Command);
    expect(stateOf(g).units.a1.turn.lostThisTurn).toBe(0);
  });
});
