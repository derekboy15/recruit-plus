/** What each army-building option is and does: the info files (generated/info/<slug>.json) for a list's catalogues. */
import type { EntryInfo, InfoProfile } from '@recruit/data/model';
import type { Scope } from '@recruit/data/roster';
import { getIndex, getInfoFile } from '../factions/dataClient';

/** Entry id -> its info, from every info file in a list's scope. */
export type EntryInfoIndex = Map<string, EntryInfo>;

const SYSTEM = 'system';

/**
 * The info of every file in the catalogues' roster scope plus the game system's, each fetched once (the first file
 * defining an id wins, as in the roster scope). Never rejects: a file, an unknown catalogue or the index that fails to
 * load is skipped with a warning, and the index holds what did load.
 */
export async function loadEntryInfo(catalogueSlugs: string[]): Promise<EntryInfoIndex> {
  const out: EntryInfoIndex = new Map();
  let catalogues;
  try {
    ({ catalogues } = await getIndex());
  } catch (e) {
    console.warn('Option info not loaded: the faction index is unavailable.', e);
    return out;
  }
  const slugs: string[] = [];
  for (const slug of catalogueSlugs) {
    const summary = catalogues.find((c) => c.slug === slug);
    if (!summary) console.warn(`Option info: no faction called "${slug}" in the data.`);
    for (const s of summary?.rosterScope ?? []) if (s !== SYSTEM && !slugs.includes(s)) slugs.push(s);
  }
  slugs.push(SYSTEM);
  const files = await Promise.allSettled(slugs.map(getInfoFile));
  files.forEach((r, i) => {
    if (r.status === 'rejected') return console.warn(`Option info for ${slugs[i]} not loaded.`, r.reason);
    for (const [id, info] of Object.entries(r.value.entries)) if (!out.has(id)) out.set(id, info);
  });
  return out;
}

const merge = <T>(a: T[] | undefined, b: T[] | undefined): T[] | undefined => {
  const all = [...(a ?? []), ...(b ?? [])];
  const seen = new Set<string>();
  const unique = all.filter((x) => {
    const k = JSON.stringify(x);
    return seen.has(k) ? false : (seen.add(k), true);
  });
  return unique.length ? unique : undefined;
};

/**
 * An option's info: an entry link's own info followed by its target's (the target `resolve(scope, node).target` would
 * give, found here without loading the roster engine), profiles and rules each concatenated; else the entry's own.
 * Undefined when there is none or the index isn't loaded.
 */
export function entryInfo(scope: Scope, index: EntryInfoIndex | null, entryId: string): EntryInfo | undefined {
  if (!index) return undefined;
  const own = index.get(entryId);
  const node = scope.node(entryId);
  const linked = node?.kind === 'link' && node.targetId ? scope.node(node.targetId) : undefined;
  const target = linked && linked.kind !== 'link' ? index.get(linked.id) : undefined;
  if (!target) return own;
  const profiles = merge(own?.profiles, target.profiles);
  const rules = merge(own?.rules, target.rules);
  return profiles || rules ? { ...(profiles && { profiles }), ...(rules && { rules }) } : undefined;
}

const MAX = 160;
/** The characteristics that hold an option's effect, most likely first; any other text of more than three words follows. */
const EFFECT_CHARS = ['Description', 'Effect', 'Ability', 'Details'];
const words = (s: string) => s.trim().split(/\s+/).length;

function profileText(p: InfoProfile, wording: 'plain' | 'official'): string | null {
  if (p.type === 'Weapon') return null;
  const keys = [...EFFECT_CHARS.filter((c) => c in p.chars), ...Object.keys(p.chars).filter((c) => !EFFECT_CHARS.includes(c))];
  const key = keys.find((c) => words(p.chars[c]) > 3) ?? keys.find((c) => EFFECT_CHARS.includes(c));
  if (!key) return null;
  return (wording === 'plain' && p.plain?.[key]) || p.chars[key];
}

/** The first line without its list bullet ("-", "•"), run on into the next line while it ends with ":". */
function firstLine(text: string): string {
  const lines = text.split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
  let line = lines[0] ?? '';
  for (let i = 1; line.endsWith(':') && i < lines.length; i++) line = `${line} ${lines[i]}`;
  return line;
}

/**
 * The first line's text up to the first ". ", "! " or "? " outside a quotation (a `"` after a digit is an inch mark),
 * else all of it.
 */
function firstSentence(text: string): string {
  const s = firstLine(text).replace(/\s+/g, ' ').trim();
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '“') quoted = true;
    else if (ch === '”') quoted = false;
    else if (ch === '"' && !/\d/.test(s[i - 1] ?? '')) quoted = !quoted;
    else if (!quoted && /[.!?]/.test(ch) && s[i + 1] === ' ') return s.slice(0, i + 1);
  }
  return s;
}

/** Cut to at most MAX characters at a word boundary, with an ellipsis. */
function cap(s: string): string {
  if (s.length <= MAX) return s;
  const cut = s.slice(0, MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

/**
 * One line saying what an option does: the first sentence of its own ability text (a profile that isn't a weapon),
 * else of its first rule. A rule an option links to is usually a shared one ("Shuriken Weapons", "Objective Secured"),
 * so the option's own text comes first. Plain English when chosen and present, else the official wording; at most 160
 * characters. Null when there is no such text (weapons only).
 */
export function summaryLine(info: EntryInfo, wording: 'plain' | 'official'): string | null {
  const text =
    (info.profiles ?? []).map((p) => profileText(p, wording)).find((t): t is string => !!t) ??
    info.rules?.map((r) => (wording === 'plain' && r.plain) || r.text).find((t) => t.trim());
  return text ? cap(firstSentence(text)) : null;
}
