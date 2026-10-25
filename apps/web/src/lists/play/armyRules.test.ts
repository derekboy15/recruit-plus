import type { CatalogueOut, EntryInfo } from '@recruit/data/model';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { loadEntryInfo } from '../../data/entryInfo';
import { getCatalogue, resetDataCache } from '../../factions/dataClient';
import { CORE_GROUP } from '../../table/stratagemFilter';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { novokhIncursionData, viewOf } from './__fixtures__/playList';
import { armyRules, infoTexts, playStratagems, shownStratagemGroups, stratagemsByPhase } from './armyRules';
import { playArmy } from './playArmy';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

test('info texts: rules as they are; ability profiles by their text column; weapon profiles left out', () => {
  const info: EntryInfo = {
    rules: [{ name: 'Rule', text: 'Do X.', plain: 'You do X.' }],
    profiles: [
      { name: 'Awakened By Murder', type: 'Abilities', chars: { Description: 'Add 1 to charge rolls.' } },
      { name: 'Gauss Flayer', type: 'Weapon', chars: { Range: '24"', Type: 'Rapid Fire 1', S: '4', AP: '-1', D: '1', Abilities: '-' } },
      { name: 'Relic', type: 'Abilities', chars: { Effect: '-', Details: 'Re-roll one hit roll.' }, plain: { Details: 'Re-roll a hit.' } },
    ],
  };
  expect(infoTexts(info)).toEqual([
    { name: 'Rule', text: 'Do X.', plain: 'You do X.' },
    { name: 'Awakened By Murder', text: 'Add 1 to charge rolls.' },
    { name: 'Relic', text: 'Re-roll one hit roll.', plain: 'Re-roll a hit.' },
  ]);
});

test('stratagem groups: a group naming an offered choice shows only when chosen; others always', () => {
  const offered = ['Novokh', 'Sautekh', 'Annihilation Legion', 'Victrix Guard'];
  const shown = shownStratagemGroups(['Necrons', 'Novokh', 'Sautekh', 'Annihilation Legion', 'Victrix Guard (Specialist Detachment)', 'Cult of the Cryptek'], ['Novokh'], offered);
  expect([...shown].sort()).toEqual(['Cult of the Cryptek', 'Necrons', 'Novokh']);
});

test('stratagem groups match ignoring case and either apostrophe', () => {
  const shown = shownStratagemGroups(['Emperor’s Children', "Kraken's Brood", 'Others'], ["Emperor's Children"], ['Emperor’s children', 'Kraken’s Brood']);
  expect([...shown].sort()).toEqual(['Emperor’s Children', 'Others']);
});

test("stratagem groups: a Vior'la Sept list shows the Vior’la group and hides the other septs'", () => {
  const groups = ['T’au Empire', 'Bork’an', 'Dal’yth', 'Farsight Enclaves', 'Sa’cea', 'T’au Sept', 'Vior’la'];
  const offered = ['Custom Sept', "Bork'an Sept", "Vior'la Sept", "Dal'yth Sept", 'Farsight Enclaves', "T'au Sept", "Sa'cea Sept", "Ke'lshan Sept"];
  expect([...shownStratagemGroups(groups, ["Vior'la Sept"], offered)].sort()).toEqual(['T’au Empire', 'Vior’la']);
});

test('a supplement group goes with its choice: Leviathan (Supplement) only for a Leviathan army', () => {
  const groups = ['Tyranids', 'Leviathan', 'Leviathan (Supplement)', 'Kraken'];
  expect([...shownStratagemGroups(groups, ['Kraken'], ['Leviathan', 'Kraken'])].sort()).toEqual(['Kraken', 'Tyranids']);
  expect([...shownStratagemGroups(groups, ['Leviathan'], ['Leviathan', 'Kraken'])].sort()).toEqual(['Leviathan', 'Leviathan (Supplement)', 'Tyranids']);
});

test('Specialist Detachment stratagems are left out at Arks of Omen sizes, where those detachments are not used', () => {
  const s = (id: string, group: string) => ({ id, name: id, cp: '1', group, kind: '', phases: ['Shooting phase'], text: '' });
  const catalogues = [{ stratagems: [s('a', 'Ultramarines'), s('v', 'Victrix Guard (Specialist Detachment)')] } as CatalogueOut];
  expect(playStratagems({ catalogues, core: [], aoo: true, chosen: ['Ultramarines'], offered: [] }).mine.map((x) => x.id)).toEqual(['a']);
  expect(playStratagems({ catalogues, core: [], aoo: false, chosen: ['Ultramarines'], offered: [] }).mine.map((x) => x.id)).toEqual(['a', 'v']);
});

test('stratagems: core always, Arks of Omen only at Arks of Omen sizes, and "all" holds everything', () => {
  const s = (id: string, group: string, phases = ['Shooting phase']) => ({ id, name: id, cp: '1', group, kind: 'Battle Tactic', phases, text: '' });
  const out = playStratagems({ catalogues: [{ stratagems: [s('a', 'Necrons'), s('b', 'Sautekh')] } as CatalogueOut], core: [s('c', CORE_GROUP), s('d', 'Arks of Omen')], aoo: false, chosen: [], offered: ['Sautekh'] });
  expect(out.mine.map((x) => x.id)).toEqual(['a', 'c']);
  expect(out.all.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  const aoo = playStratagems({ catalogues: [], core: [s('c', CORE_GROUP), s('d', 'Arks of Omen')], aoo: true, chosen: [], offered: [] });
  expect(aoo.mine.map((x) => x.id)).toEqual(['c', 'd']);
});

test('by phase: rulebook order, each stratagem once, under its first phase in that order', () => {
  const s = (id: string, phases: string[]) => ({ id, name: id, cp: '1', group: 'g', kind: '', phases, text: '' });
  const groups = stratagemsByPhase([s('fight', ['Fight phase']), s('cmd', ['Command phase', 'Fight phase']), s('pre', ['Before battle'])]);
  expect(groups.map((g) => [g.phase, g.stratagems.map((x) => x.id)])).toEqual([['Before battle', ['pre']], ['Command phase', ['cmd']], ['Fight phase', ['fight']]]);
});

test('by phase: enemy phases after your own, unknown phases last in the order first seen', () => {
  const s = (id: string, phases: string[]) => ({ id, name: id, cp: '1', group: 'g', kind: '', phases, text: '' });
  const groups = stratagemsByPhase([s('odd', ['Odd moment']), s('any', ['Any time']), s('enemy', ['Enemy Shooting phase']), s('end', ['End of your turn']), s('morale', ['Morale phase'])]);
  expect(groups.map((g) => g.phase)).toEqual(['Morale phase', 'End of your turn', 'Enemy Shooting phase', 'Any time', 'Odd moment']);
});

test('army rules: the chosen dynasty first, then faction rules its units use', async () => {
  const data = await novokhIncursionData();
  const { view, scope, units, slugs } = await viewOf(data);
  const rules = armyRules(playArmy(view, scope, units), scope, await loadEntryInfo(slugs), [await getCatalogue('necrons')]);
  expect(rules[0]).toMatchObject({ from: 'Novokh' });
  expect(rules[0].name).toMatch(/awakened by murder/i);
  expect(rules.filter((r) => r.from === 'Necrons').map((r) => r.name)).toEqual(expect.arrayContaining(['Reanimation Protocols', 'Living Metal', 'Command Protocols']));
  expect(rules.map((r) => r.name)).not.toContain('Dynastic Agents and Star Gods'); // no unit has it as an ability
  expect(new Set(rules.filter((r) => r.from === 'Necrons').map((r) => r.name)).size).toBe(rules.filter((r) => r.from === 'Necrons').length);
});
