/** Saved table-companion games: kind 'game' docs with data.mode 'table', stored local-first like lists. */
import { liveQuery } from 'dexie';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { newDocId } from '../storage/ids';
import type { Repository } from '../storage/repository';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import { makeEvent, type TableEvent, type TableGameData, type TableSetup } from './game';

const isTableGame = (d: Doc<unknown>): d is Doc<TableGameData> => (d.data as { mode?: unknown } | null)?.mode === 'table';

/** The signed-in user's table games, newest first. Sandbox games (another mode) are left out. */
export function useTableGames(): { games: Doc<TableGameData>[]; loading: boolean } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; games: Doc<TableGameData>[] } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    const sub = liveQuery(() => repo.listDocs<unknown>('game', ownerId)).subscribe({
      next: (docs) => setState({ ownerId, games: docs.filter(isTableGame) }),
      error: (e: unknown) => {
        console.warn('Could not read saved games', e);
        setState({ ownerId, games: [] });
      },
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { games: ready ? state.games : [], loading: Boolean(ownerId) && !ready };
}

/** Saves a new game (with its start event) under a fresh UUID and returns the id. */
export async function createTableGame(repo: Repository, ownerId: string, setup: TableSetup): Promise<string> {
  const id = newDocId();
  const data: TableGameData = { mode: 'table', schema: 1, setup, events: [makeEvent({ t: 'start' }, null)] };
  await repo.saveDoc<TableGameData>({ id, kind: 'game', ownerId, data });
  return id;
}

/** One game, live from the local database, with ways to add events or replace its data (undo). */
export function useTableGame(id: string): {
  game: Doc<TableGameData> | null;
  loading: boolean;
  append(events: TableEvent[]): Promise<void>;
  replace(data: TableGameData): Promise<void>;
} {
  const { repo } = useStorage();
  const [state, setState] = useState<{ id: string; game: Doc<TableGameData> | null } | null>(null);
  useEffect(() => {
    const sub = liveQuery(() => repo.getDoc<unknown>(id)).subscribe({
      next: (doc) => setState({ id, game: doc && !doc.deleted && isTableGame(doc) ? doc : null }),
      error: (e: unknown) => {
        console.warn('Could not read the game', e);
        setState({ id, game: null });
      },
    });
    return () => sub.unsubscribe();
  }, [repo, id]);
  // Each write re-reads the stored doc, so quick taps never overwrite each other's events.
  const replace = useCallback(
    async (data: TableGameData) => {
      const doc = await repo.getDoc<TableGameData>(id);
      if (!doc) throw new Error('That game no longer exists.');
      await repo.saveDoc<TableGameData>({ id, kind: 'game', ownerId: doc.ownerId, data });
    },
    [repo, id],
  );
  const append = useCallback(
    async (events: TableEvent[]) => {
      const doc = await repo.getDoc<TableGameData>(id);
      if (!doc) throw new Error('That game no longer exists.');
      await repo.saveDoc<TableGameData>({ id, kind: 'game', ownerId: doc.ownerId, data: { ...doc.data, events: [...doc.data.events, ...events] } });
    },
    [repo, id],
  );
  const ready = state !== null && state.id === id;
  return { game: ready ? state.game : null, loading: !ready, append, replace };
}
