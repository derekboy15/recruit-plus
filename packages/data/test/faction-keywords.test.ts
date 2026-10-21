/**
 * overrides/faction-keywords.json against real data (npm run data:build): every root unit of the Imperium catalogues
 * that Wahapedia gives one of the .gst's broad faction keywords (IMPERIUM, ADEPTUS ASTARTES, ...) carries the matching
 * "Faction: …" category once built, so Army Faction and Battle Brothers see it (as the policy does: the unit's
 * categories and its descendants', after modifiers).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { CatalogueOut } from '../src/model/types';
import { FORCE, addUnit, createRoster, evaluate, resolve, rootEntriesFor, type SelView } from '../src/roster';
import { loadWahapedia } from '../src/wahapedia/load';
import { realCatalogueId, realCatalogues, realScope } from './helpers/realScope';

const ROOT = join(import.meta.dirname, '..');
const CATALOGUES = realCatalogues().filter((c) => c.group === 'Imperium' && !c.library).map((c) => c.slug);
/** .gst Faction categories whose Wahapedia keyword means the same thing in BSData. */
const KEYWORDS = ['Imperium', 'Adeptus Astartes', 'Adeptus Mechanicus', 'Astra Militarum', 'Agents of the Imperium', 'Imperial Knights'];

const wahapedia = loadWahapedia(join(ROOT, 'raw', 'wahapedia'));
const datasheetKeywords = new Map<string, Set<string>>();
for (const r of wahapedia.datasheetsKeywords) {
  if (r.is_faction_keyword !== 'true') continue;
  const keyword = KEYWORDS.find((k) => k.toLowerCase() === r.keyword.trim().toLowerCase());
  if (keyword) (datasheetKeywords.get(r.datasheet_id) ?? datasheetKeywords.set(r.datasheet_id, new Set()).get(r.datasheet_id)!).add(keyword);
}

describe('broad faction keywords on every unit Wahapedia gives them', () => {
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
        const wanted = u.wahapediaId ? datasheetKeywords.get(u.wahapediaId) : undefined;
        if (!wanted) continue;
        const root = roots.find((n) => resolve(scope, n).target.id === u.id);
        if (!root) throw new Error(`${slug}: no root entry for "${u.name}"`);
        const { roster, selId } = addUnit(scope, empty, empty.forces[0].id, root.id);
        expect(selId, u.name).not.toBe('');
        const v = evaluate(scope, roster).forces[0].selections.find((s) => s.sel.id === selId)!;
        const names = new Set<string>();
        const walk = (s: SelView) => {
          for (const id of s.categories) names.add(scope.category(id)?.name ?? '');
          s.children.forEach(walk);
        };
        walk(v);
        checked++;
        for (const k of wanted) if (!names.has(`Faction: ${k}`)) missing.push(`${u.name}: ${k}`);
      }
      expect(checked).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });
  }
});
