/**
 * Compiles packages/content (rules articles, glossary, guides) against the last data build without writing anything,
 * and prints what it found. Safe to run while someone else is building.
 *   npm run content:check
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContent } from '../src/content/build';
import type { CatalogueOut, DataIndex } from '../src/model/types';

const root = join(import.meta.dirname, '..');
const gen = join(root, 'generated');
const index: DataIndex = JSON.parse(readFileSync(join(gen, 'index.json'), 'utf8'));
const cats: CatalogueOut[] = index.catalogues.map((c) => JSON.parse(readFileSync(join(gen, 'catalogues', `${c.slug}.json`), 'utf8')));
const { rules, guides } = buildContent(join(root, '..', 'content'), cats);

for (const a of rules.articles) {
  const words = a.sections.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  console.log(`${a.order}. ${a.id} (${words} words): ${a.sections.map((s) => s.id).join(', ')}`);
}
console.log(`glossary: ${rules.glossary.length} terms`);
console.log(`guides: ${guides.length} (${guides.map((g) => g.slug).join(', ')})`);
