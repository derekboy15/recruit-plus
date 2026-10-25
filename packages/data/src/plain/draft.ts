/** Drafted plain-English entries: checking them against a to-do list and merging the passing ones into a shard. Pure. */
import type { OptionTier } from '../info/tiers';
import { checkPlain } from './check';
import type { TextKind } from './collect';
import type { PlainShard } from './store';

/** One item of a content to-do list (packages/content/todo/<shard>.json): option texts carry their tier. */
export interface TodoItem {
  key: string;
  kind: TextKind;
  name: string;
  official: string;
  tier?: OptionTier;
}
/** A drafted entry: the plain English and any waived tokens, each with its reason. */
export interface DraftEntry {
  plain: string;
  waive?: Record<string, string>;
}
export interface MergeResult {
  /** The shard with the passing entries added, keys sorted. */
  shard: PlainShard;
  merged: string[];
  failed: { key: string; reason: string }[];
  /** Merged entries whose first sentence is longer than the builder's 160-character one-line summary. */
  longSummaries: { key: string; length: number }[];
}

/** The builder's one-line summary is cut at this many characters (apps/web/src/data/entryInfo.ts). */
const SUMMARY_MAX = 160;

/**
 * The length of what the builder shows as an option's one-line summary (apps/web/src/data/entryInfo.ts firstSentence):
 * the first line without its list bullet, run on into the next while it ends with ":", up to the first ". ", "! " or
 * "? " outside a quotation (a `"` after a digit is an inch mark).
 */
export function firstSentenceLength(plain: string): number {
  const lines = plain.split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
  let line = lines[0] ?? '';
  for (let i = 1; line.endsWith(':') && i < lines.length; i++) line = `${line} ${lines[i]}`;
  const s = line.replace(/\s+/g, ' ').trim();
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '“') quoted = true;
    else if (ch === '”') quoted = false;
    else if (ch === '"' && !/\d/.test(s[i - 1] ?? '')) quoted = !quoted;
    else if (!quoted && /[.!?]/.test(ch) && s[i + 1] === ' ') return i + 1;
  }
  return s.length;
}

/**
 * Adds each drafted entry that is on the to-do list and passes checkPlain to a copy of `shard`, with its name and kind
 * from the to-do list. Anything else is reported in `failed`, with the checker's reason, and left out.
 */
export function mergeDraft(shard: PlainShard, todo: TodoItem[], draft: Record<string, DraftEntry>): MergeResult {
  const items = new Map(todo.map((t) => [t.key, t]));
  const out: PlainShard = { ...shard };
  const result: Omit<MergeResult, 'shard'> = { merged: [], failed: [], longSummaries: [] };
  for (const [key, e] of Object.entries(draft)) {
    const item = items.get(key);
    if (!item) {
      result.failed.push({ key, reason: 'not in the to-do list' });
      continue;
    }
    const v = checkPlain(item.official, e.plain, e.waive);
    if (!v.ok) {
      const copied = v.copy.copied ? ` copied (longest shared run ${v.copy.longestRun} words, ${Math.round(v.copy.shared4 * 100)}% shared 4-grams)` : '';
      result.failed.push({ key, reason: `missing [${v.missing.map((x) => x.value).join(', ')}] extra [${v.extra.map((x) => x.value).join(', ')}]${copied}` });
      continue;
    }
    out[key] = { name: item.name, kind: item.kind, plain: e.plain, ...(e.waive && Object.keys(e.waive).length ? { waive: e.waive } : {}) };
    result.merged.push(key);
    const length = firstSentenceLength(e.plain);
    if (length > SUMMARY_MAX) result.longSummaries.push({ key, length });
  }
  const sorted: PlainShard = {};
  for (const key of Object.keys(out).sort()) sorted[key] = out[key];
  return { shard: sorted, ...result };
}
