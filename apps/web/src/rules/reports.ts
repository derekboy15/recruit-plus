import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { newDocId } from '../storage/ids';
import type { Repository } from '../storage/repository';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import type { Wording } from './wording';

export type ReportTargetKind = 'ability' | 'army-rule' | 'stratagem' | 'datasheet' | 'rules-section' | 'glossary' | 'guide';
export type ReportProblem = 'wrong' | 'unclear' | 'typo' | 'other';

export const PROBLEM_LABELS: Record<ReportProblem, string> = {
  wrong: "It's wrong",
  unclear: "It's unclear",
  typo: "There's a typo",
  other: 'Something else',
};

/** A user's report of a rules error, saved as a document that syncs like a list (the maintainer reads them on the server). */
export interface RulesReport {
  target: { kind: ReportTargetKind; name: string; /** location.pathname + hash */ path: string };
  problem: ReportProblem;
  note: string;
  /** What the user was looking at. */
  wording: Wording;
  text: string;
  /** index.json generatedAt: which data build the report is about. */
  dataGeneratedAt: string;
}

export async function saveReport(repo: Repository, ownerId: string, report: RulesReport): Promise<string> {
  const id = newDocId();
  await repo.saveDoc<RulesReport>({ id, kind: 'report', ownerId, data: report });
  return id;
}

/** The signed-in user's reports, newest first. */
export function useReports(): { reports: Doc<RulesReport>[]; loading: boolean } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; reports: Doc<RulesReport>[] } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    const sub = liveQuery(() => repo.listDocs<RulesReport>('report', ownerId)).subscribe({
      next: (reports) => setState({ ownerId, reports }),
      error: () => setState({ ownerId, reports: [] }),
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { reports: ready ? state.reports : [], loading: Boolean(ownerId) && !ready };
}
