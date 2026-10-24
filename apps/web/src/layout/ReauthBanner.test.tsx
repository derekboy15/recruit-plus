import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import type { AuthBackend, AuthEvent, User } from '../auth/types';
import { ReauthBanner } from './ReauthBanner';

const user: User = { id: 'u1', email: 'a@b.c' };

function backend() {
  const listeners = new Set<(u: User | null, e: AuthEvent) => void>();
  const b: AuthBackend = {
    getUser: async () => user,
    onChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    signInWithPassword: async () => {},
    signUp: async () => ({ confirmEmail: true }),
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    resendConfirmation: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
  };
  return { b, emit: (u: User | null, e: AuthEvent) => listeners.forEach((l) => l(u, e)) };
}

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return null;
}

const setup = () => {
  const { b, emit } = backend();
  render(
    <AuthProvider backend={b}>
      <Probe />
      <MemoryRouter>
        <ReauthBanner />
      </MemoryRouter>
    </AuthProvider>,
  );
  return emit;
};

afterEach(() => localStorage.clear());

test('shows nothing while the session is fine', async () => {
  setup();
  await act(async () => {});
  expect(screen.queryByText(/sign-in has expired/i)).not.toBeInTheDocument();
});

test('when the session has expired it says so and links to /sign-in', async () => {
  setup();
  await act(async () => {});
  act(() => api.markSessionExpired());
  expect(api.needsReauth).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent('Your sign-in has expired. Your lists are safe on this device. Sign in again to sync them.');
  expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/sign-in');
  expect(api.user).toEqual(user);
});

test('a later SIGNED_IN event clears the banner', async () => {
  const emit = setup();
  await act(async () => {});
  act(() => api.markSessionExpired());
  act(() => emit(user, 'SIGNED_IN'));
  expect(api.needsReauth).toBe(false);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('is not shown to a signed-out visitor even if an expiry was reported', async () => {
  const emit = setup();
  await act(async () => {});
  act(() => api.markSessionExpired());
  expect(screen.getByRole('alert')).toBeInTheDocument();
  act(() => emit(null, 'SIGNED_OUT'));
  expect(api.user).toBeNull();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
