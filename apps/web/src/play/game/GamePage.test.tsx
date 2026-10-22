import 'fake-indexeddb/auto';
import { stateOf, type Command, type GameRecord } from '@recruit/engine';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { WordingProvider } from '../../rules/wording';
import { openDb, type RecruitDb } from '../../storage/db';
import { createRepository, type Repository } from '../../storage/repository';
import { StorageProvider } from '../../storage/StorageContext';
import { deployedGame, must } from '../__fixtures__/game';
import type { RendererFactory } from '../board/BoardCanvas';
import { summarise, type GameData, type GameMeta } from '../store/gameStore';
import { GamePage } from './GamePage';

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  db = openDb(`game-page-test-${++n}`);
  repo = createRepository(db);
});
afterEach(() => db.close());

const fakeRenderer: RendererFactory = async () => ({ draw: () => {}, resize: () => {}, destroy: () => {} });
const meta = (o: Partial<GameMeta> = {}): GameMeta => ({
  title: 'Necrons vs Ultramarines',
  createdAt: 1,
  hints: true,
  handOver: true,
  missionId: 'practice',
  layoutId: 'open',
  armies: [
    { player: 'A', listId: 'l1', name: 'Necrons', faction: 'Necrons', catalogueSlugs: ['necrons'] },
    { player: 'B', listId: 'l2', name: 'Ultramarines', faction: 'Ultramarines', catalogueSlugs: [] },
  ],
  ...o,
});
async function seed(record: GameRecord, m = meta(), id = 'g1') {
  await repo.saveDoc<GameData>({ id, kind: 'game', ownerId: 'u', data: { record, meta: m, summary: summarise(record) } });
}
const page = (id = 'g1') =>
  render(
    <StorageProvider db={db}>
      <WordingProvider initial="plain">
        <MemoryRouter initialEntries={[`/play/${id}`]}>
          <Routes>
            <Route path="/play/:id" element={<GamePage renderer={fakeRenderer} />} />
            <Route path="/play" element={<p>Games list</p>} />
          </Routes>
        </MemoryRouter>
      </WordingProvider>
    </StorageProvider>,
  );
const endPhases = (g: GameRecord, count: number) => {
  for (let i = 0; i < count; i++) g = must(g, { type: 'endPhase', by: stateOf(g).active } as Command);
  return g;
};

test('shows the round, phase, CP and VP for both armies', async () => {
  const g = deployedGame();
  await seed(g);
  page();
  const bar = await screen.findByRole('banner', { name: 'Game status' });
  expect(bar).toHaveTextContent('Round 1 · Command');
  const s = stateOf(g);
  expect(within(bar).getByText('Necrons').closest('[data-player]')).toHaveTextContent(`CP ${s.cp.A}`);
  expect(within(bar).getByText('Ultramarines').closest('[data-player]')).toHaveTextContent(`CP ${s.cp.B}`);
  expect(within(bar).getByText('Necrons').closest('[data-player]')).toHaveAttribute('data-active', 'true');
  expect(bar).toHaveTextContent('VP 0');
});

test("Undo shows the engine's refusal at the start of a phase", async () => {
  await seed(deployedGame());
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent("You can't undo past the start of this phase.");
});

test('the log lists plain-English lines', async () => {
  await seed(deployedGame());
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'Log' }));
  const log = screen.getByRole('dialog', { name: 'Game log' });
  expect(within(log).getByText(/set up Intercessor Squad/)).toBeInTheDocument();
  expect(within(log).getByText(/Command phase/)).toBeInTheDocument();
});

test('a hand-over screen appears when the other player must act, and goes on a tap', async () => {
  await seed(endPhases(deployedGame(), 6));
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'End Morale phase' }));
  const over = await screen.findByRole('dialog', { name: 'Pass the device to Ultramarines' });
  await userEvent.click(within(over).getByRole('button', { name: "I'm Ultramarines" }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /Pass the device/ })).toBeNull());
  expect(screen.getByRole('banner', { name: 'Game status' })).toHaveTextContent('Round 1 · Command');
});

test('no hand-over screen when it is turned off', async () => {
  await seed(endPhases(deployedGame(), 6), meta({ handOver: false }));
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'End Morale phase' }));
  await waitFor(() => expect(screen.getByRole('banner', { name: 'Game status' })).toHaveTextContent(/Command/));
  expect(screen.queryByRole('dialog', { name: /Pass the device/ })).toBeNull();
});

test('a game saved with a roll window open reopens on the roll', async () => {
  let g = endPhases(deployedGame({ rollWindows: true }), 1);
  g = must(g, { type: 'beginMove', by: 'A', unitId: 'A:war', kind: 'advance' } as Command);
  const s = stateOf(g);
  expect(s.pending?.kind).toBe('roll');
  const die = s.rolls[(s.pending as { rollId: string }).rollId].dice[0].value;
  await seed(g);
  page();
  expect(await screen.findByRole('heading', { name: 'Necron Warriors Advance roll' })).toBeInTheDocument();
  expect(screen.getByLabelText(`Die 1: ${die}`)).toBeInTheDocument();
});

test('an unreadable game shows why and offers to delete it', async () => {
  await repo.saveDoc({ id: 'bad', kind: 'game', ownerId: 'u', data: { record: { schema: 2 }, meta: meta(), summary: summarise(deployedGame()) } });
  page('bad');
  expect(await screen.findByText('This saved game was made by a newer version of the app.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete this game' }));
  expect(await screen.findByText('Games list')).toBeInTheDocument();
  expect((await repo.getDoc('bad'))?.deleted).toBe(true);
});

test('hints show when they are on and hide when turned off in the menu', async () => {
  await seed(deployedGame());
  page();
  expect(await screen.findByRole('note', { name: 'Hint' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Hints for new players' }));
  await waitFor(() => expect(screen.queryByRole('note', { name: 'Hint' })).toBeNull());
});
