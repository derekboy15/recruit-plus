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
  const list = await screen.findByRole('region', { name: 'Necrons: stratagems now' });
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

test('before the battle it offers no one-tap rules (they apply from battle round 1)', async () => {
  const { newGame } = await import('@recruit/engine');
  const { sampleSetup } = await import('../__fixtures__/game');
  const h = renderPanel(AssistPanel, newGame(sampleSetup()));
  h.tap({ x: 0, y: 0 }, 'A:war.m1');
  expect(await screen.findByRole('region', { name: 'Necron Warriors' })).toBeInTheDocument();
  await screen.findByRole('region', { name: 'Necrons: stratagems now' });
  expect(screen.queryByText('Apply a rule (one tap)')).toBeNull();
});

test("while the Necrons shoot, the Ultramarines' stratagems for being shot are listed too, and spend their CP", async () => {
  let g = deployedGame({ rollWindows: true, bY: 20 });
  for (let i = 0; i < 3; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  const assignments = stateOf(g).units['A:war'].modelIds.map((modelId) => ({ modelId, weapon: 'Gauss Flayer', targetUnitId: 'B:int' }));
  g = must(g, { type: 'shoot', by: 'A', unitId: 'A:war', assignments } as Command);
  const h = renderPanel(AssistPanel, g);
  const theirs = await screen.findByRole('region', { name: 'Ultramarines: stratagems now' });
  const card = within(theirs).getByText('Transhuman Physiology').closest('li')!;
  await userEvent.click(within(card).getByRole('button', { name: 'Use (1 CP)' }));
  expect(stateOf(h.record()).cp.B).toBe(stateOf(g).cp.B - 1);
  expect(stateOf(h.record()).stratagemsUsed.at(-1)).toMatchObject({ player: 'B', name: 'Transhuman Physiology' });
});
