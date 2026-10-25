import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend } from '../auth/types';
import { openDb, type RecruitDb } from '../storage/db';
import { isUuid } from '../storage/ids';
import { createRepository, type Repository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { createList, deleteList, duplicateList, restoreList, setListPublic, useLists, type ListData } from './listStore';
import { uniqueListName } from './newListSetup';
import { keepPending } from './pendingEdits';

const data = (name: string, over: Partial<ListData['summary']> = {}): ListData => ({
  roster: { schema: 1, name, catalogueId: 'cat-1', battleSize: 'strike-force', forces: [] },
  summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'strike-force', points: 0, pointsLimit: 2000, issueCount: 3, ...over },
});

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  db = openDb(`lists-test-${++n}`);
  repo = createRepository(db);
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
  localStorage.clear();
});

describe('listStore', () => {
  test('createList stores a "list" doc with a UUID id and the summary, and returns the id', async () => {
    const id = await createList(repo, 'user-1', data('Necrons Strike Force'));
    expect(isUuid(id)).toBe(true);
    const doc = (await repo.getDoc<ListData>(id))!;
    expect(doc.kind).toBe('list');
    expect(doc.ownerId).toBe('user-1');
    expect(doc.isPublic).toBe(false);
    expect(doc.dirty).toBe(true);
    expect(doc.data.summary).toEqual(data('x').summary);
    expect(doc.data.roster.name).toBe('Necrons Strike Force');
  });

  test('setListPublic flips only the public flag', async () => {
    const id = await createList(repo, 'user-1', data('A'));
    await setListPublic(repo, id, true);
    expect(await repo.getDoc<ListData>(id)).toMatchObject({ isPublic: true, dirty: true });
    expect((await repo.getDoc<ListData>(id))!.data.roster.name).toBe('A');
    await setListPublic(repo, id, false);
    expect((await repo.getDoc<ListData>(id))!.isPublic).toBe(false);
  });

  test('setListPublic on a missing list is an error', async () => {
    await expect(setListPublic(repo, '00000000-0000-4000-8000-000000000009', true)).rejects.toThrow();
  });
});

describe('uniqueListName', () => {
  test('a name nobody uses is kept', () => {
    expect(uniqueListName('Necrons Combat Patrol', ['Orks Incursion'])).toBe('Necrons Combat Patrol');
  });
  test('a taken name gets the next free number', () => {
    expect(uniqueListName('Necrons Combat Patrol', ['Necrons Combat Patrol'])).toBe('Necrons Combat Patrol 2');
    expect(uniqueListName('Necrons Combat Patrol', ['Necrons Combat Patrol', 'Necrons Combat Patrol 2', 'Necrons Combat Patrol 3'])).toBe(
      'Necrons Combat Patrol 4',
    );
  });
  test('names match whatever their case and spacing', () => {
    expect(uniqueListName('Necrons Combat Patrol', ['  necrons combat patrol '])).toBe('Necrons Combat Patrol 2');
  });
});

describe('duplicate, delete and restore', () => {
  test('duplicateList saves a private copy named "(copy)", unique among the taken names, and returns its id', async () => {
    const id = await createList(repo, 'user-1', data('Necrons Combat Patrol', { points: 480 }));
    await setListPublic(repo, id, true);
    const copy = await duplicateList(repo, 'user-1', id, ['Necrons Combat Patrol']);
    expect(copy).not.toBe(id);
    expect(isUuid(copy)).toBe(true);
    const doc = (await repo.getDoc<ListData>(copy))!;
    expect(doc).toMatchObject({ kind: 'list', ownerId: 'user-1', isPublic: false, deleted: false });
    expect(doc.data.roster.name).toBe('Necrons Combat Patrol (copy)');
    expect(doc.data.summary).toEqual(data('x', { points: 480 }).summary);
    expect((await repo.getDoc<ListData>(id))!.isPublic).toBe(true);
    const second = await duplicateList(repo, 'user-1', id, ['Necrons Combat Patrol', 'Necrons Combat Patrol (copy)']);
    expect((await repo.getDoc<ListData>(second))!.data.roster.name).toBe('Necrons Combat Patrol (copy) 2');
  });

  test('duplicateList of a list that is gone is an error', async () => {
    await expect(duplicateList(repo, 'user-1', '00000000-0000-4000-8000-000000000009', [])).rejects.toThrow();
  });

  test('deleteList returns the list as it was; restoreList brings it back newer than the deletion, sharing kept', async () => {
    const id = await createList(repo, 'user-1', data('Doomed'));
    await setListPublic(repo, id, true);
    const before = (await repo.getDoc<ListData>(id))!;
    const was = await deleteList(repo, id);
    expect(was).toEqual(before);
    const deletion = (await repo.getDoc<ListData>(id))!;
    expect(deletion.deleted).toBe(true);
    expect(await repo.listDocs('list', 'user-1')).toEqual([]);

    await restoreList(repo, was);
    const back = (await repo.getDoc<ListData>(id))!;
    expect(back).toMatchObject({ deleted: false, isPublic: true, dirty: true, ownerId: 'user-1' });
    expect(back.data).toEqual(before.data);
    expect(back.updatedAt).toBeGreaterThan(deletion.updatedAt);
    expect((await repo.listDocs<ListData>('list', 'user-1')).map((d) => d.id)).toEqual([id]);
  });

  test('a restore stamped in the same millisecond as the deletion is still later', async () => {
    const fixed = createRepository(db, () => 5000);
    const id = await createList(fixed, 'user-1', data('Same moment'));
    const was = await deleteList(fixed, id);
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    await restoreList(fixed, was);
    expect((await fixed.getDoc<ListData>(id))!.updatedAt).toBeGreaterThan(5000);
  });

  test('deleteList of a list that is gone is an error', async () => {
    await expect(deleteList(repo, '00000000-0000-4000-8000-000000000009')).rejects.toThrow();
  });
});

describe('useLists', () => {
  const backend = (id: string): AuthBackend => ({
    getUser: async () => ({ id, email: null }),
    onChange: () => () => {},
    signInWithPassword: async () => {},
    signUp: async () => ({ confirmEmail: true }),
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    resendConfirmation: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
  });
  const wrapper = (userId: string) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <AuthProvider backend={backend(userId)}>
          <StorageProvider db={db}>{children}</StorageProvider>
        </AuthProvider>
      );
    };
  const signedIn = (id: string) => localStorage.setItem('recruit.lastUser', JSON.stringify({ id, email: null }));

  test("lists only the signed-in user's lists, newest first, and updates when one is added", async () => {
    signedIn('user-1');
    await createList(repo, 'user-1', data('First'));
    await createList(repo, 'someone-else', data('Not mine'));
    const { result } = renderHook(() => useLists(), { wrapper: wrapper('user-1') });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lists.map((l) => l.data.roster.name)).toEqual(['First']);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
      await createList(repo, 'user-1', data('Second'));
    });
    await waitFor(() => expect(result.current.lists.map((l) => l.data.roster.name)).toEqual(['Second', 'First']));
  });

  test('does not list deleted lists', async () => {
    signedIn('user-1');
    const id = await createList(repo, 'user-1', data('Gone'));
    await repo.deleteDoc(id);
    const { result } = renderHook(() => useLists(), { wrapper: wrapper('user-1') });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lists).toEqual([]);
  });

  test('saves edits a closing editor kept aside, so the lists page shows them', async () => {
    signedIn('user-1');
    const id = await createList(repo, 'user-1', data('Before'));
    keepPending(id, data('After closing', { points: 375 }), Date.now() + 1000);
    const { result } = renderHook(() => useLists(), { wrapper: wrapper('user-1') });
    await waitFor(() => expect(result.current.lists.map((l) => [l.data.roster.name, l.data.summary.points])).toEqual([['After closing', 375]]));
    expect(localStorage.getItem(`recruit.pendingList.${id}`)).toBeNull();
  });

  test('a database that cannot be read gives an error instead of loading forever', async () => {
    signedIn('user-1');
    vi.spyOn(db.docs, 'where').mockImplementation(() => {
      throw new Error('disk on fire');
    });
    const { result } = renderHook(() => useLists(), { wrapper: wrapper('user-1') });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.loading).toBe(false);
    expect(result.current.lists).toEqual([]);
  });
});
