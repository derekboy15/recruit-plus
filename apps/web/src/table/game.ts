/**
 * A table-companion game: its setup plus an append-only event log. Everything shown (position, CP, capped VP, the
 * log) is derived from the events, so undo is "drop the last event".
 */
import type { BattleSizeId, Pack, PackOut, PlayerKey } from '@recruit/data/missions';

export type TablePhase = 'command' | 'movement' | 'psychic' | 'shooting' | 'charge' | 'fight' | 'morale';
export const PHASES: TablePhase[] = ['command', 'movement', 'psychic', 'shooting', 'charge', 'fight', 'morale'];
export const LAST_ROUND = 5;

export interface Pos { round: number; turn: 1 | 2; phase: TablePhase }

export interface PlayerSetup {
  name: string;
  listId?: string;
  catalogueSlug: string;
  /** Secondary objective ids. */
  secondaries: string[];
  battleReady: boolean;
  startingCp: number;
  /** A stratagem group (subfaction) the player chose to filter by. */
  group?: string;
  /**
   * Display names of every selection in the player's list when the game started (sub-faction, Army of Renown,
   * detachment, units), for the stratagem filter. Absent for a faction-only player and for games saved before it.
   */
  armyChoices?: string[];
}
export interface TableSetup {
  battleSize: BattleSizeId;
  pack: Pack;
  missionId: string;
  /** Keyed by the map's Player A / Player B. */
  players: Record<PlayerKey, PlayerSetup>;
  attacker: PlayerKey;
  firstTurn: PlayerKey;
}

export type EventBody =
  | { t: 'start' }
  | { t: 'advance'; to: Pos }
  /** `auto`: written by the Command phase CP prompt (undone together with entering the phase). */
  | { t: 'cp'; player: PlayerKey; delta: number; reason: 'bonus' | 'mission' | 'stratagem' | 'manual'; note?: string; auto?: true }
  | { t: 'vp'; player: PlayerKey; category: 'primary' | 'secondary'; sourceId: string; vp: number; detail: string }
  | { t: 'stratagem'; player: PlayerKey; stratagemId: string; name: string; cp: number }
  | { t: 'roll'; label: string; sides: 3 | 6; dice: number[]; auto?: true }
  | { t: 'note'; text: string }
  | { t: 'end'; reason: 'complete' | 'agreed' | 'concede'; concededBy?: PlayerKey };
export type TableEvent = EventBody & { id: string; at: string; pos: Pos | null };

export interface TableGameData { mode: 'table'; schema: 1; setup: TableSetup; events: TableEvent[] }

export interface PlayerTotals {
  cp: number;
  /** Shown primary VP (capped). */
  primary: number;
  /** Shown VP per secondary id (each capped). */
  secondary: Record<string, number>;
  battleReady: number;
  total: number;
}
export interface TableState {
  pos: Pos | null;
  started: boolean;
  ended: TableEvent | null;
  active: PlayerKey | null;
  players: Record<PlayerKey, PlayerTotals>;
  stratagemsThisPhase: { player: PlayerKey; name: string }[];
}

export const other = (p: PlayerKey): PlayerKey => (p === 'A' ? 'B' : 'A');

export function nextPos(p: Pos): Pos | null {
  const i = PHASES.indexOf(p.phase);
  if (i < PHASES.length - 1) return { ...p, phase: PHASES[i + 1] };
  if (p.turn === 1) return { round: p.round, turn: 2, phase: 'command' };
  return p.round < LAST_ROUND ? { round: p.round + 1, turn: 1, phase: 'command' } : null;
}

export const activePlayer = (setup: TableSetup, p: Pos): PlayerKey => (p.turn === 1 ? setup.firstTurn : other(setup.firstTurn));

export function makeEvent(body: EventBody, pos: Pos | null): TableEvent {
  return { ...body, id: crypto.randomUUID(), at: new Date().toISOString(), pos };
}

const samePos = (a: Pos | null, b: Pos | null) => !!a && !!b && a.round === b.round && a.turn === b.turn && a.phase === b.phase;
const isAuto = (e: TableEvent) => (e.t === 'cp' || e.t === 'roll') && e.auto === true;

/**
 * Drops the last event; the start event is never removed. Undoing an automatic Command phase CP event also undoes the
 * rest of that phase's automatic CP and the step into the phase, or the CP prompt would simply add the bonus again.
 */
export function undo(g: TableGameData): TableGameData {
  if (g.events.length <= 1) return g;
  const events = g.events.slice(0, -1);
  const last = g.events[g.events.length - 1];
  if (isAuto(last)) {
    while (events.length > 1 && isAuto(events[events.length - 1]) && samePos(events[events.length - 1].pos, last.pos)) events.pop();
    const before = events[events.length - 1];
    if (events.length > 1 && before.t === 'advance' && samePos(before.to, last.pos)) events.pop();
  }
  return { ...g, events };
}

export function deriveState(g: TableGameData, pack: PackOut): TableState {
  const cp = { A: g.setup.players.A.startingCp, B: g.setup.players.B.startingCp };
  const primaryRaw = { A: 0, B: 0 };
  const secondaryRaw: Record<PlayerKey, Record<string, number>> = { A: {}, B: {} };
  let pos: Pos | null = null;
  let started = false;
  let ended: TableEvent | null = null;
  let stratagemsThisPhase: TableState['stratagemsThisPhase'] = [];
  const running = (p: PlayerKey) => primaryRaw[p] + Object.values(secondaryRaw[p]).reduce((a, b) => a + b, 0);
  for (const e of g.events) {
    if (e.t === 'start') {
      started = true;
      pos = { round: 1, turn: 1, phase: 'command' };
    } else if (e.t === 'advance') {
      pos = e.to;
      stratagemsThisPhase = [];
    } else if (e.t === 'cp') {
      cp[e.player] = Math.max(0, cp[e.player] + e.delta);
    } else if (e.t === 'vp') {
      // VP over a cap are never scored, so a later loss comes off the capped score; and a player's score can never
      // be reduced below 0 (Sacred Ground, Conversion).
      const held = e.category === 'primary' ? primaryRaw[e.player] : (secondaryRaw[e.player][e.sourceId] ?? 0);
      const cap = e.category === 'primary' ? pack.caps.primary : pack.caps.secondaryEach;
      const applied = e.vp >= 0 ? Math.max(0, Math.min(e.vp, cap - held)) : Math.max(e.vp, -running(e.player));
      if (e.category === 'primary') primaryRaw[e.player] += applied;
      else secondaryRaw[e.player][e.sourceId] = held + applied;
    } else if (e.t === 'stratagem') {
      stratagemsThisPhase = [...stratagemsThisPhase, { player: e.player, name: e.name }];
    } else if (e.t === 'end') {
      ended = e;
    }
  }
  const totals = (p: PlayerKey): PlayerTotals => {
    const primary = Math.min(pack.caps.primary, primaryRaw[p]);
    const secondary = Object.fromEntries(Object.entries(secondaryRaw[p]).map(([id, v]) => [id, Math.min(pack.caps.secondaryEach, v)]));
    const secondarySum = Math.min(pack.caps.secondaryTotal, Object.values(secondary).reduce((a, b) => a + b, 0));
    const battleReady = g.setup.players[p].battleReady ? pack.caps.battleReady : 0;
    const conceded = ended?.t === 'end' && ended.reason === 'concede' && ended.concededBy === p && pack.concede === 'conceder-scores-0';
    return { cp: cp[p], primary, secondary, battleReady, total: conceded ? 0 : primary + secondarySum + battleReady };
  };
  return {
    pos,
    started,
    ended,
    active: pos ? activePlayer(g.setup, pos) : null,
    players: { A: totals('A'), B: totals('B') },
    stratagemsThisPhase,
  };
}
