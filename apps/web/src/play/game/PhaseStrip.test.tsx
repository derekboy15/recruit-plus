import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { PhaseStrip } from './PhaseStrip';

test('the strip shows all seven phases and marks the current one', () => {
  render(<PhaseStrip phase="shooting" />);
  const items = within(screen.getByRole('list', { name: 'Phases' })).getAllByRole('listitem');
  expect(items.map((i) => i.textContent)).toEqual(['Command', 'Movement', 'Psychic', 'Shooting', 'Charge', 'Fight', 'Morale']);
  expect(items[3]).toHaveAttribute('aria-current', 'step');
  expect(items[1]).toHaveAttribute('data-done', 'true');
  expect(items[0]).toHaveAttribute('data-done', 'true');
  expect(items[4]).not.toHaveAttribute('data-done');
  expect(items.filter((i) => i.hasAttribute('aria-current'))).toHaveLength(1);
});

test('no strip before the battle or after it', () => {
  const { container, rerender } = render(<PhaseStrip phase="pre-battle" />);
  expect(container).toBeEmptyDOMElement();
  rerender(<PhaseStrip phase="ended" />);
  expect(container).toBeEmptyDOMElement();
});
