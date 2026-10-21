import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteStore } from './sync';
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

export function createSupabaseRemote(client: SupabaseClient): RemoteStore {
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
      const { error } = await client.from('documents').upsert(rows);
      if (error) throw new Error(`Sync push failed: ${error.message}`);
    },
    async pullSince(ownerId, cursor) {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('owner_id', ownerId)
        .gt('synced_seq', cursor)
        .order('synced_seq', { ascending: true })
        .limit(PAGE);
      if (error) throw new Error(`Sync pull failed: ${error.message}`);
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
