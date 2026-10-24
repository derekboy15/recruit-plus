import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { InfoButton } from './InfoButton';

test('opens a sheet titled with its title, holding its children, and Close gives focus back', async () => {
  render(
    <InfoButton label="About Novokh" title="Novokh">
      <p>+1 to charge rolls.</p>
    </InfoButton>,
  );
  const button = screen.getByRole('button', { name: 'About Novokh' });
  expect(button.querySelector('svg')).not.toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(button);
  const dialog = screen.getByRole('dialog', { name: 'Novokh' });
  expect(dialog).toHaveTextContent('+1 to charge rolls.');
  const close = screen.getAllByRole('button', { name: 'Close' }).find((b) => dialog.contains(b))!;
  await userEvent.click(close);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(button).toHaveFocus();
});
