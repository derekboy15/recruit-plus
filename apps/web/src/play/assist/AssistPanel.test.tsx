import { stateOf, type Command } from '@recruit/engine';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../../lists/__fixtures__/generatedData';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { AssistPanel } from './AssistPanel';

beforeEach(() => {
  resetDataCache();
  stubGeneratedData();
});
afterEach(() => vi.unstubAllGlobals());

const shootingPhase = () => {
  let g = deployedGame();
  for (let i = 0; i < 3; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  return g;
};

test("shows the selected unit's abilities in plain English with an official-wording toggle", async () => {
  const h = renderPanel(AssistPanel, shootingPhase());
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  const unit = await screen.findByRole('region', { name: 'Necron Warriors' });
  expect(within(unit).getByText(/^Whenever an enemy unit shoots or fights/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Official wording' }));
  expect(within(unit).queryByText(/^Whenever an enemy unit shoots or fights/)).toBeNull();
});

test("lists the acting player's stratagems for this moment and spends CP on one", async () => {
  const g = shootingPhase();
  const h = renderPanel(AssistPanel, g);
  const list = await screen.findByRole('region', { name: 'Stratagems now' });
  expect(within(list).queryByText('Command Re-roll')).toBeNull();
  const first = within(list).getAllByRole('button', { name: /^Use \(\d CP\)$/ })[0];
  const cost = Number(/\((\d) CP\)/.exec(first.textContent!)![1]);
  await userEvent.click(first);
  expect(stateOf(h.record()).cp.A).toBe(stateOf(g).cp.A - cost);
  expect(h.record().batches.at(-1)!.events[0].type).toBe('stratagemUsed');
});

test("lists the army's rules by name", async () => {
  renderPanel(AssistPanel, deployedGame());
  const rules = await screen.findByRole('region', { name: 'Army rules' });
  expect(within(rules).getByText('The Royal Court')).toBeInTheDocument();
});
