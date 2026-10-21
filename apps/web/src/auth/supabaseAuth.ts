import type { User as SbUser } from '@supabase/supabase-js';
import type { SupabaseLoader } from './backend';
import type { AuthBackend, AuthEvent, User } from './types';

const EVENTS: Record<string, AuthEvent> = { INITIAL_SESSION: 'INITIAL', SIGNED_IN: 'SIGNED_IN', SIGNED_OUT: 'SIGNED_OUT' };

const toUser = (u: SbUser | null | undefined): User | null => (u ? { id: u.id, email: u.email ?? null } : null);

export function createSupabaseAuth(load: SupabaseLoader): AuthBackend {
  return {
    async getUser() {
      // getSession reads the locally persisted session, so it also works offline.
      const { data, error } = await (await load()).auth.getSession();
      if (error) throw error;
      return toUser(data.session?.user);
    },
    onChange(cb) {
      // Subscribes once the client has loaded, unless listening has stopped by then.
      let stopped = false;
      let unsubscribe: (() => void) | undefined;
      load().then(
        (client) => {
          if (stopped) return;
          const { data } = client.auth.onAuthStateChange((event, session) => cb(toUser(session?.user), EVENTS[event] ?? 'OTHER'));
          unsubscribe = () => data.subscription.unsubscribe();
        },
        () => {}, // getUser reports a client that can't load
      );
      return () => {
        stopped = true;
        unsubscribe?.();
      };
    },
    async signInWithEmail(email) {
      const { error } = await (await load()).auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
    },
    async signInWithGoogle() {
      const { error } = await (await load()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await (await load()).auth.signOut();
      if (error) throw error;
    },
  };
}
