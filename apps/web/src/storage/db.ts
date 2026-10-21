import Dexie, { type Table } from 'dexie';
import type { Doc } from './types';

export interface MetaRow {
  key: string;
  value: number;
}

export class RecruitDb extends Dexie {
  docs!: Table<Doc, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      docs: 'id, kind, ownerId, updatedAt, dirty, [ownerId+kind]',
      meta: 'key',
    });
  }
}

export function openDb(name = 'recruitplus'): RecruitDb {
  return new RecruitDb(name);
}
