/** Small readers drills share: the open roll, characteristics, attempts, distances, choices. */
import {
  charsOf,
  gapToPoint,
  livingModels,
  MARKER_RADIUS,
  placedModel,
  sheetOf,
  type Command,
  type GameState,
  type ModelChars,
  type RollRecord,
} from '@recruit/engine';
import { rollJudge } from '../../play/panels/RollPanel';
import type { Choice, Watch } from '../drill/types';

/** The roll waiting for a decision, if any. */
export function openRoll(s: GameState): RollRecord | null {
  const p = s.pending;
  return p?.kind === 'roll' ? (s.rolls[p.rollId] ?? null) : null;
}
export const rollTotal = (r: RollRecord) => r.dice.reduce((a, d) => a + d.value, 0);
export const diceText = (r: RollRecord) => r.dice.map((d) => d.value).join(', ');

/** How many dice of the open attack roll succeed, judged the way the roll panel highlights them (the engine's own tests). */
export function passingDice(s: GameState): number | null {
  const judge = rollJudge(s);
  const r = openRoll(s);
  if (!judge || !r) return null;
  return r.dice.filter((d) => judge.passes(d)).length;
}
export const neededLabel = (s: GameState) => rollJudge(s)?.label ?? null;

/** The current characteristics of a unit's first living model with this profile (or its first living model). */
export function charsIn(s: GameState, unitId: string, profile?: string): ModelChars {
  const models = livingModels(s, unitId);
  const m = models.find((x) => !profile || x.profile === profile) ?? models[0];
  return charsOf(s, m);
}
export const moveOf = (c: ModelChars) => (c.M.kind === 'fixed' ? c.M.inches : c.M.kind === 'range' ? c.M.max : 0);
export const weaponOf = (s: GameState, unitId: string, name: string) => {
  const w = sheetOf(s, unitId).weapons.find((x) => x.name === name);
  if (!w) throw new Error(`${unitId} has no ${name}`);
  return w;
};

/** Accepted commands of a type in this stage. */
export const accepted = (w: Watch, type: Command['type']) => w.attempts.filter((a) => !a.problems && !a.drill && a.cmd.type === type).map((a) => a.cmd);
export const refused = (w: Watch, type: Command['type']) => w.attempts.filter((a) => a.problems && a.cmd.type === type);

/** The closest living model's distance to an objective marker's edge, in inches. */
export function gapToMarker(s: GameState, unitId: string, pos: { x: number; y: number }): number {
  return Math.min(...livingModels(s, unitId).filter((m) => m.pos).map((m) => gapToPoint(placedModel(s, m), pos) - MARKER_RADIUS));
}

/** `4.3"`, or `6"` for whole numbers. */
export function inches(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}"`;
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const numberChoices = (from: number, to: number, suffix = ''): Choice[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(from + i), label: `${from + i}${suffix}` }));
export const rollChoices = (): Choice[] => [2, 3, 4, 5, 6].map((n) => ({ id: `${n}+`, label: `${n}+` }));
export const yesNo = (): Choice[] => [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
];

/** A guard allowing only these command types for this unit (any unit when unitId is null); everything else gets `message`. */
export function only(types: Command['type'][], unitId: string | null, message: string) {
  return (cmd: Command): string | null => {
    if (!types.includes(cmd.type)) return message;
    const u = (cmd as { unitId?: string }).unitId;
    return unitId && u && u !== unitId ? message : null;
  };
}
