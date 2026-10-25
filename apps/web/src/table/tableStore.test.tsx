import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository, type Repository } from '../storage/repository';
import { testSetup } from './__fixtures__/setup';
import { makeEvent, type TableGameData } from './game';
import { resetMissionCache } from './missionData';
import { createTableGame, deleteTableGame, useTableGame, useTableGames } from './tableStore';
import './__fixtures__/patience';

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  db = openDb(`table-store-${++n}`);
  repo = createRepository(db);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  resetMissionCache();
});
const wrapper = ({ children }: { children: ReactNode }) => <TestProviders db={db} router={false}>{children}</TestProviders>;

test('createTableGame stores a game doc with the start event', async () => {
  const id = await createTableGame(repo, 'user-1', testSetup());
  const doc = (await repo.getDoc<TableGameData>(id))!;
  expect(doc.kind).toBe('game');
  expect(doc.data.mode).toBe('table');
  expect(doc.data.schema).toBe(1);
  expect(doc.data.events.map((e) => e.t)).toEqual(['start']);
});

test('sandbox-mode game docs are not listed', async () => {
  await createTableGame(repo, 'user-1', testSetup());
  await repo.saveDoc({ id: crypto.randomUUID(), kind: 'game', ownerId: 'user-1', data: { mode: 'sandbox' } });
  const { result } = renderHook(() => useTableGames(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await waitFor(() => expect(result.current.games).toHaveLength(1));
  expect(result.current.games[0].data.mode).toBe('table');
});

test('append keeps order and marks dirty', async () => {
  const id = await createTableGame(repo, 'user-1', testSetup());
  await db.docs.update(id, { dirty: false });
  const { result } = renderHook(() => useTableGame(id), { wrapper });
  await waitFor(() => expect(result.current.game).not.toBeNull());
  await act(() => result.current.append([makeEvent({ t: 'note', text: 'one' }, null), makeEvent({ t: 'note', text: 'two' }, null)]));
  await act(() => result.current.append([makeEvent({ t: 'note', text: 'three' }, null)]));
  const doc = (await repo.getDoc<TableGameData>(id))!;
  expect(doc.data.events.map((e) => (e.t === 'note' ? e.text : e.t))).toEqual(['start', 'one', 'two', 'three']);
  expect(doc.dirty).toBe(true);
  await waitFor(() => expect(result.current.game!.data.events).toHaveLength(4));
});

test('concurrent appends keep every event', async () => {
  const id = await createTableGame(repo, 'user-1', testSetup());
  const { result } = renderHook(() => useTableGame(id), { wrapper });
  await waitFor(() => expect(result.current.game).not.toBeNull());
  await act(() => Promise.all([
    result.current.append([makeEvent({ t: 'note', text: 'a' }, null)]),
    result.current.append([makeEvent({ t: 'note', text: 'b' }, null)]),
    result.current.append([makeEvent({ t: 'note', text: 'c' }, null)]),
  ]));
  const doc = (await repo.getDoc<TableGameData>(id))!;
  expect(doc.data.events.map((e) => (e.t === 'note' ? e.text : e.t))).toEqual(['start', 'a', 'b', 'c']);
});

test('a game saved offline stays dirty and is listed', async () => {
  // No remote is configured in tests: the save is local only and waits to sync.
  const id = await createTableGame(repo, 'user-1', testSetup());
  expect((await repo.getDoc(id))!.dirty).toBe(true);
  const { result } = renderHook(() => useTableGames(), { wrapper });
  await waitFor(() => expect(result.current.games.map((g) => g.id)).toEqual([id]));
});

test('deleteTableGame deletes the game and its restore brings the same game back', async () => {
  const id = await createTableGame(repo, 'user-1', testSetup());
  const saved = (await repo.getDoc<TableGameData>(id))!;
  await repo.saveDoc<TableGameData>({ ...saved, data: { ...saved.data, events: [...saved.data.events, makeEvent({ t: 'note', text: 'kept' }, null)] } });
  const before = (await repo.getDoc<TableGameData>(id))!;
  const restore = await deleteTableGame(repo, id);
  expect((await repo.getDoc(id))!.deleted).toBe(true);
  expect(await repo.listDocs('game', 'user-1')).toEqual([]);
  await restore();
  const after = (await repo.getDoc<TableGameData>(id))!;
  expect(after).toMatchObject({ id, kind: 'game', ownerId: 'user-1', deleted: false, dirty: true });
  expect(after.data).toEqual(before.data);
});
