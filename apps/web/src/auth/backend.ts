import type { SupabaseClient } from '@supabase/supabase-js';
import { createDevAuth } from './devAuth';
import { createSupabaseAuth } from './supabaseAuth';
import type { AuthBackend } from './types';

/**
 * The Supabase client, created on first use. supabase-js is loaded with a dynamic import, so it stays out of the
 * main bundle. One client per loader; a failed load (offline before the file is cached) is tried again next time.
 */
export type SupabaseLoader = () => Promise<SupabaseClient>;

export interface AuthSetup {
  backend: AuthBackend | null;
  supabase: SupabaseLoader | null;
}

function supabaseLoader(url: string, key: string): SupabaseLoader {
  let client: Promise<SupabaseClient> | undefined;
  return () =>
    (client ??= import('@supabase/supabase-js').then(
      ({ createClient }) => createClient(url, key),
      (e: unknown) => {
        client = undefined;
        throw e;
      },
    ));
}

/**
 * Production: Supabase from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, or nothing (sign-in unavailable).
 * Development: dev auth when VITE_AUTH_MODE=dev or when Supabase isn't configured.
 */
export function createAuthSetup(env: ImportMetaEnv = import.meta.env): AuthSetup {
  const url = env.VITE_SUPABASE_URL as string | undefined;
  const key = env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const wantsDev = env.VITE_AUTH_MODE === 'dev' || !url || !key;
  if (!env.PROD && wantsDev) return { backend: createDevAuth(), supabase: null };
  if (url && key) {
    const supabase = supabaseLoader(url, key);
    return { backend: createSupabaseAuth(supabase), supabase };
  }
  return { backend: null, supabase: null };
}
