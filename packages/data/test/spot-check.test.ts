import { test, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueOut, DataIndex, StratagemOut } from '../src/model/types';
import { collectOfficialTexts, ruleKeys, spotSample, textsInCatalogue, type OfficialText } from '../src/plain/collect';

const GEN = join(__dirname, '..', 'generated');
const REVIEW = join(__dirname, '..', '..', 'content', 'review');
const SAMPLE = 20;
let cats: CatalogueOut[];
let all: OfficialText[];

beforeAll(() => {
  if (!existsSync(join(GEN, 'index.json'))) throw new Error('Run npm run data:build first');
  const index: DataIndex = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
  cats = index.catalogues.map((c) => JSON.parse(readFileSync(join(GEN, 'catalogues', `${c.slug}.json`), 'utf8')));
  const core: StratagemOut[] = JSON.parse(readFileSync(join(GEN, 'core-stratagems.json'), 'utf8'));
  all = collectOfficialTexts(cats, core);
});

/** Table rows `| key | name | kind | verdict | note |` whose first cell is a 12-character text key. */
function rows(md: string): { key: string; verdict: string }[] {
  return md
    .split(/\r?\n/)
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => /^[0-9a-f]{12}$/.test(c[1] ?? ''))
    .map((c) => ({ key: c[1], verdict: c[4] }));
}

// Extra reviewed rows are fine (more review, never less).
test('every playable faction has a spot-check record covering its sample and army rules, with no failures', () => {
  const problems: string[] = [];
  for (const cat of cats.filter((c) => !c.library)) {
    const file = join(REVIEW, `${cat.slug}.md`);
    if (!existsSync(file)) {
      problems.push(`${cat.slug}: no review/${cat.slug}.md`);
      continue;
    }
    const md = readFileSync(file, 'utf8');
    const texts = textsInCatalogue(cat, all);
    const expected = new Set([...spotSample(texts, cat.slug, SAMPLE).map((t) => t.key), ...ruleKeys(cat)]);
    const found = rows(md);
    const keys = new Set(found.map((r) => r.key));
    const missing = [...expected].filter((k) => !keys.has(k));
    if (missing.length) problems.push(`${cat.slug}: sample keys not reviewed: ${missing.join(', ')}`);
    for (const r of found) if (!/^(PASS|FIXED)$/.test(r.verdict)) problems.push(`${cat.slug}: ${r.key} verdict "${r.verdict}"`);
    if (!/^Guide: (PASS|FIXED)\b/m.test(md)) problems.push(`${cat.slug}: no "Guide: PASS" or "Guide: FIXED" line`);
  }
  expect(problems).toEqual([]);
});
