import 'fake-indexeddb/auto';
import type { StratagemOut } from '@recruit/data/model';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FORCE } from '@recruit/data/roster';
import { getCatalogue, getIndex, getRosterScope, resetDataCache } from '../factions/dataClient';
import { factionDisplayName } from '../factions/names';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { necronsListData } from '../lists/__fixtures__/necronsList';
import { applyPicks, armyChoices, startingRoster } from '../lists/newListSetup';
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
  expect(armyGroups(['NOVOKH', 'Novokhan Raiders', 'Blitz Brigade Veterans'], 'Orks', ['novokh', 'Blitz Brigade'])).toEqual(['NOVOKH']);
});

test('armyGroups matches a choice however BSData and Wahapedia spell it: apostrophes, "Sept", "The", "Order of", plurals', () => {
  expect(armyGroups(['T’au Empire', 'Vior’la', 'Bork’an', 'T’au Sept'], "T'au Empire", ["Vior'la Sept"])).toEqual(['T’au Empire', 'Vior’la']);
  expect(armyGroups(['T’au Empire', 'T’au Sept', 'Vior’la'], 'Orks', ["T'au Sept"])).toEqual(['T’au Sept']);
  expect(armyGroups(['Ferrymen', 'Mortarion’s Anvil', 'Wretched'], 'Death Guard', ['The Ferrymen', "Mortarion's Anvil"])).toEqual(['Ferrymen', 'Mortarion’s Anvil']);
  expect(armyGroups(['Bladed Cog', 'Rusted Claw'], 'Genestealer Cults', ['The Bladed Cog'])).toEqual(['Bladed Cog']);
  expect(armyGroups(['Order of the Argent Shroud', 'Order of Our Martyred Lady', 'Order of the Bloody Rose'], 'Adepta Sororitas', ['Argent Shroud', 'Our Martyred Lady'])).toEqual([
    'Order of the Argent Shroud',
    'Order of Our Martyred Lady',
  ]);
  expect(armyGroups(['Goff', 'Blood Axe', 'Evil Sunz'], 'Orks', ['Goffs'])).toEqual(['Goff']);
});

test("a Vior'la list sees the Vior’la stratagems by default and not another sept's", async () => {
  const tau = (await getIndex()).catalogues.find((c) => c.slug === 'tau-empire')!;
  const scope = await getRosterScope(['tau-empire']);
  let r = startingRoster(scope, { name: 'Vior’la', catalogueId: tau.id, sizeId: 'incursion', forceId: FORCE.arksOfOmen });
  const sept = armyChoices(scope, r).find((c) => c.title === 'Sept Choice')!;
  r = applyPicks(scope, r, [sept], { [sept.key]: sept.options.find((o) => o.name === "Vior'la Sept")!.id });
  const shown = [...defaultGroups((await getCatalogue('tau-empire')).stratagems, factionDisplayName(tau.name), await chosenNames(r, 'tau-empire'))];
  expect(shown).toEqual(expect.arrayContaining(['Core Book', 'T’au Empire', 'Vior’la']));
  expect(shown).not.toContain('Bork’an');
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
