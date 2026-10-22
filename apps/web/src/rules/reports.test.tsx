import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { openDb, type RecruitDb } from '../storage/db';
import { isUuid } from '../storage/ids';
import { createRepository, type Repository } from '../storage/repository';
import { saveReport, useReports, type RulesReport } from './reports';
import { TestProviders } from './__fixtures__/TestProviders';

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  db = openDb(`reports-test-${++n}`);
  repo = createRepository(db);
});
afterEach(() => db.close());

const report: RulesReport = {
  target: { kind: 'ability', name: 'Reanimation Protocols', path: '/factions/necrons/units/necron-warriors' },
  problem: 'wrong',
  note: 'It says 4+, should be 5+',
  wording: 'plain',
  text: 'Destroyed models can come back on a 4+.',
  dataGeneratedAt: '2026-10-21T00:00:00.000Z',
};

test("saveReport stores a dirty 'report' doc with a UUID", async () => {
  const id = await saveReport(repo, 'user-1', report);
  expect(isUuid(id)).toBe(true);
  const doc = (await repo.getDoc<RulesReport>(id))!;
  expect(doc).toMatchObject({ kind: 'report', ownerId: 'user-1', dirty: true, isPublic: false, data: report });
});

test('a report saved with no network stays dirty and is listed', async () => {
  // No remote at all: the repository only ever writes to this device.
  await saveReport(repo, 'user-1', report);
  await saveReport(repo, 'someone-else', { ...report, note: 'not mine' });
  const { result } = renderHook(() => useReports(), {
    wrapper: ({ children }: { children: ReactNode }) => <TestProviders db={db}>{children}</TestProviders>,
  });
  // Only this user's report, once sign-in has resolved.
  await waitFor(() => expect(result.current.reports).toHaveLength(1));
  expect(result.current.reports[0]).toMatchObject({ dirty: true, data: { note: 'It says 4+, should be 5+' } });
});
