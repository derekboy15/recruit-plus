import type { RecruitDb } from './db';
import type { Doc } from './types';

export interface RemoteStore {
  /** Upserts docs; the server keeps whichever copy has the later updatedAt. */
  pushDocs(docs: Doc[]): Promise<void>;
  /** Docs written on the server after `cursor` (a server-side sequence, not a device clock). */
  pullSince(ownerId: string, cursor: number): Promise<{ docs: Doc[]; cursor: number }>;
}

const cursorKey = (ownerId: string) => `pullCursor:${ownerId}`;

/**
 * One sync round, last write wins per document:
 * 1. pull docs the server received since our cursor and apply any that beat the local copy
 *    (a remote win discards an older unsynced local edit);
 * 2. push the remaining dirty docs and mark them clean if unchanged meanwhile.
 * Pulling first stops a stale offline device from overwriting a newer server copy.
 */
export async function syncOnce(db: RecruitDb, remote: RemoteStore, ownerId: string): Promise<{ pushed: number; pulled: number }> {
  const since = (await db.meta.get(cursorKey(ownerId)))?.value ?? 0;
  const { docs: incoming, cursor } = await remote.pullSince(ownerId, since);
  let pulled = 0;
  await db.transaction('rw', db.docs, async () => {
    for (const r of incoming) {
      const local = await db.docs.get(r.id);
      if (!local || r.updatedAt > local.updatedAt) {
        await db.docs.put({ ...r, dirty: false });
        pulled++;
      }
    }
  });

  const dirty = (await db.docs.where('ownerId').equals(ownerId).toArray()).filter((d) => d.dirty);
  if (dirty.length) {
    await remote.pushDocs(dirty);
    await db.transaction('rw', db.docs, async () => {
      for (const d of dirty) {
        const cur = await db.docs.get(d.id);
        if (cur && cur.updatedAt === d.updatedAt) await db.docs.update(d.id, { dirty: false });
      }
    });
  }
  await db.meta.put({ key: cursorKey(ownerId), value: cursor });
  return { pushed: dirty.length, pulled };
}

/** Syncs when the app regains connectivity or focus, and every minute. Returns a stop function. */
export function startAutoSync(db: RecruitDb, remote: RemoteStore, ownerId: string, intervalMs = 60_000): () => void {
  let running = false;
  const run = async () => {
    if (running || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    running = true;
    try {
      await syncOnce(db, remote, ownerId);
    } catch (e) {
      console.warn('Sync failed; will retry', e);
    } finally {
      running = false;
    }
  };
  window.addEventListener('online', run);
  window.addEventListener('focus', run);
  const timer = window.setInterval(run, intervalMs);
  void run();
  return () => {
    window.removeEventListener('online', run);
    window.removeEventListener('focus', run);
    window.clearInterval(timer);
  };
}
