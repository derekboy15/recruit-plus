import 'fake-indexeddb/auto';
import type { LessonsData } from '@recruit/data/model';
import { render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { LearnRoutes } from './LearnRoutes';
import { completeLesson } from './progress';
import { Route, Routes } from 'react-router-dom';

const GENERATED = join(__dirname, '..', '..', '..', '..', 'packages', 'data', 'generated');
const real = JSON.parse(readFileSync(join(GENERATED, 'lessons.json'), 'utf8')) as LessonsData;
// Three lessons, whatever the content holds today: lesson 1 as written, and two copies of it renamed.
const first = real.lessons[0];
const three: LessonsData = {
  lessons: [
    first,
    { ...first, id: 'datasheets', title: 'Reading a datasheet', order: 2, drill: 'datasheets' },
    { ...first, id: 'attacks', title: 'The attack sequence', order: 3, drill: 'attacks' },
  ],
};
const css = readFileSync(join(__dirname, 'learn.css'), 'utf8');

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`learn-pages-${++n}`);
  resetDataCache();
  const generated = stubGeneratedData();
  vi.stubGlobal('fetch', (url: string) => (url === '/data/lessons.json' ? Promise.resolve(new Response(JSON.stringify(three))) : generated(url)));
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const renderAt = (path: string) =>
  render(
    <TestProviders db={db} path={path}>
      <Routes>
        <Route path="/learn/*" element={<LearnRoutes />} />
      </Routes>
    </TestProviders>,
  );
const done = async (...ids: string[]) => {
  for (const id of ids) await completeLesson(createRepository(db), 'user-1', id, 0);
};

describe('Learn home', () => {
  test('the path lists every lesson in order with Next on lesson 1 and the rest locked', async () => {
    renderAt('/learn');
    expect(await screen.findByRole('heading', { name: 'Learn to play', level: 1 })).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Lessons' })).getAllByRole('listitem');
    expect(items.map((i) => within(i).getByRole('heading').textContent)).toEqual(['1. What 40k is', '2. Reading a datasheet', '3. The attack sequence']);
    expect(within(items[0]).getByText('Next')).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/learn/what-is-40k');
    expect(within(items[1]).getByText('Locked')).toBeInTheDocument();
    expect(within(items[1]).getByText('Finish lesson 1 first')).toBeInTheDocument();
    expect(within(items[1]).queryByRole('link')).toBeNull();
    expect(screen.getByRole('meter', { name: 'Lessons done' })).toHaveTextContent('0 of 3 lessons done');
  });

  test('a finished lesson shows Done and unlocks the next', async () => {
    await done('what-is-40k');
    renderAt('/learn');
    const list = await screen.findByRole('list', { name: 'Lessons' });
    await waitFor(() => expect(screen.getByRole('meter', { name: 'Lessons done' })).toHaveTextContent('1 of 3 lessons done'));
    const items = within(list).getAllByRole('listitem');
    expect(within(items[0]).getByText('Done')).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: /What 40k is/ })).toHaveAttribute('href', '/learn/what-is-40k');
    expect(within(items[1]).getByText('Next')).toBeInTheDocument();
    expect(within(items[2]).getByText('Locked')).toBeInTheDocument();
  });

  test('Your first game stays locked until every lesson is done', async () => {
    renderAt('/learn');
    const card = await screen.findByRole('region', { name: 'Your first game' });
    expect(card).toHaveTextContent('Finish all 3 lessons to unlock a 500-point game against the Necrons, with hints on.');
    expect(within(card).queryByRole('link')).toBeNull();
  });

  test('with every lesson done, Your first game can be played', async () => {
    await done('what-is-40k', 'datasheets', 'attacks');
    renderAt('/learn');
    const card = await screen.findByRole('region', { name: 'Your first game' });
    await waitFor(() => expect(within(card).getByRole('link', { name: 'Play your first game' })).toHaveAttribute('href', '/learn/first-game'));
  });
});

describe('Lesson page', () => {
  test('the lesson page shows the text, key words from the glossary and rules links', async () => {
    renderAt('/learn/what-is-40k');
    expect(await screen.findByRole('heading', { name: 'What 40k is', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(`Lesson 1 of 3 · ${first.minutes} minutes`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: first.sections[0].title, level: 2 })).toBeInTheDocument();
    const words = screen.getByRole('region', { name: 'Key words' });
    // The definition comes from the glossary data, not from the lesson.
    const rules = JSON.parse(readFileSync(join(GENERATED, 'rules.json'), 'utf8')) as { glossary: { id: string; term: string; text: string }[] };
    const term = rules.glossary.find((g) => g.id === first.glossary[0])!;
    expect(within(words).getByRole('link', { name: term.term })).toHaveAttribute('href', `/rules/glossary#${term.id}`);
    const refs = screen.getByRole('region', { name: 'In the Rules Reference' });
    expect(within(refs).getByRole('link', { name: first.rules[0].title })).toHaveAttribute('href', `/rules/${first.rules[0].article}#${first.rules[0].section}`);
    expect(screen.getByRole('link', { name: 'Start the drill' })).toHaveAttribute('href', '/learn/what-is-40k/drill');
  });

  test('a locked lesson by URL says what to finish first and starts no drill', async () => {
    renderAt('/learn/attacks');
    expect(await screen.findByText('Finish Reading a datasheet first.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to What 40k is' })).toHaveAttribute('href', '/learn/what-is-40k');
    expect(screen.queryByRole('link', { name: 'Start the drill' })).toBeNull();
  });

  test('a locked drill by URL says what to finish first and starts no drill', async () => {
    await done('what-is-40k');
    renderAt('/learn/attacks/drill');
    expect(await screen.findByText('Finish Reading a datasheet first.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Drill' })).toBeNull();
  });

  test('an unknown lesson says so', async () => {
    renderAt('/learn/nope');
    expect(await screen.findByText("That lesson doesn't exist.")).toBeInTheDocument();
  });

  test.todo('finishing the drill saves the lesson as done');

  test('every Learn button and link is at least 44px', () => {
    for (const cls of ['learn-path__link', 'learn-path__start']) expect(css).toMatch(new RegExp(`\\.${cls}[^}]*min-height: var\\(--touch\\)`));
  });
});
