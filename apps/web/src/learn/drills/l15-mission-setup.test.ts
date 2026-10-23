import { centroid, currentStep, dispatch, livingModels, sheetOf, stateOf, type Command, type PlayerId } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { formation } from '../../play/board/formation';
import { diskCtx, play } from '../__fixtures__/drills';
import { startRun, type DrillRun } from '../drill/run';
import { missionSetup } from './l15-mission-setup';

/** Deploys a unit in rows around its zone's centre (as the deploy panel would after a tap), shifted `dy` inches north. */
const deploy = (unitId: string, dy = 0) => (run: DrillRun) => {
  const s = stateOf(run.record);
  const zone = s.setup.zones.A;
  const c = centroid(zone);
  const base = sheetOf(s, unitId).base;
  const positions = formation(livingModels(s, unitId).map((m) => ({ id: m.id, base })), { x: c.x, y: c.y + dy }, zone);
  return { type: 'deploy', by: 'A', unitId, positions } as Command;
};
const rollOff = { type: 'rollOffFirstTurn', by: 'A' } as Command;
const choose = (first: PlayerId) => ({ type: 'chooseFirstTurn', by: 'A', first }) as Command;
const begin = (run: DrillRun) => ({ type: 'beginBattle', by: stateOf(run.record).active }) as Command;

describe('Lesson 15 drill: mission setup', () => {
  test('the scenario starts where the lesson says', () => {
    const s = stateOf(startRun(missionSetup, diskCtx()).record);
    expect(s).toMatchObject({ phase: 'pre-battle', step: 'deploy' });
    expect(s.setup.attacker).toBe('B');
    expect(s.setup.rules.firstTurn).toBe('winner-chooses');
    expect(s.setup.board).toEqual({ w: 44, h: 30 });
    expect(currentStep(s).actingPlayer).toBe('A');
  });

  test('you win the roll-off and choose to go first', () => {
    const run = play(missionSetup, [{ answer: 'A' }, deploy('A:int'), deploy('A:lib', 7), { answer: 'choose' }, rollOff, choose('A'), begin], diskCtx({ dice: [6, 2] }));
    expect(run.status).toBe('done');
    const s = stateOf(run.record);
    expect(s).toMatchObject({ phase: 'command', round: 1, active: 'A' });
    expect(Object.values(s.units).every((u) => u.location === 'battlefield')).toBe(true);
    expect(run.results.map((r) => r.explain)).toEqual([
      'You do: the Defender sets up first, then the players take turns, one unit at a time.',
      'Your Intercessors are set up wholly within your deployment zone. The Necrons set up a unit in reply.',
      'Both armies are set up.',
      'They choose who takes the first turn. (In Arks of Omen missions the winner simply goes first.)',
      'You won the roll-off and chose who goes first: you take the first turn. Battle round 1 begins.',
    ]);
  });

  test('the Necrons win the roll-off and choose to go first', () => {
    const run = play(missionSetup, [{ answer: 'A' }, deploy('A:int'), deploy('A:lib', 7), { answer: 'choose' }, rollOff, begin], diskCtx({ dice: [2, 6] }));
    expect(run.status).toBe('done');
    expect(stateOf(run.record)).toMatchObject({ phase: 'command', active: 'B' });
    expect(run.results.at(-1)?.explain).toBe('The Necrons won the roll-off and chose who goes first: the Necrons take the first turn. Battle round 1 begins.');
  });

  test('a unit set up partly outside the zone is refused by the engine', () => {
    const run = play(missionSetup, [{ answer: 'A' }]);
    const s = stateOf(run.record);
    const base = sheetOf(s, 'A:int').base;
    const outside = formation(livingModels(s, 'A:int').map((m) => ({ id: m.id, base })), { x: 22, y: 15 });
    const r = dispatch(run.record, { type: 'deploy', by: 'A', unitId: 'A:int', positions: outside } as Command);
    expect(r.ok).toBe(false);
  });

  test('wrong answers are refused', () => {
    expect(() => play(missionSetup, [{ answer: 'B' }])).toThrow(/wrong answer at first/);
  });
});
