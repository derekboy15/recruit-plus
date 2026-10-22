/** Saved sandbox games: a storage doc of kind 'game' holding the engine record and what the app needs around it. */
import type { GameRecord, Phase, PlayerId } from '@recruit/engine';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
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

/** The signed-in user's saved games, newest first (the same contract as useLists). */
export function useGames(): { games: Doc<GameData>[]; loading: boolean; error: Error | null } {
  const { user } = useAuth();
  const { repo } = useStorage();
  const ownerId = user?.id;
  const [state, setState] = useState<{ ownerId: string; games: Doc<GameData>[]; error: Error | null } | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    const sub = liveQuery(() => repo.listDocs<GameData>('game', ownerId)).subscribe({
      next: (games) => setState({ ownerId, games, error: null }),
      error: (e: unknown) => setState({ ownerId, games: [], error: e instanceof Error ? e : new Error(String(e)) }),
    });
    return () => sub.unsubscribe();
  }, [repo, ownerId]);
  const ready = state !== null && state.ownerId === ownerId;
  return { games: ready ? state.games : [], loading: Boolean(ownerId) && !ready, error: ready ? state.error : null };
}
