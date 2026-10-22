import { stateOf, type Command } from '@recruit/engine';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { chargePhase } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { ChargePanel } from './ChargePanel';

async function declare(dice: number[]) {
  const h = renderPanel(ChargePanel, chargePhase(dice));
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  expect(h.rings().filter((r) => r.kind === 'charge')[0]).toMatchObject({ label: '12"' });
  h.tap({ x: 18, y: 10 }, 'B:int.m1');
  expect(h.targets()).toEqual(['B:int']);
  await userEvent.click(screen.getByRole('button', { name: 'Declare charge' }));
  // The Ultramarines don't react (no Overwatch).
  h.act({ type: 'respond', by: 'B', choice: 'decline' } as Command);
  return h;
}

test('declare a charge, accept the roll and charge into Engagement Range', async () => {
  const h = await declare([6, 5]);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Necron Warriors charges: 11"' })).toBeInTheDocument());
  h.drag('A:war.m1', { x: 14, y: 8.4 });
  const confirm = screen.getByRole('button', { name: 'Confirm charge move' });
  await waitFor(() => expect(confirm).toBeEnabled());
  await userEvent.click(confirm);
  const s = stateOf(h.record());
  expect(s.units['A:war'].turn.charged).toBe(true);
  expect(s.activation).toBeNull();
});

test('a charge move that ends short shows why', async () => {
  const h = await declare([6, 5]);
  await screen.findByRole('heading', { name: /charges: 11"/ });
  h.drag('A:war.m1', { x: 14, y: 6 });
  expect(await screen.findByText(/must end within 1" of every target/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm charge move' })).toBeDisabled();
});

test('a failed charge roll offers The charge fails', async () => {
  const h = await declare([1, 1]);
  await screen.findByRole('heading', { name: 'Necron Warriors charges: 2"' });
  await userEvent.click(screen.getByRole('button', { name: 'The charge fails' }));
  expect(h.record().batches.at(-1)!.events.map((e) => e.type)).toContain('chargeFailed');
});

test('a charging model can be turned', async () => {
  const h = await declare([6, 5]);
  await screen.findByRole('heading', { name: /charges: 11"/ });
  h.drag('A:war.m1', { x: 14, y: 8.4 });
  await userEvent.click(screen.getByRole('button', { name: 'Turn left 15°' }));
  const confirm = screen.getByRole('button', { name: 'Confirm charge move' });
  await waitFor(() => expect(confirm).toBeEnabled());
  await userEvent.click(confirm);
  expect(stateOf(h.record()).models['A:war.m1'].pos!.rot).toBeCloseTo(Math.PI / 12);
});
