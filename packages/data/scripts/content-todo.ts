/**
 * Plain-English to-do lists, from the last `npm run data:build`.
 *   npm run content:todo -- <shard>            writes packages/content/todo/<shard>.json and prints its counts
 *   npm run content:todo -- --all              prints the counts for every shard
 *   npm run content:todo -- --sample <slug> <n> prints a deterministic spot-check sample of a catalogue's texts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueOut, DataIndex, StratagemOut } from '../src/model/types';
import { checkPlain, extractTokens } from '../src/plain/check';
import { collectOfficialTexts, spotSample, textsInCatalogue, type OfficialText } from '../src/plain/collect';
import { loadPlainStore } from '../src/plain/store';

const root = join(import.meta.dirname, '..');
const gen = join(root, 'generated');
const contentDir = join(root, '..', 'content');
const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

const index = read<DataIndex>(join(gen, 'index.json'));
const cats = index.catalogues.map((c) => read<CatalogueOut>(join(gen, 'catalogues', `${c.slug}.json`)));
const texts = collectOfficialTexts(cats, read<StratagemOut[]>(join(gen, 'core-stratagems.json')));
const store = loadPlainStore(join(contentDir, 'plain'));

function todo(t: OfficialText) {
  const entry = store.get(t.key);
  const verdict = entry ? checkPlain(t.text, entry.plain, entry.waive) : null;
  if (verdict?.ok) return null;
  return {
    key: t.key,
    kind: t.kind,
    name: t.name,
    official: t.text,
    tokens: extractTokens(t.text).map((x) => x.value),
    ...(verdict
      ? { problem: { missing: verdict.missing.map((x) => x.value), extra: verdict.extra.map((x) => x.value), copied: verdict.copy.copied } }
      : {}),
  };
}

function line(shard: string): string {
  const own = texts.filter((t) => t.shard === shard);
  const open = own.map(todo).filter(Boolean).length;
  return `${shard}: ${own.length} texts, ${own.length - open} written, ${open} to do`;
}

const [arg, ...rest] = process.argv.slice(2);
if (arg === '--all') {
  for (const shard of [...new Set(texts.map((t) => t.shard))]) console.log(line(shard));
} else if (arg === '--sample') {
  const [slug, n] = rest;
  const cat = cats.find((c) => c.slug === slug);
  if (!cat || !n) throw new Error('Usage: --sample <catalogue-slug> <n>');
  for (const t of spotSample(textsInCatalogue(cat, texts), slug, Number(n))) console.log(`${t.key}\t${t.kind}\t${t.name}`);
} else if (arg) {
  if (!texts.some((t) => t.shard === arg)) throw new Error(`No shard "${arg}". Run with --all to list them.`);
  const items = texts.filter((t) => t.shard === arg).map(todo).filter(Boolean);
  mkdirSync(join(contentDir, 'todo'), { recursive: true });
  writeFileSync(join(contentDir, 'todo', `${arg}.json`), JSON.stringify(items, null, 2));
  console.log(line(arg));
} else {
  throw new Error('Usage: content:todo -- <shard> | --all | --sample <catalogue-slug> <n>');
}
