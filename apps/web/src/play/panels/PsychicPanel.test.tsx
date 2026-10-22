import { stateOf, type Command, type GameRecord } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { PsychicPanel } from './PsychicPanel';

/** The Ultramarines' Psychic phase, with the Necron Warriors 14" from the Librarian. */
function psychic(): GameRecord {
  let g = deployedGame({ librarian: true, aY: 12 });
  for (let guard = 0; guard < 20 && !(stateOf(g).active === 'B' && stateOf(g).phase === 'psychic'); guard++) g = must(g, { type: 'endPhase', by: stateOf(g).active } as Command);
  expect(stateOf(g)).toMatchObject({ active: 'B', phase: 'psychic' });
  return g;
}

test('a Librarian manifests Smite at the closest enemy', async () => {
  const h = renderPanel(PsychicPanel, psychic());
  await userEvent.click(screen.getByRole('button', { name: /Librarian/ }));
  expect(screen.getByText('Smite hits the closest visible enemy unit within 18": Necron Warriors.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Manifest Smite (warp charge 5)' }));
  const s = stateOf(h.record());
  expect(s.pending?.kind).toBe('roll');
  expect(s.units['B:lib'].turn.psychicAttempts).toBe(1);
});

test('the Librarian lists the powers on its datasheet', async () => {
  renderPanel(PsychicPanel, psychic());
  await userEvent.click(screen.getByRole('button', { name: /Librarian/ }));
  expect(screen.getAllByRole('button', { name: /^Manifest / }).length).toBeGreaterThanOrEqual(1);
});

test('End Psychic phase moves on to Shooting', async () => {
  const h = renderPanel(PsychicPanel, psychic());
  await userEvent.click(screen.getByRole('button', { name: 'End Psychic phase' }));
  expect(stateOf(h.record()).phase).toBe('shooting');
});
