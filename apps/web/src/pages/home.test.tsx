import 'fake-indexeddb/auto';
import type { LessonsData } from '@recruit/data/model';
import { render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { fakeAuthBackend } from '../auth/__fixtures__/fakeBackend';
import { resetDataCache } from '../factions/dataClient';
import { completeLesson } from '../learn/progress';
import type { ListData } from '../lists/listStore';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository, type Repository } from '../storage/repository';
import { Home } from './Home';

const GENERATED = join(__dirname, '..', '..', '..', '..', 'packages', 'data', 'generated');
const real = JSON.parse(readFileSync(join(GENERATED, 'lessons.json'), 'utf8')) as LessonsData;
const first = real.lessons[0];
// Three lessons, whatever the content holds today: lesson 1 as written, and two copies of it renamed.
const three: LessonsData = {
  lessons: [
    first,
    { ...first, id: 'datasheets', title: 'Reading a datasheet', order: 2, drill: 'datasheets' },
    { ...first, id: 'attacks', title: 'The attack sequence', order: 3, drill: 'attacks' },
  ],
};

let db: RecruitDb;
let repo: Repository;
let n = 0;
let clock = 1_000;
let lessonsFail = false;
beforeEach(() => {
  db = openDb(`home-${++n}`);
  repo = createRepository(db, () => (clock += 1_000));
  lessonsFail = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/data/lessons.json') {
        if (lessonsFail) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify(three));
      }
      return new Response('', { status: 404 });
    }),
  );
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  localStorage.clear();
});

const signedInHome = () =>
  render(
    <TestProviders db={db}>
      <Home />
    </TestProviders>,
  );

const list = (name: string, over: Partial<ListData['summary']> = {}) =>
  repo.saveDoc<ListData>({
    id: crypto.randomUUID(),
    kind: 'list',
    ownerId: 'user-1',
    data: {
      roster: { name } as unknown as ListData['roster'],
      summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'incursion', points: 885, pointsLimit: 1000, issueCount: 0, ...over },
    },
  });

test('signed out, the landing page invites you to sign in', async () => {
  render(
    <AuthProvider backend={fakeAuthBackend()}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(await screen.findByRole('link', { name: 'Sign in to start' })).toHaveAttribute('href', '/sign-in');
  for (const [name, href] of [
    [/^Learn/, '/learn'],
    [/^Lists/, '/build'],
    [/^Practice/, '/play'],
    [/^Table/, '/table'],
    [/^Rules/, '/rules'],
  ] as const) {
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  }
});

test('signed in, home picks up your next lesson', async () => {
  await completeLesson(repo, 'user-1', first.id, 0);
  signedInHome();
  expect(await screen.findByRole('heading', { name: 'Continue learning' })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Lesson 2: Reading a datasheet' })).toHaveAttribute('href', '/learn/datasheets');
  expect(screen.getByRole('link', { name: 'All lessons' })).toHaveAttribute('href', '/learn');
  expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
});

test('with every lesson done, home offers the first game', async () => {
  for (const l of three.lessons) await completeLesson(repo, 'user-1', l.id, 0);
  signedInHome();
  expect(await screen.findByRole('link', { name: 'Play your first game' })).toHaveAttribute('href', '/learn/first-game');
});

test("home falls back to Go to Learn when the lessons can't load", async () => {
  lessonsFail = true;
  signedInHome();
  expect(await screen.findByRole('link', { name: 'Go to Learn' })).toHaveAttribute('href', '/learn');
});

test('your three most recent lists, each with Play', async () => {
  await list('Oldest list');
  await list('Older list');
  await list('Old list');
  const newest = await list('Newest list');
  signedInHome();
  await waitFor(() => expect(screen.getAllByRole('link', { name: /^Play / })).toHaveLength(3));
  const plays = screen.getAllByRole('link', { name: /^Play / });
  expect(plays[0]).toHaveAccessibleName('Play Newest list');
  expect(plays[0]).toHaveAttribute('href', `/build/${newest.id}/play`);
  expect(screen.getByRole('link', { name: 'Newest list' })).toHaveAttribute('href', `/build/${newest.id}`);
  expect(screen.queryByRole('link', { name: 'Oldest list' })).toBeNull();
  expect(screen.getAllByText('Necrons · Incursion · 885 / 1,000 pts')).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'All lists' })).toHaveAttribute('href', '/build');
});

test('no lists yet offers to build one', async () => {
  signedInHome();
  expect(await screen.findByRole('link', { name: 'Build your first army' })).toHaveAttribute('href', '/build/new');
});

test('games in progress list unfinished practice and table games only', async () => {
  const practice = await repo.saveDoc({
    id: crypto.randomUUID(),
    kind: 'game',
    ownerId: 'user-1',
    data: { record: {}, meta: { title: 'Ultramarines vs Necrons' }, summary: { round: 2, phase: 'shooting', ended: false } },
  });
  await repo.saveDoc({
    id: crypto.randomUUID(),
    kind: 'game',
    ownerId: 'user-1',
    data: { record: {}, meta: { title: 'Orks vs Tau' }, summary: { round: 5, phase: 'ended', ended: true } },
  });
  const table = await repo.saveDoc({
    id: crypto.randomUUID(),
    kind: 'game',
    ownerId: 'user-1',
    data: { mode: 'table', schema: 1, setup: { players: { A: { name: 'Alice' }, B: { name: 'Bob' } } }, events: [{ t: 'start' }] },
  });
  signedInHome();
  const section = (await screen.findByRole('heading', { name: 'Games in progress' })).closest('section')!;
  expect(within(section).getByRole('link', { name: 'Ultramarines vs Necrons' })).toHaveAttribute('href', `/play/${practice.id}`);
  expect(within(section).getByRole('link', { name: 'Alice vs Bob' })).toHaveAttribute('href', `/table/${table.id}`);
  expect(within(section).getByText('Practice · Round 2')).toBeInTheDocument();
  expect(within(section).getByText('Table · In progress')).toBeInTheDocument();
  expect(screen.queryByText('Orks vs Tau')).toBeNull();
});
