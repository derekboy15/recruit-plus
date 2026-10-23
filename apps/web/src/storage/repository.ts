import type { RecruitDb } from './db';
import type { Doc, DocKind } from './types';

/** updatedAt defaults to now; give it to record when the edit was made (an edit saved later, e.g. recovered). */
export type NewDoc<T> = Pick<Doc<T>, 'id' | 'kind' | 'ownerId' | 'data'> & Partial<Pick<Doc<T>, 'isPublic' | 'updatedAt'>>;

export interface Repository {
  saveDoc<T>(doc: NewDoc<T>): Promise<Doc<T>>;
  getDoc<T>(id: string): Promise<Doc<T> | undefined>;
  listDocs<T>(kind: DocKind, ownerId: string): Promise<Doc<T>[]>;
  deleteDoc(id: string): Promise<void>;
}

export function createRepository(db: RecruitDb, now: () => number = Date.now): Repository {
  return {
    async saveDoc<T>(input: NewDoc<T>) {
      const existing = await db.docs.get(input.id);
      const doc: Doc<T> = {
        id: input.id,
        kind: input.kind,
        ownerId: input.ownerId,
        data: input.data,
        isPublic: input.isPublic ?? existing?.isPublic ?? false,
        deleted: false,
        updatedAt: input.updatedAt ?? now(),
        dirty: true,
      };
      await db.docs.put(doc as Doc);
      return doc;
    },
    async getDoc<T>(id: string) {
      return (await db.docs.get(id)) as Doc<T> | undefined;
    },
    async listDocs<T>(kind: DocKind, ownerId: string) {
      const docs = await db.docs.where('[ownerId+kind]').equals([ownerId, kind]).toArray();
      return docs.filter((d) => !d.deleted).sort((a, b) => b.updatedAt - a.updatedAt) as Doc<T>[];
    },
    async deleteDoc(id: string) {
      // Only a deletion record is kept: the contents go, here and (once synced) on the server.
      await db.docs.update(id, { deleted: true, data: {}, dirty: true, updatedAt: now() });
    },
  };
}
