import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { UNTITLED_LIST, type BattleSizeId, type Roster } from '@recruit/data/roster';
import { useAuth } from '../auth/AuthContext';
import { newDocId } from '../storage/ids';
import type { Repository } from '../storage/repository';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import { uniqueListName } from './labels';
import { recoverPending } from './pendingEdits';

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

/**
 * The signed-in user's saved lists, newest edit first. `loading` is true until the first read finishes; `error` is set
 * when the local database can't be read (the lists page shows it instead of loading forever).
 */
export function useLists(): { lists: Doc<ListData>[]; loading: boolean; error: Error | null } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; lists: Doc<ListData>[]; error: Error | null } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    // Edits a closing page kept aside are saved now; the live query below then shows them.
    recoverPending(repo).catch((e: unknown) => console.warn('Could not restore unsaved list edits', e));
    const sub = liveQuery(() => repo.listDocs<ListData>('list', ownerId)).subscribe({
      next: (lists) => setState({ ownerId, lists, error: null }),
      error: (e: unknown) => setState({ ownerId, lists: [], error: e instanceof Error ? e : new Error(String(e)) }),
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { lists: ready ? state.lists : [], loading: Boolean(ownerId) && !ready, error: ready ? state.error : null };
}

/** Saves a new list under a fresh UUID and returns the id. */
export async function createList(repo: Repository, ownerId: string, data: ListData): Promise<string> {
  const id = newDocId();
  await repo.saveDoc<ListData>({ id, kind: 'list', ownerId, data });
  return id;
}

async function existing(repo: Repository, id: string): Promise<Doc<ListData>> {
  const doc = await repo.getDoc<ListData>(id);
  if (!doc || doc.deleted) throw new Error('That list no longer exists.');
  return doc;
}

/** Saves a private copy named "<name> (copy)" (numbered when `taken`, the player's list names, has it) and returns its id. */
export async function duplicateList(repo: Repository, ownerId: string, id: string, taken: string[]): Promise<string> {
  const { data } = await existing(repo, id);
  const name = uniqueListName(`${data.roster.name.trim() || UNTITLED_LIST} (copy)`, taken);
  return createList(repo, ownerId, { ...data, roster: { ...data.roster, name } });
}

/** Deletes a list and returns it as it was, so the deletion can be undone with restoreList. */
export async function deleteList(repo: Repository, id: string): Promise<Doc<ListData>> {
  const doc = await existing(repo, id);
  await repo.deleteDoc(id);
  return doc;
}

/**
 * Saves a deleted list again, sharing as it was, stamped later than its deletion: last write wins, so once synced it
 * comes back on every device, even where the deletion already arrived.
 */
export async function restoreList(repo: Repository, doc: Doc<ListData>): Promise<void> {
  const deletion = await repo.getDoc<ListData>(doc.id);
  const updatedAt = Math.max(Date.now(), (deletion?.updatedAt ?? doc.updatedAt) + 1);
  await repo.saveDoc<ListData>({ id: doc.id, kind: 'list', ownerId: doc.ownerId, isPublic: doc.isPublic, data: doc.data, updatedAt });
}

/** Turns link sharing on or off for a list. */
export async function setListPublic(repo: Repository, id: string, isPublic: boolean): Promise<void> {
  const doc = await repo.getDoc<ListData>(id);
  if (!doc) throw new Error('That list no longer exists.');
  await repo.saveDoc<ListData>({ id, kind: 'list', ownerId: doc.ownerId, isPublic, data: doc.data });
}
