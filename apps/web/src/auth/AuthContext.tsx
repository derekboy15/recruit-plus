import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthApi, AuthBackend, AuthEvent, User } from './types';

const LAST_USER_KEY = 'recruit.lastUser';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* storage blocked: offline sign-in just won't be remembered */
  }
}

const AuthContext = createContext<AuthApi | null>(null);

/**
 * Provides the signed-in user, local-first: the last signed-in user is available immediately and
 * stays signed in until an explicit sign-out. A missing session at startup is not a sign-out:
 * offline, Supabase can't refresh an expired token and reports "no session" after retrying, and
 * signing that user out would lock them out of their own locally stored lists and games.
 */
export function AuthProvider({ backend, children }: { backend: AuthBackend | null; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (backend ? readCachedUser() : null));
  const [loading, setLoading] = useState(() => backend !== null && readCachedUser() === null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const markSessionExpired = useCallback(() => setNeedsReauth(true), []);

  useEffect(() => {
    if (!backend) return;
    let live = true;
    const apply = (u: User | null, event: AuthEvent) => {
      if (!live) return;
      if (u) {
        setUser(u);
        writeCachedUser(u);
        if (event === 'SIGNED_IN') setNeedsReauth(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        writeCachedUser(null);
        setNeedsReauth(false);
      }
      setLoading(false);
    };
    backend.getUser().then(
      (u) => apply(u, 'INITIAL'),
      () => live && setLoading(false),
    );
    const off = backend.onChange(apply);
    return () => {
      live = false;
      off();
    };
  }, [backend]);

  const api = useMemo<AuthApi>(() => {
    const need = () => {
      if (!backend) throw new Error('Sign-in is not configured for this site yet.');
      return backend;
    };
    return {
      user,
      loading,
      unavailable: backend === null,
      canDevSignIn: Boolean(backend?.signInDev),
      needsReauth,
      markSessionExpired,
      signInWithPassword: (email, password) => need().signInWithPassword(email, password),
      signUp: (email, password) => need().signUp(email, password),
      sendPasswordReset: (email) => need().sendPasswordReset(email),
      updatePassword: (password) => need().updatePassword(password),
      resendConfirmation: (email) => need().resendConfirmation(email),
      signInWithGoogle: () => need().signInWithGoogle(),
      signInDev: async () => {
        const b = need();
        if (!b.signInDev) throw new Error('Developer sign-in is not available.');
        await b.signInDev();
      },
      signOut: async () => {
        await need().signOut();
        writeCachedUser(null);
        setUser(null);
        setNeedsReauth(false);
      },
    };
  }, [backend, user, loading, needsReauth, markSessionExpired]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
