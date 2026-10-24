import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend } from '../auth/types';
import { resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { WordingProvider } from '../rules/wording';
import { createList } from './listStore';
import type { ListData } from './listStore';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { NewListPage } from './NewListPage';

// Ids in the BSData v9.8.0 files.
const STRIKE_FORCE_CHOICE = '09f9-b586-8d63-7635';
const COMBAT_PATROL_CHOICE = 'af70-08c1-1c6f-0770';
const DYNASTY_SZAREKHAN = '50c2-b873-8275-3ac6';
const COMPULSORY_ELITES = '1124-19b7-b2cd-170c';

const user = { id: 'user-1', email: 'a@b.c' };
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

function Editor() {
  return <p>Editing list {useParams().id}</p>;
}

function renderWizard() {
  localStorage.setItem('recruit.lastUser', JSON.stringify(user));
  return render(
    <AuthProvider backend={backend}>
      <StorageProvider db={db}>
        <WordingProvider initial="plain">
          <MemoryRouter initialEntries={['/build/new']}>
            <Routes>
              <Route path="/build/new" element={<NewListPage />} />
              <Route path="/build/:id" element={<Editor />} />
            </Routes>
          </MemoryRouter>
        </WordingProvider>
      </StorageProvider>
    </AuthProvider>,
  );
}

const click = async (name: string | RegExp, role: 'button' | 'radio' = 'button') => userEvent.click(await screen.findByRole(role, { name }));
const next = () => click('Next');

async function savedList() {
  const docs = await createRepository(db).listDocs<ListData>('list', user.id);
  expect(docs).toHaveLength(1);
  return docs[0];
}
const allSels = (data: ListData) => data.roster.forces.flatMap((f) => f.selections.flatMap(function walk(s): { entryId: string }[] {
  return [s, ...s.children.flatMap(walk)];
}));

beforeEach(() => {
  db = openDb(`wizard-test-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  localStorage.clear();
  vi.unstubAllGlobals();
  resetDataCache();
});

test('Necrons -> Strike Force -> Arks of Omen Detachment -> Szarekhan -> Create saves the list and opens it', async () => {
  renderWizard();
  expect(await screen.findByText('Step 1 of 4: Faction')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'New list' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  await click(/^Necrons/);
  await next();

  expect(screen.getByText('Step 2 of 4: Battle size')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Combat Patrol/ })).toHaveTextContent('500 points. Small and quick to play: the best way to learn.');
  expect(screen.getByRole('button', { name: /Combat Patrol/ })).toHaveTextContent('Recommended for your first games');
  expect(screen.getByRole('button', { name: /Incursion/ })).toHaveTextContent('1,000 points. Arks of Omen rules: one main detachment.');
  expect(screen.getByRole('button', { name: /Incursion/ })).not.toHaveTextContent('Recommended');
  expect(screen.getByRole('button', { name: /Strike Force/ })).toHaveTextContent('2,000 points. The usual size for most games and events. Arks of Omen rules.');
  expect(screen.getByRole('button', { name: /Onslaught/ })).toHaveTextContent('3,000 pts');
  expect(screen.getByRole('button', { name: /Onslaught/ })).toHaveTextContent('3,000 points. Very large games. Core Book rules: up to 4 detachments.');
  await click(/Strike Force/);
  await next();

  expect(await screen.findByText('Step 3 of 4: Detachment')).toBeInTheDocument();
  const detachment = await screen.findByRole('button', { name: /Arks of Omen Detachment/ });
  expect(screen.getAllByRole('button', { name: /Detachment/ })).toHaveLength(1);
  await userEvent.click(detachment);
  await next();

  expect(await screen.findByText('Step 4 of 4: Army options')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Szarekhan' })).not.toBeChecked();
  expect(screen.getByText('Army of Renown')).toBeInTheDocument();
  // The engine sets these from the choices in steps 1-3.
  expect(screen.queryByText('Game Type')).not.toBeInTheDocument();
  expect(screen.queryByText('Battle Size')).not.toBeInTheDocument();
  expect(screen.getByLabelText('List name')).toHaveValue('Necrons Strike Force');
  await click('Szarekhan', 'radio');
  await click('Create list');

  const editing = await screen.findByText(/^Editing list /);
  const doc = await savedList();
  expect(editing).toHaveTextContent(doc.id);
  expect(doc.kind).toBe('list');
  expect(doc.ownerId).toBe(user.id);
  expect(doc.data.roster).toMatchObject({ name: 'Necrons Strike Force', battleSize: 'strike-force' });
  const entries = allSels(doc.data).map((s) => s.entryId);
  expect(entries).toContain(STRIKE_FORCE_CHOICE);
  expect(entries).toContain(DYNASTY_SZAREKHAN);
  expect(doc.data.summary).toMatchObject({ catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'strike-force', pointsLimit: 2000, points: 0 });
  expect(doc.data.summary.issueCount).toBeGreaterThan(0); // an empty list still needs an HQ and Troops
});

test('Combat Patrol offers Core Book detachments with their slot summary, and "Decide later" creates the list without army options', async () => {
  renderWizard();
  await screen.findByText('Step 1 of 4: Faction');
  await click(/^Necrons/);
  await next();
  await click(/Combat Patrol/);
  await next();

  const patrol = await screen.findByRole('button', { name: /^Patrol Detachment/ });
  expect(patrol).toHaveTextContent('1–2 HQ · 1–3 Troops');
  expect(patrol).not.toHaveTextContent('CP');
  expect(screen.queryByRole('button', { name: /Arks of Omen/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Unbound|Boarding Patrol/ })).not.toBeInTheDocument();
  await userEvent.click(patrol);
  await next();

  expect(await screen.findByText('Step 4 of 4: Army options')).toBeInTheDocument();
  expect(screen.queryByText(/Compulsory/)).not.toBeInTheDocument(); // only at Arks of Omen sizes
  await click('Decide later');

  await screen.findByText(/^Editing list /);
  const doc = await savedList();
  const entries = allSels(doc.data).map((s) => s.entryId);
  expect(entries).toContain(COMBAT_PATROL_CHOICE);
  expect(entries).not.toContain(DYNASTY_SZAREKHAN);
  expect(doc.data.roster.name).toBe('Necrons Combat Patrol');
  expect(doc.data.summary.pointsLimit).toBe(500);
});

test('Arks of Omen sizes offer the compulsory unit type, Back keeps earlier choices, and a renamed list keeps its name', async () => {
  renderWizard();
  await screen.findByText('Step 1 of 4: Faction');
  await click(/^Necrons/);
  await next();
  await click(/Incursion/);
  await next();
  await userEvent.click(await screen.findByRole('button', { name: /Arks of Omen Detachment/ }));
  await next();

  await screen.findByText('Step 4 of 4: Army options');
  const compulsory = screen.getByRole('group', { name: /Arks of Omen Compulsory Type/ });
  expect(within(compulsory).getByRole('radio', { name: 'Troops' })).toBeChecked();
  // The data picks Troops by default; it says so.
  expect(within(compulsory).getByRole('radio', { name: 'Troops' })).toHaveAccessibleDescription('(set by your choices)');
  await userEvent.click(within(compulsory).getByRole('radio', { name: 'Elites' }));
  await userEvent.clear(screen.getByLabelText('List name'));
  await userEvent.type(screen.getByLabelText('List name'), 'My Necrons');

  await click('Back');
  expect(screen.getByRole('button', { name: /Arks of Omen Detachment/ })).toHaveAttribute('aria-pressed', 'true');
  await click('Back');
  expect(screen.getByRole('button', { name: /Incursion/ })).toHaveAttribute('aria-pressed', 'true');
  await next();
  await next();
  await screen.findByText('Step 4 of 4: Army options');
  await click('Create list');

  await screen.findByText(/^Editing list /);
  const doc = await savedList();
  expect(doc.data.roster.name).toBe('My Necrons');
  expect(allSels(doc.data).map((s) => s.entryId)).toContain(COMPULSORY_ELITES);
  expect(doc.data.summary.pointsLimit).toBe(1000);
});

test('shows a readable message when the faction data cannot be loaded', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
  renderWizard();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Couldn’t load factions/));
});

/** Steps 1 to 3 with these picks, ending on Army options. */
async function toArmyOptions(size: RegExp, detachment: RegExp) {
  await screen.findByText('Step 1 of 4: Faction');
  await click(/^Necrons/);
  await next();
  await click(size);
  await next();
  await userEvent.click(await screen.findByRole('button', { name: detachment }));
  await next();
  await screen.findByText('Step 4 of 4: Army options');
}

test('the dynasty step says what each dynasty does, with ⓘ for the full text', async () => {
  renderWizard();
  await toArmyOptions(/Strike Force/, /Arks of Omen Detachment/);
  const novokh = await screen.findByRole('radio', { name: 'Novokh' });
  await waitFor(() => expect(novokh).toHaveAccessibleDescription('Official wording Add 1 to the charge rolls made for units with this code.'));
  expect(novokh).not.toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'About Novokh' }));
  expect(screen.getByRole('dialog', { name: 'Novokh' })).toHaveTextContent('Awakened By Murder');
});

test('an Army of Renown can be picked and put back to None', async () => {
  renderWizard();
  await toArmyOptions(/Strike Force/, /Arks of Omen Detachment/);
  const renown = screen.getByRole('group', { name: 'Army of Renown' });
  expect(within(renown).getByRole('radio', { name: 'None' })).toBeChecked();
  await userEvent.click(within(renown).getByRole('radio', { name: 'Annihilation Legion' }));
  expect(within(renown).getByRole('radio', { name: 'Annihilation Legion' })).toBeChecked();
  await userEvent.click(within(renown).getByRole('radio', { name: 'None' }));
  expect(within(renown).getByRole('radio', { name: 'None' })).toBeChecked();
  await click('Create list');
  await screen.findByText(/^Editing list /);
  const doc = await savedList();
  expect(doc.data.roster.forces[0].selections.some((s) => s.entryId === 'c0b7-6702-4877-f369')).toBe(false);
});

test('"Decide later" keeps the picks already made', async () => {
  renderWizard();
  await toArmyOptions(/Strike Force/, /Arks of Omen Detachment/);
  await click('Szarekhan', 'radio');
  await click('Decide later');
  await screen.findByText(/^Editing list /);
  expect(allSels((await savedList()).data).map((s) => s.entryId)).toContain(DYNASTY_SZAREKHAN);
});

test('a second Necrons Combat Patrol gets a numbered name', async () => {
  localStorage.setItem('recruit.lastUser', JSON.stringify(user));
  const first = await createList(createRepository(db), user.id, {
    roster: { schema: 1, name: 'Necrons Combat Patrol', catalogueId: 'c', battleSize: 'combat-patrol', forces: [] },
    summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'combat-patrol', points: 0, pointsLimit: 500, issueCount: 0 },
  });
  renderWizard();
  await toArmyOptions(/Combat Patrol/, /^Patrol Detachment/);
  await waitFor(() => expect(screen.getByLabelText('List name')).toHaveValue('Necrons Combat Patrol 2'));
  await click('Create list');
  await screen.findByText(/^Editing list /);
  const docs = await createRepository(db).listDocs<ListData>('list', user.id);
  expect(docs.find((d) => d.id !== first)!.data.roster.name).toBe('Necrons Combat Patrol 2');
});
