/**
 * Where the read-only share page gets a shared list from. With accounts switched on that is the server (readable by
 * anyone, signed in or not, because the table lets everyone read public documents); in local development it is the
 * database on this device. The choice is made once in App.tsx and handed down through PublicSourceContext.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { RecruitDb } from '../storage/db';
import type { ListData } from './listStore';

export interface PublicListSource {
  /** The shared list, or null when there is no such list, it is not shared, or it was deleted. */
  get(id: string): Promise<{ data: ListData; updatedAt: number } | null>;
}

/** Enough of a list's shape to open it: anything else (a hand-edited or damaged row) is treated as not shared. */
function looksLikeList(data: unknown): data is ListData {
  const { roster, summary } = (data ?? {}) as { roster?: { name?: unknown; forces?: unknown; catalogueId?: unknown } | null; summary?: unknown };
  return (
    typeof roster === 'object' && roster !== null && typeof roster.name === 'string' && Array.isArray(roster.forces) &&
    typeof roster.catalogueId === 'string' &&
    typeof summary === 'object' && summary !== null
  );
}

export function createSupabasePublicSource(client: SupabaseClient): PublicListSource {
  return {
    async get(id) {
      const { data, error } = await client
        .from('documents')
        .select('data, updated_at')
        .eq('id', id)
        .eq('is_public', true)
        .eq('deleted', false)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const row = data as { data: unknown; updated_at: number } | null;
      return row && looksLikeList(row.data) ? { data: row.data, updatedAt: Number(row.updated_at) } : null;
    },
  };
}

/** Development without Supabase: a shared list can only be opened on the device that has it. */
export function createLocalPublicSource(db: RecruitDb): PublicListSource {
  return {
    async get(id) {
      const doc = await db.docs.get(id);
      if (!doc || doc.deleted || !doc.isPublic || doc.kind !== 'list' || !looksLikeList(doc.data)) return null;
      return { data: doc.data, updatedAt: doc.updatedAt };
    },
  };
}

export interface PublicSourceValue {
  source: PublicListSource;
  /** Whether share links reach other devices (accounts are switched on). False in local development. */
  linksWorkAnywhere: boolean;
}

export const PublicSourceContext = createContext<PublicSourceValue | null>(null);

export function usePublicSource(): PublicSourceValue {
  const ctx = useContext(PublicSourceContext);
  if (!ctx) throw new Error('usePublicSource must be used inside a PublicSourceContext provider');
  return ctx;
}
