/** Dice: expressions like "D3+3", a seeded sfc32 generator whose state lives in the game state, and a scripted queue. */
import type { PlayerId } from './types';

export interface DiceExpr { n: number; sides: 3 | 6; plus: number }

/** "2D6" → {2,6,0}, "D3+3" → {1,3,3}, "4" → {0,6,4}; anything else (x2, -, D4) → null. */
export function parseDice(s: string): DiceExpr | null {
  const m = /^\s*(\d*)\s*[dD]\s*([36])\s*(?:\+\s*(\d+))?\s*$/.exec(s);
  if (m) return { n: m[1] ? Number(m[1]) : 1, sides: Number(m[2]) as 3 | 6, plus: m[3] ? Number(m[3]) : 0 };
  if (/^\s*\d+\s*$/.test(s)) return { n: 0, sides: 6, plus: Number(s) };
  return null;
}

export const isRandom = (e: DiceExpr) => e.n > 0;
export const maxOf = (e: DiceExpr) => e.n * e.sides + e.plus;
export const minOf = (e: DiceExpr) => e.n + e.plus;
export function formatDice(e: DiceExpr): string {
  if (!e.n) return String(e.plus);
  return `${e.n > 1 ? e.n : ''}D${e.sides}${e.plus ? `+${e.plus}` : ''}`;
}

export interface DiceState { s: [number, number, number, number]; queue: number[] }

function splitmix32(a: number): () => number {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export function seedDice(seed: number): DiceState {
  const sm = splitmix32(seed | 0);
  return { s: [sm(), sm(), sm(), sm()], queue: [] };
}

function sfc32(s: [number, number, number, number]): { u: number; s: [number, number, number, number] } {
  let [a, b, c, d] = s;
  a |= 0; b |= 0; c |= 0; d |= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  return { u: (t >>> 0) / 4294967296, s: [a >>> 0, b >>> 0, c >>> 0, d >>> 0] };
}

/** One D6: the next scripted value if any, else the generator. */
export function nextD6(d: DiceState): { value: number; next: DiceState } {
  if (d.queue.length) return { value: d.queue[0], next: { s: d.s, queue: d.queue.slice(1) } };
  const r = sfc32(d.s);
  return { value: Math.floor(r.u * 6) + 1, next: { s: r.s, queue: d.queue } };
}

/** TS §1.6: a D3 is a D6 halved, rounded up. */
export const d3FromD6 = (v: number) => Math.ceil(v / 2);

export interface Die { value: number; sides: 3 | 6; rerolled?: true; replaced?: true }

/** Rolls the Command Re-roll stratagem can target (CS §2) open a window; the others resolve at once. */
export type RollKind =
  | 'hit' | 'wound' | 'save' | 'damage' | 'attacks' | 'advance' | 'charge' | 'psychic' | 'deny'
  | 'fnp' | 'morale' | 'attrition' | 'perils' | 'smite' | 'transport' | 'roll-off' | 'mortal' | 'other';
export const WINDOWED: RollKind[] = ['hit', 'wound', 'save', 'damage', 'attacks', 'advance', 'charge', 'psychic', 'deny'];

/** A roll kept in the state while it can still change (its window is open). `whole`: re-rolled together (2D6). */
export interface RollRecord { id: string; kind: RollKind; player: PlayerId; dice: Die[]; whole: boolean; context: string }

export const total = (r: { dice: Die[] }) => r.dice.reduce((a, d) => a + d.value, 0);
