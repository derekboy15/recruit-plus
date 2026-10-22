import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogueOut, FactionGuide, StratagemOut } from '@recruit/data/model';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { resetDataCache } from './dataClient';
import { FactionGuidePage } from './FactionGuidePage';
import { FactionPage } from './FactionPage';
import { StratagemsPage } from './StratagemsPage';
import { index, necronWarriors, necrons } from './__fixtures__/necrons';

const strat = (id: string, name: string, group: string, phases: string[], text: string, plain?: string): StratagemOut => ({
  id, name, cp: '1', group, kind: 'Battle Tactic', phases, text, ...(plain ? { plain } : {}),
});

const catalogue: CatalogueOut = {
  ...necrons,
  rules: [
    { id: 'r1', name: 'Reanimation Protocols', text: 'Official: destroyed models may reassemble.', plain: 'Destroyed models can come back.' },
    { id: 'r2', name: 'Command Protocols', text: 'Official: protocols apply each battle round.' },
  ],
  stratagems: [
    strat('s1', 'Swift Dismemberment', 'Annihilation Legion', ['Fight phase'], 'Official: re-roll wound rolls.'),
    strat('s2', 'Quantum Deflection', 'Necrons', ['Enemy Shooting phase'], 'Official: 4+ invulnerable save.', 'This vehicle gets a 4+ invulnerable save.'),
    strat('s3', 'Protocol of the Undying Legions', 'Necrons', ['Fight phase', 'Shooting phase'], 'Official: reanimate on a 5+.'),
  ],
};

const guide: FactionGuide = {
  slug: 'necrons',
  title: 'Necrons',
  plays: [{ t: 'p', c: [{ t: 'text', v: 'Tough robots that get back up.' }] }],
  armyRules: [{ t: 'p', c: [{ t: 'text', v: 'Everything has Reanimation Protocols.' }] }],
  keyUnits: [{ name: 'Necron Warriors', unitSlug: 'necron-warriors', why: [{ t: 'text', v: 'Cheap, tough Troops.' }] }],
};

let db: RecruitDb;
let n = 0;
let withGuide = true;
beforeEach(() => {
  db = openDb(`faction-pages-${++n}`);
  withGuide = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/index.json')) return new Response(JSON.stringify(index));
      if (url.endsWith('/catalogues/necrons.json')) return new Response(JSON.stringify(catalogue));
      if (url.endsWith('/guides/necrons.json')) return withGuide ? new Response(JSON.stringify(guide)) : new Response('', { status: 404 });
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

function renderAt(path: string) {
  render(
    <TestProviders db={db} path={path}>
      <Routes>
        <Route path="/factions/:slug" element={<FactionPage />} />
        <Route path="/factions/:slug/guide" element={<FactionGuidePage />} />
        <Route path="/factions/:slug/stratagems" element={<StratagemsPage />} />
      </Routes>
    </TestProviders>,
  );
}

test('the guide page shows the three guide sections and links key units to their datasheets', async () => {
  renderAt('/factions/necrons/guide');
  expect(await screen.findByRole('heading', { name: 'Necrons', level: 1 })).toBeInTheDocument();
  for (const h of ['How this army plays', 'Army rules', 'Key units', 'Army rules in full']) {
    expect(screen.getByRole('heading', { name: h, level: 2 })).toBeInTheDocument();
  }
  expect(screen.getByText('Tough robots that get back up.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Necron Warriors' })).toHaveAttribute('href', '/factions/necrons/units/necron-warriors');
  expect(screen.getByText('Cheap, tough Troops.')).toBeInTheDocument();
});

test('army rules in full show plain English, then the official wording after the switch', async () => {
  renderAt('/factions/necrons/guide');
  expect(await screen.findByText('Destroyed models can come back.')).toBeInTheDocument();
  expect(screen.getByText('Official: protocols apply each battle round.')).toBeInTheDocument(); // no plain yet
  await userEvent.click(screen.getByRole('button', { name: 'Official wording' }));
  expect(screen.getByText('Official: destroyed models may reassemble.')).toBeInTheDocument();
});

test('a faction without a guide says so', async () => {
  withGuide = false;
  renderAt('/factions/necrons/guide');
  expect(await screen.findByText('No guide for this faction yet.')).toBeInTheDocument();
});

test("stratagems are grouped with the faction's own group first", async () => {
  renderAt('/factions/necrons/stratagems');
  await screen.findByText('Quantum Deflection');
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Necrons', 'Annihilation Legion']);
  expect(screen.getByText('This vehicle gets a 4+ invulnerable save.')).toBeInTheDocument();
});

test('a phase chip leaves only that phase', async () => {
  renderAt('/factions/necrons/stratagems');
  await screen.findByText('Quantum Deflection');
  await userEvent.click(screen.getByRole('button', { name: 'Fight phase' }));
  expect(screen.getByRole('button', { name: 'Fight phase' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByText('Quantum Deflection')).not.toBeInTheDocument();
  expect(screen.getByText('Swift Dismemberment')).toBeInTheDocument();
  expect(screen.getByText('Protocol of the Undying Legions')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'All phases' }));
  expect(screen.getByText('Quantum Deflection')).toBeInTheDocument();
});

test('searching narrows the stratagems, and a nonsense search says so', async () => {
  renderAt('/factions/necrons/stratagems');
  const box = await screen.findByRole('searchbox', { name: 'Search stratagems' });
  await userEvent.type(box, 'swift');
  expect(screen.getByText('Swift Dismemberment')).toBeInTheDocument();
  expect(screen.queryByText('Quantum Deflection')).not.toBeInTheDocument();
  await userEvent.clear(box);
  await userEvent.type(box, 'zzzz');
  expect(screen.getByText('No stratagems match.')).toBeInTheDocument();
});

test('the tabs mark the current page', async () => {
  renderAt('/factions/necrons/stratagems');
  const tabs = await screen.findByRole('navigation', { name: 'Faction pages' });
  expect(within(tabs).getByRole('link', { name: 'Stratagems' })).toHaveAttribute('aria-current', 'page');
  expect(within(tabs).getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/factions/necrons/guide');
  expect(within(tabs).getByRole('link', { name: 'Units' })).toHaveAttribute('href', '/factions/necrons');
});

test('the units page has the tabs too', async () => {
  renderAt('/factions/necrons');
  const tabs = await screen.findByRole('navigation', { name: 'Faction pages' });
  expect(within(tabs).getByRole('link', { name: 'Units' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: /Necron Warriors/ })).toHaveAttribute('href', `/factions/necrons/units/${necronWarriors.slug}`);
});
