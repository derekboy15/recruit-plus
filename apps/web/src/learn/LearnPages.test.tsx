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
import { completeLesson, type ProgressData } from './progress';
import { DRILLS } from './drills';
import { tiny } from './__fixtures__/drills';
import userEvent from '@testing-library/user-event';
import type { RendererFactory } from '../play/board/BoardCanvas';

const fakeRenderer: RendererFactory = async () => ({ draw: () => {}, resize: () => {}, destroy: () => {} });
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
  test('every lesson is open: each title links to its lesson', async () => {
    renderAt('/learn');
    expect(await screen.findByRole('heading', { name: 'Learn to play', level: 1 })).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Lessons' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    for (const [i, [name, id]] of [
      ['1. What 40k is', first.id],
      ['2. Reading a datasheet', 'datasheets'],
      ['3. The attack sequence', 'attacks'],
    ].entries()) {
      expect(within(items[i]).getByRole('link', { name })).toHaveAttribute('href', `/learn/${id}`);
      expect(items[i]).toHaveTextContent(first.summary);
    }
    expect(screen.queryByText(/Locked/)).toBeNull();
    expect(within(items[0]).getByText('Recommended next')).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: 'Start' })).toHaveAttribute('href', `/learn/${first.id}`);
    expect(screen.getByRole('meter', { name: 'Lessons done' })).toHaveTextContent('0 of 3 lessons done');
  });

  test('the first lesson not done is the recommended one', async () => {
    await done(first.id);
    renderAt('/learn');
    const list = await screen.findByRole('list', { name: 'Lessons' });
    await waitFor(() => expect(screen.getByRole('meter', { name: 'Lessons done' })).toHaveTextContent('1 of 3 lessons done'));
    const items = within(list).getAllByRole('listitem');
    expect(within(items[1]).getByText('Recommended next')).toBeInTheDocument();
    expect(within(items[1]).getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/learn/datasheets');
    expect(within(items[0]).getByText('Done')).toBeInTheDocument();
    const replay = within(items[0]).getByRole('link', { name: 'Replay the What 40k is drill' });
    expect(replay).toHaveAttribute('href', `/learn/${first.id}/drill`);
    expect(replay).toHaveTextContent(/^Replay drill$/);
    expect(within(items[0]).queryByText('Recommended next')).toBeNull();
    expect(within(items[2]).queryByRole('link', { name: 'Start' })).toBeNull();
  });

  test('Your first game stays locked until every lesson is done', async () => {
    renderAt('/learn');
    const card = await screen.findByRole('region', { name: 'Your first game' });
    expect(card).toHaveTextContent('Finish all 3 lessons to unlock a 500-point game against the Necrons, with hints on.');
    expect(within(card).queryByRole('link')).toBeNull();
  });

  test('Your first game says exactly which lessons are left', async () => {
    await done(first.id);
    const { unmount } = renderAt('/learn');
    const card = await screen.findByRole('region', { name: 'Your first game' });
    await waitFor(() => expect(card).toHaveTextContent('Finish the 2 lessons left to unlock a 500-point game against the Necrons, with hints on.'));
    unmount();
    await done('datasheets');
    renderAt('/learn');
    const again = await screen.findByRole('region', { name: 'Your first game' });
    await waitFor(() => expect(again).toHaveTextContent('Finish The attack sequence to unlock a 500-point game against the Necrons, with hints on.'));
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
    expect(screen.getByRole('heading', { name: first.sections[0].title, level: 2 })).toBeInTheDocument();
    const words = screen.getByRole('region', { name: 'Key words' });
    // The definition comes from the glossary data, not from the lesson.
    const rules = JSON.parse(readFileSync(join(GENERATED, 'rules.json'), 'utf8')) as { glossary: { id: string; term: string; text: string }[] };
    const term = rules.glossary.find((g) => g.id === first.glossary[0])!;
    expect(within(words).getByText(term.term)).toBeInTheDocument();
    const refs = screen.getByRole('region', { name: 'In the Rules Reference' });
    expect(within(refs).getByRole('link', { name: first.rules[0].title })).toHaveAttribute('href', `/rules/${first.rules[0].article}#${first.rules[0].section}`);
    expect(screen.getByRole('link', { name: `Start the drill · ${first.minutes} min` })).toHaveAttribute('href', '/learn/what-is-40k/drill');
  });

  test('the lesson page has a Back link to Learn and the lesson number', async () => {
    renderAt('/learn/what-is-40k');
    expect(await screen.findByRole('link', { name: 'Back to Learn' })).toHaveAttribute('href', '/learn');
    expect(screen.getByText(`Lesson 1 of 3 · ${first.minutes} min`)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '← Learn' })).toBeNull();
  });

  test('the drill button sits in the start bar', async () => {
    const { container, unmount } = renderAt('/learn/what-is-40k');
    const start = await screen.findByRole('link', { name: `Start the drill · ${first.minutes} min` });
    expect(start.closest('.learn-start-bar')).not.toBeNull();
    unmount();
    container.remove();
    await done(first.id);
    renderAt('/learn/what-is-40k');
    const again = await screen.findByRole('link', { name: 'Do the drill again' });
    const bar = again.closest('.learn-start-bar') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(within(bar).getByRole('link', { name: 'Next lesson' })).toHaveAttribute('href', '/learn/datasheets');
  });

  test('key words are plain text with one glossary link', async () => {
    renderAt('/learn/what-is-40k');
    const words = await screen.findByRole('region', { name: 'Key words' });
    const rules = JSON.parse(readFileSync(join(GENERATED, 'rules.json'), 'utf8')) as { glossary: { id: string; term: string }[] };
    for (const id of first.glossary) {
      const term = rules.glossary.find((g) => g.id === id)!;
      expect(within(words).queryByRole('link', { name: term.term })).toBeNull();
    }
    const all = within(words).getAllByRole('link', { name: 'All key words in the glossary' });
    expect(all).toHaveLength(1);
    expect(all[0]).toHaveAttribute('href', '/rules/glossary');
  });

  test('a lesson opened by URL before the one before it is done shows the lesson', async () => {
    renderAt('/learn/attacks');
    expect(await screen.findByRole('heading', { name: 'The attack sequence', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Start the drill/ })).toHaveAttribute('href', '/learn/attacks/drill');
    expect(screen.queryByText(/^Finish .* first\.$/)).toBeNull();
  });

  test("a drill opened by URL starts even if earlier lessons aren't done", async () => {
    const real = DRILLS.attacks;
    DRILLS.attacks = { ...tiny, id: 'attacks' };
    try {
      render(
        <TestProviders db={db} path="/learn/attacks/drill">
          <Routes>
            <Route path="/learn/*" element={<LearnRoutes renderer={fakeRenderer} />} />
          </Routes>
        </TestProviders>,
      );
      expect(await screen.findByRole('region', { name: 'Drill' })).toBeInTheDocument();
    } finally {
      DRILLS.attacks = real;
    }
  });

  test('an unknown lesson says so', async () => {
    renderAt('/learn/nope');
    expect(await screen.findByText("That lesson doesn't exist.")).toBeInTheDocument();
  });

  test('finishing the drill saves the lesson as done', async () => {
    // The board drag is covered end to end; here a quick stand-in drill checks the route saves the lesson when done.
    const real = DRILLS['what-is-40k'];
    DRILLS['what-is-40k'] = { ...tiny, id: 'what-is-40k' };
    try {
      const user = userEvent.setup();
      render(
        <TestProviders db={db} path="/learn/what-is-40k/drill">
          <Routes>
            <Route path="/learn/*" element={<LearnRoutes renderer={fakeRenderer} />} />
          </Routes>
        </TestProviders>,
      );
      await user.click(await screen.findByRole('radio', { name: '4 CP' }));
      await user.click(screen.getByRole('button', { name: 'Check answer' }));
      await user.click(screen.getByRole('button', { name: 'End Command phase' }));
      expect(screen.getByRole('heading', { name: 'Drill complete' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Next lesson' })).toHaveAttribute('href', '/learn/datasheets');
      await waitFor(async () => expect(Object.keys((await createRepository(db).listDocs<ProgressData>('progress', 'user-1'))[0]?.data.lessons ?? {})).toEqual(['what-is-40k']));
    } finally {
      DRILLS['what-is-40k'] = real;
    }
  });

  test('every Learn button and link is at least 44px', () => {
    for (const cls of ['learn-path__link', 'learn-path__start']) expect(css).toMatch(new RegExp(`\\.${cls}[^}]*min-height: var\\(--touch\\)`));
    expect(css).toMatch(/\.learn-start-bar a[^}]*min-height: var\(--touch\)/);
  });
});
