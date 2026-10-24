import type { AuthError, User as SbUser } from '@supabase/supabase-js';
import type { SupabaseLoader } from './backend';
import type { AuthBackend, AuthEvent, User } from './types';

const EVENTS: Record<string, AuthEvent> = {
  INITIAL_SESSION: 'INITIAL',
  SIGNED_IN: 'SIGNED_IN',
  SIGNED_OUT: 'SIGNED_OUT',
  PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
};

const toUser = (u: SbUser | null | undefined): User | null => (u ? { id: u.id, email: u.email ?? null } : null);

/** Supabase's error codes, in words a player can act on. Unknown errors keep Supabase's own message. */
export function friendlyAuthError(error: Pick<AuthError, 'message'> & { code?: string; status?: number }): Error {
  const code = error.code ?? '';
  const msg = error.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return new Error('Wrong email or password.');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg))
    return new Error('Confirm your email address first: open the link we emailed you.');
  if (code === 'weak_password' || /password should be/i.test(msg)) return new Error('Choose a longer password: use at least 8 characters.');
  if (code === 'user_already_exists' || /already registered/i.test(msg))
    return new Error('That email already has an account. Sign in, or reset your password.');
  if (code.startsWith('over_') || error.status === 429 || /rate limit/i.test(msg))
    return new Error('Too many attempts just now. Wait a minute and try again.');
  if (code === 'same_password') return new Error('Choose a password different from your current one.');
  return new Error(msg || 'Something went wrong. Please try again.');
}

const check = (error: AuthError | null) => {
  if (error) throw friendlyAuthError(error);
};

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
    async signInWithPassword(email, password) {
      const { error } = await (await load()).auth.signInWithPassword({ email, password });
      check(error);
    },
    async signUp(email, password) {
      const { data, error } = await (await load()).auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      check(error);
      return { confirmEmail: !data.session };
    },
    async sendPasswordReset(email) {
      const { error } = await (await load()).auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      check(error);
    },
    async updatePassword(password) {
      const { error } = await (await load()).auth.updateUser({ password });
      check(error);
    },
    async resendConfirmation(email) {
      const { error } = await (await load()).auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } });
      check(error);
    },
    async signInWithGoogle() {
      const { error } = await (await load()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      check(error);
    },
    async signOut() {
      const { error } = await (await load()).auth.signOut();
      check(error);
    },
  };
}
