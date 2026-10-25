import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addChild, addForce, addUnit, armyOptions, availableUnits, childOptions, evaluate, FORCE, removeSelection, setBattleSize, type BattleSizeId, type Roster, type Scope } from '@recruit/data/roster';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getIndex, getPolicy, getRosterScope, resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { WordingProvider } from '../rules/wording';
import { ToastProvider } from '../ui/toast';
import { ListEditorPage } from './ListEditorPage';
import { createList, type ListData } from './listStore';
import { applyPicks, armyChoices, listData, startingRoster } from './newListSetup';
import { stubGeneratedData, withoutInfoPlain } from './__fixtures__/generatedData';
import { novokhPatrol, twoPatrols } from './__fixtures__/patrolList';

// These drive the whole editor over the real rules data; a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 20_000 });

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

/** Saves a list of the first catalogue in `slugs` starting with `forceId` at `size`, after `edit`; returns its id. */
async function factionList(slugs: string[], size: BattleSizeId, forceId: string, edit: (scope: Scope, r: Roster) => Roster = (_, r) => r) {
  const [scope, policy, index] = await Promise.all([getRosterScope(slugs), getPolicy(), getIndex()]);
  const catalogue = index.catalogues.find((c) => c.slug === slugs[0])!;
  const roster = edit(scope, startingRoster(scope, { name: 'Test list', catalogueId: catalogue.id, sizeId: size, forceId }));
  return createList(createRepository(db), 'user-1', listData(scope, policy, roster, catalogue));
}
const LEGION = 'imperium-legion-of-the-damned';
const addOnHow = async (slug: string) => (await getIndex()).catalogues.find((c) => c.slug === slug)!.addOn!.how;

/** The phone's Back button: one step back in the router's history. */
function BrowserBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Browser back
    </button>
  );
}

/** A legal Necrons Strike Force: an Overlord as Warlord, three Necron Warriors and the Szarekhan dynasty. Returns its id. */
async function legalList() {
  const scope = await getRosterScope(['necrons']);
  return necronsList('strike-force', (r, add) => {
    let out = add(r, 'Overlord');
    const overlord = out.forces[0].selections.at(-1)!.id;
    const warlord = childOptions(scope, out, overlord).find((o) => o.name === 'Warlord')!;
    out = addChild(scope, out, overlord, warlord.id);
    for (let i = 0; i < 3; i++) out = add(out, 'Necron Warriors');
    const dynasty = armyChoices(scope, out).find((c) => c.title === 'Dynasty Choice')!;
    return applyPicks(scope, out, [dynasty], { [dynasty.key]: dynasty.options.find((o) => o.name === 'Dynasty: Szarekhan')!.id });
  });
}

function renderEditor(id: string, search = '') {
  return render(
    <StorageProvider db={db}>
      <WordingProvider initial="plain">
        <MemoryRouter initialEntries={[`/build/${id}${search}`]}>
          <ToastProvider>
            <BrowserBack />
            <Routes>
              <Route path="/build" element={<p>Your lists page</p>} />
              <Route path="/build/:id" element={<ListEditorPage />} />
              <Route path="/build/:id/play" element={<p>Play page</p>} />
              <Route path="/factions/:slug/units/:unitSlug" element={<p>Datasheet page</p>} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      </WordingProvider>
    </StorageProvider>,
  );
}

const user = () => userEvent.setup();
const opened = () => screen.findByRole('meter', { name: 'Points' }, { timeout: 5000 });
const points = () => screen.getByRole('meter', { name: 'Points' });

test('adding Necron Warriors from the picker updates the header and opens the unit', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  expect(points()).toHaveTextContent('0 / 2,000 pts');
  expect(points()).toHaveAttribute('aria-invalid', 'false');
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.type(within(picker).getByRole('searchbox', { name: 'Search units' }), 'warr');
  await u.click(within(picker).getByRole('button', { name: 'Add Necron Warriors' }));

  expect(points()).toHaveTextContent('110 / 2,000 pts');
  const editor = await screen.findByRole('dialog', { name: 'Necron Warriors' });
  await u.click(await within(editor).findByRole('button', { name: 'View datasheet' }));
  const datasheet = (await screen.findAllByRole('dialog', { name: 'Necron Warriors' }))[1];
  expect(within(datasheet).getByRole('group', { name: 'Necron Warrior characteristics' })).toBeInTheDocument();
  await u.click(within(datasheet).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog', { name: 'Add a unit' })).not.toBeInTheDocument();
});

test('the picker shows Legends and Forge World badges', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
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
  await u.click(screen.getByRole('button', { name: '3 to fix' }));
  const panel = await screen.findByRole('dialog', { name: 'Problems' });
  const hq = within(panel).getByText(/needs 1 more HQ unit/).closest('li')!;
  await u.click(within(hq).getByRole('button', { name: 'Add an HQ unit' }));

  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  const rows = within(picker).getAllByRole('button', { name: / points$/ });
  expect(rows.map((r) => r.textContent)).toEqual([expect.stringMatching(/^Lord/), expect.stringMatching(/^Plasmancer/), expect.stringMatching(/^Psychomancer/)]);
  await u.click(within(picker).getByRole('button', { name: 'Add Lord' }));

  const lord = await screen.findByRole('dialog', { name: 'Lord' });
  expect(points()).toHaveTextContent('65 / 2,000 pts');
  // The HQ slot is filled; the Lord now has to be made the Warlord.
  await u.click(within(lord).getByRole('button', { name: 'Done' }));
  await u.click(screen.getByRole('button', { name: '3 to fix' }));
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
  const [scope, policy, index] = await Promise.all([getRosterScope(['aeldari-craftworlds']), getPolicy(), getIndex()]);
  const craftworlds = index.catalogues.find((c) => c.slug === 'aeldari-craftworlds')!;
  const roster = startingRoster(scope, { name: 'Craftworlds Onslaught', catalogueId: craftworlds.id, sizeId: 'onslaught', forceId: FORCE.patrol });
  renderEditor(await createList(createRepository(db), 'user-1', listData(scope, policy, roster, craftworlds)));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Patrol Detachment' }));
  let sheet = screen.getByRole('dialog', { name: 'Detachments' });
  expect(within(sheet).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  await u.click(within(sheet).getByRole('button', { name: 'Add detachment' }));
  await u.click(within(sheet).getByText('Harlequins'));
  const harlequins = within(sheet).getByText('Harlequins').closest('details')!;
  await u.click(within(harlequins).getByRole('button', { name: 'Patrol Detachment' }));
  await waitFor(() => expect(screen.getAllByRole('region', { name: 'Patrol Detachment' })).toHaveLength(2), { timeout: 15_000 });
  expect(screen.getAllByRole('region', { name: 'Patrol Detachment' })[1]).toHaveTextContent('Harlequins');
  sheet = screen.getByRole('dialog', { name: 'Detachments' });
  const [own, ally] = within(sheet).getAllByRole('listitem');
  expect(ally).toHaveTextContent('Harlequins');
  expect(within(ally).getByRole('button', { name: 'Remove Patrol Detachment' })).toBeInTheDocument();
  expect(within(own).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2 detachments' })).toBeInTheDocument();
  // Removing it is asked twice, and takes the ally's units with it.
  await u.click(within(ally).getByRole('button', { name: 'Remove Patrol Detachment' }));
  await u.click(within(ally).getByRole('button', { name: 'Remove it and its units' }));
  await waitFor(() => expect(screen.getAllByRole('region', { name: 'Patrol Detachment' })).toHaveLength(1));
}, 20_000); // loads and builds the Harlequins rules too

test('a Necrons army is offered no Xenos allies at Onslaught (none shares a faction keyword with it), only UNALIGNED Monsters and Gribblies', async () => {
  const u = user();
  renderEditor(await necronsList('onslaught'));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Patrol Detachment' }));
  const sheet = screen.getByRole('dialog', { name: 'Detachments' });
  await u.click(within(sheet).getByRole('button', { name: 'Add detachment' }));
  expect(within(sheet).getByRole('heading', { name: 'Allies' })).toBeInTheDocument();
  expect([...sheet.querySelectorAll('details.ally .ally__name')].map((s) => s.textContent)).toEqual(['Monsters and Gribblies']);
  expect(within(sheet).queryByText('Orks')).not.toBeInTheDocument();
});

test('a fix whose suggested units can no longer be added says so', async () => {
  const id = await necronsList();
  const doc = await createRepository(db).getDoc<ListData>(id);
  renderEditor(id, `?add=${doc!.data.roster.forces[0].id}&only=no-such-unit`);
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

test('a missing army choice is added straight from its fix, then picked from its chip', async () => {
  const u = user();
  const id = await necronsList('strike-force', (r) => {
    const dynasty = r.forces[0].selections.find((s) => s.entryId === 'fb30-1514-c892-86b5')!;
    return removeSelection(r, dynasty.id);
  });
  renderEditor(id);
  await opened();
  const chip = screen.getByRole('button', { name: 'Dynasty: choose' });
  expect(chip).toHaveClass('chip--warn');
  await u.click(screen.getByRole('button', { name: /to fix$/ }));
  await u.click(await screen.findByRole('button', { name: 'Choose Dynasty' }));
  const sheet = await screen.findByRole('dialog', { name: 'Choose: Dynasty' });
  expect(within(sheet).getByText('Pick one: your army needs this choice.')).toBeInTheDocument();
  await u.click(within(sheet).getByRole('radio', { name: 'Szarekhan' }));
  expect(within(sheet).getByRole('radio', { name: 'Szarekhan' })).toBeChecked();
  expect(within(sheet).queryByText(/Pick one/)).not.toBeInTheDocument();
  await u.click(within(sheet).getByRole('button', { name: 'Done' }));
  expect(await screen.findByRole('button', { name: 'Dynasty: Szarekhan' })).not.toHaveClass('chip--warn');
});

/** The default Necrons list with the dynasty picked. */
async function withDynasty(name: string) {
  const scope = await getRosterScope(['necrons']);
  return necronsList('strike-force', (r) => {
    const dynasty = armyChoices(scope, r).find((c) => c.title === 'Dynasty Choice')!;
    return applyPicks(scope, r, [dynasty], { [dynasty.key]: dynasty.options.find((o) => o.name === `Dynasty: ${name}`)!.id });
  });
}

test('each dynasty says what its code does; without plain English for Novokh’s code, it is labelled Official wording', async () => {
  withoutInfoPlain(stubGeneratedData(), 'necrons');
  const u = user();
  renderEditor(await withDynasty('Novokh'));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Dynasty: Novokh' }));
  const sheet = await screen.findByRole('dialog', { name: 'Choose: Dynasty' });
  const novokh = within(sheet).getByRole('radio', { name: 'Novokh' });
  expect(novokh).toBeChecked();
  await waitFor(() => expect(novokh).toHaveAccessibleDescription('Official wording Add 1 to the charge rolls made for units with this code.'));
  expect(within(sheet).getByRole('radio', { name: 'Custom dynasty' })).not.toHaveAttribute('aria-describedby');
  expect(within(sheet).queryByRole('button', { name: 'About Custom dynasty' })).not.toBeInTheDocument();
  expect(within(sheet).queryByText(/Dynasty:|<Custom>|undefined/)).not.toBeInTheDocument();

  await u.click(within(sheet).getByRole('button', { name: 'About Novokh' }));
  const about = screen.getByRole('dialog', { name: 'Novokh' });
  expect(within(about).getByText('Awakened By Murder')).toBeInTheDocument();
  await u.click(within(about).getByRole('button', { name: 'Close' }));

  await u.click(within(sheet).getByRole('radio', { name: 'Szarekhan' }));
  expect(screen.getByRole('button', { name: 'Dynasty: Szarekhan' })).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('button', { name: 'Dynasty: Novokh' })).toBeInTheDocument();
});

test('with plain English for a code, the dynasty row shows it', async () => {
  const fetchMock = stubGeneratedData();
  const real = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string) => {
    const res = await real(url);
    if (url !== '/data/info/necrons.json') return res;
    const file = (await res.json()) as { entries: Record<string, { profiles?: { name: string; plain?: Record<string, string> }[] }> };
    for (const e of Object.values(file.entries)) for (const p of e.profiles ?? []) if (p.name === 'Awakened By Murder') p.plain = { Description: '+1 to charge rolls. More after charging.' };
    return new Response(JSON.stringify(file));
  });
  const u = user();
  renderEditor(await withDynasty('Novokh'));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Dynasty: Novokh' }));
  const sheet = await screen.findByRole('dialog', { name: 'Choose: Dynasty' });
  await waitFor(() => expect(within(sheet).getByRole('radio', { name: 'Novokh' })).toHaveAccessibleDescription('+1 to charge rolls.'));
});

test('an optional army choice (Army of Renown) can be None', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'Army of Renown: None' }));
  const sheet = await screen.findByRole('dialog', { name: 'Choose: Army of Renown' });
  expect(within(sheet).getByRole('radio', { name: 'None' })).toBeChecked();
  await u.click(within(sheet).getByRole('radio', { name: 'Annihilation Legion' }));
  expect(screen.getByRole('button', { name: 'Army of Renown: Annihilation Legion' })).toBeInTheDocument();
  await u.click(within(sheet).getByRole('radio', { name: 'None' }));
  expect(screen.getByRole('button', { name: 'Army of Renown: None' })).toBeInTheDocument();
});

test('More options holds the other army options, without BattleScribe helpers such as "Use Beta Rules"', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'More options' }));
  const sheet = await screen.findByRole('dialog', { name: 'More options' });
  expect(within(sheet).getByRole('checkbox', { name: 'Heroic Support' })).not.toBeChecked();
  expect(within(sheet).queryByText('Use Beta Rules')).not.toBeInTheDocument();
  expect(within(sheet).queryByText(/Stratagem:/)).not.toBeInTheDocument();
  await u.click(within(sheet).getByRole('checkbox', { name: 'Heroic Support' }));
  expect(within(sheet).getByRole('checkbox', { name: 'Heroic Support' })).toBeChecked();
});

test('a helper the list already has on stays in More options, so it can be turned off', async () => {
  const u = user();
  const scope = await getRosterScope(['necrons']);
  const id = await necronsList('strike-force', (r) => {
    const beta = armyOptions(scope, r, r.forces[0].id).find((o) => o.name === 'Use Beta Rules')!;
    return addUnit(scope, r, r.forces[0].id, beta.entryId).roster;
  });
  renderEditor(id);
  await opened();
  await u.click(screen.getByRole('button', { name: 'More options' }));
  const sheet = await screen.findByRole('dialog', { name: 'More options' });
  const beta = within(sheet).getByRole('checkbox', { name: 'Use Beta Rules' });
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
  await u.click(screen.getByRole('button', { name: 'Chivalric Oath: choose' }));
  const oaths = await screen.findByRole('dialog', { name: 'Choose: Chivalric Oath' });
  expect(within(oaths).queryAllByRole('radio')).toHaveLength(0);
  expect(within(oaths).getByText('Pick 2: your army needs this choice.')).toBeInTheDocument();
  await u.click(within(oaths).getByRole('checkbox', { name: 'Defend the Realm' }));
  await u.click(within(oaths).getByRole('checkbox', { name: 'Lay Low The Tyrants' }));
  expect(within(oaths).getByRole('checkbox', { name: 'Defend the Realm' })).toBeChecked();
  expect(within(oaths).getByRole('checkbox', { name: 'Lay Low The Tyrants' })).toBeChecked();
  expect(within(oaths).getByRole('checkbox', { name: 'Refuse No Challenge' })).toBeDisabled();
  expect(within(oaths).queryByText(/Pick 2/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chivalric Oath: Defend the Realm, Lay Low The Tyrants' })).toBeInTheDocument();
  await u.click(within(oaths).getByRole('checkbox', { name: 'Defend the Realm' }));
  expect(within(oaths).getByRole('checkbox', { name: 'Defend the Realm' })).not.toBeChecked();
  expect(within(oaths).getByRole('checkbox', { name: 'Refuse No Challenge' })).toBeEnabled();
});

test('only the army choice that is still missing asks for a pick, not the other choices of the same option', async () => {
  const u = user();
  renderEditor(await knightsList());
  await opened();
  // Picking an allegiance reveals a second choice in the same army option: its households.
  await u.click(screen.getByRole('button', { name: 'Questor Allegiance: choose' }));
  const sheet = await screen.findByRole('dialog', { name: 'Choose: Questor Allegiance' });
  await u.click(within(sheet).getByRole('radio', { name: 'Questor Imperialis' }));
  await u.click(within(screen.getByRole('dialog', { name: /^Choose: Questor Allegiance/ })).getByRole('button', { name: 'Done' }));
  expect(await screen.findByRole('button', { name: 'Questor Allegiance Oath: Questor Imperialis' })).not.toHaveClass('chip--warn');
  expect(screen.getByRole('button', { name: 'Noble Households: choose' })).toHaveClass('chip--warn');
  await u.click(screen.getByRole('button', { name: 'Noble Households: choose' }));
  const households = await screen.findByRole('dialog', { name: 'Choose: Noble Households' });
  expect(within(households).getByText(/Pick one/)).toBeInTheDocument();
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

test('on a wide screen Problems rests beside the list as a region, not a dialog; a unit opens as a drawer over it', async () => {
  const u = user();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 768px)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  renderEditor(await necronsList('strike-force', (r, add) => add(r, 'Necron Warriors')));
  await opened();
  const problems = screen.getByRole('region', { name: 'Problems' });
  expect(within(problems).getByText(/needs 1 more HQ unit/)).toBeInTheDocument();
  expect(within(problems).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await u.click(screen.getByRole('button', { name: /^Necron Warriors/ }));
  const editor = await screen.findByRole('dialog', { name: 'Necron Warriors' });
  expect(screen.getByRole('region', { name: 'Problems' })).toBeInTheDocument();
  await u.click(within(editor).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('sheets close with their own button: the picker with Close, the unit editor with Done', async () => {
  const u = user();
  renderEditor(await necronsList('strike-force', (r, add) => add(r, 'Necron Warriors')));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.click(within(picker).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a unit' })).not.toBeInTheDocument());
  await u.click(screen.getByRole('button', { name: /^Necron Warriors/ }));
  const editor = await screen.findByRole('dialog', { name: 'Necron Warriors' });
  expect(editor).toHaveClass('sheet');
  await u.click(within(editor).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Necron Warriors' })).not.toBeInTheDocument());
});

test('the header: Back to Your lists, the list’s name and faction · size, and Play', async () => {
  const id = await necronsList('incursion');
  renderEditor(id);
  await opened();
  expect(screen.getByRole('link', { name: 'Back to Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.getByRole('heading', { level: 1, name: 'Necrons Strike Force' })).toBeInTheDocument();
  expect(screen.getByText('Necrons · Incursion')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', `/build/${id}/play`);
  expect(points()).toHaveTextContent('0 / 1,000 pts');
  expect(screen.getByText('1,000 pts left')).toBeInTheDocument();
});

test('an over-limit list says how far over it is', async () => {
  renderEditor(await necronsList('combat-patrol', (r, add) => [1, 2, 3, 4, 5].reduce((out) => add(out, 'Necron Warriors'), r)));
  await opened();
  expect(screen.getByText('50 pts over')).toBeInTheDocument();
});

test('Undo is off until something changes; then it takes the change back, and Redo puts it back', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  const undo = screen.getByRole('button', { name: 'Undo' });
  const redo = screen.getByRole('button', { name: 'Redo' });
  expect(undo).toBeDisabled();
  expect(redo).toBeDisabled();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.type(within(picker).getByRole('searchbox', { name: 'Search units' }), 'warr');
  await u.click(within(picker).getByRole('button', { name: 'Add Necron Warriors' }));
  await u.click(within(await screen.findByRole('dialog', { name: 'Necron Warriors' })).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(points()).toHaveTextContent('110 / 2,000 pts');
  expect(undo).toBeEnabled();
  await u.click(undo);
  expect(points()).toHaveTextContent('0 / 2,000 pts');
  expect(screen.queryByRole('button', { name: /^Necron Warriors/ })).not.toBeInTheDocument();
  expect(redo).toBeEnabled();
  await u.click(redo);
  expect(points()).toHaveTextContent('110 / 2,000 pts');
});

test('List actions: Delete list goes back to Your lists and offers Undo, which brings the list back', async () => {
  const u = user();
  const id = await necronsList();
  renderEditor(id);
  await opened();
  await u.click(screen.getByRole('button', { name: 'List actions' }));
  const menu = screen.getByRole('menu', { name: 'List actions' });
  expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Rename', 'Duplicate list', 'Export', 'Share link', 'Delete list']);
  await u.click(within(menu).getByRole('menuitem', { name: 'Delete list' }));
  expect(await screen.findByText('Your lists page')).toBeInTheDocument();
  const toast = screen.getByRole('status');
  expect(toast).toHaveTextContent('Deleted “Necrons Strike Force”');
  await waitFor(async () => expect((await createRepository(db).getDoc<ListData>(id))!.deleted).toBe(true));
  // The editor's own save on the way out must not bring it back.
  await new Promise((r) => setTimeout(r, 700));
  expect((await createRepository(db).getDoc<ListData>(id))!.deleted).toBe(true);
  await u.click(within(toast).getByRole('button', { name: 'Undo' }));
  await waitFor(async () => expect((await createRepository(db).getDoc<ListData>(id))!.deleted).toBe(false));
  expect((await createRepository(db).getDoc<ListData>(id))!.data.roster.name).toBe('Necrons Strike Force');
});

test('List actions: Delete list right after an edit keeps that edit for Undo, and the deletion stays', async () => {
  const u = user();
  const id = await necronsList();
  renderEditor(id);
  await opened();
  await u.click(screen.getByRole('button', { name: 'Strike Force · 2,000 pts' }));
  await u.click(within(screen.getByRole('dialog', { name: 'Battle size' })).getByRole('radio', { name: /Onslaught/ }));
  await u.click(screen.getByRole('button', { name: 'List actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'Delete list' }));
  expect(await screen.findByText('Your lists page')).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 700));
  expect((await createRepository(db).getDoc<ListData>(id))!.deleted).toBe(true);
  await u.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }));
  await waitFor(async () => expect((await createRepository(db).getDoc<ListData>(id))!.data.roster.battleSize).toBe('onslaught'));
});

test('List actions: Duplicate list saves a copy and says so', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'List actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'Duplicate list' }));
  expect(await screen.findByText('Duplicated as “Necrons Strike Force (copy)”')).toBeInTheDocument();
  const names = (await createRepository(db).listDocs<ListData>('list', 'user-1')).map((d) => d.data.roster.name);
  expect(names.sort()).toEqual(['Necrons Strike Force', 'Necrons Strike Force (copy)']);
});

test('List actions: Rename names the list in one undo step', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'List actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'Rename' }));
  const sheet = screen.getByRole('dialog', { name: 'Rename list' });
  await u.clear(within(sheet).getByRole('textbox', { name: 'List name' }));
  await u.type(within(sheet).getByRole('textbox', { name: 'List name' }), 'Tomb World');
  await u.click(within(sheet).getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Tomb World' })).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Necrons Strike Force' })).toBeInTheDocument();
});

test('the size chip opens Battle size; choosing Strike Force changes the points limit', async () => {
  const u = user();
  renderEditor(await necronsList('incursion'));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Incursion · 1,000 pts' }));
  const sheet = screen.getByRole('dialog', { name: 'Battle size' });
  expect(within(sheet).getByRole('radio', { name: /Incursion/ })).toBeChecked();
  await u.click(within(sheet).getByRole('radio', { name: /Strike Force/ }));
  expect(points()).toHaveTextContent('0 / 2,000 pts');
  expect(screen.getByRole('button', { name: 'Strike Force · 2,000 pts' })).toBeInTheDocument();
  expect(screen.getByText('Necrons · Strike Force')).toBeInTheDocument();
  // It stays open until Done, so the sizes can be looked through.
  expect(screen.getByRole('dialog', { name: 'Battle size' })).toBe(sheet);
  await u.click(within(sheet).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Battle size' })).not.toBeInTheDocument());
});

test('arrow keys move through the battle sizes without closing the sheet', async () => {
  const u = user();
  renderEditor(await necronsList('incursion'));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Incursion · 1,000 pts' }));
  const sheet = screen.getByRole('dialog', { name: 'Battle size' });
  within(sheet).getByRole('radio', { name: /Incursion/ }).focus();
  await u.keyboard('{ArrowDown}');
  expect(within(sheet).getByRole('radio', { name: /Strike Force/ })).toBeChecked();
  await u.keyboard('{ArrowDown}');
  expect(within(sheet).getByRole('radio', { name: /Onslaught/ })).toBeChecked();
  expect(screen.getByRole('dialog', { name: 'Battle size' })).toBe(sheet);
  expect(points()).toHaveTextContent('0 / 3,000 pts');
});

test('the detachment chip names the detachment and opens Detachments', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'Arks of Omen Detachment' }));
  const sheet = screen.getByRole('dialog', { name: 'Detachments' });
  expect(within(sheet).getByText('Arks of Omen Detachment')).toBeInTheDocument();
  expect(within(sheet).getByRole('button', { name: 'Add detachment' })).toBeInTheDocument();
});

test('the status chip says All checks pass for a legal list and how many to fix otherwise; it opens Problems', async () => {
  const u = user();
  const legal = await legalList();
  const broken = await necronsList();
  const first = renderEditor(legal);
  await opened();
  expect(screen.getByRole('button', { name: 'All checks pass' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /to fix$/ })).not.toBeInTheDocument();
  first.unmount();
  renderEditor(broken);
  await opened();
  await u.click(screen.getByRole('button', { name: '3 to fix' }));
  expect(await screen.findByRole('dialog', { name: 'Problems' })).toBeInTheDocument();
});

/** Saves a roster built by one of the __fixtures__/patrolList builders and returns its id. */
async function savedList(build: (scope: Awaited<ReturnType<typeof getRosterScope>>) => Roster) {
  const [scope, policy, index] = await Promise.all([getRosterScope(['necrons']), getPolicy(), getIndex()]);
  return createList(createRepository(db), 'user-1', listData(scope, policy, build(scope), index.catalogues.find((c) => c.id === NECRONS)!));
}

test('unit rows show the Warlord and its trait, and a squad’s weapons', async () => {
  renderEditor(await savedList(novokhPatrol));
  await opened();
  expect(screen.getByRole('button', { name: /^Overlord/ })).toHaveTextContent('Warlord · Blood-Fuelled Fury');
  expect(screen.getByRole('button', { name: /^Immortals/ })).toHaveTextContent('5x Gauss Blaster');
});

test('a role section collapses to its count, and stays collapsed when the list is opened again', async () => {
  const u = user();
  const id = await savedList(novokhPatrol);
  const first = renderEditor(id);
  await opened();
  const hq = screen.getByRole('button', { name: 'HQ 2 units · 160 pts' });
  expect(hq).toHaveAttribute('aria-expanded', 'true');
  await u.click(hq);
  expect(screen.getByRole('button', { name: 'HQ 2 units · 160 pts' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: /^Overlord/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Immortals/ })).toBeInTheDocument();
  first.unmount();
  renderEditor(id);
  await opened();
  expect(screen.getByRole('button', { name: 'HQ 2 units · 160 pts' })).toHaveAttribute('aria-expanded', 'false');
});

test('a role’s + opens the picker on that role', async () => {
  const u = user();
  renderEditor(await savedList(novokhPatrol));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Add an HQ unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  expect(within(picker).getByRole('button', { name: /^Overlord/ })).toBeInTheDocument();
  expect(within(picker).queryByRole('button', { name: /^Necron Warriors/ })).not.toBeInTheDocument();
});

test('Remove from a unit’s menu takes it out at once; Undo in the toast puts it back', async () => {
  const u = user();
  renderEditor(await savedList(novokhPatrol));
  await opened();
  const before = points().textContent;
  await u.click(screen.getByRole('button', { name: 'Options for Royal Warden' }));
  await u.click(screen.getByRole('menuitem', { name: 'Remove' }));
  expect(screen.queryByRole('button', { name: /^Royal Warden/ })).not.toBeInTheDocument();
  const toast = screen.getByRole('status');
  expect(toast).toHaveTextContent('Removed Royal Warden');
  await u.click(within(toast).getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('button', { name: /^Royal Warden/ })).toBeInTheDocument();
  expect(points().textContent).toBe(before);
});

test('Duplicate from a unit’s menu adds a copy; Undo in the toast takes the copy away', async () => {
  const u = user();
  renderEditor(await savedList(novokhPatrol));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Options for Immortals' }));
  await u.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(screen.getAllByRole('button', { name: /^Immortals/ })).toHaveLength(2);
  expect(screen.getByRole('status')).toHaveTextContent('Duplicated Immortals');
  await u.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }));
  expect(screen.getAllByRole('button', { name: /^Immortals/ })).toHaveLength(1);
});

test('a toast’s Undo after a later edit (made where the toast stays) does not undo that later edit', async () => {
  const u = user();
  renderEditor(await savedList(novokhPatrol));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Options for Royal Warden' }));
  await u.click(screen.getByRole('menuitem', { name: 'Remove' }));
  const toast = screen.getByRole('status');
  // A battle size change shows no toast of its own.
  await u.click(screen.getByRole('button', { name: 'Combat Patrol · 500 pts' }));
  await u.click(within(screen.getByRole('dialog', { name: 'Battle size' })).getByRole('radio', { name: /Incursion/ }));
  expect(points()).toHaveTextContent('/ 1,000 pts');
  await u.click(within(toast).getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('status')).toHaveTextContent('Can’t undo that now: the list has changed since. Use Undo at the top.');
  expect(points()).toHaveTextContent('/ 1,000 pts');
  expect(screen.queryByRole('button', { name: /^Royal Warden/ })).not.toBeInTheDocument();
});

test('with two detachments each has its own heading and sections; Add unit asks which one', async () => {
  const u = user();
  renderEditor(await savedList(twoPatrols));
  await opened();
  const [first, second] = screen.getAllByRole('region', { name: 'Patrol Detachment' });
  expect(within(first).getByRole('heading', { name: 'Patrol Detachment' })).toBeInTheDocument();
  expect(within(first).getByRole('button', { name: /^HQ/ })).toBeInTheDocument();
  expect(within(first).queryByRole('button', { name: /^Troops/ })).not.toBeInTheDocument();
  expect(within(second).getByRole('button', { name: /^Troops/ })).toBeInTheDocument();
  expect(within(second).getByRole('button', { name: /^Necron Warriors/ })).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const which = screen.getByRole('dialog', { name: 'Add to which detachment?' });
  const options = within(which).getAllByRole('button', { name: /Patrol Detachment/ });
  expect(options).toHaveLength(2);
  await u.click(options[1]);
  expect(await screen.findByRole('dialog', { name: 'Add a unit' })).toBeInTheDocument();
});

test('with one detachment there is no detachment heading, and Add unit opens the picker', async () => {
  const u = user();
  renderEditor(await savedList(novokhPatrol));
  await opened();
  expect(screen.queryByRole('heading', { name: 'Patrol Detachment' })).not.toBeInTheDocument();
  expect(screen.queryByText('+ Add unit')).not.toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  expect(await screen.findByRole('dialog', { name: 'Add a unit' })).toBeInTheDocument();
});

test('the bar beside Add unit opens Export', async () => {
  const u = user();
  renderEditor(await savedList(novokhPatrol));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Export or share this list' }));
  expect(await screen.findByRole('dialog', { name: 'Export list' })).toBeInTheDocument();
});

test('Problems puts choices to make first, then what must be fixed', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: '3 to fix' }));
  const panel = await screen.findByRole('dialog', { name: 'Problems' });
  const choices = within(panel).getByRole('region', { name: 'Choices to make' });
  const fixes = within(panel).getByRole('region', { name: 'Must fix' });
  expect(choices.compareDocumentPosition(fixes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(choices).getByRole('button', { name: 'Choose Dynasty' })).toBeInTheDocument();
  expect(within(fixes).getByText(/needs 1 more HQ unit/)).toBeInTheDocument();
  expect(within(fixes).queryByRole('button', { name: /^Choose/ })).not.toBeInTheDocument();
  expect(within(choices).getAllByRole('listitem').every((li) => li.classList.contains('issues__item--choice'))).toBe(true);
  expect(within(fixes).getAllByRole('listitem').every((li) => !li.classList.contains('issues__item--choice'))).toBe(true);
});

test('Choose Dynasty in Problems opens the dynasty sheet', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: '3 to fix' }));
  await u.click(within(await screen.findByRole('dialog', { name: 'Problems' })).getByRole('button', { name: 'Choose Dynasty' }));
  const sheet = await screen.findByRole('dialog', { name: 'Choose: Dynasty' });
  await u.click(within(sheet).getByRole('radio', { name: 'Szarekhan' }));
  expect(screen.getByRole('button', { name: 'Dynasty: Szarekhan' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2 to fix' })).toBeInTheDocument();
});

test('Back from a unit’s preview goes back to the picker, where the player was', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.type(within(picker).getByRole('searchbox', { name: 'Search units' }), 'skorp');
  await u.click(within(picker).getByRole('button', { name: /^Skorpekh Destroyers/ }));
  expect(await screen.findByRole('dialog', { name: 'Skorpekh Destroyers' })).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Skorpekh Destroyers' })).not.toBeInTheDocument());
  const still = screen.getByRole('dialog', { name: 'Add a unit' });
  expect(within(still).getByRole('searchbox', { name: 'Search units' })).toHaveValue('skorp');
  await u.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('closing a preview with its own button also goes back to the picker', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.click(within(picker).getByRole('button', { name: /^Lychguard/ }));
  const preview = await screen.findByRole('dialog', { name: 'Lychguard' });
  await u.click(within(preview).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Lychguard' })).not.toBeInTheDocument());
  expect(screen.getByRole('dialog', { name: 'Add a unit' })).toBeInTheDocument();
});

test('adding from the preview opens the unit; Done goes back to the list, as adding with + does', async () => {
  const u = user();
  renderEditor(await necronsList());
  await opened();
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.click(within(picker).getByRole('button', { name: /^Lychguard/ }));
  const preview = await screen.findByRole('dialog', { name: 'Lychguard' });
  await u.click(within(preview).getByRole('button', { name: /^Add to list · \d+ pts$/ }));
  const unit = await screen.findByRole('dialog', { name: 'Lychguard' });
  expect(within(unit).getByRole('button', { name: 'Remove unit' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Add a unit' })).not.toBeInTheDocument();
  await u.click(within(unit).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /^Lychguard/ })).toBeInTheDocument();
});

test('Delete list stays deleted even when the edit just before it could not be saved', async () => {
  const u = user();
  const id = await necronsList();
  renderEditor(id);
  await opened();
  await u.click(screen.getByRole('button', { name: 'Strike Force · 2,000 pts' }));
  await u.click(within(screen.getByRole('dialog', { name: 'Battle size' })).getByRole('radio', { name: /Onslaught/ }));
  // The save of that edit fails (say the device's storage is full).
  vi.spyOn(db.docs, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
  await u.click(screen.getByRole('button', { name: 'List actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'Delete list' }));
  expect(await screen.findByText('Your lists page')).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 900));
  expect((await createRepository(db).getDoc<ListData>(id))!.deleted).toBe(true);
});

test('a list saved with the Legion of the Damned as its army opens with a note on how to use it, and still saves edits', async () => {
  const u = user();
  const id = await factionList([LEGION], 'combat-patrol', FORCE.auxiliarySupport);
  const before = (await createRepository(db).getDoc<ListData>(id))!.data.roster.forces[0].selections.length;
  renderEditor(id);
  await opened();
  const note = screen.getByRole('note');
  expect(note).toHaveTextContent(
    `Legion of the Damned can’t be an army on its own. ${await addOnHow(LEGION)} To use it, start a list for the army it joins and add Legion of the Damned with Add detachment.`,
  );
  expect(within(note).getByRole('link', { name: 'New list' })).toHaveAttribute('href', '/build/new');
  await u.click(screen.getByRole('button', { name: 'Add unit' }));
  const picker = await screen.findByRole('dialog', { name: 'Add a unit' });
  await u.click(within(picker).getByRole('button', { name: 'Add Damned Legionnaires' }));
  await waitFor(async () => expect((await createRepository(db).getDoc<ListData>(id))!.data.roster.forces[0].selections).toHaveLength(before + 1));
});

test('Add detachment shows how an add-on force is used, under its name (Ultramarines at Onslaught)', async () => {
  const u = user();
  renderEditor(await factionList(['imperium-adeptus-astartes-ultramarines'], 'onslaught', FORCE.patrol));
  await opened();
  await u.click(screen.getByRole('button', { name: 'Patrol Detachment' }));
  const sheet = screen.getByRole('dialog', { name: 'Detachments' });
  await u.click(within(sheet).getByRole('button', { name: 'Add detachment' }));
  const legion = within(sheet).getByText('Legion of the Damned').closest('summary')!;
  expect(legion).toHaveTextContent(await addOnHow(LEGION));
  expect(within(sheet).getByText('Astra Militarum').closest('summary')!.textContent).toBe('Astra Militarum'); // an army: no note
});

test('an add-on ally kept after a change to Strike Force is a problem that names it, and isn’t deleted', async () => {
  const u = user();
  const legionId = (await getIndex()).catalogues.find((c) => c.slug === LEGION)!.id;
  const id = await factionList(['imperium-adeptus-astartes-ultramarines', LEGION], 'onslaught', FORCE.patrol, (scope, r) => addForce(scope, r, FORCE.auxiliarySupport, legionId));
  renderEditor(id);
  await opened();
  expect(screen.getByRole('button', { name: '2 detachments' })).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Onslaught · 3,000 pts' }));
  const sizes = screen.getByRole('dialog', { name: 'Battle size' });
  await u.click(within(sizes).getByRole('radio', { name: /Strike Force/ }));
  await u.click(within(sizes).getByRole('button', { name: 'Done' }));
  await u.click(await screen.findByRole('button', { name: /to fix$/ }));
  const problems = screen.getByRole('dialog', { name: 'Problems' });
  expect(within(problems).getByText(/^The Legion of the Damned Auxiliary Support Detachment isn't allowed at Strike Force\./)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2 detachments' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Auxiliary Support Detachment' })).toHaveTextContent('Legion of the Damned');
});
