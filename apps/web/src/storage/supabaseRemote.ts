import type { SupabaseLoader } from '../auth/backend';
import { SyncAuthError, type RemoteStore } from './sync';
import type { Doc } from './types';

interface Row {
  id: string;
  owner_id: string;
  kind: Doc['kind'];
  data: unknown;
  updated_at: number;
  deleted: boolean;
  is_public: boolean;
  synced_seq: number;
}

const PAGE = 1000;

interface RemoteError {
  message: string;
  code?: string;
}

/** An expired or invalid sign-in, as opposed to the server rejecting a particular document. */
export function isAuthFailure(error: RemoteError, status?: number): boolean {
  return status === 401 || error.code === 'PGRST301' || error.code === 'PGRST302' || /jwt|token/i.test(error.message);
}

function syncError(what: string, error: RemoteError, status?: number): Error {
  const message = `Sync ${what} failed: ${error.message}`;
  return isAuthFailure(error, status) ? new SyncAuthError(message) : new Error(message);
}

export function createSupabaseRemote(load: SupabaseLoader): RemoteStore {
  return {
    async pushDocs(docs) {
      const rows = docs.map((d) => ({
        id: d.id,
        owner_id: d.ownerId,
        kind: d.kind,
        data: d.data,
        updated_at: d.updatedAt,
        deleted: d.deleted,
        is_public: d.isPublic,
      }));
      const { error, status } = await (await load()).from('documents').upsert(rows);
      if (error) throw syncError('push', error, status);
    },
    async pullSince(ownerId, cursor) {
      const { data, error, status } = await (await load())
        .from('documents')
        .select('*')
        .eq('owner_id', ownerId)
        .gt('synced_seq', cursor)
        .order('synced_seq', { ascending: true })
        .limit(PAGE);
      if (error) throw syncError('pull', error, status);
      const rows = (data ?? []) as Row[];
      return {
        docs: rows.map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          kind: r.kind,
          data: r.data,
          updatedAt: Number(r.updated_at),
          deleted: r.deleted,
          isPublic: r.is_public,
          dirty: false,
        })),
        cursor: rows.length ? Number(rows[rows.length - 1].synced_seq) : cursor,
      };
    },
  };
}
