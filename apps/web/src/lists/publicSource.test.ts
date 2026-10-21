import 'fake-indexeddb/auto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import type { ListData } from './listStore';
import { createLocalPublicSource, createSupabasePublicSource } from './publicSource';

const data: ListData = {
  roster: { schema: 1, name: 'Shared Necrons', catalogueId: 'c', battleSize: 'strike-force', forces: [] },
  summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'strike-force', points: 0, pointsLimit: 2000, issueCount: 0 },
};

/** A fake Supabase client that records every call in the query chain and answers `maybeSingle` with `result`. */
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: unknown[][] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of ['from', 'select', 'eq']) {
    chain[name] = (...args) => {
      calls.push([name, ...args]);
      return chain;
    };
  }
  chain.maybeSingle = async () => {
    calls.push(['maybeSingle']);
    return result;
  };
  return { client: chain as unknown as SupabaseClient, calls };
}

test('the Supabase source asks for one public, undeleted document by id and nothing else', async () => {
  const { client, calls } = fakeClient({ data: { data, updated_at: 1700000000000 }, error: null });
  const found = await createSupabasePublicSource(client).get('abc');
  expect(calls).toEqual([
    ['from', 'documents'],
    ['select', 'data, updated_at'],
    ['eq', 'id', 'abc'],
    ['eq', 'is_public', true],
    ['eq', 'deleted', false],
    ['maybeSingle'],
  ]);
  expect(found).toEqual({ data, updatedAt: 1700000000000 });
});

test('the Supabase source returns null when there is no such row', async () => {
  const { client } = fakeClient({ data: null, error: null });
  expect(await createSupabasePublicSource(client).get('nope')).toBeNull();
});

test('the Supabase source returns null for a row that is not a usable list', async () => {
  const malformed = [
    { hello: 'world' },
    null,
    'text',
    { roster: { name: 'x' }, summary: data.summary },
    { roster: { ...data.roster, forces: {} }, summary: data.summary },
    { roster: { ...data.roster, catalogueId: 5 }, summary: data.summary },
    { roster: data.roster },
  ];
  for (const row of malformed) {
    const { client } = fakeClient({ data: { data: row, updated_at: 1 }, error: null });
    expect(await createSupabasePublicSource(client).get('odd')).toBeNull();
  }
});

test('the Supabase source throws when the server fails, so the page can say it could not load', async () => {
  const { client } = fakeClient({ data: null, error: { message: 'boom' } });
  await expect(createSupabasePublicSource(client).get('x')).rejects.toThrow('boom');
});

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`public-source-test-${++n}`);
});
afterEach(() => db.close());

test('the local source reads a list only while it is shared and not deleted', async () => {
  const repo = createRepository(db);
  const source = createLocalPublicSource(db);
  await repo.saveDoc({ id: 'mine', kind: 'list', ownerId: 'u', data });
  expect(await source.get('mine')).toBeNull();

  await repo.saveDoc({ id: 'mine', kind: 'list', ownerId: 'u', data, isPublic: true, updatedAt: 42 });
  expect(await source.get('mine')).toEqual({ data, updatedAt: 42 });
  expect(await source.get('missing')).toBeNull();

  await repo.deleteDoc('mine');
  expect(await source.get('mine')).toBeNull();
});
