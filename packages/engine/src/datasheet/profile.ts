/** Reading a model's current characteristics and a unit's keywords. */
import type { ModelChars, ModelProfile, WeaponProfile } from './types';

/** True when the datasheet (or anything with keywords) has the keyword, ignoring case (GL §1). */
export function has(x: { keywords: string[]; factionKeywords?: string[] }, kw: string): boolean {
  const k = kw.toUpperCase();
  return x.keywords.some((w) => w.toUpperCase() === k) || !!x.factionKeywords?.some((w) => w.toUpperCase() === k);
}

/** The model's characteristics now: a degrading profile uses the bracket holding its wounds left (TS §1.1). */
export function currentChars(model: { woundsLeft: number }, profile: ModelProfile): ModelChars {
  if (!profile.brackets.length) return profile.chars;
  const b = profile.brackets.find((r) => model.woundsLeft >= r.minW && model.woundsLeft <= r.maxW);
  return b ? { ...profile.chars, ...b.chars } : profile.chars;
}

/** Models without a melee weapon fight with this (TS §7.3). */
export const CLOSE_COMBAT_WEAPON: WeaponProfile = {
  name: 'Close combat weapon',
  type: 'Melee',
  range: null,
  minRange: null,
  shots: { n: 0, sides: 6, plus: 1 },
  s: { kind: 'user' },
  ap: 0,
  d: { n: 0, sides: 6, plus: 1 },
  blast: false,
  autoHit: false,
  indirect: false,
  text: '',
};
