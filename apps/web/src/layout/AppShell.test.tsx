import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend } from '../auth/types';
import { AppShell } from './AppShell';

const backend: AuthBackend = {
  getUser: async () => null,
  onChange: () => () => {},
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

test('the first Tab stop is a skip link that moves focus to the main content', async () => {
  render(
    <AuthProvider backend={backend}>
      <MemoryRouter>
        <AppShell>
          <h1>Page</h1>
        </AppShell>
      </MemoryRouter>
    </AuthProvider>,
  );
  await userEvent.tab();
  const skip = screen.getByRole('link', { name: 'Skip to main content' });
  expect(skip).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('main')).toHaveFocus();
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
});
