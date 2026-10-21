/** Test-only: builds a roster Scope from generated/ (npm run data:build) for one or more catalogue slugs. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataIndex } from '../../src/model/types';
import { buildScope, type Scope } from '../../src/roster/scope';
import type { RosterFile } from '../../src/roster/types';

const GENERATED = join(__dirname, '..', '..', 'generated');

function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`${path} is missing: run npm run data:build`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** The primary catalogue's rosterScope first, then each ally's, deduplicated. */
export function realScope(...catalogueSlugs: string[]): Scope {
  const index = readJson<DataIndex>(join(GENERATED, 'index.json'));
  const slugs: string[] = [];
  for (const slug of catalogueSlugs) {
    const summary = index.catalogues.find((c) => c.slug === slug);
    if (!summary) throw new Error(`No catalogue "${slug}" in generated/index.json: run npm run data:build`);
    for (const s of summary.rosterScope) if (!slugs.includes(s)) slugs.push(s);
  }
  return buildScope(slugs.map((s) => readJson<RosterFile>(join(GENERATED, 'roster', `${s}.json`))));
}

export function realCatalogueId(slug: string): string {
  const summary = readJson<DataIndex>(join(GENERATED, 'index.json')).catalogues.find((c) => c.slug === slug);
  if (!summary) throw new Error(`No catalogue "${slug}" in generated/index.json: run npm run data:build`);
  return summary.id;
}
