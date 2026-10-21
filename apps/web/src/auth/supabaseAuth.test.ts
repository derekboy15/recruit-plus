import { createClient } from '@supabase/supabase-js';
import { expect, test } from 'vitest';
import { createSupabaseAuth } from './supabaseAuth';
import type { AuthEvent, User } from './types';

test('the real client reports its first state as an INITIAL event, not a sign-out', async () => {
  const mem = new Map<string, string>();
  const client = createClient('https://abc.supabase.co', 'anon', {
    auth: {
      storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) },
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: async () => { throw new TypeError('Failed to fetch'); } },
  });
  const events: [User | null, AuthEvent][] = [];
  const off = createSupabaseAuth(client).onChange((u, e) => events.push([u, e]));
  await new Promise((r) => setTimeout(r, 200));
  off();
  expect(events[0]).toEqual([null, 'INITIAL']);
});
