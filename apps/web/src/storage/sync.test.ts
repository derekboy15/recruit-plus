import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { openDb, type RecruitDb } from './db';
import { createRepository, type Repository } from './repository';
import { syncOnce, type RemoteStore } from './sync';
import type { Doc } from './types';

/** In-memory server that, like the Supabase trigger, ignores writes older than what it holds. */
class FakeRemote implements RemoteStore {
  rows = new Map<string, Doc>();
  /** Server-side write sequence, like the synced_at column: independent of device clocks. */
  seq = new Map<string, number>();
  private counter = 0;
  async pushDocs(docs: Doc[]) {
    for (const d of docs) {
      const cur = this.rows.get(d.id);
      if (!cur || d.updatedAt >= cur.updatedAt) this.set(d);
    }
  }
  set(d: Doc) {
    this.rows.set(d.id, { ...d, dirty: false });
    this.seq.set(d.id, ++this.counter);
  }
  async pullSince(ownerId: string, cursor: number) {
    const docs = [...this.rows.values()].filter((d) => d.ownerId === ownerId && this.seq.get(d.id)! > cursor);
    return { docs, cursor: this.counter };
  }
}

const OWNER = 'user-1';
let clock = 1_000;
const now = () => clock;
let dbs: RecruitDb[] = [];
const device = (name: string) => {
  const db = openDb(`test-${name}-${Math.random()}`);
  dbs.push(db);
  return { db, repo: createRepository(db, now) };
};

beforeEach(() => {
  clock = 1_000;
});
afterEach(async () => {
  for (const db of dbs) await db.delete();
  dbs = [];
});

describe('repository', () => {
  test('saveDoc marks dirty and stamps updatedAt; deleteDoc is soft', async () => {
    const { repo } = device('a');
    await repo.saveDoc({ id: 'l1', kind: 'list', ownerId: OWNER, data: { name: 'Necrons 2k' } });
    expect(await repo.getDoc('l1')).toMatchObject({ dirty: true, updatedAt: 1_000, deleted: false, isPublic: false });
    clock = 2_000;
    await repo.deleteDoc('l1');
    expect(await repo.getDoc('l1')).toMatchObject({ deleted: true, dirty: true, updatedAt: 2_000 });
    expect(await repo.listDocs('list', OWNER)).toEqual([]);
  });
});

describe('syncOnce', () => {
  test('pushes a local dirty doc and marks it clean', async () => {
    const remote = new FakeRemote();
    const { db, repo } = device('a');
    await repo.saveDoc({ id: 'l1', kind: 'list', ownerId: OWNER, data: { v: 1 } });
    expect(await syncOnce(db, remote, OWNER)).toEqual({ pushed: 1, pulled: 0 });
    expect(remote.rows.get('l1')?.data).toEqual({ v: 1 });
    expect((await repo.getDoc('l1'))?.dirty).toBe(false);
  });

  test('a newer remote doc overwrites local; an older one does not', async () => {
    const remote = new FakeRemote();
    const { db, repo } = device('a');
    clock = 5_000;
    await repo.saveDoc({ id: 'l1', kind: 'list', ownerId: OWNER, data: { v: 'local' } });
    await syncOnce(db, remote, OWNER);
    remote.set({ ...remote.rows.get('l1')!, updatedAt: 9_000, data: { v: 'newer' } });
    remote.set({ id: 'l2', kind: 'list', ownerId: OWNER, updatedAt: 9_500, deleted: false, isPublic: false, data: { v: 'new doc' }, dirty: false });
    await syncOnce(db, remote, OWNER);
    expect((await repo.getDoc('l1'))?.data).toEqual({ v: 'newer' });
    expect((await repo.getDoc('l2'))?.data).toEqual({ v: 'new doc' });

    clock = 20_000;
    await repo.saveDoc({ id: 'l1', kind: 'list', ownerId: OWNER, data: { v: 'latest local' } });
    remote.set({ ...remote.rows.get('l1')!, updatedAt: 10_000, data: { v: 'stale' } });
    await syncOnce(db, remote, OWNER);
    expect((await repo.getDoc('l1'))?.data).toEqual({ v: 'latest local' });
    expect(remote.rows.get('l1')?.data).toEqual({ v: 'latest local' });
  });

  test('same doc edited on two offline devices: the later edit wins everywhere, other docs survive', async () => {
    const remote = new FakeRemote();
    const a = device('a');
    const b = device('b');
    await a.repo.saveDoc({ id: 'shared', kind: 'list', ownerId: OWNER, data: { v: 'base' } });
    await a.repo.saveDoc({ id: 'only-a', kind: 'list', ownerId: OWNER, data: { v: 'a' } });
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);

    clock = 3_000;
    await b.repo.saveDoc({ id: 'shared', kind: 'list', ownerId: OWNER, data: { v: 'b edit (later)' } });
    clock = 2_000;
    await a.repo.saveDoc({ id: 'shared', kind: 'list', ownerId: OWNER, data: { v: 'a edit (earlier)' } });

    await syncOnce(b.db, remote, OWNER);
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);

    expect((await a.repo.getDoc('shared'))?.data).toEqual({ v: 'b edit (later)' });
    expect((await b.repo.getDoc('shared'))?.data).toEqual({ v: 'b edit (later)' });
    expect(remote.rows.get('shared')?.data).toEqual({ v: 'b edit (later)' });
    expect((await a.repo.getDoc('only-a'))?.data).toEqual({ v: 'a' });
    expect((await b.repo.getDoc('only-a'))?.data).toEqual({ v: 'a' });
  });

  test('works offline: edits are kept locally and pushed on the next successful sync', async () => {
    const remote = new FakeRemote();
    const offline: RemoteStore = {
      pushDocs: async () => {
        throw new TypeError('Failed to fetch');
      },
      pullSince: async () => {
        throw new TypeError('Failed to fetch');
      },
    };
    const { db, repo } = device('a');
    await repo.saveDoc({ id: 'l1', kind: 'list', ownerId: OWNER, data: { v: 'offline edit' } });
    await expect(syncOnce(db, offline, OWNER)).rejects.toThrow('Failed to fetch');
    expect((await repo.listDocs('list', OWNER)).map((d) => d.data)).toEqual([{ v: 'offline edit' }]);
    expect((await repo.getDoc('l1'))?.dirty).toBe(true);
    expect(await syncOnce(db, remote, OWNER)).toEqual({ pushed: 1, pulled: 0 });
  });

  test('a doc edited earlier but uploaded later by another device is still pulled', async () => {
    const remote = new FakeRemote();
    const a = device('a');
    const b = device('b');
    clock = 1_000;
    await b.repo.saveDoc({ id: 'b-offline', kind: 'list', ownerId: OWNER, data: { v: 'made offline' } });
    clock = 10_000;
    await a.repo.saveDoc({ id: 'a-online', kind: 'list', ownerId: OWNER, data: { v: 'a' } });
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);
    await syncOnce(a.db, remote, OWNER);
    expect((await a.repo.getDoc('b-offline'))?.data).toEqual({ v: 'made offline' });
  });

  test('deletion propagates to other devices', async () => {
    const remote = new FakeRemote();
    const a = device('a');
    const b = device('b');
    await a.repo.saveDoc({ id: 'l1', kind: 'list', ownerId: OWNER, data: {} });
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);
    clock = 4_000;
    await a.repo.deleteDoc('l1');
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);
    expect((await b.repo.getDoc('l1'))?.deleted).toBe(true);
    expect(await b.repo.listDocs('list', OWNER)).toEqual([]);
  });
});
