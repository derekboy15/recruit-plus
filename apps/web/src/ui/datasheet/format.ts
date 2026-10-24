import type { UnitOut } from '@recruit/data/model';

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

const INVULNERABLE = /(\d)\+ invulnerable save/i;

/** The numbers a list row or unit card shows, from the first model profile. A missing stat is '-', never undefined. */
export function keyStats(unit: UnitOut): { M: string; T: string; Sv: string; W: string; inv: string | null } {
  const chars = unit.models[0]?.chars ?? {};
  let inv: string | null = null;
  for (const a of unit.abilities) {
    const m = INVULNERABLE.exec(a.plain ?? '') ?? INVULNERABLE.exec(a.text);
    if (m) {
      inv = `${m[1]}+`;
      break;
    }
  }
  return { M: value(chars, 'M'), T: value(chars, 'T'), Sv: value(chars, 'Save'), W: value(chars, 'W'), inv };
}

/** "1 model", "5 models", "5–10 models"; null when the data has no size. */
export function sizeLabel(unit: UnitOut): string | null {
  const { minModels: min, maxModels: max } = unit;
  if (min == null) return null;
  if (max == null || max === min) return `${min} ${min === 1 ? 'model' : 'models'}`;
  return `${min}–${max} models`;
}
