/** Test-only: builds a roster Scope from generated/ (npm run data:build) for one or more catalogue slugs. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueSummary, DataIndex } from '../../src/model/types';
import type { PolicyData } from '../../src/roster/policy';
import { buildScope, type Scope } from '../../src/roster/scope';
import type { RosterFile } from '../../src/roster/types';

const GENERATED = join(__dirname, '..', '..', 'generated');
const SYSTEM = 'system';

function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`${path} is missing: run npm run data:build`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/**
 * The roster files for a union scope: each catalogue's rosterScope in order (the primary catalogue's first),
 * deduplicated, with the system file last.
 */
export function realFiles(...catalogueSlugs: string[]): RosterFile[] {
  const index = readJson<DataIndex>(join(GENERATED, 'index.json'));
  const slugs: string[] = [];
  for (const slug of catalogueSlugs) {
    const summary = index.catalogues.find((c) => c.slug === slug);
    if (!summary) throw new Error(`No catalogue "${slug}" in generated/index.json: run npm run data:build`);
    for (const s of summary.rosterScope) if (s !== SYSTEM && !slugs.includes(s)) slugs.push(s);
  }
  return [...slugs, SYSTEM].map((s) => readJson<RosterFile>(join(GENERATED, 'roster', `${s}.json`)));
}

/** The primary catalogue's rosterScope first, then each ally's, deduplicated, the system last. */
export function realScope(...catalogueSlugs: string[]): Scope {
  return buildScope(realFiles(...catalogueSlugs));
}

export function realCatalogueId(slug: string): string {
  const summary = realCatalogues().find((c) => c.slug === slug);
  if (!summary) throw new Error(`No catalogue "${slug}" in generated/index.json: run npm run data:build`);
  return summary.id;
}

export function realCatalogues(): CatalogueSummary[] {
  return readJson<DataIndex>(join(GENERATED, 'index.json')).catalogues;
}

export function realPolicy(): PolicyData {
  return readJson<PolicyData>(join(GENERATED, 'roster', 'policy.json'));
}
