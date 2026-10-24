import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { fakeAuthBackend } from '../auth/__fixtures__/fakeBackend';
import { Home } from './Home';

afterEach(() => localStorage.clear());

const home = (signedIn: boolean) => {
  if (signedIn) localStorage.setItem('recruit.lastUser', JSON.stringify({ id: 'u1', email: 'a@b.c' }));
  render(
    <AuthProvider backend={fakeAuthBackend({ getUser: async () => (signedIn ? { id: 'u1', email: 'a@b.c' } : null) })}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AuthProvider>,
  );
};

test('signed out, the landing page invites you to sign in', async () => {
  home(false);
  expect(await screen.findByRole('link', { name: 'Sign in to start' })).toHaveAttribute('href', '/sign-in');
});

test('signed in, the landing page takes you into the app instead of offering sign-in', async () => {
  home(true);
  expect(await screen.findByRole('link', { name: 'Continue learning' })).toHaveAttribute('href', '/learn');
  expect(screen.getByRole('link', { name: 'Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
});
