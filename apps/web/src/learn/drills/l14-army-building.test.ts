import { validate } from '@recruit/data/roster';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../../lists/__fixtures__/generatedData';
import { listCtx } from '../__fixtures__/drills';
import { addUnitRun, answerListRun, currentListStage, startListRun } from '../drill/listRun';
import { armyBuilding } from './l14-army-building';
import { ULTRA } from './scenario';

beforeEach(() => {
  resetDataCache();
  stubGeneratedData();
});
afterEach(() => vi.unstubAllGlobals());

const pick = (run: ReturnType<typeof startListRun>, name: string) => run.world.picker.find((p) => p.name === name)!.entryId;

describe('Lesson 14 drill: building an army', () => {
  test('the list starts as a Patrol with one Captain, missing Troops (and a Warlord)', async () => {
    const run = startListRun(armyBuilding, await listCtx(ULTRA));
    const { issues } = validate(run.world.scope, run.world.roster, run.world.policy);
    expect(issues.map((i) => i.rule).sort()).toEqual(['slot-min', 'warlord-missing']);
    expect(run.world.picker.map((p) => `${p.name} (${p.role})`)).toEqual(['Intercessor Squad (Troops)', 'Assault Intercessor Squad (Troops)', 'Hellblaster Squad (Heavy Support)']);
  });

  test('the right answers and a Troops unit pass, with the builder’s own words', async () => {
    let run = startListRun(armyBuilding, await listCtx(ULTRA));
    run = answerListRun(run, 'troops');
    expect(run.results[0].explain).toBe('A Troops unit: your Patrol Detachment needs 1 more Troops unit. Add Assault Intercessor Squad, Incursor Squad or Intercessor Squad.');
    run = addUnitRun(run, pick(run, 'Hellblaster Squad')).run;
    expect(currentListStage(run)?.id).toBe('add');
    run = addUnitRun(run, pick(run, 'Intercessor Squad')).run;
    expect(run.results[1].explain).toBe(
      'Your Patrol now has its HQ and Troops, so every unit is in a legal detachment: the army is Battle-forged. (It still needs a Warlord: in the list builder, open a CHARACTER and turn on Warlord.)',
    );
    run = answerListRun(run, 'no');
    run = answerListRun(run, 'yes');
    expect(run.status).toBe('done');
    expect(run.results.slice(2).map((r) => r.explain)).toEqual([
      'No: the Rule of Three allows at most 3 units from the same datasheet in a Strike Force army (the Rule of Two allows 2 at Incursion).',
      'Yes: Troops units (and Dedicated Transports) don’t count towards the Rule of Three.',
    ]);
  });

  test('wrong answers are refused and explained', async () => {
    let run = startListRun(armyBuilding, await listCtx(ULTRA));
    run = answerListRun(run, 'elites');
    expect(run.wrong).toMatch(/^Not quite\. A Troops unit:/);
    expect(run.mistakes).toBe(1);
  });

  test('adding units is refused while a question is open', async () => {
    const run = startListRun(armyBuilding, await listCtx(ULTRA));
    const r = addUnitRun(run, pick(run, 'Intercessor Squad'));
    expect(r.problems?.[0].message).toBe('Answer the question first.');
  });
});
