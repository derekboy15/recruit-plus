import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { openDb, type RecruitDb } from '../../storage/db';
import { createRepository } from '../../storage/repository';
import { StorageProvider } from '../../storage/StorageContext';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { necronsListData } from '../__fixtures__/necronsList';
import type { ListData } from '../listStore';
import { keepPending } from '../pendingEdits';
import { novokhIncursionData } from './__fixtures__/playList';
import { loadPlayData, usePlayList } from './loadPlayData';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`play-load-test-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
  localStorage.clear();
  db.close();
});

const wrapper = ({ children }: { children: ReactNode }) => <StorageProvider db={db}>{children}</StorageProvider>;

test('loadPlayData: the army, its rules, its stratagems and the export text', async () => {
  const data = await novokhIncursionData();
  const out = await loadPlayData(data);
  expect(out.army.units).toHaveLength(5);
  expect(out.rules[0]).toMatchObject({ from: 'Novokh' });
  expect(out.stratagems.mine.map((s) => s.name)).toContain('Blood Rites'); // Novokh's
  expect(out.stratagems.mine.map((s) => s.name)).not.toContain('Talent for Annihilation'); // Mephrit's
  expect(out.stratagems.all.map((s) => s.name)).toContain('Talent for Annihilation');
  expect(out.text).toMatch(/^Novokh Incursion\nNecrons · Incursion/);
});

test('usePlayList: ready for a saved list, missing for an unknown or deleted one', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'l1', kind: 'list', ownerId: 'u', data: await novokhIncursionData() });
  const { result } = renderHook(() => usePlayList('l1'), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 5000 });
  const missing = renderHook(() => usePlayList('nope'), { wrapper });
  await waitFor(() => expect(missing.result.current.status).toBe('missing'));
  await repo.deleteDoc('l1');
  const deleted = renderHook(() => usePlayList('l1'), { wrapper });
  await waitFor(() => expect(deleted.result.current.status).toBe('missing'));
});

test('usePlayList follows the saved list: a save that lands after it opened shows', async () => {
  // Tapping Play straight after an edit: the editor's last save can land after Play mode has read the list.
  const repo = createRepository(db);
  const data = await novokhIncursionData();
  await repo.saveDoc({ id: 'l2', kind: 'list', ownerId: 'u', data });
  const { result } = renderHook(() => usePlayList('l2'), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 5000 });
  const renamed: ListData = { ...data, roster: { ...data.roster, name: 'Renamed' } };
  await repo.saveDoc({ id: 'l2', kind: 'list', ownerId: 'u', data: renamed });
  await waitFor(() => expect(result.current.status === 'ready' && result.current.data.army.name).toBe('Renamed'), { timeout: 5000 });
});

test('usePlayList shows an edit the editor kept aside when the page closed before its save landed', async () => {
  const repo = createRepository(db);
  const data = await novokhIncursionData();
  const saved = await repo.saveDoc({ id: 'l3', kind: 'list', ownerId: 'u', data });
  keepPending('l3', { ...data, roster: { ...data.roster, name: 'Kept aside' } }, saved.updatedAt + 1);
  const { result } = renderHook(() => usePlayList('l3'), { wrapper });
  await waitFor(() => expect(result.current.status === 'ready' && result.current.data.army.name).toBe('Kept aside'), { timeout: 5000 });
});

test('an empty list loads with no units', async () => {
  const out = await loadPlayData(await necronsListData()); // the existing fixture with no units
  expect(out.army.units).toEqual([]);
});
