import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend } from '../auth/types';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { ToastProvider } from '../ui/toast';
import { createList, setListPublic, type ListData } from './listStore';
import { ListsPage } from './ListsPage';

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
  db = openDb(`lists-page-test-${++n}`);
  localStorage.setItem('recruit.lastUser', JSON.stringify(user));
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
  localStorage.clear();
});

const data = (name: string, summary: Partial<ListData['summary']> = {}): ListData => ({
  roster: { schema: 1, name, catalogueId: 'c', battleSize: 'strike-force', forces: [] },
  summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'strike-force', points: 0, pointsLimit: 2000, issueCount: 0, ...summary },
});

const page = () =>
  render(
    <AuthProvider backend={backend}>
      <StorageProvider db={db}>
        <MemoryRouter>
          <ToastProvider>
            <ListsPage />
          </ToastProvider>
        </MemoryRouter>
      </StorageProvider>
    </AuthProvider>,
  );

/** Three lists: a legal Incursion, a Combat Patrol with problems, and a shared Strike Force. Returns their ids. */
async function threeLists() {
  const repo = createRepository(db);
  const incursion = await createList(repo, user.id, data('Novokh Dynasty', { battleSize: 'incursion', points: 885, pointsLimit: 1000 }));
  const patrol = await createList(repo, user.id, data('Necrons Combat Patrol', { battleSize: 'combat-patrol', points: 480, pointsLimit: 500, issueCount: 2 }));
  const shared = await createList(repo, user.id, data('Shared Necrons', { points: 1995 }));
  await setListPublic(repo, shared, true);
  return { incursion, patrol, shared };
}

const card = (name: RegExp) => screen.getByRole('link', { name }).closest('li')!;
const openMenu = async (u: ReturnType<typeof userEvent.setup>, listName: string) => {
  await u.click(screen.getByRole('button', { name: `Actions for ${listName}` }));
  return screen.getByRole('menu', { name: `Actions for ${listName}` });
};

test('with no lists it invites the player to build one and offers "New list"', async () => {
  page();
  expect(await screen.findByText('No lists yet. Build your first army: it takes a couple of minutes.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Your lists' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'New list' })).toHaveAttribute('href', '/build/new');
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

test('each list is a card with its crest, name, faction, size and points, then Ready or how many to fix and when it was edited', async () => {
  const { incursion, patrol } = await threeLists();
  page();
  const legal = await screen.findByRole('link', { name: /Novokh Dynasty/ });
  expect(legal).toHaveAttribute('href', `/build/${incursion}`);
  expect(legal).toHaveTextContent('Necrons · Incursion · 885 / 1,000 pts');
  expect(legal).toHaveTextContent('Ready · Edited just now');
  expect(legal.querySelector('.faction-badge')).toHaveTextContent('NEC');
  const broken = screen.getByRole('link', { name: /Necrons Combat Patrol/ });
  expect(broken).toHaveAttribute('href', `/build/${patrol}`);
  expect(broken).toHaveTextContent('Necrons · Combat Patrol · 480 / 500 pts');
  expect(broken).toHaveTextContent('2 to fix · Edited just now');
  expect(broken).not.toHaveTextContent('Ready');
  expect(screen.getByText('3 lists')).toBeInTheDocument();
});

test('a list’s ⋯ menu offers Play, Edit, Duplicate, Rename, Export or share and Delete', async () => {
  const u = userEvent.setup();
  const { incursion } = await threeLists();
  page();
  await screen.findByRole('link', { name: /Novokh Dynasty/ });
  const menu = await openMenu(u, 'Novokh Dynasty');
  expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Play', 'Edit', 'Duplicate', 'Rename', 'Export or share', 'Delete']);
  expect(within(menu).getByRole('menuitem', { name: 'Play' })).toHaveAttribute('href', `/build/${incursion}/play`);
  expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('href', `/build/${incursion}`);
  expect(within(menu).getByRole('menuitem', { name: 'Export or share' })).toHaveAttribute('href', `/build/${incursion}?export=1`);
});

test('Delete takes the card away at once and says so; Undo brings the list back, still shared', async () => {
  const u = userEvent.setup();
  const { shared } = await threeLists();
  page();
  await screen.findByRole('link', { name: /Shared Necrons/ });
  await u.click(within(await openMenu(u, 'Shared Necrons')).getByRole('menuitem', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByRole('link', { name: /Shared Necrons/ })).not.toBeInTheDocument());
  const toast = screen.getByRole('status');
  expect(toast).toHaveTextContent('Deleted “Shared Necrons”');
  await u.click(within(toast).getByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('link', { name: /Shared Necrons/ })).toBeInTheDocument();
  const back = (await createRepository(db).getDoc<ListData>(shared))!;
  expect(back).toMatchObject({ deleted: false, isPublic: true });
});

test('Duplicate adds a "(copy)" of the list and says so', async () => {
  const u = userEvent.setup();
  await threeLists();
  page();
  await screen.findByRole('link', { name: /Necrons Combat Patrol/ });
  await u.click(within(await openMenu(u, 'Necrons Combat Patrol')).getByRole('menuitem', { name: 'Duplicate' }));
  const copy = await screen.findByRole('link', { name: /Necrons Combat Patrol \(copy\)/ });
  expect(copy).toHaveTextContent('Necrons · Combat Patrol · 480 / 500 pts');
  expect(screen.getByRole('status')).toHaveTextContent('Duplicated as “Necrons Combat Patrol (copy)”');
  expect(screen.getAllByRole('link', { name: /Necrons Combat Patrol/ })).toHaveLength(2);
});

test('Rename opens a sheet; saving updates the card', async () => {
  const u = userEvent.setup();
  const { incursion } = await threeLists();
  page();
  await screen.findByRole('link', { name: /Novokh Dynasty/ });
  await u.click(within(await openMenu(u, 'Novokh Dynasty')).getByRole('menuitem', { name: 'Rename' }));
  const sheet = screen.getByRole('dialog', { name: 'Rename list' });
  const input = within(sheet).getByRole('textbox', { name: 'List name' });
  expect(input).toHaveValue('Novokh Dynasty');
  await u.clear(input);
  await u.type(input, 'Novokh Incursion');
  await u.click(within(sheet).getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('link', { name: /Novokh Incursion/ })).toHaveAttribute('href', `/build/${incursion}`);
  expect(screen.queryByRole('dialog', { name: 'Rename list' })).not.toBeInTheDocument();
  expect((await createRepository(db).getDoc<ListData>(incursion))!.data.roster.name).toBe('Novokh Incursion');
});

test('a list can’t be renamed to nothing', async () => {
  const u = userEvent.setup();
  await threeLists();
  page();
  await screen.findByRole('link', { name: /Novokh Dynasty/ });
  await u.click(within(await openMenu(u, 'Novokh Dynasty')).getByRole('menuitem', { name: 'Rename' }));
  const sheet = screen.getByRole('dialog', { name: 'Rename list' });
  await u.clear(within(sheet).getByRole('textbox', { name: 'List name' }));
  await u.type(within(sheet).getByRole('textbox', { name: 'List name' }), '   ');
  await u.click(within(sheet).getByRole('button', { name: 'Save' }));
  expect(within(sheet).getByText('Give the list a name.')).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Rename list' })).toBeInTheDocument();
  expect(card(/Novokh Dynasty/)).toBeInTheDocument();
});

test('with six or more lists a search box finds lists by name or faction', async () => {
  const u = userEvent.setup();
  const repo = createRepository(db);
  for (const name of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) await createList(repo, user.id, data(name));
  await createList(repo, user.id, data('Waaagh', { faction: 'Orks', catalogueSlug: 'orks' }));
  page();
  const search = await screen.findByRole('searchbox', { name: 'Search your lists' });
  await u.type(search, 'orks');
  expect(screen.getAllByRole('link', { name: /pts/ }).map((l) => l.textContent)).toEqual([expect.stringContaining('Waaagh')]);
  await u.clear(search);
  await u.type(search, 'char');
  expect(screen.getAllByRole('link', { name: /pts/ })).toHaveLength(1);
  await u.clear(search);
  await u.type(search, 'tau');
  expect(screen.getByText('No lists match “tau”.')).toBeInTheDocument();
});

test('when saved lists cannot be read it says so instead of "Loading…"', async () => {
  vi.spyOn(db.docs, 'where').mockImplementation(() => {
    throw new Error('disk on fire');
  });
  page();
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t read your saved lists/i);
  expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
});
