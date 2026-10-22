import { stateOf, type Command, type GameRecord } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { MoralePanel } from './MoralePanel';

/** Two Necron Warriors were destroyed this turn; now the Morale phase. */
function moralePhase(): GameRecord {
  let g = deployedGame({ rollWindows: false });
  for (const id of ['A:war.m1', 'A:war.m2']) g = must(g, { type: 'removeModel', by: 'A', modelId: id, destroyed: true } as Command);
  for (let i = 0; i < 6; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  expect(stateOf(g)).toMatchObject({ phase: 'morale', step: 'morale-tests' });
  return g;
}

test('a unit that lost models takes a Morale test', async () => {
  const h = renderPanel(MoralePanel, moralePhase());
  expect(screen.getByText(/Necron Warriors: lost 2 models this turn · Leadership 10/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Take Morale test' }));
  expect(h.record().batches.at(-1)!.events.map((e) => e.type)).toContain('moraleTested');
  expect(screen.getByText(/passed its Morale test|failed its Morale test/)).toBeInTheDocument();
});

test('Insane Bravery spends 2 CP and passes', async () => {
  const g = moralePhase();
  const h = renderPanel(MoralePanel, g);
  await userEvent.click(screen.getByRole('button', { name: 'Insane Bravery (2 CP)' }));
  expect(stateOf(h.record()).cp.A).toBe(stateOf(g).cp.A - 2);
});

test('End Morale phase is refused while a test is left, and works after', async () => {
  const h = renderPanel(MoralePanel, moralePhase());
  await userEvent.click(screen.getByRole('button', { name: 'End Morale phase' }));
  expect(h.problems()[0].message).toBe('Necron Warriors still has to take a Morale test.');
  await userEvent.click(screen.getByRole('button', { name: 'Take Morale test' }));
  await userEvent.click(screen.getByRole('button', { name: 'End Morale phase' }));
  expect(stateOf(h.record())).toMatchObject({ phase: 'command', active: 'B' });
});
