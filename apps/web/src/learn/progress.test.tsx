import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend } from '../auth/types';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository, type Repository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { allDone, completeLesson, EMPTY_PROGRESS, isUnlocked, mergeProgress, nextLesson, useProgress, type ProgressData } from './progress';

const ORDER = ['what-is-40k', 'datasheets', 'attacks'];
let db: RecruitDb;
let repo: Repository;
let n = 0;
let clock = 1000;
beforeEach(() => {
  db = openDb(`progress-test-${++n}`);
  repo = createRepository(db, () => ++clock);
});
afterEach(() => {
  db.close();
  localStorage.clear();
});

const docs = () => repo.listDocs<ProgressData>('progress', 'user-1');

describe('progress', () => {
  test('with no doc progress is empty and only lesson 1 is unlocked', async () => {
    expect(await docs()).toEqual([]);
    expect(isUnlocked(1, ORDER, EMPTY_PROGRESS)).toBe(true);
    expect(isUnlocked(2, ORDER, EMPTY_PROGRESS)).toBe(false);
    expect(nextLesson(ORDER, EMPTY_PROGRESS)).toBe('what-is-40k');
  });

  test('completing a lesson saves it and unlocks the next', async () => {
    const p = await completeLesson(repo, 'user-1', 'what-is-40k', 1);
    expect(p.lessons['what-is-40k']).toMatchObject({ mistakes: 1 });
    expect(isUnlocked(2, ORDER, p)).toBe(true);
    expect(isUnlocked(3, ORDER, p)).toBe(false);
    const saved = await docs();
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('progress');
    expect(saved[0].data.lessons['what-is-40k']).toBeDefined();
  });

  test('completing a lesson again keeps the first completedAt and the fewest mistakes', async () => {
    const first = await completeLesson(repo, 'user-1', 'what-is-40k', 2);
    const again = await completeLesson(repo, 'user-1', 'what-is-40k', 0);
    expect(again.lessons['what-is-40k'].completedAt).toBe(first.lessons['what-is-40k'].completedAt);
    expect(again.lessons['what-is-40k'].mistakes).toBe(0);
  });

  test('two progress docs merge into one, keeping every completed lesson', async () => {
    const a: ProgressData = { schema: 1, lessons: { 'what-is-40k': { completedAt: 5, mistakes: 0 } } };
    const b: ProgressData = { schema: 1, lessons: { datasheets: { completedAt: 7, mistakes: 3 } }, firstGameId: 'g1' };
    await repo.saveDoc({ id: '00000000-0000-4000-8000-000000000001', kind: 'progress', ownerId: 'user-1', data: a });
    await repo.saveDoc({ id: '00000000-0000-4000-8000-000000000002', kind: 'progress', ownerId: 'user-1', data: b });
    const p = await completeLesson(repo, 'user-1', 'attacks', 0);
    expect(Object.keys(p.lessons).sort()).toEqual(['attacks', 'datasheets', 'what-is-40k']);
    expect(p.firstGameId).toBe('g1');
    const left = await docs();
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe('00000000-0000-4000-8000-000000000001');
    expect(Object.keys(left[0].data.lessons).sort()).toEqual(['attacks', 'datasheets', 'what-is-40k']);
    expect((await repo.getDoc('00000000-0000-4000-8000-000000000002'))!.deleted).toBe(true);
  });

  test('mergeProgress keeps the earliest completion of each lesson', () => {
    const m = mergeProgress(
      { schema: 1, lessons: { x: { completedAt: 9, mistakes: 1 } } },
      { schema: 1, lessons: { x: { completedAt: 4, mistakes: 3 } } },
    );
    expect(m.lessons.x).toEqual({ completedAt: 4, mistakes: 1 });
  });

  test('nextLesson and allDone follow the order', () => {
    const p: ProgressData = { schema: 1, lessons: { 'what-is-40k': { completedAt: 1, mistakes: 0 }, attacks: { completedAt: 2, mistakes: 0 } } };
    expect(nextLesson(ORDER, p)).toBe('datasheets');
    expect(allDone(ORDER, p)).toBe(false);
    const all = mergeProgress(p, { schema: 1, lessons: { datasheets: { completedAt: 3, mistakes: 0 } } });
    expect(nextLesson(ORDER, all)).toBeNull();
    expect(allDone(ORDER, all)).toBe(true);
  });
});

describe('useProgress', () => {
  const backend = (id: string): AuthBackend => ({
    getUser: async () => ({ id, email: null }),
    onChange: () => () => {},
    signInWithEmail: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider backend={backend('user-1')}>
        <StorageProvider db={db}>{children}</StorageProvider>
      </AuthProvider>
    );
  }

  test('useProgress shows a completion made elsewhere', async () => {
    localStorage.setItem('recruit.lastUser', JSON.stringify({ id: 'user-1', email: null }));
    const { result } = renderHook(() => useProgress(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.progress.lessons).toEqual({});
    await act(async () => {
      await completeLesson(createRepository(db), 'user-1', 'datasheets', 0);
    });
    await waitFor(() => expect(Object.keys(result.current.progress.lessons)).toEqual(['datasheets']));
  });
});
