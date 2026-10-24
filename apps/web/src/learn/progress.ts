/**
 * Learn progress: one 'progress' doc per user, stored locally first and synced like lists. Progress only grows: saving
 * reads every progress doc the user has (two offline devices can each make one), merges them, and keeps one.
 */
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { newDocId } from '../storage/ids';
import type { Repository } from '../storage/repository';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';

export interface LessonDone { completedAt: number; mistakes: number }
export interface ProgressData { schema: 1; lessons: Record<string, LessonDone>; firstGameId?: string }

export const EMPTY_PROGRESS: ProgressData = { schema: 1, lessons: {} };

/** Union of completions (earliest completedAt, fewest mistakes); firstGameId from the first one given that has one. */
export function mergeProgress(...all: ProgressData[]): ProgressData {
  const lessons: Record<string, LessonDone> = {};
  for (const p of all) {
    for (const [id, done] of Object.entries(p.lessons ?? {})) {
      const had = lessons[id];
      lessons[id] = had ? { completedAt: Math.min(had.completedAt, done.completedAt), mistakes: Math.min(had.mistakes, done.mistakes) } : { ...done };
    }
  }
  const firstGameId = all.find((p) => p.firstGameId)?.firstGameId;
  return { schema: 1, lessons, ...(firstGameId ? { firstGameId } : {}) };
}

/** The recommended lesson: the first one not done. Every lesson is open; this is only the suggestion. */
export const nextLesson = (lessonsInOrder: string[], p: ProgressData): string | null => lessonsInOrder.find((id) => !p.lessons[id]) ?? null;

export const allDone = (lessonsInOrder: string[], p: ProgressData): boolean => lessonsInOrder.length > 0 && nextLesson(lessonsInOrder, p) === null;

/** Reads every progress doc of the owner, merges them, applies `change`, saves into the oldest doc and deletes the rest. */
export async function updateProgress(repo: Repository, ownerId: string, change: (p: ProgressData) => ProgressData): Promise<ProgressData> {
  const docs = await repo.listDocs<ProgressData>('progress', ownerId); // newest first
  const merged = mergeProgress(...docs.map((d) => d.data));
  const next = mergeProgress(change(merged), merged);
  const keep = docs[docs.length - 1];
  await repo.saveDoc<ProgressData>({ id: keep?.id ?? newDocId(), kind: 'progress', ownerId, data: next });
  for (const d of docs.slice(0, -1)) await repo.deleteDoc(d.id);
  return next;
}

export const completeLesson = (repo: Repository, ownerId: string, lessonId: string, mistakes: number): Promise<ProgressData> =>
  updateProgress(repo, ownerId, (p) => ({ ...p, lessons: { ...p.lessons, [lessonId]: { completedAt: Date.now(), mistakes } } }));

/** The signed-in user's progress, live and merged across their progress docs. */
export function useProgress(): { progress: ProgressData; loading: boolean; error: Error | null } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; progress: ProgressData; error: Error | null } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    const sub = liveQuery(() => repo.listDocs<ProgressData>('progress', ownerId)).subscribe({
      next: (docs: Doc<ProgressData>[]) => setState({ ownerId, progress: mergeProgress(...docs.map((d) => d.data)), error: null }),
      error: (e: unknown) => setState({ ownerId, progress: EMPTY_PROGRESS, error: e instanceof Error ? e : new Error(String(e)) }),
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { progress: ready ? state.progress : EMPTY_PROGRESS, loading: Boolean(ownerId) && !ready, error: ready ? state.error : null };
}
