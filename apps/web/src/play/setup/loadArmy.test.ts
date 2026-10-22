import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../../lists/__fixtures__/generatedData';
import { necronsListData } from '../../lists/__fixtures__/necronsList';
import type { ListData } from '../../lists/listStore';
import type { Doc } from '../../storage/types';
import { loadArmy } from './loadArmy';

beforeEach(() => {
  resetDataCache();
  stubGeneratedData();
});
afterEach(() => vi.unstubAllGlobals());

const doc = (data: ListData): Doc<ListData> => ({ id: 'list-1', kind: 'list', ownerId: 'u', updatedAt: 1, deleted: false, isPublic: false, dirty: false, data });

test('musters a Necrons list with prefixed unit ids', async () => {
  const data = await necronsListData((r, add) => add(add(r, 'Necron Warriors'), 'Overlord'));
  const loaded = await loadArmy(doc(data), 'A');
  expect(loaded.army.player).toBe('A');
  expect(loaded.army.name).toBe('Necrons Strike Force');
  expect(loaded.army.units.map((u) => u.datasheet.name).sort()).toEqual(['Necron Warriors', 'Overlord']);
  expect(loaded.army.units.every((u) => u.id.startsWith('A:'))).toBe(true);
  expect(loaded.faction).toBe('Necrons');
  expect(loaded.battleSize).toBe('strike-force');
  expect(loaded.catalogueSlugs).toContain('necrons');
}, 30_000);

test('the same list for both players gives distinct ids', async () => {
  const data = await necronsListData((r, add) => add(r, 'Necron Warriors'));
  const [a, b] = await Promise.all([loadArmy(doc(data), 'A'), loadArmy(doc(data), 'B')]);
  const ids = [...a.army.units, ...b.army.units].map((u) => u.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(b.army.player).toBe('B');
}, 30_000);

test('an empty list reports that it has no units', async () => {
  const loaded = await loadArmy(doc(await necronsListData()), 'A');
  expect(loaded.army.units).toEqual([]);
  expect(loaded.problems).toContain('Necrons Strike Force has no units.');
}, 30_000);
