import 'fake-indexeddb/auto';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext';
import type { AuthBackend } from '../../auth/types';
import type { RecruitDb } from '../../storage/db';
import { StorageProvider } from '../../storage/StorageContext';
import { WordingProvider, type Wording } from '../wording';

export const signedIn = (id = 'user-1'): AuthBackend => ({
  getUser: async () => ({ id, email: `${id}@example.com` }),
  onChange: () => () => {},
  signInWithPassword: async () => {},
  signUp: async () => ({ confirmEmail: true }),
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  resendConfirmation: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

/** Signed-in user, a local database, the wording choice and (unless `router` is false) a router at `path`. */
export function TestProviders({ db, children, path = '/', router = true, wording }: {
  db: RecruitDb; children: ReactNode; path?: string; router?: boolean; wording?: Wording;
}) {
  const inner = <WordingProvider initial={wording}>{children}</WordingProvider>;
  return (
    <AuthProvider backend={signedIn()}>
      <StorageProvider db={db}>{router ? <MemoryRouter initialEntries={[path]}>{inner}</MemoryRouter> : inner}</StorageProvider>
    </AuthProvider>
  );
}
