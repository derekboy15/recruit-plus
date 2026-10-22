import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { generatedMissions, mission } from './__fixtures__/missions';
import { testSetup } from './__fixtures__/setup';
import { deriveState, makeEvent, type EventBody, type Pos, type TableEvent, type TableGameData } from './game';
import { describeEvent, LogPanel } from './LogPanel';
import { ScoreSheet } from './ScoreSheet';

const all = generatedMissions();
const pack = all.packs.find((p) => p.id === 'arks-of-omen')!;
const pos: Pos = { round: 2, turn: 1, phase: 'shooting' };
let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`score-sheet-${++n}`);
});
afterEach(() => db.close());

function Harness({ events = [], Panel }: { events?: EventBody[]; Panel: 'score' | 'log' }) {
  const [data, setData] = useState<TableGameData>({
    mode: 'table', schema: 1, setup: testSetup(),
    events: [makeEvent({ t: 'start' }, null), makeEvent({ t: 'advance', to: pos }, null), ...events.map((e) => makeEvent(e, pos))],
  });
  const append = async (es: TableEvent[]) => setData((d) => ({ ...d, events: [...d.events, ...es] }));
  const state = deriveState(data, pack);
  return (
    <TestProviders db={db} router={false}>
      {Panel === 'score'
        ? <ScoreSheet data={data} pack={pack} mission={mission('aoo-cleanse-the-land')} state={state} append={append} />
        : <LogPanel data={data} missions={all} append={append} />}
      <output data-testid="events">{JSON.stringify(data.events.map((e) => ({ ...e, id: undefined, at: undefined })))}</output>
    </TestProviders>
  );
}
const events = () => JSON.parse(screen.getByTestId('events').textContent!) as EventBody[];

test('secondary stepper stops at 15 shown', async () => {
  const u = userEvent.setup();
  render(<Harness Panel="score" events={[{ t: 'vp', player: 'A', category: 'secondary', sourceId: 'aoo-grind-them-down', vp: 14, detail: '' }]} />);
  const you = screen.getByRole('region', { name: 'You' });
  expect(within(you).getByText('Grind Them Down')).toBeInTheDocument();
  expect(within(you).getByText('14 / 15')).toBeInTheDocument();
  await u.click(within(you).getByRole('button', { name: 'More VP: Grind Them Down' }));
  expect(within(you).getByText('15 / 15')).toBeInTheDocument();
  expect(within(you).getByRole('button', { name: 'More VP: Grind Them Down' })).toBeDisabled();
  expect(events().at(-1)).toMatchObject({ t: 'vp', player: 'A', category: 'secondary', sourceId: 'aoo-grind-them-down', vp: 1 });
});

test('primary shows its total out of 45 and the VP by round', () => {
  render(<Harness Panel="score" events={[{ t: 'vp', player: 'B', category: 'primary', sourceId: 'hold', vp: 8, detail: '' }]} />);
  const opp = screen.getByRole('region', { name: 'Opponent' });
  expect(within(opp).getByText('8 / 45')).toBeInTheDocument();
  expect(within(opp).getByText('Round 2: 8')).toBeInTheDocument();
});

test('manual CP minus never below 0', async () => {
  const u = userEvent.setup();
  render(<Harness Panel="score" events={[{ t: 'cp', player: 'A', delta: -6, reason: 'manual' }]} />);
  const you = screen.getByRole('region', { name: 'You' });
  expect(within(you).getByText('0 CP')).toBeInTheDocument();
  expect(within(you).getByRole('button', { name: 'Spend 1 CP: You' })).toBeDisabled();
  await u.click(within(you).getByRole('button', { name: 'Gain 1 CP: You' }));
  expect(within(you).getByText('1 CP')).toBeInTheDocument();
});

test('a second manual CP gain in a battle round shows the 1 CP limit warning', async () => {
  const u = userEvent.setup();
  render(<Harness Panel="score" />);
  const you = screen.getByRole('region', { name: 'You' });
  await u.click(within(you).getByRole('button', { name: 'Gain 1 CP: You' }));
  expect(within(you).queryByText(/1 CP per battle round/)).toBeNull();
  await u.click(within(you).getByRole('button', { name: 'Gain 1 CP: You' }));
  expect(within(you).getByText(/1 CP per battle round/)).toBeInTheDocument();
});

test('log lists events newest first in words', () => {
  render(<Harness Panel="log" events={[
    { t: 'cp', player: 'A', delta: 1, reason: 'bonus', note: 'Battle-forged CP bonus' },
    { t: 'vp', player: 'A', category: 'primary', sourceId: 'hold', vp: 8, detail: '2 controlled, opponent 1' },
    { t: 'stratagem', player: 'B', stratagemId: 'x', name: 'Fire Overwatch', cp: 1 },
    { t: 'roll', label: 'Dice', sides: 6, dice: [6, 4, 1] },
  ]} />);
  const items = within(screen.getByRole('list', { name: 'Game log' })).getAllByRole('listitem').map((li) => li.textContent);
  expect(items[0]).toBe('Round 2 · You · Shooting: Rolled 3D6: 6 4 1 (Dice)');
  expect(items[1]).toBe('Round 2 · You · Shooting: Opponent used Fire Overwatch (1 CP)');
  expect(items[2]).toBe('Round 2 · You · Shooting: You scored 8 VP, primary (2 controlled, opponent 1)');
  expect(items[3]).toBe('Round 2 · You · Shooting: You +1 CP (Battle-forged CP bonus)');
  expect(items.at(-1)).toBe('Game started');
});

test('describeEvent covers skips, losses, notes and the end', () => {
  const s = testSetup();
  const e = (b: EventBody) => describeEvent(makeEvent(b, pos), s, all);
  expect(e({ t: 'vp', player: 'B', category: 'secondary', sourceId: 'aoo-grind-them-down', vp: 0, detail: 'skipped' })).toBe('Round 2 · You · Shooting: Opponent skipped Grind Them Down');
  expect(e({ t: 'vp', player: 'A', category: 'primary', sourceId: 'wisdom', vp: -1, detail: '' })).toMatch(/You lost 1 VP, primary/);
  expect(e({ t: 'note', text: 'Tabled the left flank' })).toMatch(/Note: Tabled the left flank$/);
  expect(e({ t: 'end', reason: 'concede', concededBy: 'B' })).toMatch(/Opponent conceded/);
  expect(e({ t: 'cp', player: 'A', delta: 0, reason: 'bonus', note: 'No Battle-forged CP bonus (Secret Intel Inbound)' })).toMatch(/You: No Battle-forged CP bonus \(Secret Intel Inbound\)$/);
});

test('note is saved', async () => {
  const u = userEvent.setup();
  render(<Harness Panel="log" />);
  await u.type(screen.getByRole('textbox', { name: 'Add a note' }), 'Deep strike next turn');
  await u.click(screen.getByRole('button', { name: 'Add a note' }));
  await waitFor(() => expect(events().at(-1)).toMatchObject({ t: 'note', text: 'Deep strike next turn' }));
  expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue('');
});
