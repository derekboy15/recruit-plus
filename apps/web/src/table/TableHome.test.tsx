import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository, type Repository } from '../storage/repository';
import { ToastProvider } from '../ui/toast';
import { testSetup } from './__fixtures__/setup';
import { makeEvent, type TableGameData } from './game';
import { resetMissionCache } from './missionData';
import { TableHome } from './TableHome';
import { createTableGame } from './tableStore';

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  db = openDb(`table-home-${++n}`);
  repo = createRepository(db);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  resetMissionCache();
});

const renderHome = () =>
  render(
    <TestProviders db={db} path="/table">
      <ToastProvider>
        <TableHome />
      </ToastProvider>
    </TestProviders>,
  );

test('a row is one link with the mission, the score, the status and when it was played', async () => {
  const id = await createTableGame(repo, 'user-1', testSetup());
  renderHome();
  const link = await screen.findByRole('link', { name: /Cleanse the Land/ });
  expect(link).toHaveTextContent('You 0 – 0 Opponent');
  expect(link).toHaveTextContent('Round 1');
  expect(link).toHaveTextContent(/just now/);
  expect(link).toHaveAttribute('href', `/table/${id}`);
  expect(screen.queryByText('Resume')).toBeNull(); // the old pill is gone
});

test('a long mission title truncates instead of widening the row', async () => {
  await createTableGame(repo, 'user-1', testSetup());
  renderHome();
  const link = await screen.findByRole('link', { name: /Cleanse the Land/ });
  expect(within(link).getByText('Cleanse the Land')).toHaveClass('game-row__title');
  expect(link).toHaveClass('game-row__main');
});

test('Delete removes the game and Undo brings it back', async () => {
  const u = userEvent.setup();
  const id = await createTableGame(repo, 'user-1', testSetup());
  renderHome();
  await screen.findByRole('link', { name: /Cleanse the Land/ });
  await u.click(screen.getByRole('button', { name: 'Actions for Cleanse the Land' }));
  await u.click(screen.getByRole('menuitem', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByRole('link', { name: /Cleanse the Land/ })).toBeNull());
  expect(await screen.findByRole('status')).toHaveTextContent('Game deleted');
  await u.click(screen.getByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('link', { name: /Cleanse the Land/ })).toHaveTextContent('You 0 – 0 Opponent');
  const back = (await repo.getDoc<TableGameData>(id))!;
  expect(back.deleted).toBe(false);
  expect(back.data.events).toHaveLength(1);
  expect(back.data.setup).toEqual(testSetup());
});

test('a game deleted without Undo stays gone after a reload', async () => {
  const u = userEvent.setup();
  const id = await createTableGame(repo, 'user-1', testSetup());
  const { unmount } = renderHome();
  await screen.findByRole('link', { name: /Cleanse the Land/ });
  await u.click(screen.getByRole('button', { name: 'Actions for Cleanse the Land' }));
  await u.click(screen.getByRole('menuitem', { name: 'Delete' }));
  // The toast goes (as when its 6 seconds run out): its Undo can no longer run.
  await u.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Dismiss' }));
  unmount();
  renderHome();
  expect(await screen.findByText('No games yet. Start one when you sit down to play.')).toBeVisible();
  expect((await repo.getDoc(id))!.deleted).toBe(true);
});

test('the menu offers Resume for a game in progress and View for a finished one', async () => {
  const u = userEvent.setup();
  const id = await createTableGame(repo, 'user-1', testSetup());
  renderHome();
  await screen.findByRole('link', { name: /Cleanse the Land/ });
  await u.click(screen.getByRole('button', { name: 'Actions for Cleanse the Land' }));
  expect(screen.getByRole('menuitem', { name: 'Resume' })).toHaveAttribute('href', `/table/${id}`);
  expect(screen.queryByRole('menuitem', { name: 'View' })).toBeNull();
});

test('a finished game says Finished', async () => {
  const id = crypto.randomUUID();
  const data: TableGameData = { mode: 'table', schema: 1, setup: testSetup(), events: [makeEvent({ t: 'start' }, null), makeEvent({ t: 'end', reason: 'agreed' }, null)] };
  await repo.saveDoc({ id, kind: 'game', ownerId: 'user-1', data });
  renderHome();
  const link = await screen.findByRole('link', { name: /Cleanse the Land/ });
  expect(link).toHaveTextContent('Finished');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Actions for Cleanse the Land' }));
  expect(screen.getByRole('menuitem', { name: 'View' })).toHaveAttribute('href', `/table/${id}`);
});

test('empty state', async () => {
  renderHome();
  expect(await screen.findByText('No games yet. Start one when you sit down to play.')).toBeVisible();
});

test('the header is the top-level page header with New game', async () => {
  renderHome();
  expect(await screen.findByRole('heading', { level: 1, name: 'Table companion' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'New game' })).toHaveAttribute('href', '/table/new');
  expect(screen.queryByRole('link', { name: /^Back/ })).toBeNull();
});
