/**
 * UnitOut (generated per-faction JSON) → engine Datasheet. Anything that can't be read safely is reported as an
 * AdapterIssue and left out rather than guessed (R-7 … R-12): wrong rules are worse than a missing weapon.
 */
import type { ProfileOut, UnitOut } from '@recruit/data/model';
import { parseDice, type DiceExpr } from '../core/dice';
import type { Bracket, Datasheet, ModelChars, ModelProfile, PsykerProfile, WeaponProfile } from '../datasheet/types';
import { parseAp, parseBase, parseInt0, parseMove, parseRange, parseStrength, parseTarget, parseWeaponType, parseWoundRange } from './parse';

export type AdapterIssue = {
  kind: 'unparsed-char' | 'unparsed-weapon' | 'estimated-base' | 'starred-weapon' | 'unknown-capacity' | 'no-models' | 'no-keywords';
  detail: string;
};

type CharKey = keyof Omit<ModelChars, 'invuln' | 'daemonicSave'>;
const CHAR_ORDER: CharKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'A', 'Ld', 'Sv'];
const SOURCE_KEY: Record<CharKey, string> = { M: 'M', WS: 'WS', BS: 'BS', S: 'S', T: 'T', W: 'W', A: 'A', Ld: 'Ld', Sv: 'Save' };

interface Parsed { chars: Partial<ModelChars>; starred: CharKey[]; problems: string[] }

function parseChars(c: Record<string, string>, bracketRow: boolean): Parsed {
  const out: Partial<ModelChars> = {};
  const starred: CharKey[] = [];
  const problems: string[] = [];
  for (const k of CHAR_ORDER) {
    const raw = (c[SOURCE_KEY[k]] ?? '').trim();
    if (raw === '*') {
      starred.push(k);
      continue;
    }
    if (k === 'Sv' && raw.includes('/')) {
      // R-21: "5+/4+" is a Daemonic Save (melee/ranged), not an armour save.
      const ds = parseChar('daemonicSave', raw);
      if (ds) {
        out.Sv = null;
        out.daemonicSave = ds as ModelChars['daemonicSave'];
      } else problems.push(`Save "${raw}"`);
      continue;
    }
    const v = parseChar(k, raw);
    if (v === undefined) {
      if (!(bracketRow && k === 'W')) problems.push(`${k} "${raw}"`);
      continue;
    }
    (out as Record<string, unknown>)[k] = v;
  }
  return { chars: out, starred, problems };
}

function parseChar(k: CharKey | 'daemonicSave', raw: string): unknown {
  switch (k) {
    case 'M':
      return parseMove(raw) ?? undefined;
    case 'WS':
    case 'BS':
      // '6"' in a WS column is a data typo for 6+ (every WS/BS is a target number).
      return raw === '-' ? null : (parseTarget(raw.replace(/"$/, '+')) ?? undefined);
    case 'S':
    case 'T':
    case 'W':
    case 'Ld':
      return parseInt0(raw) ?? undefined;
    case 'A':
      return raw === '-' ? { n: 0, sides: 6, plus: 0 } : (parseDice(raw.replace(/\s+/g, '')) ?? undefined);
    case 'Sv': {
      if (raw === '-') return null;
      const m = /^\+?(\d)\+?$/.exec(raw.replace(/\s+/g, ''));
      return m ? Number(m[1]) : undefined;
    }
    case 'daemonicSave': {
      const m = /^(\d)\+\/(\d)\+$/.exec(raw.replace(/\s+/g, ''));
      return m ? { melee: Number(m[1]), ranged: Number(m[2]) } : undefined;
    }
  }
}

const DEFAULTS: ModelChars = {
  M: { kind: 'none' }, WS: null, BS: null, S: 1, T: 1, W: 1, A: { n: 0, sides: 6, plus: 0 }, Ld: 10, Sv: null, invuln: null,
};

/**
 * "Monolith [1] (13+ Wounds Remaining)", "1. Falcon (7+ wounds remaining)", "Be'lakor 2 (6-10 wounds remaining)",
 * "(1-7wounds remaning)", "Kratos 2 [ 5-9 wounds remaining]", "Dark Talon 2 (3-5 wounds)", "(1 wound remaining)".
 */
const BRACKET = /^(?:\d+\.\s*)?(.*?)\s*(?:\[\d+\]|\b\d+)?\s*[([]\s*(\d+\s*(?:\+|-\s*\d+\+?)?)\s*wounds?(?:\s*rema[a-z]*)?\s*[)\]]\s*$/i;

/** R-7: an unconditional "This model has a 4+ invulnerable save." sentence (no against/while/if…). */
function invulnFromAbilities(u: UnitOut): number | null {
  for (const a of u.abilities)
    for (const sentence of a.text.split(/(?<=[.!?])\s+|\n+/)) {
      const s = sentence.trim();
      if (/\b(against|while|whilst|if|bearer|equipped|contains|round|unless|until|instead)\b/i.test(s)) continue;
      const m = /^(?:this model has|models in this unit have|this unit has|[A-Z][\w' -]*? has) an? (\d)\+ invulnerable save\.?$/i.exec(s);
      if (m) return Number(m[1]);
    }
  return null;
}

function models(u: UnitOut, issues: AdapterIssue[]): ModelProfile[] {
  const groups = new Map<string, { profile: ProfileOut; range: string }[]>();
  const plain: ProfileOut[] = [];
  for (const p of u.models) {
    const m = BRACKET.exec(p.name);
    if (m) {
      const name = m[1].replace(/\s+/g, ' ').trim();
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push({ profile: p, range: m[2] });
    } else plain.push(p);
  }
  const out: ModelProfile[] = [];
  for (const p of plain) {
    const parsed = parseChars(p.chars, false);
    out.push({ name: p.name, chars: { ...DEFAULTS, ...parsed.chars }, brackets: [] });
    pendingStarred.set(out[out.length - 1], parsed.starred);
    for (const pr of parsed.problems) issues.push({ kind: 'unparsed-char', detail: `${p.name}: ${pr}` });
  }
  for (const [name, rows] of groups) {
    const parsedRows = rows.map((r) => ({ r, parsed: parseChars(r.profile.chars, true) }));
    const W = parsedRows.map((x) => x.parsed.chars.W).find((w) => typeof w === 'number') ?? 1;
    const brackets: Bracket[] = [];
    for (const { r, parsed } of parsedRows) {
      const range = parseWoundRange(r.range, W);
      if (!range) {
        issues.push({ kind: 'unparsed-char', detail: `${r.profile.name}: wounds "${r.range}"` });
        continue;
      }
      const { W: _w, ...chars } = parsed.chars;
      brackets.push({ ...range, chars });
      for (const pr of parsed.problems) issues.push({ kind: 'unparsed-char', detail: `${r.profile.name}: ${pr}` });
    }
    brackets.sort((a, b) => b.minW - a.minW);
    const top = brackets[0]?.chars ?? {};
    out.push({ name, chars: { ...DEFAULTS, ...top, W }, brackets });
  }
  return out;
}

/** Starred characteristics of plain profiles, filled from the woundTrack table. */
const pendingStarred = new WeakMap<ModelProfile, CharKey[]>();

const TRACK_NAMES: Record<string, CharKey> = {
  movement: 'M', move: 'M', m: 'M', ws: 'WS', bs: 'BS', s: 'S', strength: 'S', a: 'A', attacks: 'A', ld: 'Ld', leadership: 'Ld',
};

function applyWoundTrack(u: UnitOut, list: ModelProfile[], issues: AdapterIssue[]): void {
  for (const m of list) {
    const starred = pendingStarred.get(m) ?? [];
    if (!starred.length) continue;
    if (!u.woundTrack.length) {
      issues.push({ kind: 'unparsed-char', detail: `${m.name}: ${starred.join(', ')} "*" with no damage table` });
      continue;
    }
    const brackets: Bracket[] = [];
    for (const row of u.woundTrack) {
      const keys = Object.keys(row.chars);
      const range = parseWoundRange(row.chars[keys[0]], m.chars.W);
      if (!range) {
        issues.push({ kind: 'unparsed-char', detail: `${m.name}: damage table wounds "${row.chars[keys[0]]}"` });
        continue;
      }
      const chars: Partial<ModelChars> = {};
      keys.slice(1).forEach((key, i) => {
        const k = /^characteristic \d+$/i.test(key) ? starred[i] : TRACK_NAMES[key.toLowerCase()];
        if (!k) return;
        const v = parseChar(k, row.chars[key].trim());
        if (v === undefined) issues.push({ kind: 'unparsed-char', detail: `${m.name}: damage table ${key} "${row.chars[key]}"` });
        else (chars as Record<string, unknown>)[k] = v;
      });
      brackets.push({ ...range, chars });
    }
    brackets.sort((a, b) => b.minW - a.minW);
    m.brackets = brackets;
    m.chars = { ...m.chars, ...(brackets[0]?.chars ?? {}) };
    const unresolved = starred.filter((k) => !brackets[0] || !(k in brackets[0].chars));
    if (unresolved.length) issues.push({ kind: 'unparsed-char', detail: `${m.name}: ${unresolved.join(', ')} "*" not in the damage table` });
  }
}

const isHeader = (c: Record<string, string>) => ['-', ''].includes((c.Type ?? '').trim()) && ['-', ''].includes((c.S ?? '').trim());

function weapons(u: UnitOut, issues: AdapterIssue[]): WeaponProfile[] {
  const out: WeaponProfile[] = [];
  for (const w of u.weapons) {
    const c = w.chars;
    if (isHeader(c)) continue;
    const type = parseWeaponType(c.Type);
    const range = type?.type === 'Melee' && ['-', ''].includes((c.Range ?? '').trim()) ? { range: null, minRange: null } : parseRange(c.Range);
    const s = parseStrength(c.S);
    const ap = parseAp(c.AP);
    const d = parseDice((c.D ?? '').replace(/\s+/g, ''));
    if (!type || range === undefined || !s || ap === null || !d) {
      const starred = [c.S, c.AP, c.D, c.Type, c.Range].some((v) => (v ?? '').trim() === '*');
      issues.push({ kind: starred ? 'starred-weapon' : 'unparsed-weapon', detail: `${w.name}: ${JSON.stringify({ ...c, Abilities: undefined })}` });
      continue;
    }
    if (type.type === 'Other') issues.push({ kind: 'unparsed-weapon', detail: `${w.name}: type "${c.Type}" has no core rule (R-11)` });
    const text = c.Abilities === '-' ? '' : (c.Abilities ?? '');
    out.push({
      name: w.name,
      type: type.type,
      range: type.type === 'Melee' ? null : range.range,
      minRange: range.minRange,
      shots: type.shots,
      ...(type.dakkaShort ? { dakkaShort: type.dakkaShort } : {}),
      s,
      ap,
      d: d as DiceExpr,
      blast: /(^|[^A-Za-z])Blast([^A-Za-z]|$)/.test(text),
      autoHit: /automatically hits the target/i.test(text),
      indirect: /can target units that are not visible/i.test(text),
      text,
    });
  }
  return out;
}

function psyker(u: UnitOut): PsykerProfile | null {
  const p = u.psychic.find((x) => 'Cast' in x.chars);
  if (!p) return null;
  const powers = u.psychic
    .filter((x) => 'Warp Charge' in x.chars)
    .map((x) => {
      const name = x.name.replace(/\s*\((?:blessing|malediction|witchfire|psychic power|[^)]*)\)\s*$/i, '').trim();
      const wc = parseInt0(x.chars['Warp Charge']);
      return /^smite$/i.test(name) ? { name: 'Smite', wc: 5, smite: true as const } : { name, wc };
    });
  if (!powers.some((x) => 'smite' in x && x.smite)) powers.unshift({ name: 'Smite', wc: 5, smite: true });
  return { cast: parseInt0(p.chars.Cast) ?? 1, deny: parseInt0(p.chars.Deny) ?? 1, powers };
}

const KNIGHT_CATALOGUES = /Imperial Knights|Chaos Knights/;

/** R-9: Knight TITANIC vehicles count as 10 models on objectives, Armigers and War Dogs as 5 (BD §2). */
function ocPerModel(u: UnitOut, catalogueName: string, keywords: string[]): number {
  if (!KNIGHT_CATALOGUES.test(catalogueName)) return 1;
  if (keywords.includes('ARMIGER') || keywords.includes('WAR DOG') || /armiger|war dog|moirax/i.test(u.name)) return 5;
  if (keywords.includes('TITANIC') && keywords.includes('VEHICLE')) return 10;
  return 1;
}

/** The datasheet's own Objective Secured ability (some codexes print it there rather than in their detachment rules). */
export function datasheetObjectiveSecured(u: UnitOut): boolean {
  return u.abilities.some((a) => /^objective secured$/i.test(a.name.trim()));
}

/**
 * R-28: the codex detachment rules that give Troops units Objective Secured, as the faction keyword the unit needs and
 * the keywords that leave it out.
 */
const TROOPS_OBJECTIVE_SECURED: { faction: string; except?: string[] }[] = [
  { faction: 'ADEPTUS ASTARTES' },
  { faction: 'ADEPTUS CUSTODES' },
  { faction: 'ANATHEMA PSYKANA' },
  { faction: 'ASTRA MILITARUM' },
  { faction: 'ADEPTA SORORITAS' },
  { faction: 'ADEPTUS MECHANICUS' },
  { faction: 'TRAITORIS ASTARTES' },
  { faction: 'LEGIONES DAEMONICA', except: ['SWARM'] },
  { faction: 'THOUSAND SONS', except: ['THOUSAND SONS CULTISTS'] },
  { faction: 'RENEGADES AND HERETICS' },
  { faction: 'NECRONS' },
  { faction: 'ORKS', except: ['GRETCHIN'] },
  { faction: 'HIVE TENDRIL' },
  { faction: 'GENESTEALER CULTS' },
  { faction: 'ASURYANI' },
  { faction: "T'AU EMPIRE" },
  { faction: 'VOTANN' },
];

/** R-28: Objective Secured from the unit's codex detachment rules: Troops of a listed faction, unless its datasheet forbids it. */
function detachmentObjectiveSecured(u: UnitOut, keywords: string[], factionKeywords: string[]): boolean {
  if (u.role !== 'Troops') return false;
  // "This unit can never gain the Objective Secured ability" (Blue Horrors); conditional ("While…", "If…") texts are left to the toolkit.
  if (u.abilities.some((a) => /never gain the Objective Secured/i.test(a.text ?? '') && !/^\s*(while|if)\b/i.test(a.text ?? ''))) return false;
  return TROOPS_OBJECTIVE_SECURED.some((g) => factionKeywords.includes(g.faction) && !g.except?.some((k) => keywords.includes(k)));
}

export function toDatasheet(u: UnitOut, catalogueName: string): { datasheet: Datasheet; issues: AdapterIssue[] } {
  const issues: AdapterIssue[] = [];
  const keywords = u.keywords.map((k) => k.toUpperCase());
  const factionKeywords = u.factionKeywords.map((k) => k.toUpperCase());
  if (!keywords.length) issues.push({ kind: 'no-keywords', detail: 'the data has no keywords for this unit' });
  const list = models(u, issues);
  applyWoundTrack(u, list, issues);
  const invuln = invulnFromAbilities(u);
  if (invuln) for (const m of list) if (m.chars.invuln === null) m.chars = { ...m.chars, invuln };
  if (!list.length) issues.push({ kind: 'no-models', detail: 'no model profiles' });
  const { base, estimated } = parseBase(u.baseSize, keywords);
  if (estimated) issues.push({ kind: 'estimated-base', detail: `base "${u.baseSize ?? 'none'}"` });
  let transportCapacity: number | null = null;
  if (u.transport) {
    const text = u.transport.chars.Capacity ?? '';
    const m = /(?:transport\s+capacit(?:y|ies)(?:\s+of)?|can\s+transport)\D{0,40}?(\d+)/i.exec(text) ?? /^\s*(\d+)\b/.exec(text);
    if (m) transportCapacity = Number(m[1]);
    else issues.push({ kind: 'unknown-capacity', detail: (u.transport.chars.Capacity ?? '').slice(0, 80) });
  }
  return {
    datasheet: {
      id: u.id,
      name: u.name,
      role: u.role,
      keywords,
      factionKeywords,
      models: list,
      weapons: weapons(u, issues),
      base,
      baseEstimated: estimated,
      transportCapacity,
      psyker: psyker(u),
      objectiveSecured: datasheetObjectiveSecured(u) || detachmentObjectiveSecured(u, keywords, factionKeywords),
      ocPerModel: ocPerModel(u, catalogueName, keywords),
      powerRating: u.powerLevel ?? 0,
      points: u.points ?? 0,
    },
    issues,
  };
}
