import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from 'vitest';
import { createSupabaseRemote, isAuthFailure } from './supabaseRemote';
import { SyncAuthError } from './sync';
import type { Doc } from './types';

const doc: Doc = { id: '00000000-0000-4000-8000-000000000001', kind: 'list', ownerId: 'u', updatedAt: 1, deleted: false, isPublic: false, data: {}, dirty: true };

/** A client whose every query resolves to `result`. */
const clientReturning = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'order', 'limit']) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { from: () => ({ ...chain, upsert: () => chain }) } as unknown as SupabaseClient;
};

test('recognises an expired sign-in by status, code or message', () => {
  expect(isAuthFailure({ message: 'Unauthorized' }, 401)).toBe(true);
  expect(isAuthFailure({ message: 'x', code: 'PGRST301' })).toBe(true);
  expect(isAuthFailure({ message: 'x', code: 'PGRST302' })).toBe(true);
  expect(isAuthFailure({ message: 'JWT expired' })).toBe(true);
  expect(isAuthFailure({ message: 'invalid token' })).toBe(true);
  expect(isAuthFailure({ message: 'invalid input syntax for type uuid', code: '22P02' }, 400)).toBe(false);
});

test('push and pull throw SyncAuthError for auth failures and a plain Error otherwise', async () => {
  const expired = createSupabaseRemote(clientReturning({ data: null, error: { message: 'JWT expired', code: 'PGRST301' }, status: 401 }));
  await expect(expired.pushDocs([doc])).rejects.toBeInstanceOf(SyncAuthError);
  await expect(expired.pullSince('u', 0)).rejects.toBeInstanceOf(SyncAuthError);

  const bad = createSupabaseRemote(clientReturning({ data: null, error: { message: 'invalid input syntax for type uuid', code: '22P02' }, status: 400 }));
  const err = await bad.pushDocs([doc]).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(Error);
  expect(err).not.toBeInstanceOf(SyncAuthError);
  expect((err as Error).message).toBe('Sync push failed: invalid input syntax for type uuid');
});
