import { test, expect, beforeAll } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectOptionTexts } from '../src/info';
import type { CatalogueOut, DataIndex, InfoFile, StratagemOut } from '../src/model/types';
import { extractTokens } from '../src/plain/check';
import { collectOfficialTexts, type OfficialText } from '../src/plain/collect';
import { loadPlainStore, type CoverageReport, type PlainStore } from '../src/plain/store';

const GEN = join(__dirname, '..', 'generated');
let report: CoverageReport;
let texts: OfficialText[];
let optionTexts: OfficialText[];
let store: PlainStore;

beforeAll(() => {
  if (!existsSync(join(GEN, 'plain-report.json'))) throw new Error('Run npm run data:build first');
  report = JSON.parse(readFileSync(join(GEN, 'plain-report.json'), 'utf8'));
  const index: DataIndex = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
  const cats: CatalogueOut[] = index.catalogues.map((c) => JSON.parse(readFileSync(join(GEN, 'catalogues', `${c.slug}.json`), 'utf8')));
  const core: StratagemOut[] = JSON.parse(readFileSync(join(GEN, 'core-stratagems.json'), 'utf8'));
  texts = collectOfficialTexts(cats, core);
  store = loadPlainStore(join(__dirname, '..', '..', 'content', 'plain'));
  const infos: InfoFile[] = readdirSync(join(GEN, 'info')).map((f) => JSON.parse(readFileSync(join(GEN, 'info', f), 'utf8')));
  optionTexts = collectOptionTexts(infos, store, () => 4);
});

test('every official text has plain English that passes the checks', () => {
  const missing = Object.entries(report.shards).filter(([, r]) => r.written !== r.total).map(([s, r]) => `${s}: ${r.total - r.written} to do`);
  expect(missing).toEqual([]);
  expect(Object.values(report.shards).flatMap((r) => r.flagged)).toEqual([]);
  expect(Object.values(report.shards).flatMap((r) => r.copied)).toEqual([]);
});

test('every option-text entry passes its checks', () => {
  expect(Object.values(report.options).flatMap((r) => [...r.flagged, ...r.copied])).toEqual([]);
});

test.todo('every option text has plain English (Plan F Task 9 turns this on)');

test('no plain English is left over from changed or removed official text', () => {
  expect(report.orphans).toEqual([]);
});

test('waivers stay under 2% of all checked tokens', () => {
  // Page and option texts, each key once.
  const checked = new Map([...optionTexts, ...texts].map((t) => [t.key, t]));
  const tokens = [...checked.values()].reduce((n, t) => n + extractTokens(t.text).length, 0);
  const waived = [...store.values()].reduce((n, e) => n + Object.keys(e.waive ?? {}).length, 0);
  console.log(`plain English: ${checked.size} texts, ${tokens} tokens, ${waived} waived (${((100 * waived) / tokens).toFixed(2)}%)`);
  expect(waived / tokens).toBeLessThan(0.02);
});
