import type { ProfileOut, UnitOut } from '@recruit/data/model';

const DASH = '-';
const value = (chars: Record<string, string>, key: string) => chars[key]?.trim() || DASH;
/** "S4" and "D1", but "S User", "S +2" and "D D3": a letter or sign after the label needs a space to read. */
const tight = (label: string, v: string) => (/^\d/.test(v) ? `${label}${v}` : `${label} ${v}`);

/** One weapon profile on one line: `24" · Rapid Fire 1 · S4 · AP -1 · D1`, melee `Melee · S User · AP -3 · D2`. */
export function weaponLine(p: { chars: Record<string, string> }): string {
  const c = p.chars;
  const melee = /^melee$/i.test(c.Range?.trim() ?? '') || /^melee$/i.test(c.Type?.trim() ?? '');
  const head = melee ? ['Melee'] : [value(c, 'Range'), value(c, 'Type')];
  return [...head, tight('S', value(c, 'S')), `AP ${value(c, 'AP')}`, tight('D', value(c, 'D'))].join(' · ');
}

/**
 * A wound range at the end of a model's name, in the shapes BSData uses: "(6+ wounds remaining)", "(4-7 Wounds
 * Remaining)", "(12-22+ wounds remaining)", the typo "remaning", "(1-7wounds remaning)", "(8-14 wounds)" and
 * "[4-6 wounds remaining]".
 */
const WOUND_RANGE = /^(.*?)\s*[([]\s*(\d+)\s*(?:-\s*(\d+))?\s*(\+)?\s*wounds?(?:\s+rem\w*)?\s*[)\]]\s*$/i;

/**
 * "Rhino [2] (3-5 wounds remaining)" → base "Rhino", from 3, label "3–5 wounds left"; null for an ordinary profile.
 * The bracket's own number comes in several shapes ("Rhino [2]", "Chaos Land Raider 2", "2. Crimson Hunter") and is
 * dropped from the base; the top bracket is the one with the highest `from`, whatever order the data lists them in.
 */
export function woundBracket(name: string): { base: string; from: number; label: string } | null {
  const m = WOUND_RANGE.exec(name);
  if (!m) return null;
  const [, rest, from, to, plus] = m;
  const base = rest
    .replace(/^\s*\d+\.\s*/, '')
    .replace(/\s*\[\s*\d+\s*\]\s*$/, '')
    .replace(/\s+\d+$/, '')
    .trim();
  // An open-ended top range ("12-22+") reads as "12+": the top of it is just the model's full Wounds.
  const label = plus ? `${from}+ wounds left` : to ? `${from}–${to} wounds left` : `${from} ${from === '1' ? 'wound' : 'wounds'} left`;
  return { base, from: Number(from), label };
}

/** Bracket profiles that share a base with at least one other: a lone "(2 wounds)" is just a name. */
export function woundTracks(models: ProfileOut[]): Map<string, { label: string; from: number; profile: ProfileOut }[]> {
  const tracks = new Map<string, { label: string; from: number; profile: ProfileOut }[]>();
  for (const profile of models) {
    const b = woundBracket(profile.name);
    if (b) tracks.set(b.base, [...(tracks.get(b.base) ?? []), { label: b.label, from: b.from, profile }]);
  }
  for (const [base, brackets] of tracks) {
    if (brackets.length < 2) tracks.delete(base);
    else brackets.sort((a, b) => b.from - a.from);
  }
  return tracks;
}

const INVULNERABLE = /(\d)\+ invulnerable save/i;

/**
 * The numbers a list row or unit card shows, from the first model profile — or, for a degrading model, its top
 * bracket, which the data doesn't always list first. A missing stat is '-', never undefined.
 */
export function keyStats(unit: Pick<UnitOut, 'models'> & Partial<Pick<UnitOut, 'abilities'>>): { M: string; T: string; Sv: string; W: string; inv: string | null } {
  const first = unit.models[0];
  const base = first ? woundBracket(first.name)?.base : undefined;
  const track = base === undefined ? undefined : woundTracks(unit.models).get(base);
  const chars = (track ? track[0].profile : first)?.chars ?? {};
  let inv: string | null = null;
  for (const a of unit.abilities ?? []) {
    const m = INVULNERABLE.exec(a.plain ?? '') ?? INVULNERABLE.exec(a.text);
    if (m) {
      inv = `${m[1]}+`;
      break;
    }
  }
  return { M: value(chars, 'M'), T: value(chars, 'T'), Sv: value(chars, 'Save'), W: value(chars, 'W'), inv };
}

/** "1 model", "5 models", "5–10 models"; null when the data has no size. */
export function sizeLabel(unit: Pick<UnitOut, 'minModels' | 'maxModels'>): string | null {
  const { minModels: min, maxModels: max } = unit;
  if (min == null) return null;
  if (max == null || max === min) return `${min} ${min === 1 ? 'model' : 'models'}`;
  return `${min}–${max} models`;
}
