import { expect, test } from 'vitest';
import { createAuthSetup } from './backend';

const env = (over: Partial<ImportMetaEnv>) => ({ PROD: false, DEV: true, MODE: 'test', BASE_URL: '/', SSR: false, ...over }) as ImportMetaEnv;

test('development without Supabase settings uses local dev sign-in', () => {
  expect(createAuthSetup(env({})).backend?.signInDev).toBeTypeOf('function');
});

test('production never uses dev sign-in', () => {
  expect(createAuthSetup(env({ PROD: true, DEV: false, VITE_AUTH_MODE: 'dev' })).backend).toBeNull();
});

test('production with Supabase settings uses Supabase', () => {
  const setup = createAuthSetup(env({ PROD: true, DEV: false, VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' }));
  expect(setup.supabase).not.toBeNull();
  expect(setup.backend?.signInDev).toBeUndefined();
});
