import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { Blocks, InlineText } from './Blocks';
import { CoreStratagemsPage } from './CoreStratagemsPage';
import { GlossaryPage, letterOf } from './GlossaryPage';
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
  const more = screen.getByRole('heading', { name: 'More', level: 2 }).nextElementSibling as HTMLElement;
  const first = within(more).getAllByRole('link')[0];
  expect(first).toHaveAccessibleName(/^Factions and datasheets/);
  expect(first).toHaveAttribute('href', '/factions');
  expect(first).toHaveTextContent('Every army’s units, datasheets and stratagems.');
  for (const [name, href] of [
    ['Factions and datasheets', '/factions'],
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

test('an article has Back, contents and one report button', async () => {
  renderAt('/rules/shooting-phase');
  expect(await screen.findByRole('heading', { name: 'Shooting phase', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Rules' })).toHaveAttribute('href', '/rules');
  expect(screen.getByRole('heading', { name: 'Look Out, Sir', level: 2 })).toHaveAttribute('id', 'look-out-sir');
  expect(screen.getByText('Your units shoot one at a time.')).toBeInTheDocument();
  const contents = screen.getByRole('navigation', { name: 'On this page' });
  const sections = rulesData.articles[0].sections;
  // The list is hidden until opened on a phone; its links are there either way.
  const links = [...contents.querySelectorAll('ol a')];
  expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual(sections.map((s) => [s.title, `#${s.id}`]));
  expect(await screen.findAllByRole('button', { name: 'Report a problem' })).toHaveLength(1);
});

test('an article with fewer than three sections has no contents', async () => {
  renderAt('/rules/charge-phase');
  expect(await screen.findByRole('heading', { name: 'Charge phase', level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
});

test('the contents toggle opens and closes the list', async () => {
  renderAt('/rules/shooting-phase');
  const toggle = await screen.findByRole('button', { name: 'On this page' });
  const list = screen.getByRole('navigation', { name: 'On this page' }).querySelector('ol')!;
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(list).toHaveAttribute('hidden');
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(list).not.toHaveAttribute('hidden');
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(list).toHaveAttribute('hidden');
});

test('the article report asks which section', async () => {
  renderAt('/rules/shooting-phase');
  await userEvent.click(await screen.findByRole('button', { name: 'Report a problem' }));
  const which = screen.getByRole('combobox', { name: 'Which part?' });
  expect(within(which).getAllByRole('option').map((o) => o.textContent)).toEqual(['Shooting phase: Look Out, Sir', 'Shooting phase: Blast', 'Shooting phase: Fast dice']);
});

test('core stratagems have Back and one report button', async () => {
  renderAt('/rules/stratagems');
  expect(await screen.findByRole('link', { name: 'Back to Rules' })).toHaveAttribute('href', '/rules');
  await screen.findByText(/one of the charged units can shoot at it first/);
  expect(await screen.findAllByRole('button', { name: 'Report a problem' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Report a rules error' })).toBeNull();
});

test('an unknown article says so', async () => {
  renderAt('/rules/no-such-page');
  expect(await screen.findByText("That rules page doesn't exist.")).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Rules/ })).toHaveAttribute('href', '/rules');
});

test('the glossary lists terms A to Z and filters them', async () => {
  renderAt('/rules/glossary');
  const headings = await screen.findAllByRole('heading', { level: 3 });
  expect(headings.map((h) => [h.textContent, h.id])).toEqual([
    ['CORE', 'core'],
    ["T'au", 'tau'],
  ]);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Filter terms' }), 'xenos');
  expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(["T'au"]);
});

test('the A–Z jump lists only letters with matching terms', async () => {
  renderAt('/rules/glossary');
  const jump = await screen.findByRole('navigation', { name: 'Jump to letter' });
  expect(within(jump).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['C', '#letter-C'],
    ['T', '#letter-T'],
  ]);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Filter terms' }), 'xenos');
  expect(within(screen.getByRole('navigation', { name: 'Jump to letter' })).getAllByRole('link').map((a) => a.textContent)).toEqual(['T']);
});

test('terms sit under their letter and keep their ids', async () => {
  renderAt('/rules/glossary');
  expect(await screen.findByRole('heading', { name: 'C', level: 2 })).toHaveAttribute('id', 'letter-C');
  expect(screen.getByRole('heading', { name: 'T', level: 2 })).toHaveAttribute('id', 'letter-T');
  for (const g of rulesData.glossary) expect(screen.getByRole('heading', { name: g.term, level: 3 })).toHaveAttribute('id', g.id);
});

test('no terms, no report button', async () => {
  renderAt('/rules/glossary');
  await userEvent.type(await screen.findByRole('searchbox', { name: 'Filter terms' }), 'zzzz');
  expect(screen.getByText('No terms match.')).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Jump to letter' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Report a problem' })).toBeNull();
});

test('the glossary has Back and one report button for its terms', async () => {
  renderAt('/rules/glossary');
  expect(await screen.findByRole('link', { name: 'Back to Rules' })).toHaveAttribute('href', '/rules');
  await userEvent.click(await screen.findByRole('button', { name: 'Report a problem' }));
  const which = screen.getByRole('combobox', { name: 'Which part?' });
  expect(within(which).getAllByRole('option').map((o) => o.textContent)).toEqual(['CORE', "T'au"]);
});

test('letterOf files a term under its first letter, or # when it starts with anything else', () => {
  expect(letterOf('core')).toBe('C');
  expect(letterOf("T'au")).toBe('T');
  expect(letterOf('3" rule')).toBe('#');
  expect(letterOf("'Ere We Go")).toBe('#');
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

test('Blocks labels each table cell with its column', () => {
  const t = (v: string) => [{ t: 'text' as const, v }];
  const { container } = render(
    <TestProviders db={db}>
      <Blocks blocks={[{ t: 'table', head: [t('Trait'), t('Effect')], rows: [[t('Dense'), t('-1 to hit')], [t('Obscuring'), t('Blocks sight')]] }]} />
    </TestProviders>,
  );
  const cells = [...container.querySelectorAll('tbody td')];
  expect(cells.map((c) => [c.getAttribute('data-label'), c.textContent])).toEqual([
    ['Trait', 'Dense'],
    ['Effect', '-1 to hit'],
    ['Trait', 'Obscuring'],
    ['Effect', 'Blocks sight'],
  ]);
});

test('InlineText without links keeps a link as plain text', () => {
  render(
    <TestProviders db={db}>
      <p>
        <InlineText links={false} c={[{ t: 'text', v: 'Each turn, ' }, { t: 'a', href: '/rules/glossary#core', c: [{ t: 'text', v: 'CORE' }] }]} />
      </p>
    </TestProviders>,
  );
  expect(screen.getByText(/Each turn,/)).toHaveTextContent('Each turn, CORE');
  expect(screen.queryByRole('link')).toBeNull();
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
