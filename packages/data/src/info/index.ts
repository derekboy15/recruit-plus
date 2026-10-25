/** Info files (generated/info/<slug>.json) and their plain English. */
import { TEXT_CHARS, type InfoFile, type InfoProfile } from '../model/types';
import { checkPlain } from '../plain/check';
import { CORE_SHARD, spotSample, textKey, type OfficialText, type TextKind } from '../plain/collect';
import type { PlainStore } from '../plain/store';
import type { OptionTier, TierOf } from './tiers';

export { emitInfoFile } from './extract';
export { optionTierOf, TIER_NAMES, type OptionTier, type TierOf } from './tiers';

/** generated/info-plain-report.json: distinct option texts, how many have plain English, and the first entry of each that hasn't (for Plan F). */
export interface InfoPlainReport {
  total: number;
  written: number;
  missing: { slug: string; entryId: string; name: string; key: string }[];
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
 * catalogues: only where the store has an entry for the text's key that passes checkPlain. These texts are not part of
 * the plain-English coverage of the pages (generated/plain-report.json).
 */
export function attachInfoPlain(files: InfoFile[], store: PlainStore): InfoPlainReport {
  const verdicts = new Map<string, boolean>();
  const missing: InfoPlainReport['missing'] = [];
  const plainFor = (official: string, at: { slug: string; entryId: string; name: string }): string | undefined => {
    const key = textKey(official);
    if (!verdicts.has(key)) {
      const entry = store.get(key);
      const ok = !!entry && checkPlain(official, entry.plain, entry.waive).ok;
      verdicts.set(key, ok);
      if (!ok) missing.push({ ...at, key });
    }
    return verdicts.get(key) ? store.get(key)!.plain : undefined;
  };
  for (const f of files) {
    for (const [entryId, info] of Object.entries(f.entries)) {
      for (const r of info.rules ?? []) {
        const plain = plainFor(r.text, { slug: f.slug, entryId, name: r.name });
        if (plain) r.plain = plain;
      }
      for (const p of info.profiles ?? []) {
        for (const c of textChars(p)) {
          const plain = plainFor(p.chars[c], { slug: f.slug, entryId, name: p.name });
          if (plain) p.plain = { ...p.plain, [c]: plain };
        }
      }
    }
  }
  const written = [...verdicts.values()].filter(Boolean).length;
  return { total: verdicts.size, written, missing };
}
