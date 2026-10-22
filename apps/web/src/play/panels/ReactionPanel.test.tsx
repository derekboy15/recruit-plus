import { stateOf, type Command } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { ReactionPanel } from './ReactionPanel';

/** The Warriors (y = 4) start their move half an inch from the Intercessors (y = 5.76) and Fall Back. */
function fallingBack() {
  let g = deployedGame({ rollWindows: false, bY: 4 + 32 / 25.4 + 0.5 });
  g = must(g, { type: 'endPhase', by: 'A' } as Command);
  g = must(g, { type: 'beginMove', by: 'A', unitId: 'A:war', kind: 'fall-back' } as Command);
  expect(stateOf(g).pending).toMatchObject({ kind: 'reaction', reaction: 'cut-them-down', player: 'B' });
  return g;
}

test('Cut Them Down is offered to the right player and spends 1 CP when taken', async () => {
  const g = fallingBack();
  const h = renderPanel(ReactionPanel, g);
  expect(screen.getByRole('heading', { name: 'Ultramarines: Necron Warriors is falling back' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cut Them Down (1 CP)' }));
  expect(stateOf(h.record()).cp.B).toBe(stateOf(g).cp.B - 1);
  expect(stateOf(h.record()).pending).toBeNull();
});

test('No declines the reaction', async () => {
  const g = fallingBack();
  const h = renderPanel(ReactionPanel, g);
  await userEvent.click(screen.getByRole('button', { name: 'No' }));
  expect(stateOf(h.record()).cp.B).toBe(stateOf(g).cp.B);
  expect(stateOf(h.record()).pending).toBeNull();
});
