import { newGame, stateOf, type Command, type Pos } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { must, sampleSetup } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { FirstTurnPanel } from './FirstTurnPanel';

const row = (ids: string[], y: number) => Object.fromEntries(ids.map((id, i): [string, Pos] => [id, { x: 14 + i * 1.5, y, z: 0, rot: 0 }]));

test('roll off, choose and start the battle', async () => {
  let g = newGame({ ...sampleSetup(), firstTurn: undefined });
  g = must(g, { type: 'deploy', by: 'B', unitId: 'B:int', positions: row(stateOf(g).units['B:int'].modelIds, 26) } as Command);
  g = must(g, { type: 'deploy', by: 'A', unitId: 'A:war', positions: row(stateOf(g).units['A:war'].modelIds, 4) } as Command);
  const h = renderPanel(FirstTurnPanel, g);
  await userEvent.click(screen.getByRole('button', { name: 'Roll off' }));
  const winner = stateOf(h.record()).rollOffWinner!;
  expect(screen.getByText(`${winner === 'A' ? 'Necrons' : 'Ultramarines'} won the roll-off: who goes first?`)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Necrons goes first' }));
  await userEvent.click(screen.getByRole('button', { name: 'Start the battle' }));
  expect(stateOf(h.record())).toMatchObject({ phase: 'command', round: 1, active: 'A' });
});
