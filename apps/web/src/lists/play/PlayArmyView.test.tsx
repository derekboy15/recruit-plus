import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { WordingProvider } from '../../rules/wording';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { novokhIncursionData } from './__fixtures__/playList';
import { loadPlayData, type PlayData } from './loadPlayData';
import { PlayArmyView, type PlaySheet } from './PlayArmyView';
import { PlaySheets } from './PlaySheets';

let data: PlayData;
beforeAll(async () => {
  stubGeneratedData();
  data = await loadPlayData(await novokhIncursionData());
});
afterAll(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

function Harness({ data }: { data: PlayData }) {
  const [open, setOpen] = useState<PlaySheet | null>(null);
  return (
    <WordingProvider initial="plain">
      <MemoryRouter>
        <PlayArmyView data={data} onOpen={setOpen} />
        {open && <PlaySheets data={data} open={open} onOpen={setOpen} />}
      </MemoryRouter>
    </WordingProvider>
  );
}

/** The sheet's own close button (the backdrop behind it carries the same name). */
const closeButton = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' });

test('tiles, roles and unit cards with key stats, wargear, Warlord and points', () => {
  render(<Harness data={data} />);
  expect(screen.getByRole('button', { name: /^Army rules/ })).toHaveTextContent('Awakened By Murder, Reanimation Protocols, Living Metal');
  expect(screen.getByRole('button', { name: /^Stratagems/ })).toHaveTextContent('Yours and core ones, by phase');
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['HQ', 'Troops', 'Elites']);
  const warriors = screen.getByRole('button', { name: /^Necron Warriors/ });
  expect(warriors).toHaveTextContent('· 10');
  expect(warriors).toHaveTextContent('10x Gauss Flayer');
  expect(warriors).toHaveTextContent('110 pts');
  expect(within(warriors).getByText('Sv').nextElementSibling).toHaveTextContent('4+');
  expect(within(warriors).getAllByRole('term').map((t) => t.textContent)).toEqual(['M', 'T', 'Sv', 'W']);
  expect(screen.getByRole('button', { name: /^Overlord/ })).toHaveTextContent(/Warlord(?! ·)/);
  expect(screen.getByRole('button', { name: /^Overlord/ })).not.toHaveTextContent('· 1');
});

test('an invulnerable save shows between Sv and W', () => {
  const withInv = { ...data, army: { ...data.army, roles: data.army.roles.map((r) => ({ ...r, units: r.units.map((x) => (x.name === 'Overlord' && x.unit ? { ...x, unit: { ...x.unit, abilities: [...x.unit.abilities, { name: 'Shield', text: 'This model has a 4+ invulnerable save.', source: 'bsdata' as const }] } } : x)) })) } };
  render(<Harness data={withInv} />);
  const overlord = screen.getByRole('button', { name: /^Overlord/ });
  expect(within(overlord).getAllByRole('term').map((t) => t.textContent)).toEqual(['M', 'T', 'Sv', 'Inv', 'W']);
  expect(within(overlord).getByText('Inv').nextElementSibling).toHaveTextContent('4+');
});

test('a Warlord with a trait shows it in the badge', () => {
  const withTrait = { ...data, army: { ...data.army, roles: data.army.roles.map((r) => ({ ...r, units: r.units.map((x) => (x.warlord ? { ...x, warlordTrait: 'Blood-Fuelled Fury' } : x)) })) } };
  render(<Harness data={withTrait} />);
  expect(screen.getByRole('button', { name: /^Overlord/ })).toHaveTextContent('Warlord · Blood-Fuelled Fury');
});

test('a unit sheet: datasheet, no repeated name heading, Previous and Next across the army', async () => {
  const u = userEvent.setup();
  render(<Harness data={data} />);
  await u.click(screen.getByRole('button', { name: /^Necron Warriors/ }));
  const sheet = screen.getByRole('dialog', { name: 'Necron Warriors' });
  expect(within(sheet).getByText(/Troops · 10 models · 110 pts/)).toBeInTheDocument();
  expect(within(sheet).getAllByRole('heading', { name: 'Necron Warriors' })).toHaveLength(1);
  expect(within(sheet).getByRole('heading', { name: 'Weapons' })).toBeInTheDocument();
  // The weapon's count (the stats table has its own "Necron Warrior ×10").
  expect(within(within(sheet).getByRole('region', { name: 'Weapons' })).getByText('×10')).toBeInTheDocument();
  const nav = within(sheet).getByRole('navigation', { name: 'Other units in this army' });
  expect(within(nav).getByRole('button', { name: /^Previous/ })).toHaveTextContent('Royal Warden');
  await u.click(within(nav).getByRole('button', { name: /^Next/ }));
  expect(screen.getByRole('dialog', { name: 'Immortals' })).toBeInTheDocument();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Immortals' })).toHaveFocus();
});

test('first unit has no Previous, last has no Next', async () => {
  const u = userEvent.setup();
  render(<Harness data={data} />);
  await u.click(screen.getByRole('button', { name: /^Overlord/ }));
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /^Previous/ })).not.toBeInTheDocument();
  await u.click(closeButton());
  await u.click(screen.getByRole('button', { name: /^Skorpekh Destroyers/ }));
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /^Next/ })).not.toBeInTheDocument();
});

test('army rules and stratagems sheets; "Show every stratagem" widens the list', async () => {
  const u = userEvent.setup();
  render(<Harness data={data} />);
  await u.click(screen.getByRole('button', { name: /^Army rules/ }));
  const rules = screen.getByRole('dialog', { name: 'Army rules' });
  expect(within(rules).getByRole('heading', { name: 'Your choices' })).toBeInTheDocument();
  expect(within(rules).getByRole('heading', { name: 'Faction rules' })).toBeInTheDocument();
  expect(within(rules).getByRole('heading', { name: /Awakened By Murder/ })).toHaveTextContent('Novokh');
  expect(within(rules).getByText('Reanimation Protocols')).toBeInTheDocument();
  await u.click(closeButton());
  await u.click(screen.getByRole('button', { name: /^Stratagems/ }));
  const strats = screen.getByRole('dialog', { name: 'Stratagems' });
  expect(within(strats).getByText('Showing stratagems for your faction and its choices.')).toBeInTheDocument();
  expect(within(strats).getByText('Blood Rites')).toBeInTheDocument();
  expect(within(strats).queryByText('Talent for Annihilation')).not.toBeInTheDocument();
  expect(within(strats).getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Before battle');
  await u.click(within(strats).getByRole('checkbox', { name: 'Show every stratagem' }));
  expect(within(strats).getByText('Talent for Annihilation')).toBeInTheDocument();
});

test('no army rules', async () => {
  const u = userEvent.setup();
  render(<Harness data={{ ...data, rules: [] }} />);
  await u.click(screen.getByRole('button', { name: /^Army rules/ }));
  expect(within(screen.getByRole('dialog', { name: 'Army rules' })).getByText('No army rules found for this list.')).toBeInTheDocument();
});

test('no datasheet and no units', async () => {
  const noSheets = { ...data, army: { ...data.army, units: data.army.units.map((x) => ({ ...x, unit: null })), roles: data.army.roles.map((r) => ({ ...r, units: r.units.map((x) => ({ ...x, unit: null })) })) } };
  const u = userEvent.setup();
  const { unmount } = render(<Harness data={noSheets} />);
  expect(within(screen.getByRole('button', { name: /^Immortals/ })).queryByRole('term')).not.toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: /^Immortals/ }));
  expect(screen.getByText('This unit has no datasheet in the rules data.')).toBeInTheDocument();
  unmount();
  render(<Harness data={{ ...data, army: { ...data.army, units: [], roles: [] } }} />);
  expect(screen.getByText('No units in this list yet.')).toBeInTheDocument();
});

test('a sheet for a unit the army does not have renders nothing', () => {
  render(
    <WordingProvider initial="plain">
      <PlaySheets data={data} open={{ kind: 'unit', selId: 'not-a-unit' }} onOpen={() => {}} />
    </WordingProvider>,
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
