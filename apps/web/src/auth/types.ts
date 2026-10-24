export interface User {
  id: string;
  email: string | null;
}

/** INITIAL = first state after startup (may be null just because refresh failed offline). */
export type AuthEvent = 'INITIAL' | 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'OTHER';

/** What the app needs from a sign-in provider (Supabase in production, a local stub in development). */
export interface AuthBackend {
  /** The signed-in user, or null. May throw when offline. */
  getUser(): Promise<User | null>;
  onChange(cb: (user: User | null, event: AuthEvent) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  /** Creates an account. `confirmEmail` is true when the user must open the emailed link before signing in. */
  signUp(email: string, password: string): Promise<{ confirmEmail: boolean }>;
  /** Emails a link that opens /reset-password signed in, to choose a new password. */
  sendPasswordReset(email: string): Promise<void>;
  /** Sets a new password for the signed-in user. */
  updatePassword(password: string): Promise<void>;
  /** Sends the sign-up confirmation email again. */
  resendConfirmation(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** Development only: sign in instantly without a server. */
  signInDev?(): Promise<void>;
}

export interface AuthApi {
  user: User | null;
  loading: boolean;
  /** True when sign-in has no backend configured (production without Supabase settings). */
  unavailable: boolean;
  canDevSignIn: boolean;
  /** True after the server said the sign-in expired; the cached user stays so local data remains usable. */
  needsReauth: boolean;
  /** Called by sync when the server rejects the sign-in. A later SIGNED_IN event clears it. */
  markSessionExpired(): void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ confirmEmail: boolean }>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInDev(): Promise<void>;
  signOut(): Promise<void>;
}
