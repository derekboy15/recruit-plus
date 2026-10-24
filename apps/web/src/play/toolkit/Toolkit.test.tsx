import { eligibleUnits, gameLog, stateOf, undo, type Command } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import type { PanelProps } from '../panels/types';
import { Toolkit } from './Toolkit';

const Kit = (p: PanelProps) => <Toolkit {...p} onClose={() => {}} />;
/** A toolkit button: named by its tool name followed by its description. */
const tool = (name: string) => userEvent.click(screen.getByRole('button', { name: (accessible) => accessible.startsWith(name) }));

test('moving a model by hand logs "was moved by hand" and undo puts it back', async () => {
  const h = renderPanel(Kit, deployedGame());
  await tool('Move a model by hand');
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  h.drag('A:war.m1', { x: 14, y: 6 });
  await userEvent.click(screen.getByRole('button', { name: 'Put it here' }));
  expect(stateOf(h.record()).models['A:war.m1'].pos).toMatchObject({ x: 14, y: 6 });
  expect(gameLog(h.record()).at(-1)!.text).toBe('A model of Necron Warriors was moved by hand.');
  const back = undo(h.record());
  expect(back.ok && stateOf(back.game).models['A:war.m1'].pos).toMatchObject({ x: 14, y: 4 });
});

test('removing a model asks whether it was destroyed', async () => {
  const h = renderPanel(Kit, deployedGame());
  await tool('Remove a model');
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  await userEvent.click(screen.getByRole('button', { name: 'Destroyed' }));
  expect(stateOf(h.record()).models['A:war.m1'].destroyed).toBe(true);
  expect(stateOf(h.record()).units['A:war'].turn.lostThisTurn).toBe(1);
});

test('returning a destroyed model puts it where tapped', async () => {
  const g = must(deployedGame(), { type: 'removeModel', by: 'A', modelId: 'A:war.m1', destroyed: true } as Command);
  const h = renderPanel(Kit, g);
  await tool('Return a destroyed model');
  await userEvent.click(screen.getByRole('button', { name: /Necron Warriors/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Necron Warrior (model 1)' }));
  h.tap({ x: 14, y: 6.5 });
  await userEvent.click(screen.getByRole('button', { name: 'Return it here' }));
  const m = stateOf(h.record()).models['A:war.m1'];
  expect(m.destroyed).toBe(false);
  expect(m.pos).toMatchObject({ x: 14, y: 6.5 });
  // Like Reanimation Protocols, by default it stops counting as destroyed for this turn's Morale test.
  expect(stateOf(h.record()).units['A:war'].turn.lostThisTurn).toBe(0);
});

test("+1 CP raises that player's CP", async () => {
  const g = deployedGame();
  const h = renderPanel(Kit, g);
  await tool('Command Points');
  await userEvent.click(screen.getByRole('button', { name: 'Ultramarines +1 CP' }));
  expect(stateOf(h.record()).cp.B).toBe(stateOf(g).cp.B + 1);
});

test('Shoot again lets a unit that has shot be picked to shoot', async () => {
  let g = deployedGame({ rollWindows: false, bY: 20 });
  for (let i = 0; i < 3; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  const assignments = stateOf(g).units['A:war'].modelIds.map((modelId) => ({ modelId, weapon: 'Gauss Flayer', targetUnitId: 'B:int' }));
  g = must(g, { type: 'shoot', by: 'A', unitId: 'A:war', assignments } as Command);
  expect(eligibleUnits(stateOf(g), 'shoot')).not.toContain('A:war');
  const h = renderPanel(Kit, g);
  await tool('Extra activation');
  await userEvent.click(screen.getByRole('button', { name: /Necron Warriors/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Shoot again' }));
  expect(eligibleUnits(stateOf(h.record()), 'shoot')).toContain('A:war');
});

test('setting wounds left changes the model', async () => {
  const h = renderPanel(Kit, deployedGame());
  await tool('Set wounds left');
  h.tap({ x: 18, y: 26 }, 'B:int.m1');
  await userEvent.click(screen.getByRole('button', { name: 'Fewer wounds' }));
  await userEvent.click(screen.getByRole('button', { name: 'Set 1 wound left' }));
  expect(stateOf(h.record()).models['B:int.m1'].woundsLeft).toBe(1);
});

test('objectives with only an id are numbered in the toolkit', async () => {
  const g = deployedGame();
  const ids = ['a', 'b', 'n1', 'n2'];
  renderPanel(Kit, { ...g, setup: { ...g.setup, objectives: g.setup.objectives.map((o, i) => ({ ...o, id: ids[i] })) } });
  await tool('Objectives');
  expect(screen.getByRole('combobox', { name: 'Objective 3 held by' })).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Objective n1 held by' })).toBeNull();
});

test('objectives can be given to a player', async () => {
  const h = renderPanel(Kit, deployedGame());
  await tool('Objectives');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Objective 2 held by' }), 'B');
  expect(stateOf(h.record()).objectives['2']).toEqual({ owner: 'B', sticky: false });
});
