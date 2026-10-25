import 'fake-indexeddb/auto';
import { stateOf } from '@recruit/engine';
import { render, screen, waitFor } from '@testing-library/react';
import { Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import type { GameData } from '../play/store/gameStore';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { resetMissionCache } from '../table/missionData';
import { createFirstGame, FIRST_GAME_MISSION } from './firstGame';
import { LearnRoutes } from './LearnRoutes';
import { updateProgress, type ProgressData } from './progress';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`first-game-${++n}`);
  resetDataCache();
  resetMissionCache();
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const ORDER = ['what-is-40k', 'datasheets', 'attacks', 'command-phase', 'movement', 'psychic', 'shooting', 'charge', 'fight', 'morale', 'objectives', 'stratagems', 'terrain', 'army-building', 'mission-setup'];
const finishAll = () =>
  updateProgress(createRepository(db), 'user-1', (p) => ({ ...p, lessons: Object.fromEntries(ORDER.map((id) => [id, { completedAt: 1, mistakes: 0 }])) }));
function GameStub() {
  const { id } = useParams();
  return <p>Game {id}</p>;
}
const renderAt = (path: string) =>
  render(
    <TestProviders db={db} path={path}>
      <Routes>
        <Route path="/learn/*" element={<LearnRoutes />} />
        <Route path="/play/:id" element={<GameStub />} />
      </Routes>
    </TestProviders>,
  );
const games = () => createRepository(db).listDocs<GameData>('game', 'user-1');

describe('Your first game', () => {
  test('createFirstGame saves a Combat Patrol game on Incisive Attack with hints on', async () => {
    const repo = createRepository(db);
    const id = await createFirstGame(repo, 'user-1', 5);
    const doc = (await repo.getDoc<GameData>(id))!;
    expect(doc.kind).toBe('game');
    expect(doc.data.meta).toMatchObject({ hints: true, handOver: true, missionId: FIRST_GAME_MISSION, layoutId: 'mixed', title: 'Your first game: Ultramarines vs Necrons' });
    const s = stateOf(doc.data.record);
    expect(s.setup.battleSize).toBe('combat-patrol');
    expect(s.setup.board).toEqual({ w: 44, h: 30 });
    expect(s.setup.attacker).toBe('B');
    expect(s.setup.armies.map((a) => a.name)).toEqual(['Ultramarines Combat Patrol', 'Necrons Combat Patrol']);
    expect(s.setup.edges).toEqual({ A: 'west', B: 'east' });
    expect(s.setup.settings.rollWindows).toBe(true);
    expect(s.phase).toBe('pre-battle');
  });

  test('the first-game page creates the game once and reuses it', async () => {
    await finishAll();
    const first = renderAt('/learn/first-game');
    expect(await screen.findByText(/^Game [0-9a-f-]{36}$/, {}, { timeout: 5000 })).toBeInTheDocument();
    first.unmount();
    const [game] = await games();
    await waitFor(async () => expect(((await createRepository(db).listDocs<ProgressData>('progress', 'user-1'))[0].data.firstGameId)).toBe(game.id));
    renderAt('/learn/first-game');
    expect(await screen.findByText(`Game ${game.id}`)).toBeInTheDocument();
    expect(await games()).toHaveLength(1);
  });

  test('the first-game page is locked until every lesson is done', async () => {
    renderAt('/learn/first-game');
    expect(await screen.findByText('Finish all 15 lessons to unlock your first game.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Learn' })).toHaveAttribute('href', '/learn');
    // The page header holds the title and the way back.
    expect(screen.getByRole('heading', { name: 'Your first game', level: 1 }).closest('header.page-head')).not.toBeNull();
    expect(await games()).toHaveLength(0);
  });
});
