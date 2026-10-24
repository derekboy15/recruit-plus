import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evaluate, FORCE, type Roster, type Scope } from '@recruit/data/roster';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getIndex, getPolicy, getRosterScope, resetDataCache } from '../factions/dataClient';
import { WordingProvider } from '../rules/wording';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { ToastProvider } from '../ui/toast';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { addNamed, NECRONS, novokhPatrol, pickOption } from './__fixtures__/patrolList';
import { ListEditorPage } from './ListEditorPage';
import { createList } from './listStore';
import { listData, startingRoster } from './newListSetup';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`unit-editor-test-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
  db.close();
});

function Where() {
  const location = useLocation();
  return <output aria-label="Path">{location.pathname}</output>;
}

/** Saves the roster `build` makes and opens the unit named `unit` in the editor. */
async function openUnit(build: (scope: Scope) => Roster, unit: string) {
  const [scope, policy, index] = await Promise.all([getRosterScope(['necrons']), getPolicy(), getIndex()]);
  const roster = build(scope);
  const id = await createList(createRepository(db), 'user-1', listData(scope, policy, roster, index.catalogues.find((c) => c.id === NECRONS)!));
  const selId = evaluate(scope, roster).forces[0].selections.find((v) => v.name === unit)!.sel.id;
  render(
    <StorageProvider db={db}>
      <WordingProvider initial="plain">
        <MemoryRouter initialEntries={[`/build/${id}?unit=${selId}`]}>
          <ToastProvider>
            <Where />
            <Routes>
              <Route path="/build/:id" element={<ListEditorPage />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      </WordingProvider>
    </StorageProvider>,
  );
  return screen.findByRole('dialog', { name: unit }, { timeout: 5000 });
}

/** A Strike Force (Arks of Omen) with an Overlord as Warlord and no trait. */
function aooWarlord(scope: Scope): Roster {
  let r = startingRoster(scope, { name: 'AoO', catalogueId: NECRONS, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  r = addNamed(scope, r, 'Overlord');
  return pickOption(scope, r, r.forces[0].selections.at(-1)!.id, 'Warlord');
}

const HINT = 'In Arks of Omen games your Warlord only gets a Warlord trait if you pay 1 CP for it. Tick Warlord trait (1 CP) below to choose one.';
const path = () => screen.getByRole('status', { name: 'Path' }).textContent;

test('weapon options show their profile lines, one per profile', async () => {
  const editor = await openUnit(novokhPatrol, 'Overlord');
  const staff = within(editor).getByRole('radio', { name: 'Staff of Light' });
  await waitFor(() => expect(staff).toHaveAccessibleDescription('18" · Assault 3 · S5 · AP -2 · D1 Melee · S User · AP -2 · D1'));
  expect(within(editor).getByRole('radio', { name: 'Warscythe' })).toHaveAccessibleDescription('Melee · S +2 · AP -4 · D2');
});

test('Warlord traits drop their prefix and sit under their kind; each says what it does', async () => {
  const u = userEvent.setup();
  const editor = await openUnit(novokhPatrol, 'Overlord');
  const traits = within(editor).getByRole('group', { name: 'Warlord Trait' });
  const novokh = within(traits).getByRole('group', { name: 'Warlord trait · Novokh' });
  const fury = within(novokh).getByRole('radio', { name: 'Blood-Fuelled Fury' });
  expect(fury).toBeChecked();
  expect(within(traits).getByRole('group', { name: 'Warlord trait · Codex' })).toBeInTheDocument();
  expect(within(editor).queryByText(/Warlord Trait \(/)).not.toBeInTheDocument();
  await waitFor(() => expect(fury).toHaveAccessibleDescription(/^Official wording Each time this WARLORD makes a melee attack/));
  await u.click(within(novokh).getByRole('button', { name: 'About Blood-Fuelled Fury' }));
  expect(screen.getByRole('dialog', { name: 'Blood-Fuelled Fury' })).toHaveTextContent('Each time this WARLORD makes a melee attack');
});

test('relics lose their "Relic:" prefix', async () => {
  const editor = await openUnit(novokhPatrol, 'Overlord');
  const relics = within(editor).getByRole('group', { name: 'Artefacts of the Aeons' });
  expect(within(relics).getByRole('radio', { name: 'Veil of Darkness' })).toBeInTheDocument();
  expect(within(relics).queryByText(/Relic:/)).not.toBeInTheDocument();
});

test('in an Arks of Omen game a Warlord with no trait is told how to get one', async () => {
  const editor = await openUnit(aooWarlord, 'Overlord');
  expect(within(editor).getByText(HINT)).toBeInTheDocument();
});

test('in a Combat Patrol there is no requisition note', async () => {
  const editor = await openUnit(novokhPatrol, 'Overlord');
  expect(within(editor).queryByText(HINT)).not.toBeInTheDocument();
});

test('View datasheet opens the datasheet over the unit, and closing it comes back without leaving the list', async () => {
  const u = userEvent.setup();
  const editor = await openUnit(novokhPatrol, 'Overlord');
  const before = path();
  await u.click(await within(editor).findByRole('button', { name: 'View datasheet' }));
  await waitFor(() => expect(screen.getAllByRole('dialog', { name: 'Overlord' })).toHaveLength(2));
  const datasheet = screen.getAllByRole('dialog', { name: 'Overlord' })[1];
  expect(within(datasheet).getByRole('group', { name: /characteristics$/ })).toBeInTheDocument();
  expect(path()).toBe(before);
  await u.click(within(datasheet).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.getAllByRole('dialog', { name: 'Overlord' })).toHaveLength(1));
  expect(path()).toBe(before);
});

test('Remove unit closes the editor and offers Undo, which puts the unit back', async () => {
  const u = userEvent.setup();
  const editor = await openUnit(novokhPatrol, 'Royal Warden');
  await u.click(within(editor).getByRole('button', { name: 'Remove unit' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Royal Warden' })).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /^Royal Warden/ })).not.toBeInTheDocument();
  const toast = screen.getByText('Removed Royal Warden').closest('.toast') as HTMLElement;
  await u.click(within(toast).getByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('button', { name: /^Royal Warden/ })).toBeInTheDocument();
});

test('Duplicate unit adds a copy, says so, and keeps the original open', async () => {
  const u = userEvent.setup();
  const editor = await openUnit(novokhPatrol, 'Immortals');
  await u.click(within(editor).getByRole('button', { name: 'Duplicate unit' }));
  expect(screen.getByText('Duplicated Immortals')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Immortals/ })).toHaveLength(2);
  expect(screen.getByRole('dialog', { name: 'Immortals' })).toBe(editor);
});
