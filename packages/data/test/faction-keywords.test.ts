/**
 * overrides/faction-keywords.json against real data (npm run data:build): every root unit of the corpus catalogues
 * that Wahapedia gives the IMPERIUM faction keyword carries a "Faction: Imperium" category once built, so Army Faction
 * and Battle Brothers see it (as the policy does: the unit's categories and its descendants', after modifiers).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { CatalogueOut } from '../src/model/types';
import { FORCE, addUnit, createRoster, evaluate, resolve, rootEntriesFor, type SelView } from '../src/roster';
import { loadWahapedia } from '../src/wahapedia/load';
import { realCatalogueId, realScope } from './helpers/realScope';

const ROOT = join(import.meta.dirname, '..');
const CATALOGUES = [
  'imperium-adeptus-custodes',
  'imperium-adeptus-astartes-ultramarines',
  'imperium-adeptus-astartes-blood-angels',
  'imperium-adepta-sororitas',
  'imperium-astra-militarum',
  'imperium-imperial-knights',
];
const IMPERIUM = 'Faction: Imperium';

const wahapedia = loadWahapedia(join(ROOT, 'raw', 'wahapedia'));
const imperiumDatasheets = new Set(
  wahapedia.datasheetsKeywords.filter((r) => r.is_faction_keyword === 'true' && r.keyword.trim().toLowerCase() === 'imperium').map((r) => r.datasheet_id),
);

describe('Faction: Imperium on every IMPERIUM unit', () => {
  for (const slug of CATALOGUES) {
    test(slug, () => {
      const scope = realScope(slug);
      const catalogueId = realCatalogueId(slug);
      const units = (JSON.parse(readFileSync(join(ROOT, 'generated', 'catalogues', `${slug}.json`), 'utf8')) as CatalogueOut).units;
      const empty = createRoster(scope, { name: 'Faction keywords', catalogueId, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
      const roots = rootEntriesFor(scope, catalogueId);
      const missing: string[] = [];
      let checked = 0;
      for (const u of units) {
        if (!u.wahapediaId || !imperiumDatasheets.has(u.wahapediaId)) continue;
        const root = roots.find((n) => resolve(scope, n).target.id === u.id);
        if (!root) throw new Error(`${slug}: no root entry for "${u.name}"`);
        const { roster, selId } = addUnit(scope, empty, empty.forces[0].id, root.id);
        expect(selId, u.name).not.toBe('');
        const v = evaluate(scope, roster).forces[0].selections.find((s) => s.sel.id === selId)!;
        const names: string[] = [];
        const walk = (s: SelView) => {
          for (const id of s.categories) names.push(scope.category(id)?.name ?? '');
          s.children.forEach(walk);
        };
        walk(v);
        checked++;
        if (!names.includes(IMPERIUM)) missing.push(u.name);
      }
      expect(checked).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });
  }
});
