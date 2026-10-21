/** CLI + library: BSData + Wahapedia -> generated/{index.json, catalogues/<slug>.json, roster/<slug>.json, report.json}. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogueScope, isPlayableCatalogue, loadGameData } from './bsdata/gamedata';
import type { RawCatalogue, RawNode } from './bsdata/types';
import { extractUnits } from './extract/units';
import { joinWahapedia, loadOverrides } from './join/wahapedia';
import { emitRosterFile } from './roster/emit';
import { BATTLEFIELD_ROLES, type CatalogueOut, type DataIndex, type UnitOut } from './model/types';
import { slugify } from './text';
import { loadWahapedia } from './wahapedia/load';

export interface BuildOptions {
  rawDir: string;
  overridesDir: string;
  outDir: string;
}

export interface ReportEntry {
  units: number;
  matched: number;
  unmatched: string[];
  unitsWithoutProfiles: string[];
}

function catalogueRules(cat: RawCatalogue): CatalogueOut['rules'] {
  const containers = cat.root.children.filter((c) => c.tag === 'sharedRules' || c.tag === 'rules');
  return containers
    .flatMap((c) => c.children)
    .filter((r: RawNode) => r.tag === 'rule' && r.attrs.hidden !== 'true')
    .map((r) => ({
      id: r.attrs.id,
      name: r.attrs.name,
      text: r.children.find((c) => c.tag === 'description')?.text ?? '',
    }));
}

/** The .gst's roster file is always `system`. */
export const SYSTEM_ROSTER_SLUG = 'system';

const roleOrder = (u: UnitOut) => (u.role ? BATTLEFIELD_ROLES.indexOf(u.role) : BATTLEFIELD_ROLES.length);

export function buildAll(opts: BuildOptions): { index: DataIndex; report: Record<string, ReportEntry> } {
  const gd = loadGameData(join(opts.rawDir, 'bsdata'));
  const w = loadWahapedia(join(opts.rawDir, 'wahapedia'));
  const overrides = loadOverrides(opts.overridesDir);
  mkdirSync(join(opts.outDir, 'catalogues'), { recursive: true });

  const index: DataIndex = {
    generatedAt: new Date().toISOString(),
    sources: { bsdata: 'v9.8.0', wahapediaLastUpdate: w.lastUpdate },
    catalogues: [],
  };
  const report: Record<string, ReportEntry> = {};

  const catalogues = [...gd.catalogues.values()].sort((a, b) => a.name.localeCompare(b.name));
  const rosterSlug = (c: RawCatalogue) => (c === gd.system ? SYSTEM_ROSTER_SLUG : slugify(c.name));
  for (const cat of catalogues) {
    const slug = slugify(cat.name);
    const faction = overrides.factionMap[cat.name];
    if (!faction) throw new Error(`No faction-map entry for catalogue "${cat.name}"`);
    const joined = joinWahapedia(extractUnits(gd, cat.id), cat.name, w, overrides);
    const units = [...joined.units].sort((a, b) => roleOrder(a) - roleOrder(b) || a.name.localeCompare(b.name));
    const out: CatalogueOut = {
      id: cat.id,
      slug,
      name: cat.name,
      group: faction.group,
      library: !isPlayableCatalogue(cat, overrides.playableCatalogues),
      units,
      rules: catalogueRules(cat),
    };
    writeFileSync(join(opts.outDir, 'catalogues', `${slug}.json`), JSON.stringify(out));
    index.catalogues.push({
      id: cat.id,
      slug,
      name: cat.name,
      group: faction.group,
      library: out.library,
      unitCount: units.length,
      rosterScope: catalogueScope(gd, cat.id).map(rosterSlug),
    });
    report[slug] = {
      units: units.length,
      matched: units.length - joined.unmatched.length,
      unmatched: joined.unmatched,
      unitsWithoutProfiles: units.filter((u) => u.models.length === 0).map((u) => u.name),
    };
  }

  mkdirSync(join(opts.outDir, 'roster'), { recursive: true });
  const rosterSources = [...catalogues, gd.system];
  for (const o of overrides.costs) {
    if (!rosterSources.some((c) => c.name === o.catalogueName)) throw new Error(`Cost override names unknown catalogue "${o.catalogueName}"`);
  }
  for (const cat of rosterSources) {
    const slug = rosterSlug(cat);
    writeFileSync(join(opts.outDir, 'roster', `${slug}.json`), JSON.stringify(emitRosterFile(cat, slug, overrides.costs)));
  }

  writeFileSync(join(opts.outDir, 'index.json'), JSON.stringify(index, null, 2));
  writeFileSync(join(opts.outDir, 'report.json'), JSON.stringify(report, null, 2));
  return { index, report };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = join(import.meta.dirname, '..');
  const started = Date.now();
  const { index, report } = buildAll({
    rawDir: join(root, 'raw'),
    overridesDir: join(root, 'overrides'),
    outDir: join(root, 'generated'),
  });
  const totals = Object.values(report).reduce((a, r) => ({ u: a.u + r.units, m: a.m + r.matched }), { u: 0, m: 0 });
  console.log(
    `Built ${index.catalogues.length} catalogues, ${totals.u} units (${totals.m} matched to Wahapedia) in ${Date.now() - started} ms`,
  );
}
