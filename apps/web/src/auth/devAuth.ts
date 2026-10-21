import type { AuthBackend, AuthEvent, User } from './types';

const KEY = 'recruit.devUser';
export const DEV_USER: User = { id: '00000000-0000-4000-8000-000000000001', email: 'dev@local' };

/** Local-only sign-in for development and end-to-end tests. Never used in production builds. */
export function createDevAuth(): AuthBackend {
  const listeners = new Set<(u: User | null, e: AuthEvent) => void>();
  const current = (): User | null => (localStorage.getItem(KEY) ? DEV_USER : null);
  const emit = (e: AuthEvent) => listeners.forEach((l) => l(current(), e));
  return {
    getUser: async () => current(),
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    signInWithEmail: async () => {
      throw new Error('Email sign-in needs Supabase. Use "Continue (dev)" locally.');
    },
    signInWithGoogle: async () => {
      throw new Error('Google sign-in needs Supabase. Use "Continue (dev)" locally.');
    },
    signInDev: async () => {
      localStorage.setItem(KEY, '1');
      emit('SIGNED_IN');
    },
    signOut: async () => {
      localStorage.removeItem(KEY);
      emit('SIGNED_OUT');
    },
  };
}
