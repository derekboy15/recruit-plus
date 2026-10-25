/**
 * Plain-English to-do lists, from the last `npm run data:build`.
 *   npm run content:todo -- <shard> [--tier <1-4>] writes packages/content/todo/<shard>.json and prints its counts
 *                                              (shard "missions": the faction secondaries, in content/missions/plain.json).
 *                                              Option texts (info files) carry their tier; --tier lists only that tier's.
 *   npm run content:todo -- --all              prints the counts for every shard
 *   npm run content:todo -- --sample <slug> <n> prints a deterministic spot-check sample of a catalogue's texts
 *                                              ("missions": of the faction secondaries)
 *   npm run content:todo -- --sample-options <shard> prints a shard's option spot-check sample (Plan F)
 *   npm run content:todo -- --rules <slug>     prints a catalogue's army-rule texts
 *   npm run content:todo -- --show <key> [...] prints official text and plain English side by side
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectOptionTexts, optionSample, optionTierOf, TIER_NAMES, type OptionText, type OptionTier } from '../src/info';
import type { CatalogueOut, DataIndex, InfoFile, StratagemOut } from '../src/model/types';
import { checkPlain, extractTokens } from '../src/plain/check';
import type { MissionsOut } from '../src/missions/types';
import { collectOfficialTexts, officialFor, ruleKeys, spotSample, textKey, textsInCatalogue, type OfficialText } from '../src/plain/collect';
import { loadPlainStore } from '../src/plain/store';
import type { RosterFile } from '../src/roster/types';

const root = join(import.meta.dirname, '..');
const gen = join(root, 'generated');
const contentDir = join(root, '..', 'content');
const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const readDir = <T>(dir: string): T[] => readdirSync(join(gen, dir)).filter((f) => f !== 'policy.json').map((f) => read<T>(join(gen, dir, f)));

const index = read<DataIndex>(join(gen, 'index.json'));
const cats = index.catalogues.map((c) => read<CatalogueOut>(join(gen, 'catalogues', `${c.slug}.json`)));
const texts = collectOfficialTexts(cats, read<StratagemOut[]>(join(gen, 'core-stratagems.json')));
const store = loadPlainStore(join(contentDir, 'plain'));
/** The army-building option texts (info files), each in its owning shard with its tier. */
const options = collectOptionTexts(readDir<InfoFile>('info'), store, optionTierOf(readDir<RosterFile>('roster')));

/** The faction secondaries (the "missions" shard), one per distinct official text; their plain English is in content/missions/plain.json. */
const MISSIONS = 'missions';
const missionsStore = new Map(Object.entries(read<Record<string, { plain: string; waive?: Record<string, string> }>>(join(contentDir, 'missions', 'plain.json'))));
const factionSecondaries: OfficialText[] = [];
for (const s of read<MissionsOut>(join(gen, 'missions.json')).packs.flatMap((p) => p.secondaries)) {
  if (!s.faction) continue;
  const text = officialFor(s.text, s.amended);
  const key = textKey(text);
  // kind 'secondary' is the missions store's kind, outside the datasheet TextKind list: only listed and sampled here.
  if (!factionSecondaries.some((t) => t.key === key)) factionSecondaries.push({ key, shard: MISSIONS, kind: 'secondary', name: `${s.name} (${s.faction})`, text } as unknown as OfficialText);
}
texts.push(...factionSecondaries);
const pageKeys = new Set(texts.map((t) => t.key));
const entryFor = (t: OfficialText) => (t.shard === MISSIONS ? missionsStore.get(t.key) : store.get(t.key));

function todo(t: OfficialText | OptionText) {
  const entry = entryFor(t);
  const verdict = entry ? checkPlain(t.text, entry.plain, entry.waive) : null;
  if (verdict?.ok) return null;
  return {
    key: t.key,
    kind: t.kind,
    name: t.name,
    official: t.text,
    tokens: extractTokens(t.text).map((x) => x.value),
    ...('tier' in t ? { tier: t.tier } : {}),
    ...(verdict
      ? { problem: { missing: verdict.missing.map((x) => x.value), extra: verdict.extra.map((x) => x.value), copied: verdict.copy.copied } }
      : {}),
  };
}

function line(shard: string): string {
  const own = texts.filter((t) => t.shard === shard);
  const open = own.map(todo).filter(Boolean).length;
  const openOptions = options.filter((t) => t.shard === shard && todo(t));
  const byTier = ([1, 2, 3, 4] as const).map((tier) => `${TIER_NAMES[tier]} ${openOptions.filter((t) => t.tier === tier).length}`);
  return `${shard}: ${own.length} texts, ${own.length - open} written, ${open} to do; options: ${openOptions.length} to do (${byTier.join(', ')})`;
}

const [arg, ...rest] = process.argv.slice(2);
if (arg === '--all') {
  for (const shard of [...new Set([...texts, ...options].map((t) => t.shard))]) console.log(line(shard));
} else if (arg === '--show') {
  // Official text and plain English side by side, for review.
  for (const key of rest) {
    const t = texts.find((x) => x.key === key) ?? options.find((x) => x.key === key);
    if (!t) throw new Error(`No text with key ${key}`);
    const e = entryFor(t);
    const tier = 'tier' in t ? ` · tier ${t.tier} (${TIER_NAMES[t.tier as OptionTier]})` : '';
    console.log(`## ${key} · ${t.kind} · ${t.name} · shard ${t.shard}${tier}\nOFFICIAL: ${t.text}\nPLAIN: ${e?.plain ?? '(none)'}${e?.waive ? `\nWAIVED: ${JSON.stringify(e.waive)}` : ''}\n`);
  }
} else if (arg === '--rules') {
  // A catalogue's army rules (always part of its spot-check, besides the sample).
  const cat = cats.find((c) => c.slug === rest[0]);
  if (!cat) throw new Error('Usage: --rules <catalogue-slug>');
  const byKey = new Map(texts.map((t) => [t.key, t]));
  for (const key of ruleKeys(cat)) console.log(`${key}\trule\t${byKey.get(key)!.name}`);
} else if (arg === '--sample') {
  const [slug, n] = rest;
  if (slug === MISSIONS && n) {
    for (const t of spotSample(factionSecondaries, slug, Number(n))) console.log(`${t.key}\t${t.kind}\t${t.name}`);
    process.exit(0);
  }
  const cat = cats.find((c) => c.slug === slug);
  if (!cat || !n) throw new Error('Usage: --sample <catalogue-slug> <n>');
  for (const t of spotSample(textsInCatalogue(cat, texts), slug, Number(n))) console.log(`${t.key}\t${t.kind}\t${t.name}`);
} else if (arg === '--sample-options') {
  // A shard's option spot-check sample (content/review/options/<shard>.md must review each of these keys).
  if (!rest[0]) throw new Error('Usage: --sample-options <shard>');
  for (const t of optionSample(options, rest[0])) console.log(`${t.key}\t${t.tier}\t${t.name}`);
} else if (arg) {
  if (![...texts, ...options].some((t) => t.shard === arg)) throw new Error(`No shard "${arg}". Run with --all to list them.`);
  const tier = rest[0] === '--tier' ? Number(rest[1]) : null;
  if (tier !== null && ![1, 2, 3, 4].includes(tier)) throw new Error('Usage: content:todo -- <shard> --tier <1-4>');
  // With --tier, only that tier's option texts; an option text that is also a page text is listed with the page texts.
  const pageItems = tier === null ? texts.filter((t) => t.shard === arg) : [];
  const optionItems = options.filter((t) => t.shard === arg && !pageKeys.has(t.key) && (tier === null || t.tier === tier));
  const items = [...pageItems, ...optionItems].map(todo).filter(Boolean);
  mkdirSync(join(contentDir, 'todo'), { recursive: true });
  writeFileSync(join(contentDir, 'todo', `${arg}.json`), JSON.stringify(items, null, 2));
  console.log(`${line(arg)}${tier === null ? '' : `; listed: ${items.length} at tier ${tier}`}`);
} else {
  throw new Error('Usage: content:todo -- <shard> [--tier <1-4>] | --all | --sample <catalogue-slug> <n> | --sample-options <shard> | --rules <slug> | --show <key>');
}
