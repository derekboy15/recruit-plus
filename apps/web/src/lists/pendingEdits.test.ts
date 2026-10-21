import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { syncOnce, type RemoteStore } from '../storage/sync';
import type { Doc } from '../storage/types';
import type { ListData } from './listStore';
import { keepPending, recoverPending } from './pendingEdits';

const ID = '00000000-0000-4000-8000-0000000000aa';
const data = (name: string): ListData => ({
  roster: { schema: 1, name, catalogueId: 'c', battleSize: 'strike-force', forces: [] },
  summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'strike-force', points: 0, pointsLimit: 2000, issueCount: 0 },
});

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`pending-test-${++n}`);
});
afterEach(() => {
  db.close();
  localStorage.clear();
});

test('a recovered copy keeps the time of its edit, so a newer copy from another device still wins the next sync', async () => {
  let clock = 1_000;
  const repo = createRepository(db, () => clock);
  await repo.saveDoc<ListData>({ id: ID, kind: 'list', ownerId: 'u', data: data('Saved') });
  await db.docs.update(ID, { dirty: false });
  // Device 1 closes at 2,000 before its save lands; device 2 edits and syncs at 3,000.
  keepPending(ID, data('Device 1 edit'), 2_000);
  const server = new Map<string, Doc>([[ID, { id: ID, kind: 'list', ownerId: 'u', data: data('Device 2 edit'), updatedAt: 3_000, deleted: false, isPublic: false, dirty: false }]]);
  const remote: RemoteStore = {
    pullSince: async () => ({ docs: [...server.values()], cursor: 1 }),
    pushDocs: async (docs) => docs.forEach((d) => (server.get(d.id)!.updatedAt <= d.updatedAt ? server.set(d.id, d) : undefined)),
  };

  // Device 1 reopens at 4,000 and recovers before its first pull.
  clock = 4_000;
  await recoverPending(repo);
  const recovered = (await repo.getDoc<ListData>(ID))!;
  expect(recovered).toMatchObject({ updatedAt: 2_000, dirty: true });
  expect(recovered.data.roster.name).toBe('Device 1 edit');

  await syncOnce(db, remote, 'u');
  expect((await repo.getDoc<ListData>(ID))!.data.roster.name).toBe('Device 2 edit');
  expect(server.get(ID)!.data).toEqual(data('Device 2 edit'));
});

test('a copy no newer than the saved list is dropped unused', async () => {
  const repo = createRepository(db, () => 5_000);
  await repo.saveDoc<ListData>({ id: ID, kind: 'list', ownerId: 'u', data: data('Saved') });
  keepPending(ID, data('Old'), 5_000);
  await recoverPending(repo);
  expect((await repo.getDoc<ListData>(ID))!.data.roster.name).toBe('Saved');
  expect(localStorage.length).toBe(0);
});
