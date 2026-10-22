import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { generatedMissions } from './__fixtures__/missions';
import { testSetup } from './__fixtures__/setup';
import { makeEvent, type EventBody, type Pos, type TableGameData, type TableSetup } from './game';
import { GamePage } from './GamePage';
import { resetMissionCache } from './missionData';
import { summarise, SummaryPage } from './SummaryPage';

const packs = generatedMissions().packs;
const pack = (id: 'arks-of-omen' | 'core-book') => packs.find((p) => p.id === id)!;
const at = (round: number): Pos => ({ round, turn: 1, phase: 'command' });
const game = (events: [EventBody, Pos | null][], s: TableSetup = testSetup()): TableGameData => ({
  mode: 'table', schema: 1, setup: s, events: [makeEvent({ t: 'start' }, null), ...events.map(([e, p]) => makeEvent(e, p))],
});
const vp = (player: 'A' | 'B', n: number, round = 2, category: 'primary' | 'secondary' = 'primary'): [EventBody, Pos] =>
  [{ t: 'vp', player, category, sourceId: category === 'primary' ? 'hold' : 'aoo-grind-them-down', vp: n, detail: '' }, at(round)];

describe('summarise', () => {
  test('winner is the higher total', () => {
    const s = summarise(game([vp('A', 12), vp('B', 8), [{ t: 'end', reason: 'complete' }, null]]), pack('arks-of-omen'));
    expect(s.winner).toBe('A');
    expect(s.headline).toBe('You win, 12 to 8.');
  });
  test('tie shows Draw', () => {
    const s = summarise(game([vp('A', 4), vp('B', 4), [{ t: 'end', reason: 'agreed' }, null]]), pack('arks-of-omen'));
    expect(s.winner).toBeNull();
    expect(s.headline).toBe('Draw, 4 to 4.');
  });
  test('AoO concession: opponent wins whatever the score', () => {
    const s = summarise(game([vp('A', 30), vp('B', 2), [{ t: 'end', reason: 'concede', concededBy: 'A' }, null]]), pack('arks-of-omen'));
    expect(s.winner).toBe('B');
    expect(s.headline).toBe('You conceded, so Opponent wins.');
    expect(s.players.A.total).toBe(30);
  });
  test('Core Book concession shows 0 for the conceder', () => {
    const s = summarise(game([vp('A', 30), [{ t: 'end', reason: 'concede', concededBy: 'A' }, null]], testSetup({ pack: 'core-book' })), pack('core-book'));
    expect(s.winner).toBe('B');
    expect(s.players.A.total).toBe(0);
    expect(s.headline).toBe('You conceded and score 0 VP, so Opponent wins.');
  });
  test('VP by round sums to the total primary', () => {
    const s = summarise(game([vp('A', 4, 2), vp('A', 8, 3), vp('A', 12, 4), vp('A', 3, 4), vp('A', 2, 4, 'secondary')]), pack('arks-of-omen'));
    expect(s.primaryByRound.A).toEqual([0, 4, 8, 15, 0]);
    expect(s.primaryByRound.A.reduce((a, b) => a + b, 0)).toBe(s.players.A.primary);
  });
  test('stratagems used are counted per player', () => {
    const used: [EventBody, Pos] = [{ t: 'stratagem', player: 'B', stratagemId: 'x', name: 'Grot Shields', cp: 1 }, at(2)];
    const s = summarise(game([used, used]), pack('arks-of-omen'));
    expect(s.stratagems.B).toEqual(['Grot Shields', 'Grot Shields']);
    expect(s.stratagems.A).toEqual([]);
  });
});

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`summary-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  resetMissionCache();
});

test('the summary page shows the result, the mission and each player', async () => {
  const id = crypto.randomUUID();
  await createRepository(db).saveDoc({ id, kind: 'game', ownerId: 'user-1', data: game([vp('A', 8), vp('B', 3, 2, 'secondary'), [{ t: 'end', reason: 'agreed' }, null]]) });
  render(<TestProviders db={db} path={`/table/${id}/summary`}><Routes><Route path="/table/:id/summary" element={<SummaryPage />} /></Routes></TestProviders>);
  expect(await screen.findByRole('heading', { name: 'You win, 8 to 3.' })).toBeInTheDocument();
  expect(screen.getByText(/Cleanse the Land/)).toBeInTheDocument();
  const opp = screen.getByRole('region', { name: 'Opponent' });
  expect(within(opp).getByText('Grind Them Down')).toBeInTheDocument();
  expect(within(opp).getByText('3 / 15')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to games' })).toHaveAttribute('href', '/table');
  expect(screen.getByRole('link', { name: 'View log' })).toHaveAttribute('href', `/table/${id}?tab=Log`);
});

test('End the game: a player concedes', async () => {
  const u = userEvent.setup();
  const id = crypto.randomUUID();
  const pos: Pos = { round: 2, turn: 1, phase: 'movement' };
  await createRepository(db).saveDoc({ id, kind: 'game', ownerId: 'user-1', data: game([[{ t: 'advance', to: pos }, null]]) });
  render(
    <TestProviders db={db} path={`/table/${id}`}>
      <Routes>
        <Route path="/table/:id" element={<GamePage />} />
        <Route path="/table/:id/summary" element={<SummaryPage />} />
      </Routes>
    </TestProviders>,
  );
  await u.click(await screen.findByRole('button', { name: 'End the game' }));
  expect(screen.getByRole('button', { name: "We've finished all 5 rounds" })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'We agreed to stop early' })).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'A player concedes' }));
  await u.click(screen.getByRole('button', { name: 'Opponent concedes' }));
  expect(await screen.findByRole('heading', { name: 'Opponent conceded, so You win.' })).toBeInTheDocument();
});
