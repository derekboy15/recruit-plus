import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fakeAuthBackend } from '../auth/__fixtures__/fakeBackend';
import { AuthProvider } from '../auth/AuthContext';
import type { User } from '../auth/types';
import { resetDataCache } from '../factions/dataClient';
import { WordingProvider } from '../rules/wording';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { necronsListData } from './__fixtures__/necronsList';
import type { ListData } from './listStore';
import { createLocalPublicSource, PublicSourceContext, type PublicListSource } from './publicSource';
import { SharePage } from './SharePage';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`share-page-test-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetDataCache();
  localStorage.clear();
  db.close();
});

function EditorStub() {
  const { id } = useParams();
  return <p>{`Editor ${id}`}</p>;
}

/** The share page inside the providers the app gives it: signed out unless `user` is given. */
function renderShare(id: string, opts: { source?: PublicListSource; user?: User } = {}) {
  const { source = createLocalPublicSource(db), user } = opts;
  return render(
    <AuthProvider backend={fakeAuthBackend(user ? { getUser: async () => user } : {})}>
      <StorageProvider db={db}>
        <PublicSourceContext.Provider value={{ source, linksWorkAnywhere: true }}>
          <WordingProvider initial="plain">
            <MemoryRouter initialEntries={[`/share/${id}`]}>
              <Routes>
                <Route path="/share/:id" element={<SharePage />} />
                <Route path="/build/:id" element={<EditorStub />} />
                <Route path="/" element={<p>Home page</p>} />
              </Routes>
            </MemoryRouter>
          </WordingProvider>
        </PublicSourceContext.Provider>
      </StorageProvider>
    </AuthProvider>,
  );
}

const withWarriors = () => necronsListData((r, add) => add(r, 'Necron Warriors'));
const save = async (id: string, data: ListData, isPublic: boolean) =>
  createRepository(db).saveDoc({ id, kind: 'list', ownerId: 'owner-1', data, isPublic });

test('a public list opens for a signed-out visitor with its name, faction, size, totals and units', async () => {
  const data = await withWarriors();
  data.roster = { ...data.roster, name: 'My Shared Necrons' };
  await save('pub-1', data, true);
  renderShare('pub-1');

  expect(await screen.findByRole('heading', { level: 1, name: 'My Shared Necrons' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText(/Necrons · Strike Force/)).toBeInTheDocument();
  expect(screen.getByText(/110 \/ 2,000 pts/)).toBeInTheDocument();
  expect(screen.getByText(/\d+ PL · -?\d+ CP/)).toBeInTheDocument();
  expect(screen.getByText(/problems?$/)).toBeInTheDocument();
  const troops = screen.getByRole('heading', { name: 'Troops' }).parentElement!;
  const card = within(troops).getByRole('button', { name: /^Necron Warriors/ });
  expect(card).toHaveTextContent('· 10');
  expect(card).toHaveTextContent('10x Gauss Flayer');
  expect(card).toHaveTextContent('110 pts');
  // Read-only: no inputs, no editing controls.
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /remove|add unit/i })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build your own' })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('button', { name: 'Save to my lists' })).not.toBeInTheDocument();
});

test('a shared list is the read-only army view: tap a unit for its datasheet', async () => {
  const u = userEvent.setup();
  await save('pub-3', await withWarriors(), true);
  renderShare('pub-3');
  const card = await screen.findByRole('button', { name: /^Necron Warriors/ }, { timeout: 5000 });
  expect(card).toHaveTextContent('10x Gauss Flayer');
  await u.click(card);
  expect(screen.getByRole('dialog', { name: 'Necron Warriors' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
});

test('signed in: Save to my lists copies it into your lists and opens it', async () => {
  const u = userEvent.setup();
  await save('pub-4', await withWarriors(), true);
  renderShare('pub-4', { user: { id: 'viewer-1', email: null } });
  await u.click(await screen.findByRole('button', { name: 'Save to my lists' }, { timeout: 5000 }));
  const mine = await createRepository(db).listDocs<ListData>('list', 'viewer-1');
  expect(mine).toHaveLength(1);
  expect(mine[0].data.roster.name).toBe('Necrons Strike Force');
  expect(mine[0].isPublic).toBe(false);
  expect(await screen.findByText(`Editor ${mine[0].id}`)).toBeInTheDocument(); // the /build/:id stub route
  expect(screen.queryByRole('link', { name: 'Build your own' })).not.toBeInTheDocument();
});

test('Save to my lists says so when the list can’t be saved', async () => {
  const u = userEvent.setup();
  await save('pub-6', await withWarriors(), true);
  renderShare('pub-6', { user: { id: 'viewer-1', email: null } });
  const button = await screen.findByRole('button', { name: 'Save to my lists' }, { timeout: 5000 });
  vi.spyOn(db.docs, 'put').mockRejectedValue(new Error('disk full'));
  await u.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save this list: disk full');
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
});

test('Copy list copies the same text the export gives', async () => {
  const u = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await save('pub-2', await withWarriors(), true);
  renderShare('pub-2');
  await u.click(await screen.findByRole('button', { name: 'Copy list' }, { timeout: 5000 }));
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls[0][0]).toMatch(/^Necrons Strike Force\nNecrons · Strike Force · 110 \/ 2,000 pts/);
  expect(writeText.mock.calls[0][0]).toContain('Necron Warriors');
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
});

test('a private list says it is not shared', async () => {
  await save('priv-1', await withWarriors(), false);
  renderShare('priv-1');
  expect(await screen.findByText("This list isn't shared, or the link is wrong.")).toBeInTheDocument();
  expect(screen.queryByText(/Necron Warriors/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build your own' })).toBeInTheDocument();
});

test('a link with no such list says the same', async () => {
  renderShare('nothing-here');
  expect(await screen.findByText("This list isn't shared, or the link is wrong.")).toBeInTheDocument();
});

test('an item the rules data no longer has shows as "Unknown item" and the rest of the list still shows', async () => {
  const u = userEvent.setup();
  const data = await withWarriors();
  const [force] = data.roster.forces;
  data.roster = {
    ...data.roster,
    forces: [{ ...force, selections: [...force.selections, { id: 'gone-1', entryId: 'no-such-entry', count: 1, children: [] }] }],
  };
  await save('pub-3', data, true);
  renderShare('pub-3');
  await u.click(await screen.findByRole('button', { name: /^Unknown item/ }, { timeout: 5000 }));
  expect(within(screen.getByRole('dialog', { name: 'Unknown item' })).getByText('This unit has no datasheet in the rules data.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Necron Warriors/ })).toBeInTheDocument();
});

test('a server error is reported instead of loading forever', async () => {
  renderShare('x', { source: { get: async () => Promise.reject(new Error('offline')) } });
  expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t open this list/);
});

test('a list saved with no name opens as "Untitled list" and its units still show their own names', async () => {
  const data = await withWarriors();
  data.roster = { ...data.roster, name: '' };
  await save('pub-4', data, true);
  renderShare('pub-4');
  expect(await screen.findByRole('heading', { level: 1, name: 'Untitled list' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Necron Warriors/ })).toHaveTextContent('10x Gauss Flayer');
  expect(screen.queryByText(/^==/)).not.toBeInTheDocument();
});

test('a shared row that is not a proper list shows the not-found message instead of crashing', async () => {
  const good = await withWarriors();
  const repo = createRepository(db);
  const bad = [
    { roster: { name: 'x' }, summary: good.summary },
    { roster: { ...good.roster, forces: 'nope' }, summary: good.summary },
    { roster: { ...good.roster, catalogueId: 7 }, summary: good.summary },
    { roster: good.roster },
  ];
  for (const [i, data] of bad.entries()) {
    await repo.saveDoc({ id: `bad-${i}`, kind: 'list', ownerId: 'owner-1', data: data as never, isPublic: true });
    const view = renderShare(`bad-${i}`);
    expect(await screen.findByText("This list isn't shared, or the link is wrong.")).toBeInTheDocument();
    view.unmount();
  }
});

test('when the clipboard is blocked the button says so', async () => {
  const u = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  await save('pub-5', await withWarriors(), true);
  renderShare('pub-5');
  await u.click(await screen.findByRole('button', { name: 'Copy list' }, { timeout: 5000 }));
  expect(await screen.findByRole('button', { name: 'Couldn’t copy on this device' })).toBeInTheDocument();
});
