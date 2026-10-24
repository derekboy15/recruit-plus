import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb, type RecruitDb } from '../storage/db';
import { generatedMissions } from './__fixtures__/missions';
import { testSetup } from './__fixtures__/setup';
import { deriveState, makeEvent, type Pos, type TableEvent, type TableGameData } from './game';
import { StratagemPanel } from './StratagemPanel';

const pack = generatedMissions().packs.find((p) => p.id === 'arks-of-omen')!;
let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`stratagems-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
});

function Harness({ pos, cp = 6, armyChoices }: { pos: Pos; cp?: number; armyChoices?: string[] }) {
  const setup = testSetup();
  setup.players.A.startingCp = cp;
  if (armyChoices) setup.players.A.armyChoices = armyChoices;
  const [data, setData] = useState<TableGameData>({ mode: 'table', schema: 1, setup, events: [makeEvent({ t: 'start' }, null), makeEvent({ t: 'advance', to: pos }, null)] });
  const append = async (es: TableEvent[]) => setData((d) => ({ ...d, events: [...d.events, ...es] }));
  return (
    <TestProviders db={db} router={false}>
      <StratagemPanel data={data} state={deriveState(data, pack)} append={append} />
      <output data-testid="events">{JSON.stringify(data.events.map((e) => ({ t: e.t, ...(e.t === 'cp' || e.t === 'stratagem' ? e : {}) })))}</output>
    </TestProviders>
  );
}
const events = () => JSON.parse(screen.getByTestId('events').textContent!);
const card = (section: HTMLElement, name: string) => within(section).getByRole('heading', { name }).closest('article') as HTMLElement;

test('the active and reacting players each see their phase stratagems', async () => {
  render(<Harness pos={{ round: 2, turn: 1, phase: 'shooting' }} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  const theirs = screen.getByRole('region', { name: 'Opponent (reacting)' });
  await waitFor(() => expect(within(theirs).getByRole('heading', { name: 'Grot Shields' })).toBeInTheDocument());
  expect(within(mine).getByRole('heading', { name: 'Command Re-roll' })).toBeInTheDocument();
  expect(within(mine).queryByRole('heading', { name: 'Grot Shields' })).toBeNull();
  expect(within(theirs).queryByRole('heading', { name: 'Fire Overwatch' })).toBeNull();
});

test('Use spends CP and logs', async () => {
  const u = userEvent.setup();
  render(<Harness pos={{ round: 2, turn: 1, phase: 'shooting' }} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  await u.click(within(card(mine, 'Command Re-roll')).getByRole('button', { name: 'Use (1 CP)' }));
  expect(events().slice(-2)).toMatchObject([{ t: 'stratagem', player: 'A', name: 'Command Re-roll', cp: 1 }, { t: 'cp', player: 'A', delta: -1, reason: 'stratagem' }]);
  expect(within(mine).getByText(/You have 5 CP/)).toBeInTheDocument();
});

test('same stratagem twice in a phase warns', async () => {
  const u = userEvent.setup();
  render(<Harness pos={{ round: 2, turn: 1, phase: 'shooting' }} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  await u.click(within(card(mine, 'Command Re-roll')).getByRole('button', { name: 'Use (1 CP)' }));
  const c = card(mine, 'Command Re-roll');
  expect(within(c).getByText('Already used this phase')).toBeInTheDocument();
  await u.click(within(c).getByRole('button', { name: 'Use again anyway (1 CP)' }));
  expect(events().filter((e: { t: string }) => e.t === 'stratagem')).toHaveLength(2);
});

test('"1/2" cost asks', async () => {
  const u = userEvent.setup();
  render(<Harness pos={{ round: 2, turn: 1, phase: 'fight' }} armyChoices={['Annihilation Legion']} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  const c = await waitFor(() => card(mine, 'Lurking Murderers'));
  expect(within(c).getByRole('button', { name: 'Use (1 CP)' })).toBeInTheDocument();
  await u.click(within(c).getByRole('button', { name: 'Use (2 CP)' }));
  expect(events().at(-1)).toMatchObject({ t: 'cp', delta: -2 });
});

test("can't use a stratagem without the CP", async () => {
  render(<Harness pos={{ round: 2, turn: 1, phase: 'movement' }} cp={1} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  await waitFor(() => expect(within(card(mine, 'Desperate Breakout')).getByRole('button', { name: 'Use (2 CP)' })).toBeDisabled());
  expect(within(card(mine, 'Command Re-roll')).getByRole('button', { name: 'Use (1 CP)' })).toBeEnabled();
});

test('a group chip narrows the faction stratagems', async () => {
  const u = userEvent.setup();
  render(<Harness pos={{ round: 2, turn: 1, phase: 'fight' }} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  await u.click(await within(mine).findByRole('button', { name: 'Show all stratagems' }));
  await waitFor(() => card(mine, 'Lurking Murderers'));
  await u.click(within(mine).getByRole('button', { name: 'Szarekhan' }));
  expect(within(mine).queryByRole('heading', { name: 'Lurking Murderers' })).toBeNull();
  expect(within(mine).getByRole('heading', { name: 'Command Re-roll' })).toBeInTheDocument();
});

const shooting: Pos = { round: 1, turn: 1, phase: 'shooting' };

test("a Novokh army sees its own and core stratagems, not other dynasties'", async () => {
  const u = userEvent.setup();
  render(<Harness pos={shooting} armyChoices={['Novokh']} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  expect(within(mine).getByText('Showing Core Book, Necrons and Novokh stratagems.')).toBeVisible();
  expect(within(mine).getByRole('heading', { name: 'Command Re-roll' })).toBeVisible();
  expect(within(mine).queryByRole('heading', { name: 'Methodical Destruction' })).toBeNull(); // Sautekh
  expect(within(mine).queryByRole('heading', { name: 'Hyperdense Particle Beams' })).toBeNull(); // Cult of the Cryptek
  expect(within(mine).queryByRole('button', { name: 'Szarekhan' })).toBeNull(); // the group chips wait for Show all
  const all = within(mine).getByRole('button', { name: 'Show all stratagems' });
  expect(all).toHaveAttribute('aria-pressed', 'false');
  await u.click(all);
  expect(all).toHaveAttribute('aria-pressed', 'true');
  expect(within(mine).getByRole('heading', { name: 'Methodical Destruction' })).toBeVisible();
  expect(within(mine).getByRole('button', { name: 'Szarekhan' })).toBeVisible();
  await u.click(all);
  expect(within(mine).queryByRole('heading', { name: 'Methodical Destruction' })).toBeNull();
});

test('a game saved before armyChoices existed shows the main group and core only', async () => {
  render(<Harness pos={shooting} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  expect(within(mine).getByText('Showing Core Book and Necrons stratagems.')).toBeVisible();
  expect(within(mine).queryByRole('heading', { name: 'Methodical Destruction' })).toBeNull();
  const theirs = screen.getByRole('region', { name: 'Opponent (reacting)' });
  expect(within(theirs).getByText('Showing Core Book and Orks stratagems.')).toBeVisible();
});
