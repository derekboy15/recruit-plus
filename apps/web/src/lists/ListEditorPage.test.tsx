import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addUnit, armyOptions, availableUnits, evaluate, FORCE, removeSelection, setBattleSize, type BattleSizeId, type Roster } from '@recruit/data/roster';
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

function renderEditor(id: string, search = '') {
  return render(
    <StorageProvider db={db}>
      <MemoryRouter initialEntries={[`/build/${id}${search}`]}>
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

test('"−" never drops a customised model: it takes from a stack of identical models, else each model has Remove', async () => {
  const u = user();
  renderEditor(await necronsList('strike-force', (r, add) => add(r, 'Tomb Blades')));
  await opened();
  await u.click(screen.getByRole('button', { name: /^Tomb Blades/ }));
  const editor = await screen.findByRole('dialog', { name: 'Tomb Blades' });
  const plus = within(editor).getByRole('button', { name: 'Add one Tomb Blade' });
  const minus = within(editor).getByRole('button', { name: 'Remove one Tomb Blade' });
  await u.click(plus);
  await u.click(plus); // 5 identical models
  for (let i = 0; i < 3; i++) await u.click(within(editor).getAllByRole('button', { name: 'Customise one model' })[0]);
  expect(within(editor).getByText('Tomb Blade ×2')).toBeInTheDocument();
  expect(within(editor).getAllByRole('button', { name: 'Remove this Tomb Blade' })).toHaveLength(3);

  await u.click(minus); // from the stack of 2, not a customised one
  expect(within(editor).queryByText('Tomb Blade ×2')).not.toBeInTheDocument();
  expect(within(editor).getAllByRole('button', { name: 'Remove this Tomb Blade' })).toHaveLength(4);
  expect(within(editor).getByText('4 models')).toBeInTheDocument();
  expect(minus).toBeDisabled(); // every model is now its own: remove one with its button

  await u.click(within(editor).getAllByRole('button', { name: 'Remove this Tomb Blade' })[3]);
  expect(within(editor).getByText('3 models')).toBeInTheDocument();
  expect(within(editor).queryByRole('button', { name: 'Customise one one' })).not.toBeInTheDocument();
});

test('the army keeps its own detachment while an ally remains', async () => {
  const u = user();
  renderEditor(await necronsList('onslaught'));
  await opened();
  expect(screen.queryByRole('button', { name: 'Remove detachment' })).not.toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: '+ Add detachment' }));
  await u.click(screen.getByText('Orks'));
  const orks = screen.getByText('Orks').closest('details')!;
  await u.click(within(orks).getByRole('button', { name: 'Patrol Detachment' }));
  await waitFor(() => expect(screen.getAllByRole('region', { name: 'Patrol Detachment' })).toHaveLength(2), { timeout: 15_000 });
  const [own, ally] = screen.getAllByRole('region', { name: 'Patrol Detachment' });
  expect(ally).toHaveTextContent('Orks');
  expect(within(ally).getByRole('button', { name: 'Remove detachment' })).toBeInTheDocument();
  expect(within(own).queryByRole('button', { name: 'Remove detachment' })).not.toBeInTheDocument();
}, 20_000); // loads and builds the Orks rules too

test('a fix whose suggested units can no longer be added says so', async () => {
  const id = await necronsList();
  const doc = await createRepository(db).getDoc<ListData>(id);
  render(
    <StorageProvider db={db}>
      <MemoryRouter initialEntries={[`/build/${id}?add=${doc!.data.roster.forces[0].id}&only=no-such-unit`]}>
        <Routes>
          <Route path="/build/:id" element={<ListEditorPage />} />
        </Routes>
      </MemoryRouter>
    </StorageProvider>,
  );
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' }, { timeout: 5000 });
  expect(within(picker).getByText(/None of the suggested units can be added here any more/)).toBeInTheDocument();
  expect(within(picker).queryByText(/No units match/)).not.toBeInTheDocument();
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

test('Army options leave out BattleScribe helpers such as "Use Beta Rules"', async () => {
  renderEditor(await necronsList());
  await opened();
  const options = screen.getByRole('region', { name: 'Army options' });
  expect(within(options).getByRole('checkbox', { name: 'Stratagem: Heroic Support' })).toBeInTheDocument();
  expect(within(options).queryByText('Use Beta Rules')).not.toBeInTheDocument();
});

test('a helper the list already has on stays in Army options, so it can be turned off', async () => {
  const u = user();
  const scope = await getRosterScope(['necrons']);
  const id = await necronsList('strike-force', (r) => {
    const beta = armyOptions(scope, r, r.forces[0].id).find((o) => o.name === 'Use Beta Rules')!;
    return addUnit(scope, r, r.forces[0].id, beta.entryId).roster;
  });
  renderEditor(id);
  await opened();
  const beta = within(screen.getByRole('region', { name: 'Army options' })).getByRole('checkbox', { name: 'Use Beta Rules' });
  expect(beta).toBeChecked();
  await u.click(beta);
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Use Beta Rules' })).not.toBeInTheDocument());
});

test("in a Character's own editor the Warlord hint points to the option below", async () => {
  const u = user();
  renderEditor(await necronsList('strike-force', (r, add) => add(r, 'Overlord')));
  await opened();
  await u.click(screen.getByRole('button', { name: /^Overlord/ }));
  const editor = await screen.findByRole('dialog', { name: 'Overlord' });
  expect(within(editor).getByText('Choose a Warlord. Turn on "Warlord" below.')).toBeInTheDocument();
  expect(within(editor).queryByText(/Open a Character/)).not.toBeInTheDocument();
});

/** A new Imperial Knights Strike Force list (Arks of Omen Detachment, no army options picked yet); returns its id. */
async function knightsList() {
  const [scope, policy, index] = await Promise.all([getRosterScope(['imperium-imperial-knights']), getPolicy(), getIndex()]);
  const catalogue = index.catalogues.find((c) => c.slug === 'imperium-imperial-knights')!;
  const roster = startingRoster(scope, { name: 'Knights', catalogueId: catalogue.id, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  return createList(createRepository(db), 'user-1', listData(scope, policy, roster, catalogue));
}

test('an army choice that takes two (Chivalric Oath) is a set of checkboxes, closed to a third once two are picked', async () => {
  const u = user();
  renderEditor(await knightsList());
  await opened();
  const oaths = screen.getByRole('group', { name: 'Chivalric Oath' });
  expect(within(oaths).queryAllByRole('radio')).toHaveLength(0);
  expect(within(oaths).getByText('Pick 2: your army needs this choice.')).toBeInTheDocument();
  await u.click(within(oaths).getByRole('checkbox', { name: 'Oath: Defend the Realm' }));
  await u.click(within(oaths).getByRole('checkbox', { name: 'Oath: Lay Low The Tyrants' }));
  expect(within(oaths).getByRole('checkbox', { name: 'Oath: Defend the Realm' })).toBeChecked();
  expect(within(oaths).getByRole('checkbox', { name: 'Oath: Lay Low The Tyrants' })).toBeChecked();
  expect(within(oaths).getByRole('checkbox', { name: 'Oath: Refuse No Challenge' })).toBeDisabled();
  expect(within(oaths).queryByText(/Pick 2/)).not.toBeInTheDocument();
  await u.click(within(oaths).getByRole('checkbox', { name: 'Oath: Defend the Realm' }));
  expect(within(oaths).getByRole('checkbox', { name: 'Oath: Defend the Realm' })).not.toBeChecked();
  expect(within(oaths).getByRole('checkbox', { name: 'Oath: Refuse No Challenge' })).toBeEnabled();
});

test('only the army choice that is still missing asks for a pick, not the other choices of the same option', async () => {
  const u = user();
  renderEditor(await knightsList());
  await opened();
  // Picking an allegiance reveals a second choice in the same army option: its households.
  await u.click(within(screen.getByRole('group', { name: 'Questor Allegiance' })).getByRole('radio', { name: 'Questor Imperialis' }));
  const allegiance = await screen.findByRole('group', { name: 'Questor Allegiance: Questor Allegiance Oath' });
  expect(within(allegiance).getByRole('radio', { name: 'Questor Imperialis' })).toBeChecked();
  expect(within(allegiance).queryByText(/Pick one/)).not.toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Questor Allegiance: Noble Households' })).getByText(/Pick one/)).toBeInTheDocument();
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

test('the Game Type and Battle Size the app sets open read-only', async () => {
  const scope = await getRosterScope(['necrons']);
  let gameType = '';
  const id = await necronsList('strike-force', (r) => {
    const cp = setBattleSize(scope, r, 'combat-patrol');
    gameType = evaluate(scope, cp).forces[0].selections.find((v) => v.name === 'Game Type')!.sel.id;
    return cp;
  });
  renderEditor(id, `?unit=${gameType}`);
  const editor = await screen.findByRole('dialog', { name: 'Game Type' }, { timeout: 5000 });
  expect(editor).toHaveTextContent('Set by the battle size.');
  expect(editor).toHaveTextContent('1. Eternal War');
  expect(within(editor).queryAllByRole('radio')).toEqual([]);
  expect(within(editor).queryAllByRole('checkbox')).toEqual([]);
  expect(within(editor).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
});
