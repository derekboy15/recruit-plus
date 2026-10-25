import { test, expect, beforeAll } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { collectOptionTexts, optionSample, optionTierOf, type OptionText } from '../src/info';
import type { InfoFile } from '../src/model/types';
import { loadPlainStore } from '../src/plain/store';
import type { RosterFile } from '../src/roster/types';

const GEN = join(__dirname, '..', 'generated');
const REVIEW = join(__dirname, '..', '..', 'content', 'review', 'options');
let texts: OptionText[];

beforeAll(() => {
  if (!existsSync(join(GEN, 'info'))) throw new Error('Run npm run data:build first');
  const read = <T>(dir: string): T[] => readdirSync(join(GEN, dir)).filter((f) => f !== 'policy.json').map((f) => JSON.parse(readFileSync(join(GEN, dir, f), 'utf8')));
  const store = loadPlainStore(join(__dirname, '..', '..', 'content', 'plain'));
  texts = collectOptionTexts(read<InfoFile>('info'), store, optionTierOf(read<RosterFile>('roster')));
});

/** Table rows `| key | name | tier | verdict | note |` whose first cell is a 12-character text key. */
function rows(md: string): { key: string; verdict: string }[] {
  return md
    .split(/\r?\n/)
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => /^[0-9a-f]{12}$/.test(c[1] ?? ''))
    .map((c) => ({ key: c[1], verdict: c[4] }));
}

// Plan F Tasks 5-8 write content/review/options/<shard>.md. Extra reviewed rows are fine (more review, never less).
test('every option spot-check record covers its sample with no failures', () => {
  const problems: string[] = [];
  const records = existsSync(REVIEW) ? readdirSync(REVIEW).filter((f) => f.endsWith('.md')) : [];
  for (const file of records) {
    const shard = basename(file, '.md');
    const expected = optionSample(texts, shard).map((t) => t.key);
    if (!expected.length) problems.push(`${shard}: owns no option texts`);
    const found = rows(readFileSync(join(REVIEW, file), 'utf8'));
    const keys = new Set(found.map((r) => r.key));
    const missing = expected.filter((k) => !keys.has(k));
    if (missing.length) problems.push(`${shard}: sample keys not reviewed: ${missing.join(', ')}`);
    for (const r of found) if (!/^(PASS|FIXED)$/.test(r.verdict)) problems.push(`${shard}: ${r.key} verdict "${r.verdict}"`);
  }
  expect(problems).toEqual([]);
});

test.todo('every shard with option texts has an option spot-check record (Plan F Task 9 turns this on)');
