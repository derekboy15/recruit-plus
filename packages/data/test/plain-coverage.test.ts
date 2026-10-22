import { test, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueOut, DataIndex, StratagemOut } from '../src/model/types';
import { extractTokens } from '../src/plain/check';
import { collectOfficialTexts, type OfficialText } from '../src/plain/collect';
import { loadPlainStore, type PlainReport, type PlainStore } from '../src/plain/store';

const GEN = join(__dirname, '..', 'generated');
let report: PlainReport;
let texts: OfficialText[];
let store: PlainStore;

beforeAll(() => {
  if (!existsSync(join(GEN, 'plain-report.json'))) throw new Error('Run npm run data:build first');
  report = JSON.parse(readFileSync(join(GEN, 'plain-report.json'), 'utf8'));
  const index: DataIndex = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
  const cats: CatalogueOut[] = index.catalogues.map((c) => JSON.parse(readFileSync(join(GEN, 'catalogues', `${c.slug}.json`), 'utf8')));
  const core: StratagemOut[] = JSON.parse(readFileSync(join(GEN, 'core-stratagems.json'), 'utf8'));
  texts = collectOfficialTexts(cats, core);
  store = loadPlainStore(join(__dirname, '..', '..', 'content', 'plain'));
});

test('every official text has plain English that passes the checks', () => {
  const missing = Object.entries(report.shards).filter(([, r]) => r.written !== r.total).map(([s, r]) => `${s}: ${r.total - r.written} to do`);
  expect(missing).toEqual([]);
  expect(Object.values(report.shards).flatMap((r) => r.flagged)).toEqual([]);
  expect(Object.values(report.shards).flatMap((r) => r.copied)).toEqual([]);
});

test('no plain English is left over from changed or removed official text', () => {
  expect(report.orphans).toEqual([]);
});

test('waivers stay under 2% of all checked tokens', () => {
  const tokens = texts.reduce((n, t) => n + extractTokens(t.text).length, 0);
  const waived = [...store.values()].reduce((n, e) => n + Object.keys(e.waive ?? {}).length, 0);
  console.log(`plain English: ${texts.length} texts, ${tokens} tokens, ${waived} waived (${((100 * waived) / tokens).toFixed(2)}%)`);
  expect(waived / tokens).toBeLessThan(0.02);
});
