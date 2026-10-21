import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { necronsListData } from './__fixtures__/necronsList';
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
  db.close();
});

/** Renders the share page with no AuthProvider at all: a visitor who has never signed in. */
function renderShare(id: string, source: PublicListSource = createLocalPublicSource(db)) {
  return render(
    <PublicSourceContext.Provider value={{ source, linksWorkAnywhere: true }}>
      <MemoryRouter initialEntries={[`/share/${id}`]}>
        <Routes>
          <Route path="/share/:id" element={<SharePage />} />
          <Route path="/" element={<p>Home page</p>} />
        </Routes>
      </MemoryRouter>
    </PublicSourceContext.Provider>,
  );
}

const withWarriors = () => necronsListData((r, add) => add(r, 'Necron Warriors'));
const save = async (id: string, data: Awaited<ReturnType<typeof withWarriors>>, isPublic: boolean) =>
  createRepository(db).saveDoc({ id, kind: 'list', ownerId: 'owner-1', data, isPublic });

test('a public list opens for a signed-out visitor with its name, faction, size, totals and units', async () => {
  const data = await withWarriors();
  data.roster = { ...data.roster, name: 'My Shared Necrons' };
  await save('pub-1', data, true);
  renderShare('pub-1');

  expect(await screen.findByRole('heading', { level: 1, name: 'My Shared Necrons' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText(/Necrons · Strike Force/)).toBeInTheDocument();
  expect(screen.getByText(/110 \/ 2,000 pts/)).toBeInTheDocument();
  expect(screen.getByText(/problems?$/)).toBeInTheDocument();
  const troops = screen.getByRole('heading', { name: 'Troops' }).parentElement!;
  expect(within(troops).getByText('Necron Warriors (10 models)')).toBeInTheDocument();
  expect(within(troops).getByText('10x Gauss Flayer')).toBeInTheDocument();
  expect(within(troops).getByText('110 pts')).toBeInTheDocument();
  // Read-only: no inputs, no editing controls.
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /remove|add unit/i })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build your own' })).toHaveAttribute('href', '/');
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
  const data = await withWarriors();
  const [force] = data.roster.forces;
  data.roster = {
    ...data.roster,
    forces: [{ ...force, selections: [...force.selections, { id: 'gone-1', entryId: 'no-such-entry', count: 1, children: [] }] }],
  };
  await save('pub-3', data, true);
  renderShare('pub-3');
  expect(await screen.findByText('Unknown item', {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText(/Necron Warriors/)).toBeInTheDocument();
});

test('a server error is reported instead of loading forever', async () => {
  renderShare('x', { get: async () => Promise.reject(new Error('offline')) });
  expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t open this list/);
});
