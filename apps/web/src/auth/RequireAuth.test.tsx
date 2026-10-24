import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import type { AuthBackend, AuthEvent, User } from './types';

const fakeBackend = (user: User | null, opts: { failGetUser?: boolean } = {}): AuthBackend => ({
  getUser: async () => {
    if (opts.failGetUser) throw new TypeError('Failed to fetch');
    return user;
  },
  onChange: () => () => {},
  signInWithPassword: async () => {},
  signUp: async () => ({ confirmEmail: true }),
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  resendConfirmation: async () => {},
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

const eventBackend = (opts: { getUser: () => Promise<User | null> }) => {
  let emit: (u: User | null, e: AuthEvent) => void = () => {};
  const backend: AuthBackend = {
    getUser: opts.getUser,
    onChange: (cb) => {
      emit = cb;
      return () => {};
    },
    signInWithPassword: async () => {},
    signUp: async () => ({ confirmEmail: true }),
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    resendConfirmation: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
  };
  return { backend, emit: (u: User | null, e: AuthEvent) => emit(u, e) };
};

function renderProbe(backend: AuthBackend) {
  const seen: { user: User | null; loading: boolean } = { user: null, loading: true };
  function Probe() {
    const a = useAuth();
    seen.user = a.user;
    seen.loading = a.loading;
    return null;
  }
  render(
    <AuthProvider backend={backend}>
      <Probe />
    </AuthProvider>,
  );
  return seen;
}

const CACHED = { id: 'u1', email: 'a@b.c' };

test('offline with an expired session: cached user is available at once while the backend is still retrying', async () => {
  localStorage.setItem('recruit.lastUser', JSON.stringify(CACHED));
  const { backend } = eventBackend({ getUser: () => new Promise(() => {}) });
  const seen = renderProbe(backend);
  expect(seen.user).toEqual(CACHED);
  expect(seen.loading).toBe(false);
});

test('a null initial session (refresh failed offline) does not sign the user out or clear the cache', async () => {
  localStorage.setItem('recruit.lastUser', JSON.stringify(CACHED));
  const { backend, emit } = eventBackend({ getUser: () => new Promise(() => {}) });
  const seen = renderProbe(backend);
  act(() => emit(null, 'INITIAL'));
  await waitFor(() => expect(seen.user).toEqual(CACHED));
  expect(localStorage.getItem('recruit.lastUser')).not.toBeNull();
});

test('an explicit sign-out event clears the user and the cache', async () => {
  localStorage.setItem('recruit.lastUser', JSON.stringify(CACHED));
  const { backend, emit } = eventBackend({ getUser: () => new Promise(() => {}) });
  const seen = renderProbe(backend);
  act(() => emit(null, 'SIGNED_OUT'));
  await waitFor(() => expect(seen.user).toBeNull());
  expect(localStorage.getItem('recruit.lastUser')).toBeNull();
});
