export interface User {
  id: string;
  email: string | null;
}

/** INITIAL = first state after startup (may be null just because refresh failed offline). */
export type AuthEvent = 'INITIAL' | 'SIGNED_IN' | 'SIGNED_OUT' | 'OTHER';

/** What the app needs from a sign-in provider (Supabase in production, a local stub in development). */
export interface AuthBackend {
  /** The signed-in user, or null. May throw when offline. */
  getUser(): Promise<User | null>;
  onChange(cb: (user: User | null, event: AuthEvent) => void): () => void;
  signInWithEmail(email: string): Promise<void>;
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
  signInWithEmail(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInDev(): Promise<void>;
  signOut(): Promise<void>;
}
