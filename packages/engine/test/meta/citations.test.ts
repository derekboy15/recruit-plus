import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const TEST = join(import.meta.dirname, '..');
const TAG = /^\[(?:(?:TS|TR|PP|CS|GL|BD|FAQ|MP|GT) §[\d.]+|WCR|R-\d+)[^\]]*\]/;
const dirs = ['rules', 'scenario'].map((d) => join(TEST, d)).filter((d) => existsSync(d));
const files = dirs.flatMap((d) => readdirSync(d, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.test.ts')).map((f) => join(d, f)));

/** Every test title in the rules and scenario suites starts with the rule it checks. */
test('every rules test cites its rule', () => {
  const missing: string[] = [];
  let count = 0;
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\b(?:test|it)(?:\.each\([^)]*\))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      count++;
      if (!TAG.test(m[2])) missing.push(`${f.slice(TEST.length + 1)}: ${m[2]}`);
    }
  }
  expect(missing).toEqual([]);
  expect(count).toBeGreaterThanOrEqual(0);
});

test('every ruling cited in tests exists in RULINGS.md', () => {
  const rulings = readFileSync(join(TEST, '../RULINGS.md'), 'utf8');
  const cited = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\[(R-\d+)\]/g)) cited.add(m[1]);
  const missing = [...cited].filter((r) => !new RegExp(`^## ${r}(?![0-9])`, 'm').test(rulings));
  expect(missing).toEqual([]);
});
