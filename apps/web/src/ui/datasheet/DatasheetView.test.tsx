import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProfileOut, UnitOut } from '@recruit/data/model';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { necronWarriors } from '../../factions/__fixtures__/necrons';
import { WordingProvider } from '../../rules/wording';
import { DatasheetView } from './index';

const flayer: ProfileOut = { name: 'Gauss Flayer', chars: { Range: '24"', Type: 'Rapid Fire 1', S: '4', AP: '-1', D: '1', Abilities: '-' } };
const reaper: ProfileOut = { name: 'Gauss Reaper', chars: { Range: '12"', Type: 'Assault 2', S: '5', AP: '-2', D: '1', Abilities: '-' } };
const warriors: UnitOut = { ...necronWarriors, weapons: [flayer, reaper] };

const show = (ui: ReactElement) => render(<WordingProvider initial="plain">{ui}</WordingProvider>);
const box = (grid: HTMLElement, label: string) => within(grid).getByText(label, { selector: 'dt' }).parentElement!;

test('the stat grid shows each characteristic in its own box', () => {
  show(<DatasheetView unit={warriors} />);
  const grid = screen.getByRole('group', { name: 'Necron Warrior characteristics' });
  expect(within(grid).getAllByRole('term').map((t) => t.textContent)).toEqual(['M', 'WS', 'BS', 'S', 'T', 'W', 'A', 'Ld', 'Sv']);
  expect(within(box(grid, 'T')).getByText('4')).toBeInTheDocument();
  expect(within(box(grid, 'Sv')).getByText('4+')).toBeInTheDocument();
});

test('the characteristics group wraps a plain <dl>, so every dt and dd sits in a list (axe dlitem)', () => {
  show(<DatasheetView unit={warriors} />);
  const group = screen.getByRole('group', { name: 'Necron Warrior characteristics' });
  const dl = group.tagName === 'DL' ? group : group.querySelector('dl')!;
  expect(dl).not.toBeNull();
  expect(dl).not.toHaveAttribute('role');
  for (const item of dl.querySelectorAll('dt, dd')) expect(item.closest('dl')).toBe(dl);
});

test('it has no wide stats table', () => {
  const { container } = show(<DatasheetView unit={warriors} />);
  expect(container.querySelector('table.stats')).toBeNull();
  expect(container.querySelector('table')).toBeNull();
});

test('weapons are cards with the five numbers and the count', () => {
  show(<DatasheetView unit={{ ...warriors, weapons: [flayer] }} />);
  const card = screen.getByRole('article', { name: 'Gauss Flayer' });
  expect(within(card).getAllByRole('term').map((t) => t.textContent)).toEqual(['RANGE', 'TYPE', 'S', 'AP', 'D']);
  expect(within(card).getByText('Rapid Fire 1')).toBeInTheDocument();
  // A dash means no abilities: nothing is shown for it.
  expect(within(card).queryByText('-')).toBeNull();
});

test('taken weapons come first; the rest wait, closed, under Other wargear options', () => {
  show(<DatasheetView unit={warriors} taken={['Gauss Flayer']} />);
  const other = screen.getByText('Other wargear options').closest('details')!;
  expect(other).not.toHaveAttribute('open');
  expect(within(other).getByRole('article', { name: 'Gauss Reaper', hidden: true })).toBeInTheDocument();
  expect(other).not.toContainElement(screen.getByRole('article', { name: 'Gauss Flayer' }));
});

test('taken matches every profile of a multi-profile weapon', () => {
  const shooting: ProfileOut = { name: 'Staff of Light (Shooting)', chars: { Range: '18"', Type: 'Assault 3', S: '5', AP: '-2', D: '1' } };
  const melee: ProfileOut = { name: 'Staff of Light (Melee)', chars: { Range: 'Melee', Type: 'Melee', S: 'User', AP: '-2', D: '1' } };
  show(<DatasheetView unit={{ ...warriors, weapons: [shooting, melee, reaper] }} taken={['Staff of Light']} />);
  const other = screen.getByText('Other wargear options').closest('details')!;
  expect(other).not.toContainElement(screen.getByRole('article', { name: 'Staff of Light (Shooting)' }));
  expect(other).not.toContainElement(screen.getByRole('article', { name: 'Staff of Light (Melee)' }));
  expect(within(other).getByRole('article', { name: 'Gauss Reaper', hidden: true })).toBeInTheDocument();
});

test('a taken count shows on the weapon card', () => {
  show(<DatasheetView unit={warriors} taken={['10x Gauss Flayer']} />);
  expect(within(screen.getByRole('article', { name: 'Gauss Flayer' })).getByText('×10')).toBeInTheDocument();
});

test('without taken, every weapon of the unit is listed, and nothing is under Other wargear options', () => {
  show(<DatasheetView unit={warriors} />);
  expect(screen.getByRole('article', { name: 'Gauss Reaper' }).closest('details')).toBeNull();
  expect(screen.queryByText('Other wargear options')).toBeNull();
});

test('relic and chapter extras (extra: true) wait, closed, under Also available', () => {
  const relic = { ...reaper, name: 'Voidreaper', extra: true as const };
  const ability = { name: 'Relic Ability', text: 'Only with the relic.', source: 'bsdata' as const, extra: true as const };
  show(<DatasheetView unit={{ ...warriors, weapons: [flayer, relic], abilities: [...warriors.abilities, ability] }} />);
  const also = screen.getByText('Also available').closest('details')!;
  expect(also).not.toHaveAttribute('open');
  expect(within(also).getByRole('article', { name: 'Voidreaper', hidden: true })).toBeInTheDocument();
  expect(within(also).getByText('Relic Ability')).toBeInTheDocument();
  expect(also).not.toContainElement(screen.getByText('Reanimation Protocols'));
});

test('the meta line: no "Use model" base, no "1 models"', () => {
  show(<DatasheetView unit={{ ...warriors, minModels: 1, maxModels: 1, baseSize: 'Use model' }} />);
  expect(screen.queryByText(/Use model/)).toBeNull();
  expect(screen.queryByText(/1 models/)).toBeNull();
  expect(screen.getByText('Troops · 1 model · 110 pts · 6 PL')).toBeInTheDocument();
});

test('the base size shows when it is a real size', () => {
  show(<DatasheetView unit={warriors} />);
  expect(screen.getByText('Troops · 10–20 models · 110 pts · 6 PL · 32mm base')).toBeInTheDocument();
});

test('hideName: no heading with the unit name; the meta line and badges stay', () => {
  show(<DatasheetView unit={{ ...warriors, legends: true }} headingLevel={2} hideName />);
  expect(screen.queryByRole('heading', { name: /Necron Warriors/ })).toBeNull();
  expect(screen.getByText(/Troops · 10–20 models · 110 pts/)).toBeInTheDocument();
  expect(screen.getByText('Legends')).toBeInTheDocument();
});

test('headingLevel sets the name heading, and the sections sit one level below it', () => {
  const { unmount } = show(<DatasheetView unit={warriors} headingLevel={1} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Necron Warriors' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Weapons' })).toBeInTheDocument();
  unmount();
  show(<DatasheetView unit={warriors} headingLevel={2} />);
  expect(screen.getByRole('heading', { level: 2, name: 'Necron Warriors' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Abilities' })).toBeInTheDocument();
});

test('the view renders no Report button', () => {
  show(<DatasheetView unit={warriors} />);
  expect(screen.queryByRole('button', { name: /Report/ })).toBeNull();
});

test('a unit with no weapons has no Weapons section', () => {
  show(<DatasheetView unit={{ ...warriors, weapons: [] }} />);
  expect(screen.queryByRole('heading', { name: 'Weapons' })).toBeNull();
  expect(screen.queryByText(/undefined/)).toBeNull();
});

test('a degrading profile becomes one stat grid and a wound track', () => {
  const ark: UnitOut = {
    ...warriors,
    name: 'Doomsday Ark',
    models: [
      { name: 'Doomsday Ark [1] (8+ Wounds Remaining)', chars: { M: '12"', WS: '6+', BS: '3+', S: '6', T: '6', W: '14', A: '3', Ld: '10', Save: '3+' } },
      { name: 'Doomsday Ark [2] (4-7 Wounds Remaining)', chars: { M: '8"', WS: '6+', BS: '4+', S: '6', T: '6', W: 'N/A', A: 'D3', Ld: '10', Save: '3+' } },
      { name: 'Doomsday Ark [3] (1-3 Wounds Remaining)', chars: { M: '4"', WS: '6+', BS: '5+', S: '6', T: '6', W: 'N/A', A: '1', Ld: '10', Save: '3+' } },
    ],
  };
  show(<DatasheetView unit={ark} />);
  expect(screen.getAllByRole('group', { name: /characteristics$/ })).toHaveLength(1);
  const grid = screen.getByRole('group', { name: 'Doomsday Ark characteristics' });
  expect(within(box(grid, 'W')).getByText('14')).toBeInTheDocument();
  const track = screen.getByRole('region', { name: 'Wound track' });
  const rows = within(track).getAllByRole('listitem');
  expect(rows.map((li) => li.querySelector('.wound-track__label')!.textContent)).toEqual(['8+ wounds left', '4–7 wounds left', '1–3 wounds left']);
  // Only what changes is listed, and never W (N/A below the top bracket).
  expect(rows[1]).toHaveTextContent('M8"');
  expect(rows[1]).toHaveTextContent('BS4+');
  expect(rows[1]).toHaveTextContent('AD3');
  expect(rows[1]).not.toHaveTextContent('N/A');
  expect(rows[1]).not.toHaveTextContent('Ld');
});

test.each([
  [
    'the BSData typo "remaning" and a missing space',
    ['Gladiator Lancer [1] (7+ wounds remaning)', 'Gladiator Lancer [2] (4-6 wounds remaning)', 'Gladiator Lancer [3] (1-3wounds remaning)'],
    ['7+ wounds left', '4–6 wounds left', '1–3 wounds left'],
  ],
  [
    'an open-ended top range',
    ['Macharius [1] (12-22+ wounds remaining)', 'Macharius [2] (6-11 wounds remaining)', 'Macharius [3] (1-5 wounds remaining)'],
    ['12+ wounds left', '6–11 wounds left', '1–5 wounds left'],
  ],
  [
    'no "remaining" at all',
    ['Tank [1] (8-14 wounds)', 'Tank [2] (4-7 wounds)', 'Tank [3] (1-3 wounds)'],
    ['8–14 wounds left', '4–7 wounds left', '1–3 wounds left'],
  ],
  [
    'brackets listed out of order',
    ['Rhino [2] (3-5 wounds remaining)', 'Rhino [1] (6+ wounds remaining)', 'Rhino [3] (1-2 wounds remaining)'],
    ['6+ wounds left', '3–5 wounds left', '1–2 wounds left'],
  ],
  [
    'a numbered list in front of the name',
    ['3. Crimson Hunter (1-3 wounds remaining)', '1. Crimson Hunter (7+ wounds remaining)', '2. Crimson Hunter (4-6 wounds remaining)'],
    ['7+ wounds left', '4–6 wounds left', '1–3 wounds left'],
  ],
  [
    'a bare number after the name',
    ['Chaos Land Raider 3 (1-4 wounds remaining)', 'Chaos Land Raider 1 (9+ wounds remaining)', 'Chaos Land Raider 2 (5-8 wounds remaining)'],
    ['9+ wounds left', '5–8 wounds left', '1–4 wounds left'],
  ],
  [
    'square brackets round the range',
    ['Knight 1 [7+ wounds remaining]', 'Knight 2 [ 4-6 wounds remaining]', 'Knight 3 [1-3 wounds remaining]'],
    ['7+ wounds left', '4–6 wounds left', '1–3 wounds left'],
  ],
])('a wound track from %s: one stat grid with the full W, and the brackets in order', (_, names, labels) => {
  const chars = (W: string, M: string) => ({ M, WS: '6+', BS: '3+', S: '6', T: '7', W, A: '3', Ld: '8', Save: '3+' });
  // The top bracket is the one that starts at the most wounds.
  const from = (n: string) => Number(/[([]\s*(\d+)/.exec(n.replace(/^\d+\.\s*|\[\d+\]/g, ''))![1]);
  const top = names.indexOf([...names].sort((a, b) => from(b) - from(a))[0]);
  const unit: UnitOut = { ...warriors, models: names.map((name, i) => ({ name, chars: chars(i === top ? '12' : 'N/A', `${10 - i}"`) })) };
  show(<DatasheetView unit={unit} />);
  const grids = screen.getAllByRole('group', { name: /characteristics$/ });
  expect(grids).toHaveLength(1);
  const base = names[0].replace(/^\d+\.\s*/, '').replace(/\s*(\[\d+\]|\d+)?\s*[([].*$/, '');
  expect(grids[0]).toHaveAccessibleName(`${base} characteristics`);
  expect(within(box(grids[0], 'W')).getByText('12')).toBeInTheDocument();
  const rows = within(screen.getByRole('region', { name: 'Wound track' })).getAllByRole('listitem');
  expect(rows.map((li) => li.querySelector('.wound-track__label')!.textContent)).toEqual(labels);
  expect(document.body.textContent).not.toMatch(/remain|\[\d\]/i);
});

test('a single profile that merely mentions wounds stays an ordinary profile', () => {
  const unit: UnitOut = { ...warriors, models: [{ name: 'Spawn (2 wounds)', chars: { M: '8"', W: '2' } }] };
  show(<DatasheetView unit={unit} />);
  expect(screen.getByRole('group', { name: 'Spawn (2 wounds) characteristics' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Wound track' })).toBeNull();
});

test('weapon abilities follow the wording switch', async () => {
  const withText: ProfileOut = { ...flayer, chars: { ...flayer.chars, Abilities: 'Official weapon text.' }, plain: { Abilities: 'Plain weapon text.' } };
  show(<DatasheetView unit={{ ...warriors, weapons: [withText] }} />);
  expect(screen.getByText('Plain weapon text.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Official wording' }));
  expect(screen.getByText('Official weapon text.')).toBeInTheDocument();
});

test('keywords list the faction and the unit keywords', () => {
  show(<DatasheetView unit={warriors} />);
  const kw = screen.getByRole('region', { name: 'Keywords' });
  expect(kw).toHaveTextContent('Faction: Necrons, <Dynasty>');
  expect(kw).toHaveTextContent('Unit: Core, Infantry, Necron Warriors');
});

test('the meta line ends with the army choices the unit needs, any one of them', () => {
  show(<DatasheetView unit={{ ...warriors, needs: ['Sautekh dynasty'] }} />);
  expect(screen.getByText('Troops · 10–20 models · 110 pts · 6 PL · 32mm base · Needs Sautekh dynasty')).toBeInTheDocument();
  cleanup();
  show(<DatasheetView unit={{ ...warriors, needs: ['Khorne', 'Chaos Undivided'] }} />);
  expect(screen.getByText(/· Needs Khorne or Chaos Undivided$/)).toBeInTheDocument();
});
