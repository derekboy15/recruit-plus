import { describe, expect, test } from 'vitest';
import { checkEnv } from './env.mjs';

const prod = { VERCEL_ENV: 'production', VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'key', VITE_CONTACT_EMAIL: 'ops@example.org', VITE_DATA_REGION: 'the EU (Frankfurt)' };

describe('checkEnv', () => {
  test('a complete production env passes', () => {
    expect(checkEnv(prod)).toEqual([]);
  });

  test('production requires Supabase URL, key, contact email and data region', () => {
    const problems = checkEnv({ VERCEL_ENV: 'production' });
    expect(problems.join('\n')).toContain('VITE_DATA_REGION');
    expect(problems.join('\n')).toContain('VITE_SUPABASE_URL');
    expect(problems.join('\n')).toContain('VITE_SUPABASE_ANON_KEY');
    expect(problems.join('\n')).toContain('VITE_CONTACT_EMAIL');
  });

  test('production refuses VITE_AUTH_MODE=dev', () => {
    expect(checkEnv({ ...prod, VITE_AUTH_MODE: 'dev' }).join()).toContain('VITE_AUTH_MODE');
  });

  test('production refuses an http Supabase URL', () => {
    expect(checkEnv({ ...prod, VITE_SUPABASE_URL: 'http://abc.supabase.co' }).join()).toContain('https://');
  });

  test('preview without Supabase passes with a warning', () => {
    const warnings: string[] = [];
    expect(checkEnv({ VERCEL_ENV: 'preview' }, (w) => warnings.push(w))).toEqual([]);
    expect(warnings.join()).toContain('VITE_SUPABASE_URL');
  });

  test('local build passes with nothing set', () => {
    expect(checkEnv({})).toEqual([]);
  });
});
