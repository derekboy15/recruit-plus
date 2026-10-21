import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthApi, AuthBackend, User } from './types';

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
 * Provides the signed-in user. When the backend can't be reached (offline), the last signed-in
 * user is kept so locally stored lists and games stay available.
 */
export function AuthProvider({ backend, children }: { backend: AuthBackend | null; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(backend !== null);

  useEffect(() => {
    if (!backend) return;
    let live = true;
    const apply = (u: User | null) => {
      if (!live) return;
      setUser(u);
      writeCachedUser(u);
      setLoading(false);
    };
    backend.getUser().then(apply, () => {
      if (!live) return;
      setUser(readCachedUser());
      setLoading(false);
    });
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
      signInWithEmail: (email) => need().signInWithEmail(email),
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
      },
    };
  }, [backend, user, loading]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
