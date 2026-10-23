import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend } from '../auth/types';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { GamesPage } from './GamesPage';
import type { GameData } from './store/gameStore';

const user = { id: 'user-1', email: null };
const backend: AuthBackend = {
  getUser: async () => user,
  onChange: () => () => {},
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`games-page-test-${++n}`);
  localStorage.setItem('recruit.lastUser', JSON.stringify(user));
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
  localStorage.clear();
});

const game = (title: string, summary: Partial<GameData['summary']>): GameData => ({
  record: { schema: 1, setup: {} as never, batches: [] },
  meta: {
    title,
    createdAt: 1,
    hints: true,
    handOver: true,
    missionId: 'practice',
    layoutId: 'open',
    armies: [
      { player: 'A', listId: 'l1', name: 'Necrons', faction: 'Necrons', catalogueSlugs: ['necrons'] },
      { player: 'B', listId: 'l2', name: 'Ultramarines', faction: 'Ultramarines', catalogueSlugs: ['imperium-adeptus-astartes-ultramarines'] },
    ],
  },
  summary: { round: 1, phase: 'command', ended: false, winner: null, vp: { A: 0, B: 0 }, ...summary },
});

const page = () =>
  render(
    <AuthProvider backend={backend}>
      <StorageProvider db={db}>
        <MemoryRouter>
          <GamesPage />
        </MemoryRouter>
      </StorageProvider>
    </AuthProvider>,
  );

test('with no saved games it offers a new game', async () => {
  page();
  expect(await screen.findByText('No games yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'New game' })).toHaveAttribute('href', '/play/new');
});

test('lists saved games newest first with their round and score', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'g1', kind: 'game', ownerId: user.id, data: game('Old game', { ended: true, winner: 'A', round: 5, phase: 'ended' }), updatedAt: 1 });
  await repo.saveDoc({ id: 'g2', kind: 'game', ownerId: user.id, data: game('Necrons vs Ultramarines', { round: 2, phase: 'shooting', vp: { A: 10, B: 5 } }), updatedAt: 2 });
  page();
  await screen.findByText('Old game');
  const cards = screen.getAllByRole('link').filter((l) => /^\/play\/g/.test(l.getAttribute('href') ?? ''));
  expect(cards[0]).toHaveTextContent('Necrons vs Ultramarines');
  expect(cards[0]).toHaveTextContent('Round 2 · Shooting');
  expect(cards[0]).toHaveTextContent('VP 10–5');
  expect(cards[0]).toHaveAttribute('href', '/play/g2');
  expect(cards[1]).toHaveTextContent('Finished: Necrons won');
});

test('deleting a game asks first', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'g1', kind: 'game', ownerId: user.id, data: game('Necrons vs Ultramarines', {}) });
  page();
  const item = (await screen.findByRole('link', { name: /Necrons vs Ultramarines/ })).closest('li')!;
  await userEvent.click(within(item).getByRole('button', { name: 'Delete' }));
  expect(screen.getByText("Delete this game? This can't be undone.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete game' }));
  expect(await screen.findByText('No games yet.')).toBeInTheDocument();
});

test('table companion games are not listed and do not break the page', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'g1', kind: 'game', ownerId: user.id, data: game('Necrons vs Ultramarines', {}), updatedAt: 1 });
  await repo.saveDoc({ id: 't1', kind: 'game', ownerId: user.id, data: { mode: 'table', schema: 1, setup: {}, events: [] }, updatedAt: 2 });
  page();
  expect(await screen.findByRole('link', { name: /Necrons vs Ultramarines/ })).toHaveAttribute('href', '/play/g1');
  expect(screen.getAllByRole('link').filter((l) => /^\/play\/t1/.test(l.getAttribute('href') ?? ''))).toHaveLength(0);
});
