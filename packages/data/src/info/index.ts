/** Info files (generated/info/<slug>.json) and their plain English. */
import { TEXT_CHARS, type CatalogueOut, type InfoFile, type InfoProfile } from '../model/types';
import { checkPlain, type PlainVerdict } from '../plain/check';
import { CORE_SHARD, officialFor, spotSample, textKey, type OfficialText, type TextKind } from '../plain/collect';
import type { OptionShardReport, PlainStore } from '../plain/store';
import type { OptionTier, TierOf } from './tiers';

export { emitInfoFile } from './extract';
export { optionTierOf, TIER_NAMES, type OptionTier, type TierOf } from './tiers';

/** The option texts' plain-English coverage: totals, flagged or copied entries, and each owning shard's report. */
export interface InfoPlainReport {
  total: number;
  written: number;
  /** Entries that fail the checks: missing or invented tokens, or copied wording. */
  flagged: number;
  shards: Record<string, OptionShardReport>;
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;

/** A profile's rules-text characteristics: a weapon's TEXT_CHARS, any other profile's characteristics of more than three words. */
function textChars(p: InfoProfile): string[] {
  return Object.keys(p.chars).filter((c) => {
    const v = p.chars[c];
    if (v.trim() === '-' || wordCount(v) <= 3) return false;
    return p.type === 'Weapon' ? (TEXT_CHARS as readonly string[]).includes(c) : true;
  });
}

/** The text keys of every option text attachInfoPlain looks up: rules, and profiles' rules-text characteristics. */
export function infoTextKeys(files: InfoFile[]): Set<string> {
  const keys = new Set<string>();
  for (const f of files) {
    for (const info of Object.values(f.entries)) {
      for (const r of info.rules ?? []) keys.add(textKey(r.text));
      for (const p of info.profiles ?? []) for (const c of textChars(p)) keys.add(textKey(p.chars[c]));
    }
  }
  return keys;
}

/** An option BattleScribe leaves without text, given the text of the Stratagem it buys (overrides/option-stratagems.json). */
export interface OptionStratagem {
  /** The BattleScribe file that defines the option. */
  catalogueName: string;
  entryId: string;
  /** The catalogue (slug) whose Stratagem it buys, and the Stratagem's name as the catalogue has it. */
  stratagem: { catalogue: string; name: string };
  source: string;
}

/**
 * Adds each override's Stratagem text (its amendment included, so the Stratagem's plain English matches by key) to the
 * option's rules, in place. Throws on a catalogue with no info file or a Stratagem the catalogue doesn't have.
 */
export function attachOptionStratagems(files: InfoFile[], overrides: OptionStratagem[], cats: CatalogueOut[], slugOf: (catalogueName: string) => string): void {
  for (const o of overrides) {
    const file = files.find((f) => f.slug === slugOf(o.catalogueName));
    if (!file) throw new Error(`option-stratagems.json names unknown catalogue "${o.catalogueName}"`);
    const s = cats.find((c) => c.slug === o.stratagem.catalogue)?.stratagems.find((x) => x.name === o.stratagem.name);
    if (!s) throw new Error(`option-stratagems.json: no Stratagem "${o.stratagem.name}" in ${o.stratagem.catalogue}`);
    const info = (file.entries[o.entryId] ??= {});
    info.rules = [...(info.rules ?? []), { name: s.name, text: officialFor(s.text, s.amended) }];
  }
}

/** An option text: its owning shard (where its plain English goes) and its tier (how early a player meets it). */
export interface OptionText extends OfficialText {
  tier: OptionTier;
}

/** The shard that owns a roster file's option texts: the game system's go in `core`. */
export function optionShard(slug: string): string {
  return slug === 'system' ? CORE_SHARD : slug;
}

const profileKind = (p: InfoProfile): TextKind => (p.type === 'Weapon' ? 'weapon' : /psychic/i.test(p.type) ? 'psychic' : 'ability');
/** Slug order (by code point, so hyphens count), the game system last. */
const fileOrder = (a: InfoFile, b: InfoFile) =>
  Number(a.slug === 'system') - Number(b.slug === 'system') || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/**
 * Every distinct option text, once: the texts attachInfoPlain looks up. Each is owned by the shard that already holds
 * its entry, else by the first file it occurs in (slug order, the game system last), and ranked at its most visible use.
 */
export function collectOptionTexts(files: InfoFile[], store: PlainStore, tierOf: TierOf): OptionText[] {
  const out = new Map<string, OptionText>();
  const add = (slug: string, entryId: string, kind: TextKind, name: string, text: string) => {
    const key = textKey(text);
    const tier = tierOf(slug, entryId);
    const seen = out.get(key);
    if (seen) seen.tier = Math.min(seen.tier, tier) as OptionTier;
    else out.set(key, { key, shard: store.get(key)?.shard ?? optionShard(slug), kind, name, text, tier });
  };
  for (const f of [...files].sort(fileOrder)) {
    for (const [entryId, info] of Object.entries(f.entries)) {
      for (const r of info.rules ?? []) add(f.slug, entryId, 'rule', r.name, r.text);
      for (const p of info.profiles ?? []) for (const c of textChars(p)) add(f.slug, entryId, profileKind(p), p.name, p.chars[c]);
    }
  }
  return [...out.values()];
}

/** A shard's option texts in content:todo's counts: how many it owns, how many are written, and the open ones by tier. */
export function optionCounts(texts: OptionText[], shard: string, written: (t: OptionText) => boolean): { total: number; written: number; open: Record<OptionTier, number> } {
  const own = texts.filter((t) => t.shard === shard);
  const open: Record<OptionTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const t of own) if (!written(t)) open[t.tier]++;
  return { total: own.length, written: own.length - Object.values(open).reduce((a, b) => a + b, 0), open };
}

/** A shard's option spot-check sample: up to 5 army choices and 5 other texts, each half topping up the other (at most 10). */
export function optionSample(texts: OptionText[], shard: string): OptionText[] {
  const own = texts.filter((t) => t.shard === shard);
  const army = own.filter((t) => t.tier === 1);
  const rest = own.filter((t) => t.tier !== 1);
  const nArmy = Math.min(army.length, Math.max(5, 10 - rest.length));
  const seed = `options:${shard}`;
  return [...spotSample(army, seed, nArmy), ...spotSample(rest, seed, Math.min(rest.length, 10 - nArmy))];
}

/**
 * Attaches plain English to the info files' rules and profile text characteristics (in place), as applyPlain does for
 * catalogues: only where the store has an entry for the text's key that passes checkPlain. Reports each option text
 * (collectOptionTexts) once, under its owning shard and tier: written, flagged (missing or invented tokens) or copied.
 * These counts are generated/plain-report.json's `options`, apart from the pages' coverage.
 */
export function attachInfoPlain(files: InfoFile[], store: PlainStore, tierOf: TierOf): InfoPlainReport {
  const verdicts = new Map<string, PlainVerdict | null>();
  const plainFor = (official: string): string | undefined => {
    const key = textKey(official);
    if (!verdicts.has(key)) {
      const entry = store.get(key);
      verdicts.set(key, entry ? checkPlain(official, entry.plain, entry.waive) : null);
    }
    return verdicts.get(key)?.ok ? store.get(key)!.plain : undefined;
  };
  for (const f of files) {
    for (const info of Object.values(f.entries)) {
      for (const r of info.rules ?? []) {
        const plain = plainFor(r.text);
        if (plain) r.plain = plain;
      }
      for (const p of info.profiles ?? []) {
        for (const c of textChars(p)) {
          const plain = plainFor(p.chars[c]);
          if (plain) p.plain = { ...p.plain, [c]: plain };
        }
      }
    }
  }

  const shards: Record<string, OptionShardReport> = {};
  const tally = { total: 0, written: 0, flagged: 0 };
  const count = () => ({ total: 0, written: 0 });
  for (const t of collectOptionTexts(files, store, tierOf)) {
    const v = verdicts.get(t.key);
    const r = (shards[t.shard] ??= { total: 0, written: 0, flagged: [], copied: [], tiers: { 1: count(), 2: count(), 3: count(), 4: count() } });
    r.total++;
    r.tiers[t.tier].total++;
    tally.total++;
    if (v?.ok) {
      r.written++;
      r.tiers[t.tier].written++;
      tally.written++;
    }
    if (v && (v.missing.length || v.extra.length)) r.flagged.push({ key: t.key, name: t.name, missing: v.missing.map((x) => x.value), extra: v.extra.map((x) => x.value) });
    if (v?.copy.copied) r.copied.push({ key: t.key, name: t.name, longestRun: v.copy.longestRun });
    if (v && !v.ok) tally.flagged++;
  }
  return { ...tally, shards };
}
