import 'fake-indexeddb/auto';
import type { StratagemOut } from '@recruit/data/model';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getCatalogue, getRosterScope, resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { necronsListData } from '../lists/__fixtures__/necronsList';
import { applyPicks, armyChoices } from '../lists/newListSetup';
import { armyGroups, chosenNames, defaultGroups, mainGroup } from './armyGroups';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

const s = (name: string, group: string): StratagemOut => ({ id: name, name, cp: '1', group, kind: 'Battle Tactic', phases: ['Any phase'], text: 't' });

test('mainGroup is the most frequent non-core group', async () => {
  expect(mainGroup((await getCatalogue('necrons')).stratagems)).toBe('Necrons');
  expect(mainGroup((await getCatalogue('imperium-adeptus-astartes-ultramarines')).stratagems)).toBe('Adeptus Astartes');
});

test('mainGroup: a tie goes to the first seen, core never counts, and nothing gives null', () => {
  expect(mainGroup([s('a', 'Novokh'), s('b', 'Necrons'), s('c', 'Core Book'), s('d', 'Core Book'), s('e', 'Core Book')])).toBe('Novokh');
  expect(mainGroup([s('c', 'Core Book')])).toBeNull();
  expect(mainGroup([])).toBeNull();
});

test('armyGroups matches the faction, chosen names and "(Specialist Detachment)" groups', () => {
  const groups = ['Necrons', 'Novokh', 'Szarekhan', 'Annihilation Legion', 'Blitz Brigade (Specialist Detachment)'];
  expect(armyGroups(groups, 'Necrons', ['Novokh', 'Blitz Brigade'])).toEqual(['Necrons', 'Novokh', 'Blitz Brigade (Specialist Detachment)']);
  expect(armyGroups(groups, 'Necrons', [])).toEqual(['Necrons']);
});

test('armyGroups ignores case but not a name that only starts the same', () => {
  expect(armyGroups(['NOVOKH', 'Novokhan Raiders', 'Blitz Brigades'], 'Orks', ['novokh', 'Blitz Brigade'])).toEqual(['NOVOKH']);
});

test('defaultGroups is the Core Book, the main group and the army groups', () => {
  const all = [s('a', 'Necrons'), s('b', 'Necrons'), s('c', 'Novokh'), s('d', 'Sautekh'), s('e', 'Core Book')];
  expect([...defaultGroups(all, 'Necrons', ['Novokh'])]).toEqual(['Core Book', 'Necrons', 'Novokh']);
  expect([...defaultGroups(all, 'Necrons')]).toEqual(['Core Book', 'Necrons']);
});

test('chosenNames of a Novokh list includes Novokh', async () => {
  const scope = await getRosterScope(['necrons']);
  const list = await necronsListData((r) => {
    const choice = armyChoices(scope, r).find((c) => c.options.some((o) => /Novokh/.test(o.name)))!;
    return applyPicks(scope, r, [choice], { [choice.key]: choice.options.find((o) => /Novokh/.test(o.name))!.id });
  });
  const names = await chosenNames(list.roster, 'necrons');
  expect(names).toEqual(expect.arrayContaining(['Novokh']));
  expect(new Set(names).size).toBe(names.length);
});

test('chosenNames of a list with no dynasty picked has no dynasty', async () => {
  const list = await necronsListData();
  const names = await chosenNames(list.roster, 'necrons');
  expect(names.length).toBeGreaterThan(0);
  expect(names).not.toContain('Novokh');
});
