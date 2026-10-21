import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import type { AuthBackend, User } from './types';

const fakeBackend = (user: User | null, opts: { failGetUser?: boolean } = {}): AuthBackend => ({
  getUser: async () => {
    if (opts.failGetUser) throw new TypeError('Failed to fetch');
    return user;
  },
  onChange: () => () => {},
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

const app = (backend: AuthBackend) =>
  render(
    <AuthProvider backend={backend}>
      <MemoryRouter initialEntries={['/factions']}>
        <Routes>
          <Route path="/sign-in" element={<p>Sign-in page</p>} />
          <Route
            path="/factions"
            element={
              <RequireAuth>
                <p>Secret factions</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

afterEach(() => localStorage.clear());

test('redirects to /sign-in when signed out', async () => {
  app(fakeBackend(null));
  expect(await screen.findByText('Sign-in page')).toBeInTheDocument();
  expect(screen.queryByText('Secret factions')).not.toBeInTheDocument();
});

test('renders children when signed in', async () => {
  app(fakeBackend({ id: 'u1', email: 'a@b.c' }));
  expect(await screen.findByText('Secret factions')).toBeInTheDocument();
});

test('offline with a cached session: the last user is still signed in', async () => {
  localStorage.setItem('recruit.lastUser', JSON.stringify({ id: 'u1', email: 'a@b.c' }));
  let seen: User | null = null;
  function Probe() {
    seen = useAuth().user;
    return null;
  }
  render(
    <AuthProvider backend={fakeBackend(null, { failGetUser: true })}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(seen).toEqual({ id: 'u1', email: 'a@b.c' }));
});
