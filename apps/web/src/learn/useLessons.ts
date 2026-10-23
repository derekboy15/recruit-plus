/** The lessons, the glossary and the signed-in user's progress, loaded together for the Learn pages. */
import type { GlossaryTerm, Lesson } from '@recruit/data/model';
import { getLessons, getRules } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { isUnlocked, useProgress, type ProgressData } from './progress';

export type LearnData =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; lessons: Lesson[]; order: string[]; glossary: GlossaryTerm[]; progress: ProgressData };

export function useLearnData(): LearnData {
  const data = useAsync(() => Promise.all([getLessons(), getRules()]), 'learn');
  const { progress, loading, error } = useProgress();
  if (data.status === 'error') return data;
  if (error) return { status: 'error', error };
  if (data.status === 'loading' || loading) return { status: 'loading' };
  const [{ lessons }, rules] = data.data;
  return { status: 'ready', lessons, order: lessons.map((l) => l.id), glossary: rules.glossary, progress };
}

/** Whether a lesson is open, and if not, the lesson to finish first. */
export function lockOf(lessons: Lesson[], progress: ProgressData, lesson: Lesson): { open: true } | { open: false; before: Lesson; next: Lesson | null } {
  const order = lessons.map((l) => l.id);
  const i = order.indexOf(lesson.id);
  if (isUnlocked(i + 1, order, progress)) return { open: true };
  const next = lessons.find((l) => !progress.lessons[l.id]) ?? null;
  return { open: false, before: lessons[i - 1], next };
}
