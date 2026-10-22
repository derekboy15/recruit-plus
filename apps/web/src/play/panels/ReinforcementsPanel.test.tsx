import { newGame, stateOf, type Command, type GameRecord, type Pos } from '@recruit/engine';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { must, sampleSetup } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { ReinforcementsPanel } from './ReinforcementsPanel';

const row = (g: GameRecord, unitId: string, y: number) =>
  Object.fromEntries(stateOf(g).units[unitId].modelIds.map((id, i): [string, Pos] => [id, { x: 14 + i * 1.5, y, z: 0, rot: 0 }]));

/** The Librarian waits in Strategic Reserves; play on to the Ultramarines' Reinforcements step of the given round. */
function reinforcements(round: number): GameRecord {
  let g = newGame(sampleSetup({ librarian: true, rollWindows: false }));
  g = must(g, { type: 'declareReserves', by: 'B', unitIds: ['B:lib'], kind: 'strategic' } as Command);
  g = must(g, { type: 'deploy', by: 'B', unitId: 'B:int', positions: row(g, 'B:int', 26) } as Command);
  g = must(g, { type: 'deploy', by: 'A', unitId: 'A:war', positions: row(g, 'A:war', 4) } as Command);
  g = must(g, { type: 'beginBattle', by: 'A' } as Command);
  for (let guard = 0; guard < 60; guard++) {
    const s = stateOf(g);
    if (s.round === round && s.active === 'B' && s.step === 'reinforcements') return g;
    g = must(g, { type: s.phase === 'movement' && s.active === 'B' && s.round === round ? 'endStep' : 'endPhase', by: s.active } as Command);
  }
  throw new Error('never reached the Reinforcements step');
}

async function place(g: GameRecord, at: { x: number; y: number }) {
  const h = renderPanel(ReinforcementsPanel, g);
  await userEvent.click(screen.getByRole('button', { name: /Librarian/ }));
  h.tap(at);
  return h;
}

test('a unit in reserve arrives where tapped when the engine allows it', async () => {
  const h = await place(reinforcements(2), { x: 3, y: 26 });
  const go = screen.getByRole('button', { name: 'Set up Librarian' });
  await waitFor(() => expect(go).toBeEnabled());
  await userEvent.click(go);
  expect(stateOf(h.record()).units['B:lib'].location).toBe('battlefield');
});

test('it shows the 9" rule when set up too close to the enemy', async () => {
  await place(reinforcements(2), { x: 14, y: 12 });
  expect(await screen.findByText(/more than 9"/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Set up Librarian' })).toBeDisabled();
});

test("in battle round 1 it says reserves can't arrive yet", async () => {
  await place(reinforcements(1), { x: 3, y: 26 });
  expect(await screen.findByText(/can't arrive from reserve before battle round 2/)).toBeInTheDocument();
});

test('End Movement phase moves on to the Psychic phase', async () => {
  const h = renderPanel(ReinforcementsPanel, reinforcements(1));
  await userEvent.click(screen.getByRole('button', { name: 'End Movement phase' }));
  expect(stateOf(h.record()).phase).toBe('psychic');
});
