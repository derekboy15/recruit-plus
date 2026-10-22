/** Loads the generated catalogue JSON (needs `npm run data:build`). Tests only. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueOut, UnitOut } from '@recruit/data/model';

export const CATALOGUES_DIR = join(import.meta.dirname, '../../../data/generated/catalogues');

let cache: CatalogueOut[] | null = null;
export function realCatalogues(): CatalogueOut[] {
  cache ??= readdirSync(CATALOGUES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(CATALOGUES_DIR, f), 'utf8')) as CatalogueOut);
  return cache;
}

export function realUnit(catalogueName: string, unitName: string): { unit: UnitOut; catalogueName: string } {
  const cat = realCatalogues().find((c) => c.name === catalogueName);
  if (!cat) throw new Error(`No catalogue "${catalogueName}"`);
  const unit = cat.units.find((u) => u.name === unitName);
  if (!unit) throw new Error(`No unit "${unitName}" in ${catalogueName}`);
  return { unit, catalogueName };
}
