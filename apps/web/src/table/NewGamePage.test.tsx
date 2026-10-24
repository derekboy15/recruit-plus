import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { necronsListData } from '../lists/__fixtures__/necronsList';
import { createList } from '../lists/listStore';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import type { TableGameData } from './game';
import { resetMissionCache } from './missionData';
import { NewGamePage } from './NewGamePage';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`new-game-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  resetMissionCache();
});

function GameStub() {
  return <p>Game {useParams().id}</p>;
}
function renderPage(roll?: (sides: 3 | 6) => number) {
  render(
    <TestProviders db={db} path="/table/new">
      <Routes>
        <Route path="/table/new" element={<NewGamePage roll={roll} />} />
        <Route path="/table/:id" element={<GameStub />} />
      </Routes>
    </TestProviders>,
  );
}
const next = () => screen.getByRole('button', { name: 'Next' });

async function toArmies(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole('button', { name: /^Incursion/ }));
  await u.click(next());
  await u.click(await screen.findByRole('button', { name: /11 Cleanse the Land/ }));
  await u.click(next());
}

test('battle size choices show points, board and pack', async () => {
  renderPage();
  expect(await screen.findByRole('button', { name: /Strike Force · 2,000 pts · 44" × 60" · Arks of Omen GT missions/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Combat Patrol · 500 pts · 44" × 30" · Core Book missions/ })).toBeInTheDocument();
  expect(next()).toBeDisabled();
});

test('rolling for the mission picks it from a D33', async () => {
  const u = userEvent.setup();
  const rolls = [2, 3];
  renderPage(() => rolls.shift()!);
  await u.click(await screen.findByRole('button', { name: /^Incursion/ }));
  await u.click(next());
  await u.click(await screen.findByRole('button', { name: 'Roll for mission' }));
  expect(await screen.findByText(/You rolled 2 and 3: 23/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /23 Surge of Faith/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('img', { name: /Deployment map/ })).toBeInTheDocument();
});

test("both players on factions only can't continue", async () => {
  const u = userEvent.setup();
  renderPage();
  await toArmies(u);
  for (const group of screen.getAllByRole('group', { name: /army/ })) {
    await u.click(within(group).getByRole('radio', { name: 'Just pick a faction' }));
    await u.selectOptions(within(group).getByRole('combobox', { name: 'Faction' }), 'orks');
  }
  expect(screen.getByText('At least one army needs to be one of your saved lists.')).toBeInTheDocument();
  expect(next()).toBeDisabled();
});

test('start creates a game and navigates', async () => {
  const listId = await createList(createRepository(db), 'user-1', await necronsListData());
  const u = userEvent.setup();
  renderPage(() => 4);
  await toArmies(u);
  const [yours, theirs] = screen.getAllByRole('group', { name: /army/ });
  await u.click(within(yours).getByRole('radio', { name: 'Use one of my lists' }));
  await u.click(within(yours).getByRole('radio', { name: /Necrons Strike Force/ }));
  await u.click(within(theirs).getByRole('radio', { name: 'Just pick a faction' }));
  await u.selectOptions(within(theirs).getByRole('combobox', { name: 'Faction' }), 'orks');
  await u.click(next());
  // Attacker and Defender: You defend and take Player B's zone; Opponent goes first.
  await u.click(within(screen.getByRole('group', { name: 'Who is the Defender?' })).getByRole('button', { name: 'You' }));
  await u.click(within(screen.getByRole('group', { name: 'Which deployment zone does the Defender pick?' })).getByRole('button', { name: 'Player B' }));
  await u.click(within(screen.getByRole('group', { name: 'Who takes the first turn?' })).getByRole('button', { name: 'Opponent' }));
  await u.click(next());
  // Secondaries: Arks of Omen defaults are already picked.
  expect(screen.getAllByRole('button', { name: 'Assassination', pressed: true })).toHaveLength(2);
  await u.click(next());
  await u.click(screen.getByRole('button', { name: 'Less CP for You' }));
  await u.click(screen.getByRole('checkbox', { name: /Opponent's army is painted/ }));
  await u.click(screen.getByRole('button', { name: 'Start game' }));
  const id = (await screen.findByText(/^Game /)).textContent!.slice(5);
  await waitFor(async () => expect(await createRepository(db).getDoc(id)).toBeDefined());
  const doc = (await createRepository(db).getDoc<TableGameData>(id))!;
  expect(doc.data.setup).toMatchObject({
    battleSize: 'incursion', pack: 'arks-of-omen', missionId: 'aoo-cleanse-the-land', attacker: 'A', firstTurn: 'A',
    players: {
      A: { name: 'Opponent', catalogueSlug: 'orks', battleReady: true, startingCp: 6, secondaries: ['aoo-assassination', 'aoo-grind-them-down', 'aoo-behind-enemy-lines'] },
      B: { name: 'You', listId, catalogueSlug: 'necrons', battleReady: false, startingCp: 5 },
    },
  });
  expect(doc.data.events.map((e) => e.t)).toEqual(['start']);
  // The list side carries its choices' display names, for the stratagem filter; the faction-only side has none.
  expect(doc.data.setup.players.B.armyChoices).toEqual(expect.arrayContaining([expect.any(String)]));
  expect(doc.data.setup.players.B.armyChoices!.length).toBeGreaterThan(0);
  expect(doc.data.setup.players.A.armyChoices).toBeUndefined();
});

test('two secondaries from one category are refused', async () => {
  const listId = await createList(createRepository(db), 'user-1', await necronsListData());
  const u = userEvent.setup();
  renderPage();
  await toArmies(u);
  const [yours, theirs] = screen.getAllByRole('group', { name: /army/ });
  await u.click(within(yours).getByRole('radio', { name: 'Use one of my lists' }));
  await u.click(within(yours).getByRole('radio', { name: /Necrons Strike Force/ }));
  await u.click(within(theirs).getByRole('radio', { name: 'Just pick a faction' }));
  await u.selectOptions(within(theirs).getByRole('combobox', { name: 'Faction' }), 'orks');
  await u.click(next());
  await u.click(within(screen.getByRole('group', { name: 'Who is the Defender?' })).getByRole('button', { name: 'You' }));
  await u.click(within(screen.getByRole('group', { name: 'Which deployment zone does the Defender pick?' })).getByRole('button', { name: 'Player A' }));
  await u.click(within(screen.getByRole('group', { name: 'Who takes the first turn?' })).getByRole('button', { name: 'You' }));
  await u.click(next());
  const mine = screen.getByRole('region', { name: 'Secondary objectives: You' });
  await u.click(within(mine).getByRole('button', { name: 'Bring It Down' }));
  expect(within(mine).getByText('Pick exactly 3 secondary objectives.')).toBeInTheDocument();
  expect(within(mine).getByText('You can only pick one from Purge the Enemy.')).toBeInTheDocument();
  expect(next()).toBeDisabled();
});

test('the armies step shows your lists as cards with faction, points and when they were edited', async () => {
  await createList(createRepository(db), 'user-1', await necronsListData());
  const u = userEvent.setup();
  renderPage();
  await toArmies(u);
  const yours = screen.getByRole('group', { name: 'Your army' });
  await u.click(within(yours).getByRole('radio', { name: 'Use one of my lists' }));
  expect(within(yours).getByRole('radiogroup', { name: 'List' })).toBeVisible();
  const card = within(yours).getByRole('radio', { name: /Necrons Strike Force/ });
  expect(card.closest('label')).toHaveTextContent(/Necrons · Strike Force · [\d,]+ \/ 2,000 pts/);
  expect(card.closest('label')).toHaveTextContent(/Edited just now/);
  expect(card.closest('label')).toHaveTextContent(/Ready|\d+ to fix/);
  const theirs = screen.getByRole('group', { name: "Your opponent's army" });
  await u.click(within(theirs).getByRole('radio', { name: 'Just pick a faction' }));
  await u.selectOptions(within(theirs).getByRole('combobox', { name: 'Faction' }), 'orks');
  expect(next()).toBeDisabled();
  await u.click(card);
  expect(card).toBeChecked();
  expect(next()).toBeEnabled();
});

test('mission rows name the primary objective', async () => {
  const u = userEvent.setup();
  renderPage();
  await u.click(await screen.findByRole('button', { name: /^Incursion/ }));
  await u.click(next());
  expect(await screen.findByRole('button', { name: /11 Cleanse the Land/ })).toHaveTextContent(/Primary: \S/);
});

test('the wizard has Back to Table games and the step in its header', async () => {
  renderPage();
  expect(await screen.findByRole('heading', { level: 1, name: 'New game' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Back to Table games' })).toHaveAttribute('href', '/table');
  expect(screen.getByText('Step 1 of 6: Battle size')).toBeVisible();
});
