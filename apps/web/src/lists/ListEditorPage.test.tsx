import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addUnit, availableUnits, FORCE, removeSelection, type BattleSizeId, type Roster } from '@recruit/data/roster';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getIndex, getPolicy, getRosterScope, resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { ListEditorPage } from './ListEditorPage';
import { createList, type ListData } from './listStore';
import { listData, startingRoster } from './newListSetup';
import { stubGeneratedData } from './__fixtures__/generatedData';

const NECRONS = '61c6-c8c5-a304-ff5f';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`editor-page-test-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
  db.close();
});

/** Saves a Necrons list (Arks of Omen Detachment at Strike Force/Incursion, else a Patrol) after `edit`, and returns its id. */
async function necronsList(size: BattleSizeId = 'strike-force', edit: (r: Roster, add: (r: Roster, name: string) => Roster) => Roster = (r) => r) {
  const [scope, policy, index] = await Promise.all([getRosterScope(['necrons']), getPolicy(), getIndex()]);
  const forceId = size === 'strike-force' || size === 'incursion' ? FORCE.arksOfOmen : FORCE.patrol;
  const start = startingRoster(scope, { name: 'Necrons Strike Force', catalogueId: NECRONS, sizeId: size, forceId });
  const units = availableUnits(scope, start, start.forces[0].id);
  const add = (r: Roster, name: string) => addUnit(scope, r, r.forces[0].id, units.find((u) => u.name === name)!.entryId).roster;
  const roster = edit(start, add);
  return createList(createRepository(db), 'user-1', listData(scope, policy, roster, index.catalogues.find((c) => c.id === NECRONS)!));
}

function renderEditor(id: string) {
  return render(
    <StorageProvider db={db}>
      <MemoryRouter initialEntries={[`/build/${id}`]}>
        <Routes>
          <Route path="/build/:id" element={<ListEditorPage />} />
          <Route path="/factions/:slug/units/:unitSlug" element={<p>Datasheet page</p>} />
        </Routes>
      </MemoryRouter>
    </StorageProvider>,
  );
}

const user = () => userEvent.setup();
const opened = () => screen.findByRole('textbox', { name: 'List name' }, { timeout: 5000 });
const points = () => screen.getByRole('meter', { name: 'Points' });

test('adding Necron Warriors from the picker updates the header and opens the unit', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  expect(points()).toHaveTextContent('0 / 2,000 pts');
  expect(points()).toHaveAttribute('aria-invalid', 'false');
  await u.click(screen.getByRole('button', { name: '+ Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.type(within(picker).getByRole('searchbox', { name: 'Search units' }), 'warr');
  await u.click(within(picker).getByRole('button', { name: /^Necron Warriors/ }));

  expect(points()).toHaveTextContent('110 / 2,000 pts');
  const editor = await screen.findByRole('dialog', { name: 'Necron Warriors' });
  expect(within(editor).getByRole('link', { name: 'View datasheet' })).toHaveAttribute('href', '/factions/necrons/units/necron-warriors');
  expect(screen.queryByRole('dialog', { name: 'Add a unit' })).not.toBeInTheDocument();
});

test('the picker shows Legends and Forge World badges', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: '+ Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  expect(within(picker).getByRole('button', { name: /^Canoptek Tomb Sentinel/ })).toHaveTextContent('Forge World');
  const walls = within(picker).getByRole('button', { name: /^Tomb Citadel Walls/ });
  expect(walls).toHaveTextContent('Legends');
  expect(walls).not.toHaveTextContent('[Legends]');
  expect(within(picker).getByRole('button', { name: /^Necron Warriors/ })).not.toHaveTextContent(/Legends|Forge World/);
});

test('the issues button shows the count; the HQ fix lets the player pick an HQ and adds it', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: '3 problems' }));
  const panel = await screen.findByRole('dialog', { name: 'Problems' });
  const hq = within(panel).getByText(/needs 1 more HQ unit/).closest('li')!;
  await u.click(within(hq).getByRole('button', { name: 'Add an HQ unit' }));

  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  const rows = within(picker).getAllByRole('button', { name: / pts$/ });
  expect(rows.map((r) => r.textContent)).toEqual([expect.stringMatching(/^Lord/), expect.stringMatching(/^Plasmancer/), expect.stringMatching(/^Psychomancer/)]);
  await u.click(within(picker).getByRole('button', { name: /^Lord/ }));

  expect(await screen.findByRole('dialog', { name: 'Lord' })).toBeInTheDocument();
  expect(points()).toHaveTextContent('65 / 2,000 pts');
  // The HQ slot is filled; the Lord now has to be made the Warlord.
  await u.click(screen.getByRole('button', { name: 'Done' }));
  await u.click(screen.getByRole('button', { name: '3 problems' }));
  const after = await screen.findByRole('dialog', { name: 'Problems' });
  expect(within(after).queryByText(/needs 1 more HQ unit/)).not.toBeInTheDocument();
  expect(within(after).getByRole('button', { name: 'Open Lord' })).toBeInTheDocument();
});

test('the model stepper stops at the unit maximum of 20', async () => {
  const u = user();
  renderEditor(await necronsList('strike-force', (r, add) => add(r, 'Necron Warriors')));
  await opened();
  await u.click(screen.getByRole('button', { name: /^Necron Warriors/ }));
  const editor = await screen.findByRole('dialog', { name: 'Necron Warriors' });
  const plus = within(editor).getByRole('button', { name: 'Add one Necron Warrior (Gauss Flayer)' });
  const minus = within(editor).getByRole('button', { name: 'Remove one Necron Warrior (Gauss Flayer)' });
  expect(minus).toBeDisabled(); // 10 is the minimum
  for (let i = 0; i < 10; i++) await u.click(plus);
  expect(plus).toBeDisabled();
  expect(minus).toBeEnabled();
  expect(points()).toHaveTextContent('220 / 2,000 pts');
  expect(within(editor).getByText('20 models')).toBeInTheDocument();
});

test('Duplicate unit adds a copy; Remove unit closes the editor and takes the unit out', async () => {
  const u = user();
  renderEditor(await necronsList('strike-force', (r, add) => add(r, 'Necron Warriors')));
  await opened();
  await u.click(screen.getByRole('button', { name: /^Necron Warriors/ }));
  let editor = await screen.findByRole('dialog', { name: 'Necron Warriors' });
  await u.click(within(editor).getByRole('button', { name: 'Duplicate unit' }));
  expect(points()).toHaveTextContent('220 / 2,000 pts');
  expect(screen.getAllByRole('button', { name: /^Necron Warriors/ })).toHaveLength(2);
  await u.click(within(editor).getByRole('button', { name: 'Remove unit' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Necron Warriors' })).not.toBeInTheDocument());
  expect(points()).toHaveTextContent('110 / 2,000 pts');
  expect(screen.getAllByRole('button', { name: /^Necron Warriors/ })).toHaveLength(1);
  // Still on the list, and units still open.
  await u.click(screen.getByRole('button', { name: /^Necron Warriors/ }));
  editor = await screen.findByRole('dialog', { name: 'Necron Warriors' });
  expect(editor).toBeInTheDocument();
});

test('an over-limit list shows the points bar as invalid', async () => {
  const id = await necronsList('combat-patrol', (r, add) => [1, 2, 3, 4, 5].reduce((out) => add(out, 'Necron Warriors'), r));
  renderEditor(id);
  await opened();
  expect(points()).toHaveTextContent('550 / 500 pts');
  expect(points()).toHaveAttribute('aria-invalid', 'true');
});

test('a missing army choice is added straight from its fix, then picked in Army options', async () => {
  const u = user();
  const id = await necronsList('strike-force', (r) => {
    const dynasty = r.forces[0].selections.find((s) => s.entryId === 'fb30-1514-c892-86b5')!;
    return removeSelection(r, dynasty.id);
  });
  renderEditor(id);
  await opened();
  expect(within(screen.getByRole('group', { name: 'Dynasty Choice' })).getByText(/Pick one/)).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: /problems$/ }));
  await u.click(await screen.findByRole('button', { name: 'Choose Dynasty Choice' }));
  const dynasty = await screen.findByRole('group', { name: 'Dynasty Choice' });
  expect(within(dynasty).getByText(/Pick one/)).toBeInTheDocument();
  await u.click(within(dynasty).getByRole('radio', { name: 'Dynasty: Szarekhan' }));
  expect(within(dynasty).getByRole('radio', { name: 'Dynasty: Szarekhan' })).toBeChecked();
  expect(within(dynasty).queryByText(/Pick one/)).not.toBeInTheDocument();
});

test('an item the rules data no longer has is shown with a Remove button', async () => {
  const u = user();
  const id = await necronsList('strike-force', (r) => ({
    ...r,
    forces: [{ ...r.forces[0], selections: [...r.forces[0].selections, { id: 'gone-1', entryId: 'no-such-entry', count: 1, children: [] }] }],
  }));
  renderEditor(id);
  await opened();
  const row = screen.getByText('Unknown item').closest('li')!;
  await u.click(within(row).getByRole('button', { name: 'Remove' }));
  expect(screen.queryByText('Unknown item')).not.toBeInTheDocument();
  await waitFor(async () => {
    const doc = await createRepository(db).getDoc<ListData>(id);
    expect(doc!.data.roster.forces[0].selections.some((s) => s.id === 'gone-1')).toBe(false);
  });
});

test('a list that does not exist says so', async () => {
  renderEditor('00000000-0000-4000-8000-000000000001');
  expect(await screen.findByText(/couldn.t find this list/i)).toBeInTheDocument();
});
