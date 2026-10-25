/** The official rules texts the app shows, keyed by a hash of their normalised wording, and where each one's plain English lives. */
import { createHash } from 'node:crypto';
import { TEXT_CHARS, type CatalogueOut, type ProfileOut, type StratagemOut } from '../model/types';
import { normaliseRulesText } from './check';

export type TextKind = 'ability' | 'weapon' | 'psychic' | 'rule' | 'stratagem';

export interface OfficialText {
  key: string;
  /** The content file (`plain/<shard>.json`) that holds its plain English: `core`, or a catalogue slug. */
  shard: string;
  kind: TextKind;
  name: string;
  /** The official text the plain English is checked against, amendment included. */
  text: string;
}

export const CORE_SHARD = 'core';

/** The text a plain-English version must cover: the official wording, plus our note of a later rules update. */
export function officialFor(text: string, amended?: string): string {
  return amended ? `${text}\n\nRules update: ${amended}` : text;
}

export function textKey(official: string): string {
  return createHash('sha1').update(normaliseRulesText(official)).digest('hex').slice(0, 12);
}

/** One shown text, with a way to attach its plain English to the output object it came from. */
export interface TextItem {
  kind: TextKind;
  name: string;
  official: string;
  shard: string;
  /**
   * A list-building extra's text on a datasheet (a relic, a Warlord trait): an option text, like the info files'. It gets
   * its plain English when there is one, but isn't one of the texts the pages must cover.
   */
  extra?: true;
  setPlain(plain: string): void;
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;

function profileItems(profiles: ProfileOut[], kind: 'weapon' | 'psychic', shard: string): TextItem[] {
  return profiles.flatMap((p) =>
    TEXT_CHARS.filter((c) => {
      const v = p.chars[c];
      return v && v.trim() !== '-' && wordCount(v) > 3;
    }).map((c) => ({
      kind,
      name: p.name,
      official: p.chars[c],
      shard,
      ...(p.extra && { extra: true as const }),
      setPlain: (plain: string) => {
        p.plain = { ...p.plain, [c]: plain };
      },
    })),
  );
}

/**
 * Every text a catalogue's pages show: unit abilities and profile rules text (in the shard of the catalogue that
 * defines the unit), then army rules and stratagems (in the catalogue's own shard). `slugById` maps catalogue ids to
 * slugs; a unit from an unknown catalogue stays in this catalogue's shard.
 */
export function catalogueItems(cat: CatalogueOut, slugById: Map<string, string>): TextItem[] {
  const items: TextItem[] = [];
  for (const u of cat.units) {
    const shard = slugById.get(u.catalogueId) ?? cat.slug;
    for (const a of u.abilities) {
      if (!a.text.trim()) continue;
      items.push({ kind: 'ability', name: a.name, official: officialFor(a.text, a.amended), shard, ...(a.extra && { extra: true as const }), setPlain: (p) => void (a.plain = p) });
    }
    items.push(...profileItems(u.weapons, 'weapon', shard), ...profileItems(u.psychic, 'psychic', shard));
  }
  for (const r of cat.rules) {
    if (!r.text.trim()) continue;
    items.push({ kind: 'rule', name: r.name, official: officialFor(r.text, r.amended), shard: cat.slug, setPlain: (p) => void (r.plain = p) });
  }
  for (const s of cat.stratagems) items.push(stratagemItem(s, cat.slug));
  return items;
}

export function stratagemItem(s: StratagemOut, shard: string): TextItem {
  return { kind: 'stratagem', name: s.name, official: officialFor(s.text, s.amended), shard, setPlain: (p) => void (s.plain = p) };
}

/** Core stratagems, then every catalogue's texts in the given order. */
export function allItems(cats: CatalogueOut[], core: StratagemOut[]): TextItem[] {
  const slugById = new Map(cats.map((c) => [c.id, c.slug]));
  return [...core.map((s) => stratagemItem(s, CORE_SHARD)), ...cats.flatMap((c) => catalogueItems(c, slugById))];
}

/** The texts the pages must cover, each once: list-building extras are left out. */
function dedupe(items: TextItem[]): OfficialText[] {
  const seen = new Map<string, OfficialText>();
  for (const i of items.filter((x) => !x.extra)) {
    const key = textKey(i.official);
    if (!seen.has(key)) seen.set(key, { key, shard: i.shard, kind: i.kind, name: i.name, text: i.official });
  }
  return [...seen.values()];
}

/** Every distinct official text, once, owned by the shard where it first occurs (core first, then `cats` in order). */
export function collectOfficialTexts(cats: CatalogueOut[], core: StratagemOut[]): OfficialText[] {
  return dedupe(allItems(cats, core));
}

/** The distinct texts shown on one catalogue's pages, as collected in `all` (so each keeps its owning shard). */
export function textsInCatalogue(cat: CatalogueOut, all: OfficialText[]): OfficialText[] {
  const byKey = new Map(all.map((t) => [t.key, t]));
  const keys = new Set(catalogueItems(cat, new Map()).filter((i) => !i.extra).map((i) => textKey(i.official)));
  return [...keys].map((k) => byKey.get(k)).filter((t): t is OfficialText => !!t);
}

/**
 * The keys of a catalogue's own army rules, in order. Taken from its `rules`, not from the collected texts: a rule whose
 * wording was first collected as a unit ability elsewhere still counts here.
 */
export function ruleKeys(cat: CatalogueOut): string[] {
  return [...new Set(catalogueItems(cat, new Map()).filter((i) => i.kind === 'rule').map((i) => textKey(i.official)))];
}

/** A deterministic sample of `n` texts, ordered by a hash of seed and key (for the per-faction spot-check). */
export function spotSample<T extends OfficialText>(texts: T[], seed: string, n: number): T[] {
  const rank = (t: OfficialText) => createHash('sha1').update(`${seed}:${t.key}`).digest('hex');
  return [...texts].sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, n);
}
