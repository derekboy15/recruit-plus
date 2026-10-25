/** Words for a roll: how it went, and what picking dice does. */
import type { Die } from '@recruit/engine';

/** "7 hits of 10" against the roll's target number, or "Total 9" for a roll with none (charge, Morale, D3s). */
export function rollTally(dice: Die[], judge: { passes(d: Die): boolean; noun: 'hit' | 'wound' | 'save' } | null): string {
  if (!judge) return `Total ${dice.reduce((a, d) => a + d.value, 0)}`;
  const n = dice.filter((d) => judge.passes(d)).length;
  return `${n} ${judge.noun}${n === 1 ? '' : 's'} of ${dice.length}`;
}

/** The line under the dice: picking dice, and what a Command Re-roll will re-roll. */
export function rerollHelp(picked: number, whole: boolean): string {
  const count = picked === 1 ? '1 die picked.' : `${picked} dice picked.`;
  if (whole) return `${picked ? `${count} ` : ''}A Command Re-roll re-rolls all of these dice.`;
  if (picked === 0) return 'Tap a die to pick it for a re-roll or a change.';
  return picked === 1 ? count : `${count} A Command Re-roll needs exactly one.`;
}
