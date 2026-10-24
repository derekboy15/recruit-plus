import { useEffect, useMemo } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { createAuthSetup } from './auth/backend';
import { RequireAuth } from './auth/RequireAuth';
import { AccountMenu } from './layout/AccountMenu';
import { AppShell } from './layout/AppShell';
import { createLocalPublicSource, createSupabasePublicSource, PublicSourceContext, type PublicSourceValue } from './lists/publicSource';
import { ResetPassword } from './pages/ResetPassword';
import { SignIn } from './pages/SignIn';
import { AppRoutes } from './routes';
import { WordingProvider } from './rules/wording';
import { openDb } from './storage/db';
import { StorageProvider } from './storage/StorageContext';
import { createSupabaseRemote } from './storage/supabaseRemote';
import { startAutoSync } from './storage/sync';
import { ToastProvider } from './ui/toast';

const setup = createAuthSetup();
export const db = openDb();

/** Shared lists come from the server when accounts are on, else from this device (local development). */
const publicSource: PublicSourceValue = setup.supabase
  ? { source: createSupabasePublicSource(setup.supabase), linksWorkAnywhere: true }
  : { source: createLocalPublicSource(db), linksWorkAnywhere: false };

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
              <ToastProvider>
                <AppShell account={<AccountMenu />}>
                  <AppRoutes guard={(c) => <RequireAuth>{c}</RequireAuth>} extra={
                      <>
                        <Route path="/sign-in" element={<SignIn />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                      </>
                    } />
                </AppShell>
              </ToastProvider>
            </BrowserRouter>
          </WordingProvider>
        </PublicSourceContext.Provider>
      </StorageProvider>
    </AuthProvider>
  );
}
