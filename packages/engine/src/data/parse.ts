/** Parsers for the characteristic strings in the generated BSData/Wahapedia unit JSON (formats surveyed across all catalogues). */
import { parseDice, type DiceExpr } from '../core/dice';
import type { BaseShape, Move, StrengthExpr, WeaponType } from '../datasheet/types';

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '').replace(/["”″]/g, '"');

/** '6"' and '7""' fixed; '20-60"' or '20"-50"' an Aircraft range; '-' can't move; random or starred moves are null. */
export function parseMove(s: string): Move | null {
  const v = clean(s);
  if (v === '-') return { kind: 'none' };
  let m = /^(\d+(?:\.\d+)?)"*$/.exec(v);
  if (m) return { kind: 'fixed', inches: Number(m[1]) };
  m = /^(\d+)"?-(\d+)"*$/.exec(v);
  if (m) return { kind: 'range', min: Number(m[1]), max: Number(m[2]) };
  return null;
}

/** '3+' → 3 (also '5\t+' and '4'); '-' → null. */
export function parseTarget(s: string): number | null {
  const m = /^(\d+)\+?$/.exec(clean(s));
  return m ? Number(m[1]) : null;
}

export function parseInt0(s: string): number | null {
  const m = /^(\d+)\+?$/.exec(clean(s));
  return m ? Number(m[1]) : null;
}

const TYPES: [RegExp, WeaponType][] = [
  [/^as+ault$/i, 'Assault'],
  [/^heavy$/i, 'Heavy'],
  [/^rapid ?fire$/i, 'Rapid Fire'],
  [/^grenade$/i, 'Grenade'],
  [/^pistol$/i, 'Pistol'],
  [/^dakka$/i, 'Dakka'],
];

/** 'Rapid fire 2', 'Asssault D6', 'Heavy 2D6+1', 'Dakka 3/2', 'Melee'; unknown types (HunTR) become 'Other' (R-11). */
export function parseWeaponType(s: string): { type: WeaponType; shots: DiceExpr; dakkaShort?: DiceExpr } | null {
  const v = (s ?? '').trim();
  if (/^melee$/i.test(v)) return { type: 'Melee', shots: { n: 0, sides: 6, plus: 1 } };
  const m = /^([A-Za-z][A-Za-z ]*?)\s+((?:\d|[dD]\d).*)$/.exec(v);
  if (!m) return null;
  const type = TYPES.find(([re]) => re.test(m[1].trim()))?.[1] ?? 'Other';
  if (type === 'Dakka') {
    const d = /^(\S+)\s*\/\s*(\S+)$/.exec(m[2]);
    const short = d && parseDice(d[1]);
    const long = d && parseDice(d[2]);
    return short && long ? { type, shots: long, dakkaShort: short } : null;
  }
  const shots = parseDice(m[2].replace(/\s+/g, ''));
  return shots ? { type, shots } : null;
}

/** 'User', '+2', 'x2'/'X2', '8'; starred or random strengths are null. */
export function parseStrength(s: string): StrengthExpr | null {
  const v = clean(s);
  if (/^user$/i.test(v)) return { kind: 'user' };
  let m = /^\+(\d+)$/.exec(v);
  if (m) return { kind: 'add', v: Number(m[1]) };
  m = /^[xX×](\d+)$/.exec(v);
  if (m) return { kind: 'mul', v: Number(m[1]) };
  m = /^(\d+)$/.exec(v);
  return m ? { kind: 'fixed', v: Number(m[1]) } : null;
}

/** '-1', '0', '- 2', '--1'; '-' and '--' are AP 0; starred is null. */
export function parseAp(s: string): number | null {
  const v = clean(s);
  if (/^-+$/.test(v)) return 0;
  const m = /^-*(\d+)$/.exec(v);
  if (!m) return null;
  return v.startsWith('-') ? -Number(m[1]) : Number(m[1]);
}

/** '24"', 'Melee', '24"-200"' (minimum range 24), '0-24"'; undefined when unparseable. */
export function parseRange(s: string): { range: number | null; minRange: number | null } | undefined {
  const v = clean(s);
  if (/^melee$/i.test(v)) return { range: null, minRange: null };
  let m = /^(\d+(?:\.\d+)?)"*$/.exec(v);
  if (m) return { range: Number(m[1]), minRange: null };
  m = /^(\d+)"?-(\d+)"*$/.exec(v);
  if (m) return { range: Number(m[2]), minRange: Number(m[1]) > 0 ? Number(m[1]) : null };
  return undefined;
}

const mm = (v: number) => v / 25.4;

/** '32mm', '60 x 35.5mm' (oval), flying bases alike; 'Use model' and null get an estimated footprint (R-8). */
export function parseBase(s: string | null, keywords: string[]): { base: BaseShape; estimated: boolean } {
  const v = (s ?? '').toLowerCase();
  let m = /^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*mm/.exec(v);
  if (m) return { base: { kind: 'oval', w: mm(Number(m[1])), h: mm(Number(m[2])) }, estimated: false };
  m = /^(\d+(?:\.\d+)?)\s*mm/.exec(v);
  if (m) return { base: { kind: 'circle', d: mm(Number(m[1])) }, estimated: false };
  const k = keywords.map((x) => x.toUpperCase());
  if (k.includes('TITANIC')) return { base: { kind: 'rect', w: 5, h: 9 }, estimated: true };
  if (k.includes('VEHICLE')) return { base: { kind: 'rect', w: 3, h: 5 }, estimated: true };
  if (k.includes('MONSTER')) return { base: { kind: 'circle', d: mm(60) }, estimated: true };
  return { base: { kind: 'circle', d: mm(32) }, estimated: true };
}

/** A degrading-profile row's wounds: '9-16+', '6+', '6-+', '1-4'. */
export function parseWoundRange(s: string, maxW: number): { minW: number; maxW: number } | null {
  const v = clean(s);
  let m = /^(\d+)-?\+$/.exec(v);
  if (m) return { minW: Number(m[1]), maxW };
  m = /^(\d+)-(\d+)\+?$/.exec(v);
  if (m) return { minW: Number(m[1]), maxW: Number(m[2]) };
  m = /^(\d+)$/.exec(v);
  if (m) return { minW: Number(m[1]), maxW: Number(m[1]) };
  return null;
}
