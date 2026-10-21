import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { RecruitDb } from './db';
import { createRepository, type Repository } from './repository';

export interface Storage {
  db: RecruitDb;
  repo: Repository;
}

const StorageContext = createContext<Storage | null>(null);

/** Gives pages the local database and a repository over it (the app opens one database; tests open their own). */
export function StorageProvider({ db, children }: { db: RecruitDb; children: ReactNode }) {
  const value = useMemo<Storage>(() => ({ db, repo: createRepository(db) }), [db]);
  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage(): Storage {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used inside <StorageProvider>');
  return ctx;
}
