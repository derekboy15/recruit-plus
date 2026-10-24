import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from '../../auth/AuthContext';
import type { AuthBackend } from '../../auth/types';
import type { ListData } from '../../lists/listStore';
import { openDb, type RecruitDb } from '../../storage/db';
import { createRepository } from '../../storage/repository';
import { StorageProvider } from '../../storage/StorageContext';
import { sampleSetup } from '../__fixtures__/game';
import type { GameData } from '../store/gameStore';
import type { LoadedArmy } from './loadArmy';
import { NewGamePage } from './NewGamePage';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetMissionCache } from '../../table/missionData';

const loadArmy = vi.hoisted(() => vi.fn());
vi.mock('./loadArmy', () => ({ loadArmy }));

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
const sample = sampleSetup();
const loaded = (name: string, size: LoadedArmy['battleSize'], over: Partial<LoadedArmy> = {}): LoadedArmy => ({
  army: { ...sample.armies[0], name },
  problems: [],
  catalogueSlugs: ['necrons'],
  faction: 'Necrons',
  battleSize: size,
  points: 480,
  ...over,
});
const LISTS: Record<string, LoadedArmy> = {
  l1: loaded('Szarekhan Patrol', 'combat-patrol'),
  l2: loaded('Second Patrol', 'combat-patrol', { problems: ['Necron Warriors: "Shiny gun" couldn\'t be matched to a weapon and won\'t be used.'] }),
  l3: loaded('Big Army', 'strike-force'),
  empty: loaded('Empty List', 'combat-patrol', { army: { ...sample.armies[0], name: 'Empty List', units: [] }, problems: ['Empty List has no units.'] }),
};

beforeEach(() => {
  db = openDb(`new-game-test-${++n}`);
  localStorage.setItem('recruit.lastUser', JSON.stringify(user));
  loadArmy.mockImplementation(async (doc: { id: string }, player: 'A' | 'B') => {
    const l = LISTS[doc.id];
    return { ...l, army: { ...l.army, player, units: l.army.units.map((u) => ({ ...u, id: `${player}:${u.id}` })) } };
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  resetMissionCache();
  db.close();
  localStorage.clear();
});

const listData = (name: string, size: ListData['summary']['battleSize']): ListData => ({
  roster: { schema: 1, name, catalogueId: 'c', battleSize: size, forces: [] },
  summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: size, points: 480, pointsLimit: 500, issueCount: 0 },
});
async function seed(...ids: string[]) {
  const repo = createRepository(db);
  for (const id of ids) await repo.saveDoc({ id, kind: 'list', ownerId: user.id, data: listData(LISTS[id].army.name, LISTS[id].battleSize) });
}

function GameStub() {
  return <p>Game {useParams().id}</p>;
}
const page = () =>
  render(
    <AuthProvider backend={backend}>
      <StorageProvider db={db}>
        <MemoryRouter initialEntries={['/play/new']}>
          <Routes>
            <Route path="/play/new" element={<NewGamePage />} />
            <Route path="/play/:id" element={<GameStub />} />
          </Routes>
        </MemoryRouter>
      </StorageProvider>
    </AuthProvider>,
  );

const pick = async (player: 'Player 1' | 'Player 2', list: string) =>
  userEvent.click(within(await screen.findByRole('group', { name: player })).getByRole('radio', { name: new RegExp(list) }));

test('with no lists it sends the player to build one', async () => {
  page();
  expect(await screen.findByText('You need two lists to play. You can use the same list for both players.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build a list' })).toHaveAttribute('href', '/build/new');
});

test('picking two lists and starting saves a game and opens it', async () => {
  await seed('l1', 'l2');
  page();
  await pick('Player 1', 'Szarekhan Patrol');
  await pick('Player 2', 'Szarekhan Patrol');
  const start = screen.getByRole('button', { name: 'Start game' });
  await waitFor(() => expect(start).toBeEnabled());
  await userEvent.click(start);
  const text = await screen.findByText(/^Game /);
  const id = text.textContent!.replace('Game ', '');
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const doc = await createRepository(db).getDoc<GameData>(id);
  expect(doc?.kind).toBe('game');
  expect(doc?.data.meta.title).toBe('Szarekhan Patrol vs Szarekhan Patrol');
  expect(doc?.data.meta.armies.map((a) => [a.player, a.listId])).toEqual([['A', 'l1'], ['B', 'l1']]);
  expect(doc?.data.record.setup.battleSize).toBe('combat-patrol');
  expect(doc?.data.record.setup.armies[1].player).toBe('B');
  expect(loadArmy).toHaveBeenCalledTimes(2);
});

test('shows muster problems under the list that has them', async () => {
  await seed('l1', 'l2');
  page();
  await pick('Player 2', 'Second Patrol');
  const group = screen.getByRole('group', { name: 'Player 2' });
  expect(await within(group).findByText("Some of this list won't be in the game")).toBeInTheDocument();
  expect(within(group).getByText(/"Shiny gun" couldn't be matched/)).toBeInTheDocument();
});

test('an empty list blocks the start with a reason', async () => {
  await seed('l1', 'empty');
  page();
  await pick('Player 1', 'Szarekhan Patrol');
  await pick('Player 2', 'Empty List');
  expect(await screen.findByRole('alert')).toHaveTextContent('Empty List has no units.');
  expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled();
});

test("battle size defaults to Player 1's list and warns when the lists differ", async () => {
  await seed('l1', 'l3');
  page();
  await pick('Player 1', 'Big Army');
  expect(within(screen.getByRole('group', { name: 'Battle size' })).getByRole('radio', { name: /Strike Force/ })).toBeChecked();
  await pick('Player 2', 'Szarekhan Patrol');
  expect(await screen.findByText('Your lists are for different battle sizes; the game uses the size you pick here.')).toBeInTheDocument();
});

test('the real Core Book and Arks of Omen missions are offered for the battle size, after Practice', async () => {
  const missions = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated', 'missions.json'), 'utf8');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(missions)));
  await seed('l1', 'l3');
  page();
  await pick('Player 1', 'Szarekhan Patrol');
  const missionGroup = await screen.findByRole('group', { name: 'Mission' });
  expect(await within(missionGroup).findByRole('radio', { name: /Incisive Attack/ })).toBeInTheDocument();
  const names = within(missionGroup).getAllByRole('radio').map((r) => r.closest('label')!.querySelector('strong')!.textContent);
  expect(names[0]).toBe('Practice');
  expect(names).not.toContain('Cleanse the Land'); // an Incursion mission, not Combat Patrol
});

test("if the mission data can't load, Practice is still offered", async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
  await seed('l1');
  page();
  await pick('Player 1', 'Szarekhan Patrol');
  const missionGroup = await screen.findByRole('group', { name: 'Mission' });
  expect(within(missionGroup).getAllByRole('radio')).toHaveLength(1);
});
