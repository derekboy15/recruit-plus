import type { RecruitDb } from './db';
import { isUuid, newDocId } from './ids';
import type { Doc } from './types';

export interface RemoteStore {
  /** Upserts docs; the server keeps whichever copy has the later updatedAt. */
  pushDocs(docs: Doc[]): Promise<void>;
  /** Docs written on the server after `cursor` (a server-side sequence, not a device clock). */
  pullSince(ownerId: string, cursor: number): Promise<{ docs: Doc[]; cursor: number }>;
}

const cursorKey = (ownerId: string) => `pullCursor:${ownerId}`;

/**
 * How far back each pull reaches behind the saved cursor. The server numbers rows when they are
 * written, but a slow transaction can commit after a later one, so a row can appear with a number
 * below our cursor. Re-reading a window is safe because a pulled doc is only applied if strictly newer.
 */
export const PULL_OVERLAP = 50;

/** The server refused a sync because the sign-in has expired; the user must sign in again. */
export class SyncAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncAuthError';
  }
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  /** Ids of docs the server rejected; they stay unsynced and are retried next round. */
  failed: string[];
  /** Local docs given a new id because their old one was not a UUID. */
  rekeyed: number;
}

/** Gives every non-UUID doc of this owner a fresh id (the server never saw the old ones). */
async function rekeyBadIds(db: RecruitDb, ownerId: string): Promise<number> {
  return db.transaction('rw', db.docs, async () => {
    const bad = (await db.docs.where('ownerId').equals(ownerId).toArray()).filter((d) => !isUuid(d.id));
    for (const d of bad) {
      await db.docs.add({ ...d, id: newDocId(), dirty: true });
      await db.docs.delete(d.id);
    }
    return bad.length;
  });
}

/**
 * One sync round, last write wins per document:
 * 1. pull docs the server received since our cursor (less an overlap window) and apply any that
 *    beat the local copy (a remote win discards an older unsynced local edit);
 * 2. re-key docs with ids the server would refuse, then push the dirty docs and mark them clean if
 *    unchanged meanwhile. If the batch is refused, each doc is pushed alone so one bad doc can't
 *    block the rest; docs that still fail stay dirty and are reported in `failed`.
 * Pulling first stops a stale offline device from overwriting a newer server copy.
 */
export async function syncOnce(db: RecruitDb, remote: RemoteStore, ownerId: string): Promise<SyncResult> {
  const saved = (await db.meta.get(cursorKey(ownerId)))?.value ?? 0;
  const { docs: incoming, cursor } = await remote.pullSince(ownerId, Math.max(0, saved - PULL_OVERLAP));
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

  const rekeyed = await rekeyBadIds(db, ownerId);
  const dirty = (await db.docs.where('ownerId').equals(ownerId).toArray()).filter((d) => d.dirty);
  const accepted: Doc[] = [];
  const failed: string[] = [];
  if (dirty.length) {
    try {
      await remote.pushDocs(dirty);
      accepted.push(...dirty);
    } catch (e) {
      if (e instanceof SyncAuthError) throw e;
      for (const d of dirty) {
        try {
          await remote.pushDocs([d]);
          accepted.push(d);
        } catch (e2) {
          if (e2 instanceof SyncAuthError) throw e2;
          failed.push(d.id);
        }
      }
    }
    await db.transaction('rw', db.docs, async () => {
      for (const d of accepted) {
        const cur = await db.docs.get(d.id);
        if (cur && cur.updatedAt === d.updatedAt) await db.docs.update(d.id, { dirty: false });
      }
    });
  }
  // An empty pull echoes back the (lowered) cursor it was given, so never move the saved one backwards.
  await db.meta.put({ key: cursorKey(ownerId), value: Math.max(saved, cursor) });
  return { pushed: accepted.length, pulled, failed, rekeyed };
}

export interface AutoSyncOptions {
  intervalMs?: number;
  /** Called once when the server says the sign-in has expired; auto-sync stops itself first. */
  onAuthError?: () => void;
}

/**
 * Syncs when the app regains connectivity or focus, and every minute. Returns a stop function.
 * Stops by itself after an expired sign-in; start it again once the user has signed in.
 */
export function startAutoSync(db: RecruitDb, remote: RemoteStore, ownerId: string, opts: AutoSyncOptions = {}): () => void {
  const { intervalMs = 60_000, onAuthError } = opts;
  let running = false;
  let stopped = false;
  const stop = () => {
    stopped = true;
    window.removeEventListener('online', run);
    window.removeEventListener('focus', run);
    window.clearInterval(timer);
  };
  async function run() {
    if (stopped || running || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    running = true;
    try {
      const result = await syncOnce(db, remote, ownerId);
      if (result.failed.length) console.warn('Some documents could not be synced', result.failed);
    } catch (e) {
      if (e instanceof SyncAuthError) {
        stop();
        onAuthError?.();
      } else {
        console.warn('Sync failed; will retry', e);
      }
    } finally {
      running = false;
    }
  }
  window.addEventListener('online', run);
  window.addEventListener('focus', run);
  const timer = window.setInterval(run, intervalMs);
  void run();
  return stop;
}
