import { stateOf, type Command } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { HeroicPanel } from './HeroicPanel';

test('with no Heroic Intervention to make, the step ends and the Fight phase starts', async () => {
  let g = deployedGame({ rollWindows: false });
  for (let i = 0; i < 4; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  g = must(g, { type: 'endStep', by: 'A' } as Command);
  expect(stateOf(g).step).toBe('heroic-interventions');
  const h = renderPanel(HeroicPanel, g);
  expect(screen.getByRole('heading', { name: 'Ultramarines: Heroic Interventions' })).toBeInTheDocument();
  expect(screen.getByText('No character can Heroically Intervene.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'No more Heroic Interventions' }));
  expect(stateOf(h.record()).phase).toBe('fight');
});
