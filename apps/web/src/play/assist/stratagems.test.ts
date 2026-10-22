import type { StratagemOut } from '@recruit/data/model';
import { stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { ENGINE_STRATAGEMS, momentFor, stratagemsNow, type Moment } from './stratagems';

const strat = (name: string, phases: string[]): StratagemOut => ({ id: name, name, cp: '1', group: 'Test', kind: 'Battle Tactic', phases, text: '' });
const ALL = [
  strat('Mine to shoot', ['Shooting phase']),
  strat('Theirs to shoot', ['Enemy Shooting phase']),
  strat('Shielded', ['Being targeted']),
  strat('Whenever', ['Any time']),
  strat('In my phases', ['Any of your phases']),
  strat('Last gasp', ['Taking casualties']),
  strat('Vengeance', ['Enemy taking casualties']),
  strat('Opening move', ['Before battle']),
  strat('New dawn', ['At the start of battle round']),
  strat('Command Re-roll', ['Any time']),
  strat('Fire Overwatch', ['Enemy Charge phase']),
];
const moment = (o: Partial<Moment>): Moment => ({ phase: 'shooting', mine: true, targeted: false, casualties: false, enemyCasualties: false, preBattle: false, roundStart: false, ...o });
const names = (m: Moment) => stratagemsNow(ALL, m).map((s) => s.name);

describe('stratagems for the moment', () => {
  test('in your Shooting phase you see "Shooting phase" stratagems, not "Enemy Shooting phase" ones', () => {
    expect(names(moment({}))).toEqual(['Mine to shoot', 'Whenever', 'In my phases']);
    expect(names(moment({ mine: false }))).toEqual(['Theirs to shoot', 'Whenever']);
  });

  test('a unit being targeted brings in "Being targeted" stratagems for the defender', () => {
    expect(names(moment({ mine: false, targeted: true, casualties: true }))).toEqual(['Theirs to shoot', 'Shielded', 'Whenever', 'Last gasp']);
    expect(names(moment({ enemyCasualties: true }))).toContain('Vengeance');
  });

  test('"Any time" stratagems always show', () => {
    expect(names(moment({ phase: 'morale', mine: false }))).toEqual(['Whenever']);
    expect(names(moment({ phase: 'pre-battle', preBattle: true }))).toEqual(['Whenever', 'In my phases', 'Opening move']);
    expect(names(moment({ phase: 'command', roundStart: true }))).toContain('New dawn');
  });

  test('stratagems the engine runs are left out of the spend list', () => {
    expect(ENGINE_STRATAGEMS).toEqual(
      expect.arrayContaining(['Command Re-roll', 'Cut Them Down', 'Desperate Breakout', 'Emergency Disembarkation', 'Fire Overwatch', 'Counter-offensive', 'Insane Bravery']),
    );
    expect(names(moment({}))).not.toContain('Command Re-roll');
    expect(names(moment({ phase: 'charge', mine: false }))).not.toContain('Fire Overwatch');
  });
});

test('momentFor reads the phase, whose turn it is and who is being shot', () => {
  let g = deployedGame({ rollWindows: true, bY: 20 });
  for (let i = 0; i < 3; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  const assignments = stateOf(g).units['A:war'].modelIds.map((modelId) => ({ modelId, weapon: 'Gauss Flayer', targetUnitId: 'B:int' }));
  g = must(g, { type: 'shoot', by: 'A', unitId: 'A:war', assignments } as Command);
  const s = stateOf(g);
  expect(momentFor(s, 'A')).toMatchObject({ phase: 'shooting', mine: true, targeted: false, enemyCasualties: true });
  expect(momentFor(s, 'B')).toMatchObject({ phase: 'shooting', mine: false, targeted: true, casualties: true });
  expect(momentFor(stateOf(deployedGame()), 'A')).toMatchObject({ phase: 'command', roundStart: true });
});
