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
import { createList, saveList, setListPublic, useLists, type ListData } from './listStore';

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

  test('saveList replaces the data but keeps the id, owner and public flag', async () => {
    const id = await createList(repo, 'user-1', data('Old'));
    await setListPublic(repo, id, true);
    const before = (await repo.getDoc<ListData>(id))!;
    await saveList(repo, before, data('New', { points: 1500, issueCount: 0 }));
    const after = (await repo.getDoc<ListData>(id))!;
    expect(after.data.roster.name).toBe('New');
    expect(after.data.summary).toMatchObject({ points: 1500, issueCount: 0 });
    expect(after).toMatchObject({ id, ownerId: 'user-1', isPublic: true, kind: 'list' });
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

describe('useLists', () => {
  const backend = (id: string): AuthBackend => ({
    getUser: async () => ({ id, email: null }),
    onChange: () => () => {},
    signInWithEmail: async () => {},
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
