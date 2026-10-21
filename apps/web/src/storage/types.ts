export type DocKind = 'list' | 'game' | 'progress';

/** A user document stored locally first and synced to the server (last write wins). */
export interface Doc<T = unknown> {
  id: string;
  kind: DocKind;
  ownerId: string;
  /** Milliseconds since epoch of the last local edit. */
  updatedAt: number;
  deleted: boolean;
  isPublic: boolean;
  data: T;
  /** True while the latest local edit has not reached the server. */
  dirty: boolean;
}
