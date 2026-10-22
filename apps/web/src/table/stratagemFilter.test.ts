import { describe, expect, test } from 'vitest';
import type { StratagemOut } from '@recruit/data/model';
import { costOptions, phaseFilter, stratagemsFor } from './stratagemFilter';

const s = (name: string, phases: string[], group = 'Necrons', cp = '1'): StratagemOut => ({ id: name, name, cp, group, kind: 'Battle Tactic', phases, text: 't' });

describe('phaseFilter', () => {
  test('active Shooting includes "Shooting phase" and "Any phase"', () => {
    const f = phaseFilter('shooting', 'active', { firstCommandOfRound: false });
    expect(f.main).toEqual(expect.arrayContaining(['Shooting phase', 'Any phase', 'Any of your phases', 'Any time']));
    expect(f.main).not.toContain('Enemy Shooting phase');
  });
  test('reacting Shooting includes "Enemy Shooting phase"', () => {
    const f = phaseFilter('shooting', 'reacting', { firstCommandOfRound: false });
    expect(f.main).toEqual(expect.arrayContaining(['Enemy Shooting phase', 'Any phase', 'Any time']));
    expect(f.main).not.toContain('Shooting phase');
    expect(f.main).not.toContain('Any of your phases');
  });
  test('both players act in the Fight and Morale phases, so the reacting player also sees those', () => {
    expect(phaseFilter('morale', 'reacting', { firstCommandOfRound: false }).main).toEqual(expect.arrayContaining(['Morale phase', 'Enemy Morale phase']));
    expect(phaseFilter('fight', 'reacting', { firstCommandOfRound: false }).main).toEqual(expect.arrayContaining(['Fight phase', 'Enemy Fight phase']));
  });
  test('start of round only in the first Command phase of the round', () => {
    expect(phaseFilter('command', 'active', { firstCommandOfRound: true }).main).toContain('At the start of battle round');
    expect(phaseFilter('command', 'reacting', { firstCommandOfRound: true }).main).toContain('At the start of battle round');
    expect(phaseFilter('command', 'active', { firstCommandOfRound: false }).main).not.toContain('At the start of battle round');
  });
  test('End of your turn in the Morale phase', () => {
    expect(phaseFilter('morale', 'active', { firstCommandOfRound: false }).main).toContain('End of your turn');
    expect(phaseFilter('shooting', 'active', { firstCommandOfRound: false }).main).not.toContain('End of your turn');
  });
  test('reactions always listed', () => {
    for (const side of ['active', 'reacting'] as const) {
      expect(phaseFilter('movement', side, { firstCommandOfRound: false }).reactions).toEqual(['Being targeted', 'Taking casualties', 'Enemy taking casualties']);
    }
  });
});

describe('stratagemsFor', () => {
  const all = [s('Shoot', ['Shooting phase']), s('Any', ['Any phase'], 'Nihilakh'), s('Hit back', ['Taking casualties']), s('Pre', ['Before battle']), s('Both', ['Shooting phase', 'Taking casualties'])];
  test('splits main and reactions, never listing one stratagem twice', () => {
    const r = stratagemsFor(all, phaseFilter('shooting', 'active', { firstCommandOfRound: false }));
    expect(r.main.map((x) => x.name)).toEqual(['Shoot', 'Any', 'Both']);
    expect(r.reactions.map((x) => x.name)).toEqual(['Hit back']);
  });
  test('a group narrows the faction stratagems but keeps the core ones', () => {
    const core = s('Command Re-roll', ['Any time'], 'Core Book');
    const r = stratagemsFor([...all, core], phaseFilter('shooting', 'active', { firstCommandOfRound: false }), 'Nihilakh');
    expect(r.main.map((x) => x.name)).toEqual(['Any', 'Command Re-roll']);
  });
});

test('costOptions reads "1", "1/2", "3/1" and "1-3"', () => {
  expect(costOptions('1')).toEqual([1]);
  expect(costOptions('1/2')).toEqual([1, 2]);
  expect(costOptions('3/1')).toEqual([1, 3]);
  expect(costOptions('1-3')).toEqual([1, 2, 3]);
  expect(costOptions('0')).toEqual([0]);
});
