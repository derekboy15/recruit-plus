import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  const off = createSupabaseAuth(async () => client).onChange((u, e) => events.push([u, e]));
  await new Promise((r) => setTimeout(r, 200));
  off();
  expect(events[0]).toEqual([null, 'INITIAL']);
});

test('listening stopped before the client has loaded never subscribes, and a later load still works', async () => {
  let release!: (client: SupabaseClient) => void;
  const loaded = new Promise<SupabaseClient>((resolve) => (release = resolve));
  const subscribed: string[] = [];
  const fake = {
    auth: {
      onAuthStateChange: () => {
        subscribed.push('on');
        return { data: { subscription: { unsubscribe: () => subscribed.push('off') } } };
      },
    },
  } as unknown as SupabaseClient;
  const auth = createSupabaseAuth(() => loaded);
  const off = auth.onChange(() => {});
  off();
  release(fake);
  await loaded;
  await new Promise((r) => setTimeout(r, 0));
  expect(subscribed).toEqual([]);

  const offLater = auth.onChange(() => {});
  await new Promise((r) => setTimeout(r, 0));
  expect(subscribed).toEqual(['on']);
  offLater();
  expect(subscribed).toEqual(['on', 'off']);
});

// --- Password sign-in against a stubbed Supabase Auth server (the real supabase-js client talks to it). ---

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'a@b.c', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const SESSION = (() => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, aud: 'authenticated', role: 'authenticated', exp })}.sig`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: USER };
})();

type Reply = { status: number; body: unknown };
function authWith(routes: Record<string, (body: Record<string, unknown>, url: URL) => Reply>) {
  const calls: { path: string; body: Record<string, unknown>; url: URL }[] = [];
  const mem = new Map<string, string>();
  const client = createClient('https://abc.supabase.co', 'anon', {
    auth: {
      storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) },
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        calls.push({ path: url.pathname, body, url });
        const handler = routes[url.pathname];
        const reply = handler ? handler(body, url) : { status: 404, body: { message: 'no route' } };
        return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
      },
    },
  });
  return { auth: createSupabaseAuth(async () => client), calls };
}

test('password sign-in sends the email and password, and a wrong password reads "Wrong email or password."', async () => {
  const { auth, calls } = authWith({
    '/auth/v1/token': (body) =>
      body.password === 'right-password'
        ? { status: 200, body: SESSION }
        : { status: 400, body: { code: 'invalid_credentials', message: 'Invalid login credentials' } },
  });
  await expect(auth.signInWithPassword('a@b.c', 'nope-nope')).rejects.toThrow('Wrong email or password.');
  await expect(auth.signInWithPassword('a@b.c', 'right-password')).resolves.toBeUndefined();
  expect(calls.at(-1)).toMatchObject({ path: '/auth/v1/token', body: { email: 'a@b.c', password: 'right-password' } });
  expect(calls.at(-1)!.url.searchParams.get('grant_type')).toBe('password');
});

test('an unconfirmed email says to open the confirmation link', async () => {
  const { auth } = authWith({ '/auth/v1/token': () => ({ status: 400, body: { code: 'email_not_confirmed', message: 'Email not confirmed' } }) });
  await expect(auth.signInWithPassword('a@b.c', 'whatever-1')).rejects.toThrow(/confirm your email/i);
});

test('sign-up reports whether the email still needs confirming', async () => {
  const pending = authWith({ '/auth/v1/signup': () => ({ status: 200, body: USER }) });
  expect(await pending.auth.signUp('a@b.c', 'long-enough-1')).toEqual({ confirmEmail: true });
  expect(pending.calls[0].body).toMatchObject({ email: 'a@b.c', password: 'long-enough-1' });
  const instant = authWith({ '/auth/v1/signup': () => ({ status: 200, body: SESSION }) });
  expect(await instant.auth.signUp('a@b.c', 'long-enough-1')).toEqual({ confirmEmail: false });
});

test('a password the server finds too weak, and too many emails, read as plain advice', async () => {
  const weak = authWith({ '/auth/v1/signup': () => ({ status: 422, body: { code: 'weak_password', message: 'Password should be at least 6 characters.' } }) });
  await expect(weak.auth.signUp('a@b.c', 'short')).rejects.toThrow(/at least 8 characters/);
  const flood = authWith({ '/auth/v1/recover': () => ({ status: 429, body: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' } }) });
  await expect(flood.auth.sendPasswordReset('a@b.c')).rejects.toThrow(/wait a minute/i);
});

test('a reset link returns to /reset-password, and the new password is saved for the signed-in user', async () => {
  const { auth, calls } = authWith({
    '/auth/v1/recover': () => ({ status: 200, body: {} }),
    '/auth/v1/token': () => ({ status: 200, body: SESSION }),
    '/auth/v1/user': () => ({ status: 200, body: USER }),
    '/auth/v1/resend': () => ({ status: 200, body: {} }),
  });
  await auth.sendPasswordReset('a@b.c');
  expect(calls[0].path).toBe('/auth/v1/recover');
  expect(calls[0].url.searchParams.get('redirect_to')).toBe(`${window.location.origin}/reset-password`);
  await auth.signInWithPassword('a@b.c', 'old-password');
  await auth.updatePassword('brand-new-password');
  expect(calls.at(-1)).toMatchObject({ path: '/auth/v1/user', body: { password: 'brand-new-password' } });
  await auth.resendConfirmation('a@b.c');
  expect(calls.at(-1)).toMatchObject({ path: '/auth/v1/resend', body: { email: 'a@b.c', type: 'signup' } });
});
