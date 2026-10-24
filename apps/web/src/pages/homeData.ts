/**
 * What the signed-in home shows: your next lesson, your latest lists and your games in progress. It reads the local
 * database directly (summaries only), so the home page never loads the engine, the roster engine or the board.
 */
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getLessons } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { nextLesson, useProgress } from '../learn/progress';
import type { ListData } from '../lists/listStore';
import type { GameData } from '../play/store/gameStore';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import type { TableGameData } from '../table/game';

export interface HomeList { id: string; name: string; faction: string; slug: string; size: string; points: number; pointsLimit: number; issueCount: number; updatedAt: number }
export interface HomeGame { id: string; kind: 'practice' | 'table'; title: string; status: string; to: string; updatedAt: number }
export type NextLesson =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'next'; id: string; title: string; order: number; total: number }
  | { status: 'done'; total: number };

export const SIZE_NAMES: Record<string, string> = {
  'combat-patrol': 'Combat Patrol',
  incursion: 'Incursion',
  'strike-force': 'Strike Force',
  onslaught: 'Onslaught',
};

export function toHomeList(doc: Doc<ListData>): HomeList {
  const s = doc.data.summary;
  return {
    id: doc.id,
    name: doc.data.roster?.name?.trim() || 'Untitled list',
    faction: s.faction,
    slug: s.catalogueSlug,
    size: SIZE_NAMES[s.battleSize] ?? s.battleSize,
    points: s.points,
    pointsLimit: s.pointsLimit,
    issueCount: s.issueCount,
    updatedAt: doc.updatedAt,
  };
}

/** A game in progress as a home row; null once the game has ended. Practice and table games share the 'game' kind. */
export function toHomeGame(doc: Doc<unknown>): HomeGame | null {
  const base = { id: doc.id, updatedAt: doc.updatedAt };
  if ((doc.data as { mode?: string } | null)?.mode === 'table') {
    const d = doc.data as Partial<TableGameData>;
    if (d.events?.some((e) => e.t === 'end')) return null;
    const players = d.setup?.players;
    return { ...base, kind: 'table', title: `${players?.A?.name ?? 'Player A'} vs ${players?.B?.name ?? 'Player B'}`, status: 'In progress', to: `/table/${doc.id}` };
  }
  const d = doc.data as Partial<GameData> | null;
  if (!d?.summary || d.summary.ended) return null;
  const status = d.summary.phase === 'pre-battle' ? 'Setting up' : `Round ${d.summary.round}`;
  return { ...base, kind: 'practice', title: d.meta?.title || 'Practice game', status, to: `/play/${doc.id}` };
}

/** The signed-in user's lists and unfinished games, newest first, live. */
export function useHomeData(): { lists: HomeList[]; games: HomeGame[]; loading: boolean } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; lists: HomeList[]; games: HomeGame[] } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    const sub = liveQuery(async () => {
      const [lists, games] = await Promise.all([repo.listDocs<ListData>('list', ownerId), repo.listDocs<unknown>('game', ownerId)]);
      return { lists, games };
    }).subscribe({
      next: ({ lists, games }) =>
        setState({ ownerId, lists: lists.map(toHomeList), games: games.map(toHomeGame).filter((g): g is HomeGame => g !== null) }),
      error: () => setState({ ownerId, lists: [], games: [] }),
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { lists: ready ? state.lists : [], games: ready ? state.games : [], loading: Boolean(ownerId) && !ready };
}

/** The lesson to take next (the first one not done), or done when every lesson is. */
export function useNextLesson(): NextLesson {
  const lessons = useAsync(getLessons, 'lessons');
  const { progress, loading, error } = useProgress();
  if (lessons.status === 'error' || error) return { status: 'error' };
  if (lessons.status === 'loading' || loading) return { status: 'loading' };
  const all = lessons.data.lessons;
  if (all.length === 0) return { status: 'error' };
  const id = nextLesson(all.map((l) => l.id), progress);
  const lesson = all.find((l) => l.id === id);
  if (!lesson) return { status: 'done', total: all.length };
  return { status: 'next', id: lesson.id, title: lesson.title, order: lesson.order, total: all.length };
}
