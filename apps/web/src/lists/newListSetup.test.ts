import { FORCE } from '@recruit/data/roster';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getRosterScope, resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { armyChoices, startingRoster } from './newListSetup';

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
