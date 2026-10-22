import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { Blocks } from './Blocks';
import { CoreStratagemsPage } from './CoreStratagemsPage';
import { GlossaryPage } from './GlossaryPage';
import { RulesArticlePage } from './RulesArticlePage';
import { RulesHome } from './RulesHome';
import { TestProviders } from './__fixtures__/TestProviders';
import { coreStratagems, rulesData } from './__fixtures__/rules';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`rules-pages-${++n}`);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/rules.json') ? rulesData : url.endsWith('/core-stratagems.json') ? coreStratagems : { generatedAt: 'x' }))),
  );
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  localStorage.clear();
});

function renderAt(path: string) {
  render(
    <TestProviders db={db} path={path}>
      <Routes>
        <Route path="/rules" element={<RulesHome />} />
        <Route path="/rules/glossary" element={<GlossaryPage />} />
        <Route path="/rules/stratagems" element={<CoreStratagemsPage />} />
        <Route path="/rules/:articleId" element={<RulesArticlePage />} />
      </Routes>
    </TestProviders>,
  );
}

test('the rules home lists the articles and the other sections', async () => {
  renderAt('/rules');
  expect(await screen.findByRole('heading', { name: 'Rules', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Shooting phase/ })).toHaveAttribute('href', '/rules/shooting-phase');
  for (const [name, href] of [
    ['Glossary', '/rules/glossary'],
    ['Core stratagems', '/rules/stratagems'],
    ['Faction guides', '/rules/factions'],
    ['Your rules reports', '/rules/reports'],
  ]) {
    expect(screen.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href);
  }
});

test('searching lists results that link to the section', async () => {
  renderAt('/rules');
  await userEvent.type(await screen.findByRole('searchbox', { name: 'Search the rules' }), 'overwatch');
  const results = screen.getByRole('list', { name: 'Search results' });
  const links = within(results).getAllByRole('link');
  expect(links[0]).toHaveAttribute('href', '/rules/charge-phase#overwatch');
  expect(links[1]).toHaveAttribute('href', '/rules/stratagems#strat-000002134006');
  expect(screen.queryByRole('link', { name: /Shooting phase/ })).not.toBeInTheDocument();
});

test('a search with no hits says so', async () => {
  renderAt('/rules');
  await userEvent.type(await screen.findByRole('searchbox', { name: 'Search the rules' }), 'zzzz');
  expect(screen.getByText('Nothing matches "zzzz". Try fewer words.')).toBeInTheDocument();
});

test('an article shows its sections with anchors and a report button each', async () => {
  renderAt('/rules/shooting-phase');
  expect(await screen.findByRole('heading', { name: 'Shooting phase', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Look Out, Sir', level: 2 })).toHaveAttribute('id', 'look-out-sir');
  expect(screen.getByText('Your units shoot one at a time.')).toBeInTheDocument();
  expect(await screen.findAllByRole('button', { name: 'Report a rules error' })).toHaveLength(2);
});

test('an unknown article says so', async () => {
  renderAt('/rules/no-such-page');
  expect(await screen.findByText("That rules page doesn't exist.")).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Rules/ })).toHaveAttribute('href', '/rules');
});

test('the glossary lists terms A to Z and filters them', async () => {
  renderAt('/rules/glossary');
  const headings = await screen.findAllByRole('heading', { level: 2 });
  expect(headings.map((h) => [h.textContent, h.id])).toEqual([
    ['CORE', 'core'],
    ["T'au", 'tau'],
  ]);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Filter terms' }), 'xenos');
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(["T'au"]);
});

test('core stratagems show plain English, then the official wording after the switch', async () => {
  renderAt('/rules/stratagems');
  expect(await screen.findByText(/one of the charged units can shoot at it first/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Core Book' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Arks of Omen' })).toBeInTheDocument();
  expect(screen.getByText('1 CP · Core · Enemy Charge phase')).toBeInTheDocument();
  expect(document.getElementById('strat-000002134006')).not.toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Official wording' }));
  expect(screen.getByText(/declares a charge against one or more units from your army/)).toBeInTheDocument();
});

test('Blocks renders tables in a scroll box and unconfirmed notes with a title', () => {
  const { container } = render(
    <TestProviders db={db}>
      <Blocks
        blocks={[
          { t: 'table', head: [[{ t: 'text', v: 'Trait' }]], rows: [[[{ t: 'text', v: 'Dense' }]]] },
          { t: 'note', kind: 'unconfirmed', c: [{ t: 'text', v: 'Older FAQs differ.' }] },
          { t: 'p', c: [{ t: 'a', href: '/rules/glossary#core', c: [{ t: 'text', v: 'CORE' }] }] },
        ]}
      />
    </TestProviders>,
  );
  expect(container.querySelector('.table-scroll table')).not.toBeNull();
  const note = container.querySelector('.note--unconfirmed')!;
  expect(note).toHaveTextContent('Not confirmed');
  expect(note).toHaveTextContent('Older FAQs differ.');
  expect(screen.getByRole('link', { name: 'CORE' })).toHaveAttribute('href', '/rules/glossary#core');
});
