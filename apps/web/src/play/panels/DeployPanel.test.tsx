import { newGame, stateOf } from '@recruit/engine';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { sampleSetup } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { DeployPanel } from './DeployPanel';

const fresh = () => newGame(sampleSetup());

test('tapping a unit then the board places it in formation and Deploy sets it up', async () => {
  const h = renderPanel(DeployPanel, fresh());
  // Necrons attack, so the Ultramarines (the Defender) set up first.
  expect(screen.getByRole('heading', { name: 'Ultramarines sets up a unit' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Intercessor Squad/ }));
  h.tap({ x: 22, y: 25 });
  expect(Object.keys(h.plan()!.positions)).toHaveLength(5);
  expect(h.canDrag('B:int.m1')).toBe(true);
  const deploy = screen.getByRole('button', { name: 'Deploy Intercessor Squad' });
  await waitFor(() => expect(deploy).toBeEnabled());
  await userEvent.click(deploy);
  expect(stateOf(h.record()).units['B:int'].location).toBe('battlefield');
  expect(h.record().batches.at(-1)!.events.map((e) => e.type)).toContain('unitDeployed');
  expect(await screen.findByRole('heading', { name: 'Necrons sets up a unit' })).toBeInTheDocument();
});

test("Deploy stays disabled with the engine's reason when a model is outside the zone", async () => {
  const h = renderPanel(DeployPanel, fresh());
  await userEvent.click(screen.getByRole('button', { name: /Intercessor Squad/ }));
  h.tap({ x: 22, y: 25 });
  h.drag('B:int.m1', { x: 22, y: 15 });
  await waitFor(() => expect(screen.getByText(/must be wholly within your deployment zone/)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Deploy Intercessor Squad' })).toBeDisabled();
  expect(h.invalid().length).toBeGreaterThan(0);
});

test('Strategic Reserves puts the unit in reserve', async () => {
  const h = renderPanel(DeployPanel, newGame(sampleSetup({ librarian: true })));
  await userEvent.click(screen.getByRole('button', { name: /Librarian/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Strategic Reserves' }));
  expect(stateOf(h.record()).units['B:lib']).toMatchObject({ location: 'reserves', reserveKind: 'strategic' });
});

test('a refused reserve shows why', async () => {
  const h = renderPanel(DeployPanel, fresh());
  await userEvent.click(screen.getByRole('button', { name: /Intercessor Squad/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Strategic Reserves' }));
  expect(h.problems()[0].message).toMatch(/No more than half your units/);
});

test('a model can be turned before deploying', async () => {
  const h = renderPanel(DeployPanel, fresh());
  await userEvent.click(screen.getByRole('button', { name: /Intercessor Squad/ }));
  h.tap({ x: 22, y: 25 });
  await userEvent.click(screen.getByRole('button', { name: 'Turn right 15°' }));
  const deploy = screen.getByRole('button', { name: 'Deploy Intercessor Squad' });
  await waitFor(() => expect(deploy).toBeEnabled());
  await userEvent.click(deploy);
  expect(stateOf(h.record()).models['B:int.m1'].pos!.rot).toBeCloseTo(-Math.PI / 12);
});
