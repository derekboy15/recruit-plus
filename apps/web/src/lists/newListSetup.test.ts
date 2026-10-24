import { FORCE } from '@recruit/data/roster';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getRosterScope, resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from './__fixtures__/generatedData';
import type { CatalogueSummary } from '@recruit/data/model';
import { armyChoices, defaultListName, sizeCards, startingRoster } from './newListSetup';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

async function titles(slug: string, catalogueId: string) {
  const scope = await getRosterScope([slug]);
  const roster = startingRoster(scope, { name: 'x', catalogueId, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  return armyChoices(scope, roster).map((c) => c.title);
}

test('army option titles never show raw BattleScribe group names', async () => {
  const craftworlds = await titles('aeldari-craftworlds', '30b2-6f64-b85e-b4dc');
  expect(craftworlds).toContain('Craftworld');
  const tyranids = await titles('tyranids', '7150-5917-ae80-68c5');
  expect(tyranids).toEqual(expect.arrayContaining(['Hive Fleet', 'Hive Fleet: Hyper-adaption']));
  for (const t of [...craftworlds, ...tyranids]) expect(t).not.toMatch(/selection|selector|\*/i);
});

test('army option choices read without BattleScribe decoration ("*Far-Flung Craftworld*" -> "Far-Flung Craftworld")', async () => {
  const scope = await getRosterScope(['aeldari-craftworlds']);
  const roster = startingRoster(scope, { name: 'x', catalogueId: '30b2-6f64-b85e-b4dc', sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  const names = armyChoices(scope, roster).flatMap((c) => c.options.map((o) => o.name));
  expect(names).toContain('Far-Flung Craftworld');
  for (const n of names) expect(n).not.toMatch(/^[-*\s]|[-*\s]$|\*/);
});

test('the default list name is the faction and size, numbered when the player already has one by that name', () => {
  const necrons = { name: 'Necrons' } as CatalogueSummary;
  expect(defaultListName(necrons, 'combat-patrol')).toBe('Necrons Combat Patrol');
  expect(defaultListName(necrons, 'combat-patrol', ['Necrons Combat Patrol'])).toBe('Necrons Combat Patrol 2');
});

test('battle sizes say what each is for; only Combat Patrol is recommended', () => {
  expect(sizeCards().map((s) => [s.id, s.recommended, s.description])).toEqual([
    ['combat-patrol', true, '500 points. Small and quick to play: the best way to learn.'],
    ['incursion', false, '1,000 points. Arks of Omen rules: one main detachment.'],
    ['strike-force', false, '2,000 points. The usual size for most games and events. Arks of Omen rules.'],
    ['onslaught', false, '3,000 points. Very large games. Core Book rules: up to 4 detachments.'],
  ]);
});
