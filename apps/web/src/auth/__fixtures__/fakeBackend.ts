import type { AuthBackend } from '../types';

/** A sign-in backend for tests: signed out, every action succeeds, nothing is sent. Override what a test needs. */
export function fakeAuthBackend(over: Partial<AuthBackend> = {}): AuthBackend {
  return {
    getUser: async () => null,
    onChange: () => () => {},
    signInWithPassword: async () => {},
    signUp: async () => ({ confirmEmail: true }),
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    resendConfirmation: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
    ...over,
  };
}
