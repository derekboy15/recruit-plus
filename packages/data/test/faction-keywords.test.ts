/**
 * overrides/faction-keywords.json against real data (npm run data:build): every root unit of the Imperium catalogues,
 * and of the Xenos catalogues the corpus has reached, that Wahapedia gives one of the .gst's broad faction keywords
 * (IMPERIUM, ADEPTUS ASTARTES, AELDARI, ...) or a catalogue-level one (GREY KNIGHTS, ADEPTA SORORITAS, DRUKHARI,
 * HARLEQUINS, ...) carries the matching "Faction: …" category once built, so
 * Army Faction and Battle Brothers see it (as the policy does: the unit's categories and its descendants', after
 * modifiers). A catalogue-level keyword is checked where its category is in the catalogue's scope.
 *
 * Not checked: the sub-faction a `<…>` keyword stands for (chapters within Codex: Space Marines, regiments, orders,
 * forge worlds, ordos), BROOD BROTHERS, which Wahapedia lists on Astra Militarum datasheets but a unit only gains
 * in a Genestealer Cults army (03_Codexes/Xenos/Genestealer_Cults.md §3), and YNNARI, which Wahapedia lists on
 * Harlequins and Drukhari datasheets but a unit only gains in a Ynnari detachment (03_Codexes/Xenos/Aeldari.md §3).
 * Wahapedia's ORK is BSData's "Faction: Orks".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { CatalogueOut } from '../src/model/types';
import { FORCE, addUnit, createRoster, evaluate, resolve, rootEntriesFor, type SelView } from '../src/roster';
import { loadWahapedia } from '../src/wahapedia/load';
import { realCatalogueId, realCatalogues, realScope } from './helpers/realScope';

const ROOT = join(import.meta.dirname, '..');
/** The Xenos catalogues the corpus has reached (Task 11 part 1). */
const XENOS = ['aeldari-craftworlds', 'aeldari-drukhari', 'aeldari-harlequins', 'necrons', 'orks'];
const CATALOGUES = [...realCatalogues().filter((c) => c.group === 'Imperium' && !c.library).map((c) => c.slug), ...XENOS];
/** .gst Faction categories whose Wahapedia keyword means the same thing in BSData. */
const KEYWORDS = ['Imperium', 'Adeptus Astartes', 'Adeptus Mechanicus', 'Astra Militarum', 'Agents of the Imperium', 'Imperial Knights', 'Officio Assassinorum', 'Aeldari'];
/** Catalogue-level faction keywords: a catalogue's own Faction categories (or a linked catalogue's) of that name. */
const CATALOGUE_KEYWORDS = [
  'Adepta Sororitas', 'Adeptus Ministorum', 'Adeptus Custodes', 'Anathema Psykana', 'Grey Knights', 'Sanctic Astartes',
  'Inquisition', 'Adeptus Arbites', 'Adeptus Titanicus', 'Astra Telepathica', 'Legion of the Damned', 'Questor Imperialis',
  'Questor Mechanicus', 'Cult Mechanicus', 'Skitarii', 'Militarum Tempestus', 'Blood Angels', 'Dark Angels', 'Space Wolves',
  'Black Templars', 'Deathwatch', 'Asuryani', 'Drukhari', 'Harlequins', 'Incubi', 'Necrons', 'Orks',
];
/** Wahapedia keywords BSData names differently. */
const ALIASES: Record<string, string> = { ork: 'Orks' };

const wahapedia = loadWahapedia(join(ROOT, 'raw', 'wahapedia'));
const datasheetKeywords = new Map<string, Set<string>>();
for (const r of wahapedia.datasheetsKeywords) {
  if (r.is_faction_keyword !== 'true') continue;
  const name = r.keyword.trim().toLowerCase();
  const keyword = ALIASES[name] ?? [...KEYWORDS, ...CATALOGUE_KEYWORDS].find((k) => k.toLowerCase() === name);
  if (keyword) (datasheetKeywords.get(r.datasheet_id) ?? datasheetKeywords.set(r.datasheet_id, new Set()).get(r.datasheet_id)!).add(keyword);
}

describe('broad and catalogue-level faction keywords on every unit Wahapedia gives them', () => {
  for (const slug of CATALOGUES) {
    test(slug, () => {
      const scope = realScope(slug);
      const catalogueId = realCatalogueId(slug);
      const units = (JSON.parse(readFileSync(join(ROOT, 'generated', 'catalogues', `${slug}.json`), 'utf8')) as CatalogueOut).units;
      const empty = createRoster(scope, { name: 'Faction keywords', catalogueId, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
      const roots = rootEntriesFor(scope, catalogueId);
      const inScope = new Set(scope.files.flatMap((f) => (f.categories ?? []).map((c) => c.name)));
      const missing: string[] = [];
      let checked = 0;
      for (const u of units) {
        const wanted = [...((u.wahapediaId && datasheetKeywords.get(u.wahapediaId)) || [])].filter((k) => KEYWORDS.includes(k) || inScope.has(`Faction: ${k}`));
        if (!wanted.length) continue;
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
