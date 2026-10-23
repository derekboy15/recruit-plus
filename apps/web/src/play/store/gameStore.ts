/** Saved sandbox games: a storage doc of kind 'game' holding the engine record and what the app needs around it. */
import { EngineLoadError, loadGame, newGame, stateOf, totalVp, type GameRecord, type GameSetup, type Phase, type PlayerId } from '@recruit/engine';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { newDocId } from '../../storage/ids';
import type { Repository } from '../../storage/repository';
import { useStorage } from '../../storage/StorageContext';
import type { Doc } from '../../storage/types';

export interface GameMeta {
  /** "Necrons vs Ultramarines". */
  title: string;
  createdAt: number;
  hints: boolean;
  handOver: boolean;
  missionId: string;
  layoutId: string;
  armies: { player: PlayerId; listId: string; name: string; faction: string; catalogueSlugs: string[] }[];
}
export interface GameSummary { round: number; phase: Phase; ended: boolean; winner: PlayerId | null; vp: Record<PlayerId, number> }
export interface GameData { record: GameRecord; meta: GameMeta; summary: GameSummary }

export function summarise(record: GameRecord): GameSummary {
  const s = stateOf(record);
  return { round: s.round, phase: s.phase, ended: !!s.ended, winner: s.ended?.winner ?? null, vp: { A: totalVp(s, 'A'), B: totalVp(s, 'B') } };
}

export async function createGame(repo: Repository, ownerId: string, setup: GameSetup, meta: GameMeta): Promise<string> {
  const record = newGame(setup);
  const id = newDocId();
  await repo.saveDoc<GameData>({ id, kind: 'game', ownerId, data: { record, meta, summary: summarise(record) } });
  return id;
}

export function saveGameDoc(repo: Repository, doc: Doc<GameData>, record: GameRecord): Promise<Doc<GameData>> {
  return repo.saveDoc<GameData>({ id: doc.id, kind: 'game', ownerId: doc.ownerId, data: { ...doc.data, record, summary: summarise(record) } });
}

export type Opened =
  | { ok: true; doc: Doc<GameData>; record: GameRecord }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'unreadable'; message: string };

/** Table companion games share the 'game' kind (data.mode 'table'); the sandbox never lists or opens them. */
export const isSandboxGame = (doc: Doc<unknown>): doc is Doc<GameData> => (doc.data as { mode?: string } | null)?.mode !== 'table';

/** Opens a saved game; a record this engine can't replay comes back as unreadable with the engine's reason. */
export async function openGameDoc(repo: Repository, id: string): Promise<Opened> {
  const doc = await repo.getDoc<GameData>(id);
  if (!doc || doc.deleted || doc.kind !== 'game' || !isSandboxGame(doc)) return { ok: false, reason: 'missing' };
  try {
    return { ok: true, doc, record: loadGame(JSON.stringify(doc.data.record)) };
  } catch (e) {
    return { ok: false, reason: 'unreadable', message: e instanceof EngineLoadError ? e.message : `This saved game couldn't be opened: ${(e as Error).message}` };
  }
}

/** The signed-in user's saved games, newest first (the same contract as useLists). */
export function useGames(): { games: Doc<GameData>[]; loading: boolean; error: Error | null } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; games: Doc<GameData>[]; error: Error | null } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    const sub = liveQuery(() => repo.listDocs<GameData>('game', ownerId)).subscribe({
      next: (games) => setState({ ownerId, games: games.filter(isSandboxGame), error: null }),
      error: (e: unknown) => setState({ ownerId, games: [], error: e instanceof Error ? e : new Error(String(e)) }),
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { games: ready ? state.games : [], loading: Boolean(ownerId) && !ready, error: ready ? state.error : null };
}
