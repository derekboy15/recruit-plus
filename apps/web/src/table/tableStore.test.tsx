import 'fake-indexeddb/auto';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
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
import { TableHome } from './TableHome';
import { createTableGame, useTableGame, useTableGames } from './tableStore';

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

test('a game saved offline stays dirty and is listed', async () => {
  // No remote is configured in tests: the save is local only and waits to sync.
  const id = await createTableGame(repo, 'user-1', testSetup());
  expect((await repo.getDoc(id))!.dirty).toBe(true);
  const { result } = renderHook(() => useTableGames(), { wrapper });
  await waitFor(() => expect(result.current.games.map((g) => g.id)).toEqual([id]));
});

test('TableHome shows Resume for an unfinished game', async () => {
  await createTableGame(createRepository(db), 'user-1', testSetup());
  render(<TestProviders db={db} path="/table"><TableHome /></TestProviders>);
  expect(await screen.findByRole('heading', { name: 'Table companion' })).toBeInTheDocument();
  expect(await screen.findByText('Cleanse the Land')).toBeInTheDocument();
  expect(screen.getByText(/Round 1/)).toBeInTheDocument();
  expect(screen.getByText('You 0 – 0 Opponent')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Resume/ })).toHaveAttribute('href', expect.stringMatching(/^\/table\/[0-9a-f-]{36}$/));
  expect(screen.getByRole('link', { name: 'New game' })).toHaveAttribute('href', '/table/new');
});

test('TableHome empty state', async () => {
  render(<TestProviders db={db} path="/table"><TableHome /></TestProviders>);
  expect(await screen.findByText('No games yet. Start one when you sit down to play.')).toBeInTheDocument();
});
