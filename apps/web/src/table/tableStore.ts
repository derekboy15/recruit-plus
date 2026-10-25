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

/**
 * Deletes a game at once and returns `restore`, which saves the same game (id, owner, setup and events) back: the
 * Undo on the "Game deleted" toast.
 */
export async function deleteTableGame(repo: Repository, id: string): Promise<() => Promise<void>> {
  const doc = await repo.getDoc<TableGameData>(id);
  if (!doc) throw new Error('That game no longer exists.');
  await repo.deleteDoc(id);
  return async () => {
    await repo.saveDoc<TableGameData>({ id: doc.id, kind: doc.kind, ownerId: doc.ownerId, data: doc.data });
  };
}

/**
 * One game, live from the local database. `append` adds events and `update` changes the data (undo); each runs as one
 * read-and-save transaction, so writes that overlap (quick taps, auto CP) queue up instead of overwriting each other.
 */
export function useTableGame(id: string): {
  game: Doc<TableGameData> | null;
  loading: boolean;
  append(events: TableEvent[]): Promise<void>;
  update(change: (data: TableGameData) => TableGameData): Promise<void>;
} {
  const { db, repo } = useStorage();
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
  const update = useCallback(
    (change: (data: TableGameData) => TableGameData) =>
      db.transaction('rw', db.docs, async () => {
        const doc = await repo.getDoc<TableGameData>(id);
        if (!doc) throw new Error('That game no longer exists.');
        await repo.saveDoc<TableGameData>({ id, kind: 'game', ownerId: doc.ownerId, data: change(doc.data) });
      }),
    [db, repo, id],
  );
  const append = useCallback((events: TableEvent[]) => update((d) => ({ ...d, events: [...d.events, ...events] })), [update]);
  const ready = state !== null && state.id === id;
  return { game: ready ? state.game : null, loading: !ready, append, update };
}
