/** Authored plain-English texts (packages/content/plain/<shard>.json): loading, checking, and attaching them to the output. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { CatalogueOut, StratagemOut } from '../model/types';
import { checkPlain, type PlainVerdict } from './check';
import { allItems, textKey, type TextKind } from './collect';

export interface PlainEntry {
  name: string;
  kind: TextKind;
  plain: string;
  /** Tokens (by value) the cross-check may ignore, each with the reason. */
  waive?: Record<string, string>;
}
/** key -> entry; keys are written sorted. */
export type PlainShard = Record<string, PlainEntry>;
export type PlainStore = Map<string, PlainEntry & { shard: string }>;

/** Every shard file in `dir` (none if it doesn't exist). A key may live in only one shard. */
export function loadPlainStore(dir: string): PlainStore {
  const out: PlainStore = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const shard = basename(file, '.json');
    const entries: PlainShard = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const [key, entry] of Object.entries(entries)) {
      const prior = out.get(key);
      if (prior) throw new Error(`Plain-English key ${key} ("${entry.name}") is in both ${prior.shard}.json and ${file}`);
      out.set(key, { ...entry, shard });
    }
  }
  return out;
}

export interface ShardReport {
  total: number;
  written: number;
  flagged: { key: string; name: string; missing: string[]; extra: string[] }[];
  copied: { key: string; name: string; longestRun: number }[];
}
export interface PlainReport {
  shards: Record<string, ShardReport>;
  orphans: { shard: string; key: string; name: string }[];
}

/**
 * Attaches each text's plain English to the output (in place), but only where an entry exists for the text's current
 * key and passes the checks. Reports, per owning shard, what is written, flagged or copied, and the entries whose
 * official text no longer occurs. A list-building extra's text gets its plain English the same way but isn't reported:
 * it isn't a text the pages must cover, though its entry isn't an orphan either. Nor is an entry whose text is one of
 * `optionTexts` (the info files' texts, by key: infoTextKeys), which get their plain English there.
 */
export function applyPlain(cats: CatalogueOut[], core: StratagemOut[], store: PlainStore, optionTexts: Set<string> = new Set()): PlainReport {
  const shards: Record<string, ShardReport> = {};
  const verdicts = new Map<string, PlainVerdict | null>();
  const extraKeys = new Set<string>();
  for (const item of allItems(cats, core)) {
    const key = textKey(item.official);
    if (item.extra) {
      extraKeys.add(key);
      const entry = store.get(key);
      if (entry && checkPlain(item.official, entry.plain, entry.waive).ok) item.setPlain(entry.plain);
      continue;
    }
    if (!verdicts.has(key)) {
      const entry = store.get(key);
      const verdict = entry ? checkPlain(item.official, entry.plain, entry.waive) : null;
      verdicts.set(key, verdict);
      const r = (shards[item.shard] ??= { total: 0, written: 0, flagged: [], copied: [] });
      r.total++;
      if (verdict?.ok) r.written++;
      if (verdict && (verdict.missing.length || verdict.extra.length)) {
        r.flagged.push({ key, name: item.name, missing: verdict.missing.map((t) => t.value), extra: verdict.extra.map((t) => t.value) });
      }
      if (verdict?.copy.copied) r.copied.push({ key, name: item.name, longestRun: verdict.copy.longestRun });
    }
    const entry = store.get(key);
    if (entry && verdicts.get(key)?.ok) item.setPlain(entry.plain);
  }
  const orphans = [...store]
    .filter(([key]) => !verdicts.has(key) && !extraKeys.has(key) && !optionTexts.has(key))
    .map(([key, e]) => ({ shard: e.shard, key, name: e.name }));
  return { shards, orphans };
}
