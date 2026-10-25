import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { testSetup } from './__fixtures__/setup';
import { makeEvent, type EventBody, type Pos, type TableGameData, type TableSetup } from './game';
import { GamePage } from './GamePage';
import { resetMissionCache } from './missionData';
import './__fixtures__/patience';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`game-page-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  resetMissionCache();
});

/** Saves a game whose events reach `pos` with the Command phase CP already decided there (when it's a Command phase). */
async function seed(setup: TableSetup, pos?: Pos, extra: [EventBody, Pos][] = []): Promise<string> {
  const id = crypto.randomUUID();
  const events = [makeEvent({ t: 'start' }, null)];
  if (pos) {
    events.push(makeEvent({ t: 'advance', to: pos }, null));
    if (pos.phase === 'command') for (const p of ['A', 'B'] as const) events.push(makeEvent({ t: 'cp', player: p, delta: 0, reason: 'bonus', note: 'test' }, pos));
  }
  for (const [e, p] of extra) events.push(makeEvent(e, p));
  const data: TableGameData = { mode: 'table', schema: 1, setup, events };
  await createRepository(db).saveDoc({ id, kind: 'game', ownerId: 'user-1', data });
  return id;
}
function renderGame(id: string, roll?: (sides: 3 | 6) => number) {
  render(
    <TestProviders db={db} path={`/table/${id}`}>
      <Routes>
        <Route path="/table/:id" element={<GamePage roll={roll} />} />
        <Route path="/table/:id/summary" element={<p>Summary page</p>} />
      </Routes>
    </TestProviders>,
  );
}
const player = (name: string) => screen.getByRole('group', { name });
const doc = async (id: string) => (await createRepository(db).getDoc<TableGameData>(id))!;
const tap = async (u: ReturnType<typeof userEvent.setup>, label: string, times: number) => {
  for (let i = 0; i < times; i++) await u.click(screen.getByRole('button', { name: label }));
};

test('Arks of Omen Command phase adds 1 CP to both players', async () => {
  renderGame(await seed(testSetup()));
  await waitFor(() => {
    expect(within(player('You')).getByText('7 CP')).toBeInTheDocument();
    expect(within(player('Opponent')).getByText('7 CP')).toBeInTheDocument();
  });
  expect(screen.getByText(/Round 1 · Your turn · Command phase/)).toBeInTheDocument();
  expect(screen.getByText(/Both players gain 1 CP/)).toBeInTheDocument();
});

test('Core Book adds 1 CP to the active player only', async () => {
  const s = testSetup({ pack: 'core-book', battleSize: 'combat-patrol', missionId: 'cb-incisive-attack' });
  s.players.A.startingCp = 3;
  s.players.B.startingCp = 3;
  renderGame(await seed(s));
  await waitFor(() => expect(within(player('You')).getByText('4 CP')).toBeInTheDocument());
  expect(within(player('Opponent')).getByText('3 CP')).toBeInTheDocument();
});

test('Secret Intel Inbound gives no CP in round 1', async () => {
  const id = await seed(testSetup({ missionId: 'aoo-display-of-spiritual-might' }));
  renderGame(id);
  await waitFor(async () => expect((await doc(id)).data.events.filter((e) => e.t === 'cp')).toHaveLength(2));
  expect(within(player('You')).getByText('6 CP')).toBeInTheDocument();
  expect(within(player('Opponent')).getByText('6 CP')).toBeInTheDocument();
});

test('a Leading From the Front "No" rolls a die and logs it', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup({ missionId: 'aoo-ascension' }));
  renderGame(id, () => 2);
  const q = await screen.findByRole('region', { name: 'Command phase CP: You' });
  expect(within(q).getByText(/Is your WARLORD on the battlefield/)).toBeInTheDocument();
  await u.click(within(q).getByRole('button', { name: 'No' }));
  const q2 = await screen.findByRole('region', { name: 'Command phase CP: Opponent' });
  await u.click(within(q2).getByRole('button', { name: 'Yes' }));
  await waitFor(() => expect(within(player('Opponent')).getByText('7 CP')).toBeInTheDocument());
  expect(within(player('You')).getByText('6 CP')).toBeInTheDocument();
  const events = (await doc(id)).data.events;
  expect(events.find((e) => e.t === 'roll')).toMatchObject({ dice: [2], sides: 6 });
  expect(events.find((e) => e.t === 'cp' && e.player === 'A')).toMatchObject({ delta: 0, reason: 'bonus' });
});

test('leaving Command in round 2 opens the hold prompt and 2 controlled vs 1 scores 12 in AoO', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup(), { round: 2, turn: 1, phase: 'command' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'Next phase' }));
  const prompt = await screen.findByRole('region', { name: /Score: You/ });
  await tap(u, 'More: Objective markers you control', 2);
  await tap(u, 'More: Objective markers your opponent controls', 1);
  await u.click(within(prompt).getByRole('button', { name: 'Score 12 VP' }));
  await waitFor(() => expect(within(player('You')).getByText('12 VP')).toBeInTheDocument());
  expect(await screen.findByText(/Round 2 · Your turn · Movement phase/)).toBeInTheDocument();
});

test('round 5 second player is prompted for the hold at End turn', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup(), { round: 5, turn: 2, phase: 'morale' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'End turn' }));
  const prompt = await screen.findByRole('region', { name: /Score: Opponent/ });
  await tap(u, 'More: Objective markers you control', 1);
  await u.click(within(prompt).getByRole('button', { name: 'Score 8 VP' }));
  const next = await screen.findByRole('region', { name: /Score: Opponent/ });
  await u.click(within(next).getByRole('button', { name: 'Skip' }));
  expect(await screen.findByText('Summary page', {}, { timeout: 5000 })).toBeInTheDocument();
  const events = (await doc(id)).data.events;
  expect(events.at(-1)).toMatchObject({ t: 'end', reason: 'complete' });
  expect(events.find((e) => e.t === 'vp' && e.vp === 8)).toMatchObject({ player: 'B', sourceId: 'hold' });
});

test("a quick second tap can't score the same prompt twice", async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup(), { round: 2, turn: 1, phase: 'command' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'Next phase' }));
  await tap(u, 'More: Objective markers you control', 1);
  const score = screen.getByRole('button', { name: 'Score 8 VP' });
  // Two taps before the first save finishes.
  fireEvent.click(score);
  fireEvent.click(score);
  await screen.findByText(/Movement phase/);
  await waitFor(async () => expect((await doc(id)).data.events.filter((e) => e.t === 'vp')).toHaveLength(1));
  expect((await doc(id)).data.events.filter((e) => e.t === 'advance')).toHaveLength(2);
});

test('the round 5 hold prompt says it is scored at the end of the turn', async () => {
  const u = userEvent.setup();
  renderGame(await seed(testSetup(), { round: 5, turn: 2, phase: 'morale' }));
  await u.click(await screen.findByRole('button', { name: 'End turn' }));
  const prompt = await screen.findByRole('region', { name: /Score: Opponent/ });
  expect(within(prompt).getByText(/End of the turn/)).toBeInTheDocument();
  expect(within(prompt).queryByText(/End of the Command phase/)).toBeNull();
});

test('Undo in the Command phase returns to the previous Morale phase and stays there', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup(), { round: 1, turn: 1, phase: 'morale' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'End turn' }));
  await u.click(within(await screen.findByRole('region', { name: /Score: You/ })).getByRole('button', { name: 'Skip' }));
  await waitFor(() => expect(within(player('Opponent')).getByText('7 CP')).toBeInTheDocument());
  expect(screen.getByText(/Round 1 · Opponent's turn · Command phase/)).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Undo' }));
  expect(await screen.findByText(/Round 1 · Your turn · Morale phase/)).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 300));
  expect(screen.getByText(/Round 1 · Your turn · Morale phase/)).toBeInTheDocument();
  expect(within(player('Opponent')).getByText('6 CP')).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(async () => expect((await doc(id)).data.events.filter((e) => e.t === 'vp')).toHaveLength(0));
});

test('Undo removes the last score', async () => {
  const u = userEvent.setup();
  const pos: Pos = { round: 2, turn: 1, phase: 'movement' };
  const id = await seed(testSetup(), pos, [[{ t: 'vp', player: 'A', category: 'primary', sourceId: 'hold', vp: 8, detail: '2 controlled' }, pos]]);
  renderGame(id);
  await waitFor(() => expect(within(player('You')).getByText('8 VP')).toBeInTheDocument());
  await u.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(within(player('You')).getByText('0 VP')).toBeInTheDocument());
});

test('End turn of turn 2 asks Break Them for both players', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup({ battleSize: 'strike-force', missionId: 'aoo-recover-the-relics' }), { round: 1, turn: 2, phase: 'morale' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'End turn' }));
  const first = await screen.findByRole('region', { name: /Score: You/ });
  await tap(u, 'More: Enemy units destroyed this battle round', 2);
  await u.click(within(first).getByRole('button', { name: 'Score 2 VP' }));
  const second = await screen.findByRole('region', { name: /Score: Opponent/ });
  await u.click(within(second).getByRole('button', { name: 'Skip' }));
  expect(await screen.findByText(/Round 2 · Your turn · Command phase/)).toBeInTheDocument();
  await waitFor(() => expect(within(player('You')).getByText('2 VP')).toBeInTheDocument());
});

test('the mission card shows the map and rules', async () => {
  renderGame(await seed(testSetup(), { round: 1, turn: 1, phase: 'movement' }));
  expect(await screen.findByText(/Mission: Cleanse the Land/)).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Deployment map/ })).toBeInTheDocument();
  expect(screen.getByText(/Any units arriving|can't arrive from Strategic Reserves/)).toBeInTheDocument();
});

test('quick taps never act on a stale phase: Next phase and Undo stay disabled until the new state is on screen', async () => {
  const id = await seed(testSetup(), { round: 1, turn: 1, phase: 'movement' });
  renderGame(id);
  await screen.findByText(/Round 1 · Your turn · Movement phase/);
  const next = screen.getByRole('button', { name: 'Next phase' });
  fireEvent.click(next);
  // Disabled straight away, before the save and redraw finish, so a second tap can't repeat the same advance.
  expect(next).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  fireEvent.click(next);
  await screen.findByText(/Round 1 · Your turn · Psychic phase/);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next phase' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Next phase' }));
  await screen.findByText(/Round 1 · Your turn · Shooting phase/);
  const advances = (await doc(id)).data.events.filter((e) => e.t === 'advance');
  expect(advances.map((e) => (e as { to: Pos }).to.phase)).toEqual(['movement', 'psychic', 'shooting']);
});

test('the game has a header with Back to Table games and the mission name', async () => {
  renderGame(await seed(testSetup()));
  expect(await screen.findByRole('heading', { level: 1, name: 'Cleanse the Land' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Back to Table games' })).toHaveAttribute('href', '/table');
});

test('a game that is not on this device says so under a header with Back', async () => {
  renderGame(crypto.randomUUID());
  expect(await screen.findByRole('heading', { level: 1, name: 'Game not found' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Back to Table games' })).toHaveAttribute('href', '/table');
  expect(screen.getByRole('alert')).toHaveTextContent('This game doesn’t exist on this device.');
});

test('End the game lives in the menu and asks once', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup());
  renderGame(id);
  await screen.findByRole('heading', { level: 1, name: 'Cleanse the Land' });
  expect(screen.queryByRole('button', { name: 'End the game' })).toBeNull();
  await u.click(screen.getByRole('button', { name: 'Game actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'End the game…' }));
  const sheet = screen.getByRole('dialog', { name: 'End the game' });
  expect(within(sheet).getByRole('button', { name: 'We’ve finished all 5 rounds' })).toBeVisible();
  await u.click(within(sheet).getByRole('button', { name: 'We agreed to stop early' }));
  expect(await screen.findByText('Summary page')).toBeVisible();
  expect((await doc(id)).data.events.at(-1)).toMatchObject({ t: 'end', reason: 'agreed' });
});

test('closing the End the game sheet ends nothing', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup());
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'Game actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'End the game…' }));
  await u.click(within(screen.getByRole('dialog', { name: 'End the game' })).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect((await doc(id)).data.events.some((e) => e.t === 'end')).toBe(false);
});

test('a player concedes from the sheet', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup(), { round: 2, turn: 1, phase: 'movement' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'Game actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'End the game…' }));
  const sheet = screen.getByRole('dialog', { name: 'End the game' });
  await u.click(within(sheet).getByRole('button', { name: 'A player concedes' }));
  await u.click(within(sheet).getByRole('button', { name: 'Opponent concedes' }));
  expect(await screen.findByText('Summary page')).toBeVisible();
  expect((await doc(id)).data.events.at(-1)).toMatchObject({ t: 'end', reason: 'concede', concededBy: 'B' });
});

test('an ended game offers the summary and Undo the end from the menu', async () => {
  const u = userEvent.setup();
  const pos: Pos = { round: 2, turn: 1, phase: 'movement' };
  const id = await seed(testSetup(), pos, [[{ t: 'end', reason: 'agreed' }, pos]]);
  renderGame(id);
  expect(await screen.findByText(/This game is over\./)).toBeVisible();
  await u.click(screen.getByRole('button', { name: 'Game actions' }));
  expect(screen.queryByRole('menuitem', { name: 'End the game…' })).toBeNull();
  expect(screen.getByRole('menuitem', { name: 'See the summary' })).toHaveAttribute('href', `/table/${id}/summary`);
  await u.click(screen.getByRole('menuitem', { name: 'Undo the end' }));
  await waitFor(() => expect(screen.queryByText(/This game is over\./)).toBeNull());
  expect((await doc(id)).data.events.some((e) => e.t === 'end')).toBe(false);
});

test('Next phase stays enabled during the Warlord question, explains itself and focuses the question', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup({ missionId: 'aoo-ascension' }));
  renderGame(id, () => 2);
  const q = await screen.findByRole('region', { name: 'Command phase CP: You' });
  const next = screen.getByRole('button', { name: 'Next phase' });
  expect(next).toBeEnabled();
  expect(next).toHaveAccessibleDescription('Answer the question above first.');
  expect(screen.getByText('Answer the question above first.')).toBeVisible();
  await u.click(next);
  await u.click(next);
  expect(within(q).getByRole('heading', { level: 2 })).toHaveFocus();
  expect(screen.getByText('Round 1 · Your turn · Command phase')).toBeVisible();
  expect((await doc(id)).data.events.filter((e) => e.t === 'advance')).toHaveLength(0);
});

test('End turn with a score prompt open focuses the prompt and writes nothing', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup(), { round: 2, turn: 1, phase: 'command' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'Next phase' }));
  const prompt = await screen.findByRole('region', { name: /Score: You/ });
  const before = (await doc(id)).data.events.length;
  const next = screen.getByRole('button', { name: 'Next phase' });
  await waitFor(() => expect(next).toBeEnabled());
  expect(next).toHaveAccessibleDescription('Answer the question above first.');
  await u.click(next);
  expect(within(prompt).getByRole('heading', { level: 2 })).toHaveFocus();
  expect((await doc(id)).data.events).toHaveLength(before);
});

test('with nothing to answer there is no hint', async () => {
  renderGame(await seed(testSetup(), { round: 1, turn: 1, phase: 'movement' }));
  expect(await screen.findByRole('button', { name: 'Next phase' })).not.toHaveAccessibleDescription();
  expect(screen.queryByText('Answer the question above first.')).toBeNull();
});

test('a double tap on an End the game choice ends the game once', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup(), { round: 2, turn: 1, phase: 'movement' });
  renderGame(id);
  await u.click(await screen.findByRole('button', { name: 'Game actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'End the game…' }));
  const stop = within(screen.getByRole('dialog', { name: 'End the game' })).getByRole('button', { name: 'We agreed to stop early' });
  // Two taps before the first save finishes.
  fireEvent.click(stop);
  fireEvent.click(stop);
  expect(await screen.findByText('Summary page')).toBeVisible();
  await new Promise((r) => setTimeout(r, 200));
  expect((await doc(id)).data.events.filter((e) => e.t === 'end')).toHaveLength(1);
});

test('an ended game also offers Undo the end beside the summary link', async () => {
  const u = userEvent.setup();
  const pos: Pos = { round: 2, turn: 1, phase: 'movement' };
  const id = await seed(testSetup(), pos, [[{ t: 'end', reason: 'agreed' }, pos]]);
  renderGame(id);
  expect(await screen.findByText(/This game is over\./)).toBeVisible();
  await u.click(screen.getByRole('button', { name: 'Undo the end' }));
  await waitFor(() => expect(screen.queryByText(/This game is over\./)).toBeNull());
  expect((await doc(id)).data.events.some((e) => e.t === 'end')).toBe(false);
});
