import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';

const SRC = join(import.meta.dirname, '../../src');
const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.split(String.fromCharCode(92)).join('/'));
const FORBIDDEN: [string, RegExp][] = [
  ['node: imports', /from ['"]node:/],
  ['Math.random', /Math\.random/],
  ['Date', /\bnew Date\b|\bDate\./],
  ['crypto', /\bcrypto\./],
];

test('the engine core is pure: no node:, Math.random, Date or crypto in src/', () => {
  const hits: string[] = [];
  for (const f of files) {
    const text = readFileSync(join(SRC, f), 'utf8');
    for (const [name, re] of FORBIDDEN) if (re.test(text)) hits.push(`${f}: ${name}`);
  }
  expect(hits).toEqual([]);
});

test('only src/data imports @recruit/data', () => {
  const hits = files.filter((f) => !f.startsWith('data/') && /@recruit\/data/.test(readFileSync(join(SRC, f), 'utf8')));
  expect(hits.map((f) => relative('.', f))).toEqual([]);
});
