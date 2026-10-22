import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AppRoutes } from '../routes';
import { openDb, type RecruitDb } from '../storage/db';
import { StorageProvider } from '../storage/StorageContext';
import { AuthProvider } from '../auth/AuthContext';
import { signedIn } from '../rules/__fixtures__/TestProviders';
import { getMissions, missionById, resetMissionCache } from './missionData';

const missions = { generatedAt: 'x', packs: [], secondaryFactions: {}, missions: [{ id: 'aoo-cleanse-the-land', name: 'Cleanse the Land' }] };
let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`mission-data-${++n}`);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(missions))));
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetMissionCache();
});

test('getMissions caches one fetch', async () => {
  const a = await getMissions();
  const b = await getMissions();
  expect(a).toBe(b);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith('/data/missions.json');
  expect(missionById(a, 'aoo-cleanse-the-land')?.name).toBe('Cleanse the Land');
  expect(missionById(a, 'nope')).toBeUndefined();
});

test('/table renders "Table companion" behind sign-in', async () => {
  render(
    <AuthProvider backend={signedIn()}>
      <StorageProvider db={db}>
        <MemoryRouter initialEntries={['/table']}>
          <AppRoutes guard={(c) => c} />
        </MemoryRouter>
      </StorageProvider>
    </AuthProvider>,
  );
  expect(await screen.findByRole('heading', { name: 'Table companion' })).toBeInTheDocument();
});

test('/table is behind the guard', async () => {
  render(
    <StorageProvider db={db}>
      <MemoryRouter initialEntries={['/table']}>
        <AppRoutes guard={() => <p>Sign in first</p>} />
      </MemoryRouter>
    </StorageProvider>,
  );
  expect(await screen.findByText('Sign in first')).toBeInTheDocument();
});
