import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { BattleSizeId, Roster } from '@recruit/data/roster';
import { useAuth } from '../auth/AuthContext';
import { newDocId } from '../storage/ids';
import type { Repository } from '../storage/repository';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';

/** What a saved list holds: the roster itself, plus numbers cached for the lists page so it never has to load roster data. */
export interface ListData {
  roster: Roster;
  summary: {
    catalogueSlug: string;
    /** Display name, e.g. "Necrons". */
    faction: string;
    battleSize: BattleSizeId;
    points: number;
    pointsLimit: number;
    issueCount: number;
  };
}

/** The signed-in user's saved lists, newest edit first. `loading` is true until the first read finishes. */
export function useLists(): { lists: Doc<ListData>[]; loading: boolean } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; lists: Doc<ListData>[] } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    const sub = liveQuery(() => repo.listDocs<ListData>('list', ownerId)).subscribe({
      next: (lists) => setState({ ownerId, lists }),
      error: (e) => console.warn('Could not read saved lists', e),
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { lists: ready ? state.lists : [], loading: Boolean(ownerId) && !ready };
}

/** Saves a new list under a fresh UUID and returns the id. */
export async function createList(repo: Repository, ownerId: string, data: ListData): Promise<string> {
  const id = newDocId();
  await repo.saveDoc<ListData>({ id, kind: 'list', ownerId, data });
  return id;
}

/** Replaces a list's data, keeping its id, owner and sharing setting. */
export async function saveList(repo: Repository, doc: Pick<Doc<ListData>, 'id' | 'ownerId' | 'isPublic'>, data: ListData): Promise<void> {
  await repo.saveDoc<ListData>({ id: doc.id, kind: 'list', ownerId: doc.ownerId, isPublic: doc.isPublic, data });
}

/** Turns link sharing on or off for a list. */
export async function setListPublic(repo: Repository, id: string, isPublic: boolean): Promise<void> {
  const doc = await repo.getDoc<ListData>(id);
  if (!doc) throw new Error('That list no longer exists.');
  await repo.saveDoc<ListData>({ id, kind: 'list', ownerId: doc.ownerId, isPublic, data: doc.data });
}
