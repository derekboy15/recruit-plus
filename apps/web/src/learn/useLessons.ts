/** The lessons, the glossary and the signed-in user's progress, loaded together for the Learn pages. */
import type { GlossaryTerm, Lesson } from '@recruit/data/model';
import { getLessons, getRules } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { useProgress, type ProgressData } from './progress';

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

