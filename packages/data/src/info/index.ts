/** Info files (generated/info/<slug>.json) and their plain English. */
import { TEXT_CHARS, type InfoFile, type InfoProfile } from '../model/types';
import { checkPlain } from '../plain/check';
import { textKey } from '../plain/collect';
import type { PlainStore } from '../plain/store';

export { emitInfoFile } from './extract';

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
