import type { SupabaseClient, User as SbUser } from '@supabase/supabase-js';
import type { AuthBackend, User } from './types';

const toUser = (u: SbUser | null | undefined): User | null => (u ? { id: u.id, email: u.email ?? null } : null);

export function createSupabaseAuth(client: SupabaseClient): AuthBackend {
  return {
    async getUser() {
      // getSession reads the locally persisted session, so it also works offline.
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return toUser(data.session?.user);
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signInWithEmail(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
    },
    async signInWithGoogle() {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
  };
}
