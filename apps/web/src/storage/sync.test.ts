import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { openDb, type RecruitDb } from './db';
import { isUuid } from './ids';
import { createRepository, type Repository } from './repository';
import { PULL_OVERLAP, startAutoSync, SyncAuthError, syncOnce, type RemoteStore } from './sync';
import type { Doc } from './types';

/** In-memory server that, like the Supabase trigger, ignores writes older than what it holds. */
class FakeRemote implements RemoteStore {
  rows = new Map<string, Doc>();
  /** Server-side write sequence, like the synced_at column: independent of device clocks. */
  seq = new Map<string, number>();
  /** Rows written by a transaction that hasn't committed yet: not visible to pulls. */
  hidden = new Set<string>();
  /** Doc ids the server refuses (e.g. a constraint violation), alone or in a batch. */
  reject = new Set<string>();
  pushCalls: string[][] = [];
  private counter = 0;
  async pushDocs(docs: Doc[]) {
    this.pushCalls.push(docs.map((d) => d.id));
    if (docs.some((d) => this.reject.has(d.id))) throw new Error('Sync push failed: rejected');
    for (const d of docs) {
      const cur = this.rows.get(d.id);
      if (!cur || d.updatedAt >= cur.updatedAt) this.set(d);
    }
  }
  set(d: Doc, seq = ++this.counter) {
    this.counter = Math.max(this.counter, seq);
    this.rows.set(d.id, { ...d, dirty: false });
    this.seq.set(d.id, seq);
  }
  async pullSince(ownerId: string, cursor: number) {
    const docs = [...this.rows.values()].filter((d) => d.ownerId === ownerId && !this.hidden.has(d.id) && this.seq.get(d.id)! > cursor);
    return { docs, cursor: Math.max(cursor, ...docs.map((d) => this.seq.get(d.id)!)) };
  }
}

const OWNER = 'user-1';
const L1 = '00000000-0000-4000-8000-000000000001';
const L2 = '00000000-0000-4000-8000-000000000002';
const SHARED = '00000000-0000-4000-8000-000000000003';
const ONLY_A = '00000000-0000-4000-8000-000000000004';
const B_OFFLINE = '00000000-0000-4000-8000-000000000005';
const A_ONLINE = '00000000-0000-4000-8000-000000000006';
let clock = 1_000;
const now = () => clock;
let dbs: RecruitDb[] = [];
const device = (name: string): { db: RecruitDb; repo: Repository } => {
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
    await repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: { name: 'Necrons 2k' } });
    expect(await repo.getDoc(L1)).toMatchObject({ dirty: true, updatedAt: 1_000, deleted: false, isPublic: false });
    clock = 2_000;
    await repo.deleteDoc(L1);
    expect(await repo.getDoc(L1)).toMatchObject({ deleted: true, dirty: true, updatedAt: 2_000 });
    expect(await repo.listDocs('list', OWNER)).toEqual([]);
  });

  test('deleting a doc clears its contents: only the deletion record is kept', async () => {
    const { repo } = device('a');
    await repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: { name: 'Necrons 2k', units: ['Warriors'] } });
    await repo.deleteDoc(L1);
    expect((await repo.getDoc(L1))?.data).toEqual({});
  });
});

describe('syncOnce', () => {
  test('pushes a local dirty doc and marks it clean', async () => {
    const remote = new FakeRemote();
    const { db, repo } = device('a');
    await repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: { v: 1 } });
    expect(await syncOnce(db, remote, OWNER)).toEqual({ pushed: 1, pulled: 0, failed: [], rekeyed: 0 });
    expect(remote.rows.get(L1)?.data).toEqual({ v: 1 });
    expect((await repo.getDoc(L1))?.dirty).toBe(false);
  });

  test('a newer remote doc overwrites local; an older one does not', async () => {
    const remote = new FakeRemote();
    const { db, repo } = device('a');
    clock = 5_000;
    await repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: { v: 'local' } });
    await syncOnce(db, remote, OWNER);
    remote.set({ ...remote.rows.get(L1)!, updatedAt: 9_000, data: { v: 'newer' } });
    remote.set({ id: L2, kind: 'list', ownerId: OWNER, updatedAt: 9_500, deleted: false, isPublic: false, data: { v: 'new doc' }, dirty: false });
    await syncOnce(db, remote, OWNER);
    expect((await repo.getDoc(L1))?.data).toEqual({ v: 'newer' });
    expect((await repo.getDoc(L2))?.data).toEqual({ v: 'new doc' });

    clock = 20_000;
    await repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: { v: 'latest local' } });
    remote.set({ ...remote.rows.get(L1)!, updatedAt: 10_000, data: { v: 'stale' } });
    await syncOnce(db, remote, OWNER);
    expect((await repo.getDoc(L1))?.data).toEqual({ v: 'latest local' });
    expect(remote.rows.get(L1)?.data).toEqual({ v: 'latest local' });
  });

  test('same doc edited on two offline devices: the later edit wins everywhere, other docs survive', async () => {
    const remote = new FakeRemote();
    const a = device('a');
    const b = device('b');
    await a.repo.saveDoc({ id: SHARED, kind: 'list', ownerId: OWNER, data: { v: 'base' } });
    await a.repo.saveDoc({ id: ONLY_A, kind: 'list', ownerId: OWNER, data: { v: 'a' } });
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);

    clock = 3_000;
    await b.repo.saveDoc({ id: SHARED, kind: 'list', ownerId: OWNER, data: { v: 'b edit (later)' } });
    clock = 2_000;
    await a.repo.saveDoc({ id: SHARED, kind: 'list', ownerId: OWNER, data: { v: 'a edit (earlier)' } });

    await syncOnce(b.db, remote, OWNER);
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);

    expect((await a.repo.getDoc(SHARED))?.data).toEqual({ v: 'b edit (later)' });
    expect((await b.repo.getDoc(SHARED))?.data).toEqual({ v: 'b edit (later)' });
    expect(remote.rows.get(SHARED)?.data).toEqual({ v: 'b edit (later)' });
    expect((await a.repo.getDoc(ONLY_A))?.data).toEqual({ v: 'a' });
    expect((await b.repo.getDoc(ONLY_A))?.data).toEqual({ v: 'a' });
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
    await repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: { v: 'offline edit' } });
    await expect(syncOnce(db, offline, OWNER)).rejects.toThrow('Failed to fetch');
    expect((await repo.listDocs('list', OWNER)).map((d) => d.data)).toEqual([{ v: 'offline edit' }]);
    expect((await repo.getDoc(L1))?.dirty).toBe(true);
    expect(await syncOnce(db, remote, OWNER)).toEqual({ pushed: 1, pulled: 0, failed: [], rekeyed: 0 });
  });

  test('a doc edited earlier but uploaded later by another device is still pulled', async () => {
    const remote = new FakeRemote();
    const a = device('a');
    const b = device('b');
    clock = 1_000;
    await b.repo.saveDoc({ id: B_OFFLINE, kind: 'list', ownerId: OWNER, data: { v: 'made offline' } });
    clock = 10_000;
    await a.repo.saveDoc({ id: A_ONLINE, kind: 'list', ownerId: OWNER, data: { v: 'a' } });
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);
    await syncOnce(a.db, remote, OWNER);
    expect((await a.repo.getDoc(B_OFFLINE))?.data).toEqual({ v: 'made offline' });
  });

  test('deletion propagates to other devices', async () => {
    const remote = new FakeRemote();
    const a = device('a');
    const b = device('b');
    await a.repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: {} });
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);
    clock = 4_000;
    await a.repo.deleteDoc(L1);
    await syncOnce(a.db, remote, OWNER);
    await syncOnce(b.db, remote, OWNER);
    expect((await b.repo.getDoc(L1))?.deleted).toBe(true);
    expect(await b.repo.listDocs('list', OWNER)).toEqual([]);
  });

  test('a doc with a non-uuid id is re-keyed and pushed', async () => {
    const remote = new FakeRemote();
    const { db, repo } = device('a');
    await repo.saveDoc({ id: 'dev-list-1', kind: 'list', ownerId: OWNER, data: { v: 'legacy' } });
    await repo.saveDoc({ id: 'dev-list-2', kind: 'list', ownerId: 'someone-else', data: { v: 'not mine' } });
    clock = 2_000;
    const result = await syncOnce(db, remote, OWNER);
    expect(result).toEqual({ pushed: 1, pulled: 0, failed: [], rekeyed: 1 });
    expect(await repo.getDoc('dev-list-1')).toBeUndefined();
    const mine = await repo.listDocs('list', OWNER);
    expect(mine).toHaveLength(1);
    expect(isUuid(mine[0].id)).toBe(true);
    expect(mine[0]).toMatchObject({ data: { v: 'legacy' }, updatedAt: 1_000, dirty: false });
    expect(remote.rows.get(mine[0].id)?.data).toEqual({ v: 'legacy' });
    expect([...remote.rows.keys()]).toEqual([mine[0].id]);
    // another owner's rows are left alone
    expect(await repo.getDoc('dev-list-2')).toMatchObject({ dirty: true });
    // and nothing is re-keyed twice
    expect((await syncOnce(db, remote, OWNER)).rekeyed).toBe(0);
  });

  test("one rejected doc doesn't block the others", async () => {
    const remote = new FakeRemote();
    const { db, repo } = device('a');
    await repo.saveDoc({ id: L1, kind: 'list', ownerId: OWNER, data: { v: 1 } });
    await repo.saveDoc({ id: L2, kind: 'list', ownerId: OWNER, data: { v: 'bad' } });
    await repo.saveDoc({ id: SHARED, kind: 'list', ownerId: OWNER, data: { v: 3 } });
    remote.reject.add(L2);
    const result = await syncOnce(db, remote, OWNER);
    expect(result).toEqual({ pushed: 2, pulled: 0, failed: [L2], rekeyed: 0 });
    expect(remote.rows.has(L1)).toBe(true);
    expect(remote.rows.has(SHARED)).toBe(true);
    expect(remote.rows.has(L2)).toBe(false);
    expect((await repo.getDoc(L1))?.dirty).toBe(false);
    expect((await repo.getDoc(SHARED))?.dirty).toBe(false);
    expect((await repo.getDoc(L2))?.dirty).toBe(true);
    // the bad doc is retried next time; once the server accepts it, it syncs
    remote.reject.clear();
    expect(await syncOnce(db, remote, OWNER)).toEqual({ pushed: 1, pulled: 0, failed: [], rekeyed: 0 });
    expect((await repo.getDoc(L2))?.dirty).toBe(false);
  });

  test('rows committed out of sequence order are still pulled', async () => {
    const remote = new FakeRemote();
    const { db, repo } = device('a');
    const base = { kind: 'list' as const, ownerId: OWNER, updatedAt: 500, deleted: false, isPublic: false, dirty: false };
    // A got sequence 5 but its transaction hasn't committed; B (sequence 6) is already visible.
    remote.set({ ...base, id: L1, data: { v: 'A' } }, 5);
    remote.hidden.add(L1);
    remote.set({ ...base, id: L2, data: { v: 'B' } }, 6);
    expect((await syncOnce(db, remote, OWNER)).pulled).toBe(1);
    expect(await repo.getDoc(L1)).toBeUndefined();
    expect((await db.meta.get(`pullCursor:${OWNER}`))?.value).toBe(6);

    remote.hidden.clear();
    expect((await syncOnce(db, remote, OWNER)).pulled).toBe(1);
    expect((await repo.getDoc(L1))?.data).toEqual({ v: 'A' });
    // the overlap re-sends B, which is not applied twice
    expect((await syncOnce(db, remote, OWNER)).pulled).toBe(0);
    expect(PULL_OVERLAP).toBe(50);
  });

  test('an empty pull never moves the cursor backwards', async () => {
    const remote = new FakeRemote();
    const { db } = device('a');
    remote.set({ id: L1, kind: 'list', ownerId: OWNER, updatedAt: 1, deleted: false, isPublic: false, data: {}, dirty: false }, 100);
    await syncOnce(db, remote, OWNER);
    await syncOnce(db, remote, OWNER);
    expect((await db.meta.get(`pullCursor:${OWNER}`))?.value).toBe(100);
  });
});

describe('startAutoSync', () => {
  test('auth error calls onAuthError and stops retrying', async () => {
    let pulls = 0;
    const expired: RemoteStore = {
      pushDocs: async () => {},
      pullSince: async () => {
        pulls++;
        throw new SyncAuthError('Sync pull failed: JWT expired');
      },
    };
    const { db } = device('a');
    const onAuthError = vi.fn();
    const stop = startAutoSync(db, expired, OWNER, { intervalMs: 10, onAuthError });
    await vi.waitFor(() => expect(onAuthError).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 80));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 20));
    expect(pulls).toBe(1);
    expect(onAuthError).toHaveBeenCalledTimes(1);
    stop();
  });

  test('an auth error that arrives after stop() is not reported', async () => {
    let fail: (e: Error) => void = () => {};
    let started = false;
    const slow: RemoteStore = {
      pushDocs: async () => {},
      pullSince: () =>
        new Promise((_resolve, reject) => {
          started = true;
          fail = reject;
        }),
    };
    const { db } = device('a');
    const onAuthError = vi.fn();
    const stop = startAutoSync(db, slow, OWNER, { intervalMs: 10_000, onAuthError });
    await vi.waitFor(() => expect(started).toBe(true));
    stop();
    fail(new SyncAuthError('Sync pull failed: JWT expired'));
    await new Promise((r) => setTimeout(r, 20));
    expect(onAuthError).not.toHaveBeenCalled();
  });

  test('other errors are retried on the next tick', async () => {
    let pulls = 0;
    const flaky: RemoteStore = {
      pushDocs: async () => {},
      pullSince: async (_owner, cursor) => {
        if (++pulls === 1) throw new TypeError('Failed to fetch');
        return { docs: [], cursor };
      },
    };
    const { db } = device('a');
    const onAuthError = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stop = startAutoSync(db, flaky, OWNER, { intervalMs: 10, onAuthError });
    await vi.waitFor(() => expect(pulls).toBeGreaterThanOrEqual(2));
    stop();
    warn.mockRestore();
    expect(onAuthError).not.toHaveBeenCalled();
  });
});
