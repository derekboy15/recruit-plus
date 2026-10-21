import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createDevAuth } from './devAuth';
import { createSupabaseAuth } from './supabaseAuth';
import type { AuthBackend } from './types';

export interface AuthSetup {
  backend: AuthBackend | null;
  supabase: SupabaseClient | null;
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
    const supabase = createClient(url, key);
    return { backend: createSupabaseAuth(supabase), supabase };
  }
  return { backend: null, supabase: null };
}
