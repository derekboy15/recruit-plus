import { useEffect, useMemo } from 'react';
import { BrowserRouter, Route, useMatch } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { createAuthSetup } from './auth/backend';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { createLocalPublicSource, createSupabasePublicSource, PublicSourceContext, type PublicSourceValue } from './lists/publicSource';
import { SignIn } from './pages/SignIn';
import { AppRoutes } from './routes';
import { WordingProvider } from './rules/wording';
import { openDb } from './storage/db';
import { StorageProvider } from './storage/StorageContext';
import { createSupabaseRemote } from './storage/supabaseRemote';
import { startAutoSync } from './storage/sync';

const setup = createAuthSetup();
export const db = openDb();

/** Shared lists come from the server when accounts are on, else from this device (local development). */
const publicSource: PublicSourceValue = setup.supabase
  ? { source: createSupabasePublicSource(setup.supabase), linksWorkAnywhere: true }
  : { source: createLocalPublicSource(db), linksWorkAnywhere: false };

function AccountMenu() {
  const { user, signOut } = useAuth();
  // A shared list is a read-only page for anyone: it has no account menu.
  const onSharePage = useMatch('/share/:id') !== null;
  if (!user || onSharePage) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
      <span className="muted" style={{ maxWidth: '40vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {user.email}
      </span>
      <button className="btn" style={{ padding: '0 0.8rem' }} onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

function SyncWhileSignedIn() {
  const { user, needsReauth, markSessionExpired } = useAuth();
  const remote = useMemo(() => (setup.supabase ? createSupabaseRemote(setup.supabase) : null), []);
  useEffect(() => {
    // After an expired sign-in auto-sync has stopped itself; signing in again clears needsReauth, which restarts it.
    if (!user || !remote || needsReauth) return;
    return startAutoSync(db, remote, user.id, { onAuthError: markSessionExpired });
  }, [user, remote, needsReauth, markSessionExpired]);
  return null;
}

export function App() {
  return (
    <AuthProvider backend={setup.backend}>
      <StorageProvider db={db}>
        <PublicSourceContext.Provider value={publicSource}>
          <SyncWhileSignedIn />
          <WordingProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppShell account={<AccountMenu />}>
                <AppRoutes guard={(c) => <RequireAuth>{c}</RequireAuth>} extra={<Route path="/sign-in" element={<SignIn />} />} />
              </AppShell>
            </BrowserRouter>
          </WordingProvider>
        </PublicSourceContext.Provider>
      </StorageProvider>
    </AuthProvider>
  );
}
