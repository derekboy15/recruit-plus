import { livingModels, meleeTargets, stateOf, type Command, type PlayerId } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx, play, type Step } from '../__fixtures__/drills';
import { actRun, startRun, type DrillRun } from '../drill/run';
import { gapBetween } from './scenario';
import { fight } from './l09-fight';

const by = (p: PlayerId) => (type: string, unitId: string, extra: object = {}) => ({ type, by: p, unitId, ...extra }) as Command;
const A = by('A');
const B = by('B');
const accept = (p: PlayerId) => ({ type: 'confirmRoll', by: p }) as Command;
/** Every model that can reach an enemy makes its Attacks with the close combat weapon. */
const attacks = (p: PlayerId, unitId: string, target: string, perModel: (profile: string) => number) => (run: DrillRun) => {
  const s = stateOf(run.record);
  const assignments = livingModels(s, unitId)
    .filter((m) => meleeTargets(s, m).length)
    .map((m) => ({ modelId: m.id, weapon: 'Close combat weapon', attacks: perModel(m.profile), targetUnitId: target }));
  return { type: 'fightAttacks', by: p, unitId, assignments } as Command;
};
const marineAttacks = attacks('A', 'A:int', 'B:war', (p) => (p === 'Intercessor Sergeant' ? 3 : 2));
const warriorAttacks = attacks('B', 'B:war', 'A:int', () => 1);
const intercessorsFight: Step[] = [A('selectFighter', 'A:int'), A('pileIn', 'A:int', { moves: {} }), marineAttacks];

describe('Lesson 9 drill: fight', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(fight, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'fight', active: 'A' });
    expect(s.units['A:int'].turn.charged).toBe(true);
    expect(gapBetween(s, 'A:int', 'B:war')).toBeLessThanOrEqual(1);
  });

  test('the Intercessors miss everything, then the Warriors fight back', () => {
    // 11 Intercessor attacks all miss (1s); 10 Warriors... each that can reach attacks: hits 6s, wounds 6s; saves are rolled for you (1s).
    const dice = [...Array(11).fill(1), ...Array(10).fill(6), ...Array(10).fill(6), ...Array(10).fill(1)];
    const run = play(
      fight,
      [{ answer: 'A:int' }, ...intercessorsFight, accept('A'), A('consolidate', 'A:int', { moves: {} }), { answer: 'B' }, B('selectFighter', 'B:war'), B('pileIn', 'B:war', { moves: {} }), warriorAttacks, accept('B'), accept('B'), B('consolidate', 'B:war', { moves: {} })],
      diskCtx({ dice }),
    );
    expect(run.status).toBe('done');
    const res = run.results.map((r) => r.explain);
    expect(res[0]).toBe('Your Intercessors: they charged this turn, and units that charged fight first.');
    expect(res[1]).toBe('Your Intercessors fought: 0 Warriors destroyed.');
    expect(res[2]).toBe('The Necrons: once the chargers have fought, the players take turns picking units, starting with the player whose turn it isn’t.');
    expect(res[3]).toMatch(/^The Warriors fought back: your Intercessors lost \d+ wounds?/);
  });

  test('when no Warrior is left to fight, the fight-back is explained and the run finishes', () => {
    const dice = [...Array(11).fill(6), ...Array(11).fill(6), ...Array(11).fill(1)];
    const run = play(fight, [{ answer: 'A:int' }, ...intercessorsFight, accept('A'), accept('A'), A('consolidate', 'A:int', { moves: {} })], diskCtx({ dice }));
    expect(livingModels(stateOf(run.record), 'B:war')).toHaveLength(0);
    expect(run.status).toBe('done');
    expect(run.results.at(-1)?.explain).toBe('No Warrior is within Engagement Range any more, so the Necrons can’t fight back.');
  });

  test('a pile-in move longer than 3" is refused by the engine', () => {
    const run = play(fight, [{ answer: 'A:int' }, A('selectFighter', 'A:int')]);
    const s = stateOf(run.record);
    const m = livingModels(s, 'A:int')[0];
    const r = actRun(run, A('pileIn', 'A:int', { moves: { [m.id]: { to: { ...m.pos!, x: m.pos!.x - 3.5 } } } }));
    expect(r.problems?.[0].code).not.toBe('drill');
  });

  test('wrong answers are refused', () => {
    expect(() => play(fight, [{ answer: 'B:war' }])).toThrow(/wrong answer at first/);
  });
});
