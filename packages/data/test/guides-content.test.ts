import { test, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../src/content/markdown';
import type { DataIndex, FactionGuide } from '../src/model/types';

const GEN = join(__dirname, '..', 'generated');
const SRC = join(__dirname, '..', '..', 'content', 'guides');

test('every playable catalogue has exactly one guide', () => {
  if (!existsSync(join(GEN, 'index.json'))) throw new Error('Run npm run data:build first');
  const index: DataIndex = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
  const playable = index.catalogues.filter((c) => !c.library).map((c) => c.slug).sort();
  const built = readdirSync(join(GEN, 'guides')).map((f) => f.replace(/\.json$/, '')).sort();
  expect(built).toEqual(playable);
});

test('each guide is 250–700 words', () => {
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.md'))) {
    const { body } = parseFrontmatter(readFileSync(join(SRC, f), 'utf8'), f);
    const words = body.replace(/^#+ .*$/gm, '').split(/\s+/).filter(Boolean).length;
    expect(words, f).toBeGreaterThanOrEqual(250);
    expect(words, f).toBeLessThanOrEqual(700);
  }
});

test('each guide names at least 3 key units (or every unit of a smaller faction) that resolve', () => {
  const index: DataIndex = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
  for (const f of readdirSync(join(GEN, 'guides'))) {
    const g: FactionGuide = JSON.parse(readFileSync(join(GEN, 'guides', f), 'utf8'));
    const units = index.catalogues.find((c) => c.slug === g.slug)!.unitCount;
    expect(g.keyUnits.length, f).toBeGreaterThanOrEqual(Math.min(3, units));
    for (const k of g.keyUnits) expect(k.unitSlug, `${f}: ${k.name}`).toMatch(/^[a-z0-9-]+$/);
  }
});
