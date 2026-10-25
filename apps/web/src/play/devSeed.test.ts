import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import type { ListData } from '../lists/listStore';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository, type Repository } from '../storage/repository';
import { seedPracticeList } from './devSeed';

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  resetDataCache();
  stubGeneratedData();
  db = openDb(`dev-seed-test-${++n}`);
  repo = createRepository(db);
});
afterEach(() => {
  vi.unstubAllGlobals();
  db.close();
});

test('seeds a Combat Patrol list with the named units, saved under the owner', async () => {
  const id = await seedPracticeList(repo, 'u1', { catalogue: 'necrons', name: 'Necrons Combat Patrol', size: 'combat-patrol', units: ['Necron Warriors'] });
  const doc = await repo.getDoc<ListData>(id);
  expect(doc?.ownerId).toBe('u1');
  expect(doc?.data.roster.name).toBe('Necrons Combat Patrol');
  expect(doc?.data.summary).toMatchObject({ faction: 'Necrons', battleSize: 'combat-patrol', pointsLimit: 500 });
  expect(doc?.data.summary.points).toBeGreaterThanOrEqual(100);
});

test('an unknown unit name fails with its name', async () => {
  await expect(seedPracticeList(repo, 'u1', { catalogue: 'necrons', name: 'x', size: 'combat-patrol', units: ['Nope'] })).rejects.toThrow('Nope');
});
