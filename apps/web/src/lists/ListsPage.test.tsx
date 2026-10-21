import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend } from '../auth/types';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { createList, type ListData } from './listStore';
import { ListsPage } from './ListsPage';

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
  db = openDb(`lists-page-test-${++n}`);
  localStorage.setItem('recruit.lastUser', JSON.stringify(user));
});
afterEach(() => {
  db.close();
  localStorage.clear();
});

const data = (name: string, summary: Partial<ListData['summary']>): ListData => ({
  roster: { schema: 1, name, catalogueId: 'c', battleSize: 'strike-force', forces: [] },
  summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'strike-force', points: 0, pointsLimit: 2000, issueCount: 0, ...summary },
});

const page = () =>
  render(
    <AuthProvider backend={backend}>
      <StorageProvider db={db}>
        <MemoryRouter>
          <ListsPage />
        </MemoryRouter>
      </StorageProvider>
    </AuthProvider>,
  );

test('with no lists it invites the player to build one and offers "New list"', async () => {
  page();
  expect(await screen.findByText('No lists yet. Build your first army: it takes a couple of minutes.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'New list' })).toHaveAttribute('href', '/build/new');
});

test('each list is a card with faction, size, points, and a Legal or problems badge', async () => {
  const repo = createRepository(db);
  const legal = await createList(repo, user.id, data('Tidy Necrons', { points: 1995, issueCount: 0 }));
  const broken = await createList(repo, user.id, data('Messy Necrons', { points: 2150, issueCount: 3, battleSize: 'incursion', pointsLimit: 1000 }));
  const oneProblem = await createList(repo, user.id, data('Nearly', { points: 480, issueCount: 1, battleSize: 'combat-patrol', pointsLimit: 500 }));
  page();
  const card = (await screen.findByRole('link', { name: /Tidy Necrons/ })) as HTMLElement;
  expect(card).toHaveAttribute('href', `/build/${legal}`);
  expect(card).toHaveTextContent('Necrons · Strike Force');
  expect(card).toHaveTextContent('1995 / 2000 pts');
  expect(card).toHaveTextContent('Legal');
  const messy = screen.getByRole('link', { name: /Messy Necrons/ });
  expect(messy).toHaveAttribute('href', `/build/${broken}`);
  expect(messy).toHaveTextContent('Necrons · Incursion');
  expect(messy).toHaveTextContent('2150 / 1000 pts');
  expect(messy).toHaveTextContent('3 problems');
  expect(messy).not.toHaveTextContent('Legal');
  expect(screen.getByRole('link', { name: /Nearly/ })).toHaveAttribute('href', `/build/${oneProblem}`);
  expect(screen.getByRole('link', { name: /Nearly/ })).toHaveTextContent('1 problem');
  expect(screen.queryByText(/No lists yet/)).not.toBeInTheDocument();
});
