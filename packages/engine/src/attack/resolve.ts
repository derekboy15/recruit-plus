/** The pure maths of an attack (TS §5.5–5.7, §1.6). */
import { maxOf, type DiceExpr } from '../core/dice';
import type { ModelChars, WeaponProfile } from '../datasheet/types';

/** TS §1.6: rules that set a value first, then ×, then +; S never below 1. `plus` is any +S from rules. */
export function strengthOf(c: ModelChars, w: WeaponProfile, plus = 0): number {
  const s = w.s;
  const base = s.kind === 'fixed' ? s.v : c.S;
  const mul = s.kind === 'mul' ? base * s.v : base;
  const add = s.kind === 'add' ? s.v : 0;
  return Math.max(1, mul + add + plus);
}

/** TS §5.6 wound table. */
export function woundNeeded(s: number, t: number): 2 | 3 | 4 | 5 | 6 {
  if (s >= 2 * t) return 2;
  if (s > t) return 3;
  if (s === t) return 4;
  if (2 * s <= t) return 6;
  return 5;
}

/** TS §5.6: hit and wound rolls are never modified by more than -1 or +1 in total. */
export const capMod = (sum: number): -1 | 0 | 1 => (sum > 0 ? 1 : sum < 0 ? -1 : 0);

/** Hit and wound rolls: an unmodified 6 always succeeds, an unmodified 1 always fails (TS §5.6). */
export function hitSucceeds(unmodified: number, needed: number, mod: number): boolean {
  if (unmodified === 6) return true;
  if (unmodified === 1) return false;
  return unmodified + mod >= needed;
}
export const woundSucceeds = hitSucceeds;

/** Saving throws: an unmodified 1 always fails (TS §5.6). */
export function saveSucceeds(unmodified: number, needed: number, mod: number): boolean {
  if (unmodified === 1) return false;
  return unmodified + mod >= needed;
}

/** TS §5.5: Blast against 6–10 models makes at least 3 attacks per weapon; against 11+ the maximum. */
export function blastShots(expr: DiceExpr, rolled: number, targetModels: number): number {
  if (targetModels >= 11) return maxOf(expr);
  if (targetModels >= 6) return Math.max(3, rolled);
  return rolled;
}

export interface SaveChoice { needed: number; mod: number; kind: 'armour' | 'invuln' | 'daemonic' }

/**
 * The best save a model can take against an attack (TS §5.7): its armour save modified by AP, cover and armour
 * modifiers, plus any other save modifiers; or its invulnerable save, which ignores AP and cover. A Daemonic Save
 * (R-21) replaces both and is never modified. Null when no roll can succeed.
 */
export function bestSave(c: ModelChars, invulnFx: number | null, ap: number, armourMods: number, allMods: number, melee: boolean): SaveChoice | null {
  if (c.daemonicSave) return { needed: melee ? c.daemonicSave.melee : c.daemonicSave.ranged, mod: 0, kind: 'daemonic' };
  const options: SaveChoice[] = [];
  if (c.Sv !== null) options.push({ needed: c.Sv, mod: ap + armourMods + allMods, kind: 'armour' });
  const inv = [c.invuln, invulnFx].filter((x): x is number => x !== null);
  if (inv.length) options.push({ needed: Math.min(...inv), mod: allMods, kind: 'invuln' });
  const possible = options.filter((o) => o.needed - o.mod <= 6);
  if (!possible.length) return null;
  return possible.reduce((best, o) => (o.needed - o.mod < best.needed - best.mod ? o : best));
}

/** R-24: a unit with different Toughness values uses the majority value; on a tie the defender takes the higher. */
export function majorityToughness(ts: number[]): number {
  const counts = new Map<number, number>();
  for (const t of ts) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best = ts[0];
  for (const [t, n] of counts) if (n > counts.get(best)! || (n === counts.get(best)! && t > best)) best = t;
  return best;
}
