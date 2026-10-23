import { stateOf, type Command, type GameRecord } from '@recruit/engine';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { MovementPanel } from './MovementPanel';

const inMovement = (o: Parameters<typeof deployedGame>[0] = {}): GameRecord => must(deployedGame({ rollWindows: false, ...o }), { type: 'endPhase', by: 'A' } as Command);
const pos = (g: GameRecord, id: string) => stateOf(g).models[id].pos!;

async function startMove(kind: 'Normal Move' | 'Advance', g = inMovement()) {
  const h = renderPanel(MovementPanel, g);
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  await userEvent.click(screen.getByRole('button', { name: kind }));
  return h;
}

test('Normal Move then dragging the unit 5" and Confirm moves it', async () => {
  const h = await startMove('Normal Move');
  // One ring, around the model being moved (the first one until another is dragged).
  expect(h.rings().filter((r) => r.kind === 'move')).toEqual([{ center: { x: 14, y: 4 }, r: 5, kind: 'move', label: '5"' }]);
  h.drag('A:war.m1', { x: 14, y: 9 });
  const confirm = screen.getByRole('button', { name: 'Confirm move' });
  await waitFor(() => expect(confirm).toBeEnabled());
  await userEvent.click(confirm);
  expect(pos(h.record(), 'A:war.m10').y).toBeCloseTo(9);
  expect(stateOf(h.record()).units['A:war'].turn.moved).toBe('normal');
});

test('the move ring follows the model being dragged', async () => {
  const h = await startMove('Normal Move');
  h.drag('A:war.m3', { x: 17, y: 6 });
  await waitFor(() => expect(h.rings().filter((r) => r.kind === 'move')).toEqual([{ center: { x: 17, y: 4 }, r: 5, kind: 'move', label: '5"' }]));
});

test('a 7" drag of 5" infantry stops on the 5" ring, and the move is allowed', async () => {
  const h = await startMove('Normal Move');
  h.drag('A:war.m1', { x: 14, y: 11 });
  expect(h.plan()!.positions['A:war.m1'].y).toBeCloseTo(9, 10);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm move' })).toBeEnabled());
  expect(h.invalid()).toEqual([]);
});

test('after an Advance roll of 4, a drag stops on the 9" ring', async () => {
  const h = await startMove('Advance', inMovement({ rollWindows: true, scriptedDice: [4] }));
  h.act({ type: 'confirmRoll', by: 'A' } as Command);
  await waitFor(() => expect(h.rings().find((r) => r.kind === 'move')).toMatchObject({ r: 9 }));
  h.drag('A:war.m1', { x: 14, y: 15 });
  expect(h.plan()!.positions['A:war.m1'].y).toBeCloseTo(13, 10);
});

test('Advance opens the roll; after accepting, the rings grow by the roll', async () => {
  const h = await startMove('Advance', inMovement({ rollWindows: true, scriptedDice: [4] }));
  expect(stateOf(h.record()).pending?.kind).toBe('roll');
  h.act({ type: 'confirmRoll', by: 'A' } as Command);
  await waitFor(() => expect(h.rings().find((r) => r.kind === 'move')).toMatchObject({ r: 9, label: '9"' }));
});

test('Remain Stationary records the unit as stationary', async () => {
  const h = renderPanel(MovementPanel, inMovement());
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  await userEvent.click(screen.getByRole('button', { name: 'Remain Stationary' }));
  expect(stateOf(h.record()).units['A:war'].turn.moved).toBe('stationary');
});

test('Turn right 15° sends a move with rot −π/12', async () => {
  const h = await startMove('Normal Move');
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  await userEvent.click(screen.getByRole('button', { name: 'Turn right 15°' }));
  const confirm = screen.getByRole('button', { name: 'Confirm move' });
  await waitFor(() => expect(confirm).toBeEnabled());
  await userEvent.click(confirm);
  expect(pos(h.record(), 'A:war.m1').rot).toBeCloseTo(-Math.PI / 12);
  expect(pos(h.record(), 'A:war.m2').rot).toBe(0);
});

test('Cancel ends a Normal Move without moving', async () => {
  const h = await startMove('Normal Move');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(stateOf(h.record()).activation).toBeNull();
  expect(h.plan()).toBeNull();
});

test('End Movement goes on to the Reinforcements step', async () => {
  const h = renderPanel(MovementPanel, inMovement());
  await userEvent.click(screen.getByRole('button', { name: 'End Movement' }));
  expect(stateOf(h.record()).step).toBe('reinforcements');
});
