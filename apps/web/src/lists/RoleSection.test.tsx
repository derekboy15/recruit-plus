import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COST_PTS, type SelView } from '@recruit/data/roster';
import { expect, test, vi } from 'vitest';
import { RoleSection } from './RoleSection';

const unit = (pts: number) => ({ total: { [COST_PTS]: pts } }) as unknown as SelView;

function section(collapsed: boolean, units = [unit(90), unit(70)]) {
  const onToggle = vi.fn();
  const onAdd = vi.fn();
  render(
    <RoleSection role="HQ" units={units} collapsed={collapsed} onToggle={onToggle} onAdd={onAdd}>
      <li>Overlord</li>
    </RoleSection>,
  );
  return { onToggle, onAdd };
}

test('the role heading is a button that says how many units and points, and opens or closes the section', async () => {
  const { onToggle } = section(false);
  const toggle = screen.getByRole('button', { name: 'HQ 2 units · 160 pts' });
  expect(toggle.closest('h2')).not.toBeNull();
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Overlord')).toBeInTheDocument();
  await userEvent.click(toggle);
  expect(onToggle).toHaveBeenCalled();
});

test('collapsed, the units are hidden and the count stays', () => {
  section(true, [unit(90)]);
  expect(screen.getByRole('button', { name: 'HQ 1 unit · 90 pts' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Overlord')).not.toBeInTheDocument();
});

test('its + adds a unit of that role', async () => {
  const { onAdd } = section(false);
  await userEvent.click(screen.getByRole('button', { name: 'Add an HQ unit' }));
  expect(onAdd).toHaveBeenCalled();
});
