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
import { ToastProvider } from '../ui/toast';
import { GamesPage, scoreLine, statusLine } from './GamesPage';
import type { GameData } from './store/gameStore';

const user = { id: 'user-1', email: null };
const backend: AuthBackend = {
  getUser: async () => user,
  onChange: () => () => {},
  signInWithPassword: async () => {},
  signUp: async () => ({ confirmEmail: true }),
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  resendConfirmation: async () => {},
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
          <ToastProvider>
            <GamesPage />
          </ToastProvider>
        </MemoryRouter>
      </StorageProvider>
    </AuthProvider>,
  );

test('the page is the Practice tab: title, intro and New game', async () => {
  page();
  expect(await screen.findByRole('heading', { level: 1, name: 'Practice' })).toBeInTheDocument();
  expect(screen.getByText('Two players, one device: the app runs the core rules for you.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'New game' })).toHaveAttribute('href', '/play/new');
});

test('scoreLine reads like the Table: army, score, en dash, score, army', () => {
  expect(scoreLine(game('x', { vp: { A: 10, B: 5 } }))).toBe('Necrons 10 – 5 Ultramarines');
  expect(statusLine(game('x', { round: 3, phase: 'charge' }))).toBe('Round 3 · Charge');
  expect(statusLine(game('x', { ended: true, winner: null, phase: 'ended' }))).toBe('Finished: a draw');
});

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
  expect(cards[0]).toHaveTextContent('Necrons 10 – 5 Ultramarines');
  expect(cards[0]).toHaveTextContent(/ago|just now|yesterday|\d{4}/);
  expect(cards[0]).toHaveAttribute('href', '/play/g2');
  expect(cards[1]).toHaveTextContent('Finished: Necrons won');
});

test('Delete removes the game at once and Undo brings it back with its data', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'g1', kind: 'game', ownerId: user.id, data: game('Necrons vs Ultramarines', { round: 2, vp: { A: 3, B: 1 } }) });
  page();
  const item = (await screen.findByRole('link', { name: /Necrons vs Ultramarines/ })).closest('li')!;
  await userEvent.click(within(item).getByRole('button', { name: 'Actions for Necrons vs Ultramarines' }));
  expect(screen.getByRole('menuitem', { name: 'Resume' })).toHaveAttribute('href', '/play/g1');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(await screen.findByText('No games yet.')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Game deleted');
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('link', { name: /Necrons vs Ultramarines/ })).toHaveAttribute('href', '/play/g1');
  const restored = await repo.getDoc<GameData>('g1');
  expect(restored?.deleted).toBe(false);
  expect(restored?.data.meta.title).toBe('Necrons vs Ultramarines');
  expect(restored?.data.summary.vp).toEqual({ A: 3, B: 1 });
});

test('a finished game is viewed, not resumed', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'g1', kind: 'game', ownerId: user.id, data: game('Old game', { ended: true, winner: 'A', phase: 'ended' }) });
  page();
  const item = (await screen.findByRole('link', { name: /Old game/ })).closest('li')!;
  await userEvent.click(within(item).getByRole('button', { name: 'Actions for Old game' }));
  expect(screen.getByRole('menuitem', { name: 'View' })).toHaveAttribute('href', '/play/g1');
  expect(screen.queryByRole('menuitem', { name: 'Resume' })).toBeNull();
});

test('table companion games are not listed and do not break the page', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'g1', kind: 'game', ownerId: user.id, data: game('Necrons vs Ultramarines', {}), updatedAt: 1 });
  await repo.saveDoc({ id: 't1', kind: 'game', ownerId: user.id, data: { mode: 'table', schema: 1, setup: {}, events: [] }, updatedAt: 2 });
  page();
  expect(await screen.findByRole('link', { name: /Necrons vs Ultramarines/ })).toHaveAttribute('href', '/play/g1');
  expect(screen.getAllByRole('link').filter((l) => /^\/play\/t1/.test(l.getAttribute('href') ?? ''))).toHaveLength(0);
});
