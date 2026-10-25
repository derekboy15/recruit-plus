import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { makeEvent, type Pos, type TableEvent } from './game';
import { ToolsPanel } from './ToolsPanel';
import './__fixtures__/patience';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`tools-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
});
const pos: Pos = { round: 2, turn: 1, phase: 'shooting' };

function Harness({ roll }: { roll: (sides: 3 | 6) => number }) {
  const [events, setEvents] = useState<TableEvent[]>([makeEvent({ t: 'start' }, null)]);
  return (
    <TestProviders db={db} path="/table/x">
      <ToolsPanel pos={pos} roll={roll} append={async (es) => setEvents((e) => [...e, ...es])} />
      <output data-testid="events">{JSON.stringify(events)}</output>
    </TestProviders>
  );
}
const events = () => JSON.parse(screen.getByTestId('events').textContent!) as TableEvent[];

test('the dice roller rolls, counts successes, re-rolls 1s and logs each roll', async () => {
  const u = userEvent.setup();
  const faces = [6, 1, 3, 4];
  render(<Harness roll={() => faces.shift()!} />);
  await u.click(screen.getByRole('button', { name: 'More: Dice' }));
  await u.click(screen.getByRole('button', { name: 'More: Dice' }));
  await u.click(screen.getByRole('button', { name: 'Roll 3D6' }));
  const results = screen.getByRole('list', { name: 'Results' });
  expect(within(results).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['6', '3', '1']);
  await u.click(screen.getByRole('button', { name: '3+' }));
  expect(screen.getByText('2 of 3 rolled 3+')).toBeInTheDocument();
  expect(events().at(-1)).toMatchObject({ t: 'roll', sides: 6, dice: [6, 1, 3] });
  await u.click(screen.getByRole('button', { name: 'Re-roll 1s' }));
  expect(within(results).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['6', '4', '3']);
  expect(events().at(-1)).toMatchObject({ t: 'roll', label: 'Re-roll 1s', dice: [4] });
});

test('attack odds shows the numbers for the defaults', async () => {
  const u = userEvent.setup();
  render(<Harness roll={() => 1} />);
  await u.click(screen.getByRole('tab', { name: 'Attack odds' }));
  const out = screen.getByRole('region', { name: 'Expected result' });
  const unsaved = () => within(out).getByText('Unsaved wounds').nextElementSibling!.textContent;
  // 10 shots, BS3+, S4 v T4, Sv3+: 10 × 4/6 × 3/6 × 2/6.
  expect(unsaved()).toBe('1.11');
  await u.selectOptions(screen.getByRole('combobox', { name: 'AP' }), '-2');
  expect(unsaved()).toBe('2.22');
});

test('search finds "overwatch"', async () => {
  const u = userEvent.setup();
  render(<Harness roll={() => 1} />);
  await u.click(screen.getByRole('tab', { name: 'Rules search' }));
  await u.type(await screen.findByRole('searchbox', { name: 'Search the rules' }), 'overwatch');
  await waitFor(() => expect(screen.getAllByRole('link', { name: /Fire Overwatch/ }).length).toBeGreaterThan(0));
});

test('every attack-odds control sits in the second column of a two-column grid', async () => {
  const u = userEvent.setup();
  render(<Harness roll={() => 1} />);
  await u.click(screen.getByRole('tab', { name: 'Attack odds' }));
  const grids = document.querySelectorAll('.odds__grid');
  expect(grids).toHaveLength(2);
  for (const grid of grids) {
    const cells = [...grid.children];
    expect(cells.length % 2).toBe(0);
    for (const control of cells.filter((_, i) => i % 2 === 1)) {
      expect(control.matches('select, input') || control.querySelector('button, input, select'), control.outerHTML).toBeTruthy();
    }
  }
  // The controls keep their names.
  expect(screen.getByRole('button', { name: 'More: Strength' })).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Attacks each' })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Blast' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Save' })).toBeVisible();
});
