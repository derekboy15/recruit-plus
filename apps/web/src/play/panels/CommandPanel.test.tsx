import { stateOf, type Command } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { CommandPanel } from './CommandPanel';
import { GameOverPanel } from './GameOverPanel';
import type { PanelProps } from './types';

test('ending the Command phase moves on to Movement', async () => {
  const h = renderPanel(CommandPanel, deployedGame());
  expect(screen.getByRole('heading', { name: "Necrons' Command phase" })).toBeInTheDocument();
  expect(screen.getByText(/Necrons gained 1 CP/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'End Command phase' }));
  expect(stateOf(h.record()).phase).toBe('movement');
});

const Routed = (p: PanelProps) => (
  <MemoryRouter>
    <GameOverPanel {...p} />
  </MemoryRouter>
);

test('after a concession the other army wins', () => {
  renderPanel(Routed, must(deployedGame(), { type: 'concede', by: 'A' } as Command));
  expect(screen.getByRole('heading', { name: 'Ultramarines wins' })).toBeInTheDocument();
  expect(screen.getByText('Necrons conceded.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Practice games' })).toHaveAttribute('href', '/play');
});

test('a game that ends level is a draw', () => {
  renderPanel(Routed, must(deployedGame(), { type: 'endGame', by: 'A' } as Command));
  expect(screen.getByRole('heading', { name: 'A draw' })).toBeInTheDocument();
  expect(screen.getAllByText(/Primary 0 · Secondary 0 · Painted 0/)).toHaveLength(2);
});
