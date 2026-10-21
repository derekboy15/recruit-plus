/**
 * A synchronous safety copy of a list's latest data, written when the page is being hidden or closed. The database
 * save started at that moment is asynchronous and the browser may cut it off (a reload, a closed tab, a phone that
 * kills the app). Opening the list, or the lists page, writes any copy newer than the saved list back to the database.
 */
import type { Repository } from '../storage/repository';
import type { ListData } from './listStore';

const PREFIX = 'recruit.pendingList.';

interface Pending { data: ListData; at: number }

export function keepPending(listId: string, data: ListData, at = Date.now()): void {
  try {
    localStorage.setItem(PREFIX + listId, JSON.stringify({ data, at } satisfies Pending));
  } catch {
    // Storage full or blocked: the database save is still under way.
  }
}

/** Drops the safety copy once a save that started at or after it has landed. */
export function dropPending(listId: string, savedFrom: number): void {
  try {
    const raw = localStorage.getItem(PREFIX + listId);
    if (raw && (JSON.parse(raw) as Pending).at <= savedFrom) localStorage.removeItem(PREFIX + listId);
  } catch {
    // Nothing to drop.
  }
}

function pendingIds(): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
  } catch {
    return [];
  }
}

/**
 * Saves each safety copy (of these lists, or all) that is newer than its saved list, then drops it. A copy older than
 * the saved list (say a newer version arrived from another device) is dropped unused.
 */
export async function recoverPending(repo: Repository, listIds: string[] = pendingIds()): Promise<void> {
  for (const id of listIds) {
    let pending: Pending;
    try {
      const raw = localStorage.getItem(PREFIX + id);
      if (!raw) continue;
      pending = JSON.parse(raw) as Pending;
    } catch {
      continue;
    }
    const doc = await repo.getDoc<ListData>(id);
    if (doc && !doc.deleted && pending.at > doc.updatedAt && pending.data?.roster?.schema === 1) {
      await repo.saveDoc<ListData>({ id, kind: 'list', ownerId: doc.ownerId, data: pending.data });
    }
    localStorage.removeItem(PREFIX + id);
  }
}
