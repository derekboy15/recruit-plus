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
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';

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
    strat('s4', 'Dynastic Heirlooms', 'Necrons', ['Before battle'], 'Official: one extra relic.'),
    strat('s5', 'Dimensional Corridor', 'Necrons', ['Command phase'], 'Official: a unit moves through a Monolith.'),
    strat('s6', 'Methodical Destruction', 'Necrons', ['Enemy Fight phase'], 'Official: re-roll hit rolls of 1 in melee.'),
  ],
};

const guide: FactionGuide = {
  slug: 'necrons',
  title: 'Necrons',
  plays: [{ t: 'p', c: [{ t: 'text', v: 'Tough robots that get back up.' }] }],
  armyRules: [{ t: 'p', c: [{ t: 'text', v: 'Everything has Reanimation Protocols.' }] }],
  keyUnits: [
    {
      name: 'Necron Warriors',
      unitSlug: 'necron-warriors',
      why: [
        { t: 'text', v: 'each Command phase, ' },
        { t: 'a', href: '/rules/glossary#core', c: [{ t: 'text', v: 'CORE' }] },
      ],
    },
  ],
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
  vi.restoreAllMocks();
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
  expect(screen.getByRole('link', { name: 'Back to Factions' })).toHaveAttribute('href', '/factions');
  for (const h of ['How this army plays', 'Army rules', 'Key units']) {
    expect(screen.getByRole('heading', { name: h, level: 2 })).toBeInTheDocument();
  }
  expect(screen.getByText('Tough robots that get back up.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Necron Warriors/ })).toHaveAttribute('href', '/factions/necrons/units/necron-warriors');
});

test('the guide shows the short army rules, then the full ones folded away', async () => {
  const { container } = render(
    <TestProviders db={db} path="/factions/necrons/guide">
      <Routes>
        <Route path="/factions/:slug/guide" element={<FactionGuidePage />} />
      </Routes>
    </TestProviders>,
  );
  expect(await screen.findByRole('heading', { name: 'Army rules', level: 2 })).toBeInTheDocument();
  expect(screen.getByText('Everything has Reanimation Protocols.')).toBeInTheDocument();
  const summary = screen.getByText('Army rules in full');
  expect(summary.tagName).toBe('SUMMARY');
  const details = summary.closest('details')!;
  expect(details).not.toHaveAttribute('open');
  expect(within(details).getByRole('heading', { name: 'Reanimation Protocols', level: 3, hidden: true })).toBeInTheDocument();
  expect(container.querySelector('.card .card')).toBeNull();
});

test('each key unit card is one link with a capitalised blurb', async () => {
  renderAt('/factions/necrons/guide');
  const link = await screen.findByRole('link', { name: /^Necron Warriors/ });
  expect(link).toHaveAttribute('href', '/factions/necrons/units/necron-warriors');
  expect(link).toHaveTextContent('Each Command phase, CORE');
  expect(link.querySelector('a')).toBeNull();
});

test('the guide has one report button, for the guide and each army rule', async () => {
  renderAt('/factions/necrons/guide');
  expect(await screen.findAllByRole('button', { name: 'Report a problem' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Report a problem' }));
  const which = screen.getByRole('combobox', { name: 'Which part?' });
  expect(within(which).getAllByRole('option').map((o) => o.textContent)).toEqual(['Necrons guide', 'Reanimation Protocols', 'Command Protocols']);
});

test('the units page has Back to Factions and key stats on each unit', async () => {
  renderAt('/factions/necrons');
  expect(await screen.findByRole('link', { name: 'Back to Factions' })).toHaveAttribute('href', '/factions');
  expect(screen.getByRole('heading', { name: 'Necrons', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Necron Warriors/ })).toHaveTextContent('10–20 models · M5" T4 W1 Sv4+');
  expect(screen.getByRole('link', { name: /Necron Warriors/ })).toHaveTextContent('110 pts');
});

test("phase chips follow the game's order in one row", async () => {
  renderAt('/factions/necrons/stratagems');
  const chips = await screen.findByRole('group', { name: 'Phase' });
  expect(chips).toHaveClass('rules-chips');
  const names = within(chips).getAllByRole('button').map((b) => b.textContent);
  expect(names).toEqual(['All phases', 'Before battle', 'Command phase', 'Shooting phase', 'Fight phase', 'Enemy Shooting phase', 'Enemy Fight phase']);
});

test('the stratagems page has Back to Factions and one report button', async () => {
  renderAt('/factions/necrons/stratagems');
  expect(await screen.findByRole('link', { name: 'Back to Factions' })).toHaveAttribute('href', '/factions');
  await screen.findByText('Quantum Deflection');
  expect(await screen.findAllByRole('button', { name: 'Report a problem' })).toHaveLength(1);
});

test('army rules in full show plain English, then the official wording after the switch', async () => {
  renderAt('/factions/necrons/guide');
  expect(await screen.findByText('Destroyed models can come back.')).toBeInTheDocument();
  expect(screen.getByText('Official: protocols apply each battle round.')).toBeInTheDocument(); // no plain yet
  await userEvent.click(screen.getByText('Army rules in full'));
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

test('guide page offline shows the offline notice', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const online = vi.mocked(fetch);
  const base = online.getMockImplementation()!;
  online.mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/guides/necrons.json')) throw new TypeError('Failed to fetch');
    return base(url);
  });
  renderAt('/factions/necrons/guide');
  expect(await screen.findByRole('heading', { name: 'Necrons', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent("You're offline, and this hasn't been saved on this device yet.");
  expect(screen.queryByText('No guide for this faction yet.')).toBeNull();
});

test('faction page offline shows the offline notice', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  vi.mocked(fetch).mockImplementation(async () => {
    throw new TypeError('Failed to fetch');
  });
  renderAt('/factions/necrons');
  expect(await screen.findByRole('status')).toHaveTextContent("You're offline, and this hasn't been saved on this device yet.");
});

test('a unit that needs an army choice says so on its faction page: Imotekh needs the Sautekh dynasty', async () => {
  stubGeneratedData();
  renderAt('/factions/necrons');
  expect(await screen.findByRole('link', { name: /^Imotekh the Stormlord/ })).toHaveTextContent('Needs Sautekh dynasty');
  expect(screen.getByRole('link', { name: /^Necron Warriors/ })).not.toHaveTextContent('Needs');
});

test('the Ultramarines page lists no Open Play Land Raider Variant', async () => {
  stubGeneratedData();
  renderAt('/factions/imperium-adeptus-astartes-ultramarines');
  await screen.findByRole('link', { name: /^Intercessor Squad/ });
  expect(screen.queryByText(/Land Raider Variant/)).toBeNull();
});

test('the Chaos Space Marines page lists Vashtorr the Arkifane, whom BattleScribe stores as an upgrade', async () => {
  stubGeneratedData();
  renderAt('/factions/chaos-chaos-space-marines');
  expect(await screen.findByRole('link', { name: /^Vashtorr the Arkifane/ })).toBeInTheDocument();
});
