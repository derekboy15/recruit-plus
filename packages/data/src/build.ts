/** CLI + library: BSData + Wahapedia -> generated/{index.json, catalogues/<slug>.json, core-stratagems.json, roster/<slug>.json, roster/policy.json, report.json}. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogueScope, isPlayableCatalogue, loadGameData } from './bsdata/gamedata';
import type { RawCatalogue, RawNode } from './bsdata/types';
import { coreStratagems, selectStratagems } from './extract/stratagems';
import { extractUnits } from './extract/units';
import { joinWahapedia, loadOverrides, type Overrides } from './join/wahapedia';
import { emitRosterFile } from './roster/emit';
import { buildScope, resolve, rootEntriesFor } from './roster/scope';
import type { AooAllies, BattleBrothers, DatasheetEquivalence, MustBeWarlord, PolicyData } from './roster/policy';
import type { RosterFile } from './roster/types';
import { BATTLEFIELD_ROLES, type CatalogueOut, type DataIndex, type UnitOut } from './model/types';
import { slugify, titleCase } from './text';
import { loadWahapedia, type Wahapedia } from './wahapedia/load';

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
  stratagems: number;
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

/** Category names by id in these files, the first definition of an id winning. */
function categoryNamesById(files: RawCatalogue[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of files) {
    for (const c of f.root.children.find((n) => n.tag === 'categoryEntries')?.children ?? []) if (!out.has(c.attrs.id)) out.set(c.attrs.id, c.attrs.name);
  }
  return out;
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
  const playable = new Set(catalogues.filter((c) => isPlayableCatalogue(c, overrides.playableCatalogues)).map((c) => c.name));
  validateStratagemOverrides(w, overrides, playable);
  const excludedStratagems = new Set(overrides.excludedStratagems.map((e) => e.id));
  const stratagemFaction = new Map(overrides.stratagemFactions.map((e) => [e.catalogueName, e]));
  const rosterSlug = (c: RawCatalogue) => (c === gd.system ? SYSTEM_ROSTER_SLUG : slugify(c.name));
  for (const cat of catalogues) {
    const slug = slugify(cat.name);
    const faction = overrides.factionMap[cat.name];
    if (!faction) throw new Error(`No faction-map entry for catalogue "${cat.name}"`);
    const joined = joinWahapedia(extractUnits(gd, cat.id), cat.name, w, overrides);
    const units = [...joined.units].sort((a, b) => roleOrder(a) - roleOrder(b) || a.name.localeCompare(b.name));
    const library = !playable.has(cat.name);
    const out: CatalogueOut = {
      id: cat.id,
      slug,
      name: cat.name,
      group: faction.group,
      library,
      units,
      rules: catalogueRules(cat),
      stratagems: library ? [] : selectStratagems(w, stratagemFaction.get(cat.name)!, excludedStratagems, overrides.stratagemDetails),
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
      factions: [], // filled in once the roster files exist
    });
    report[slug] = {
      units: units.length,
      matched: units.length - joined.unmatched.length,
      unmatched: joined.unmatched,
      unitsWithoutProfiles: units.filter((u) => u.models.length === 0).map((u) => u.name),
      stratagems: out.stratagems.length,
    };
  }
  writeFileSync(join(opts.outDir, 'core-stratagems.json'), JSON.stringify(coreStratagems(w, overrides.coreStratagems.map((c) => c.id))));

  mkdirSync(join(opts.outDir, 'roster'), { recursive: true });
  const rosterSources = [...catalogues, gd.system];
  for (const [file, list] of [['costs.json', overrides.costs], ['faction-keywords.json', overrides.factionKeywords], ['constraints.json', overrides.constraints], ['add-constraints.json', overrides.addedConstraints]] as const) {
    for (const o of list) if (!rosterSources.some((c) => c.name === o.catalogueName)) throw new Error(`${file} names unknown catalogue "${o.catalogueName}"`);
  }
  // The .gst's category ids by name: faction-keywords.json links units to its "Faction: …" categories.
  const systemCategories = new Map<string, string>();
  for (const c of gd.system.root.children.find((n) => n.tag === 'categoryEntries')?.children ?? []) {
    if (!systemCategories.has(c.attrs.name)) systemCategories.set(c.attrs.name, c.attrs.id);
  }
  const rosterFiles: RosterFile[] = [];
  for (const cat of rosterSources) {
    const slug = rosterSlug(cat);
    const scopeCategories = categoryNamesById(cat === gd.system ? [gd.system] : catalogueScope(gd, cat.id));
    const file = emitRosterFile(cat, slug, { costs: overrides.costs, factionKeywords: overrides.factionKeywords, constraints: overrides.constraints, addedConstraints: overrides.addedConstraints, systemCategories, scopeCategories });
    rosterFiles.push(file);
    writeFileSync(join(opts.outDir, 'roster', `${slug}.json`), JSON.stringify(file));
  }
  writeFileSync(join(opts.outDir, 'roster', 'policy.json'), JSON.stringify(loadPolicy(opts.overridesDir, rosterFiles)));
  for (const summary of index.catalogues) summary.factions = catalogueFactions(rosterFiles, summary.rosterScope, summary.id);

  writeFileSync(join(opts.outDir, 'index.json'), JSON.stringify(index, null, 2));
  writeFileSync(join(opts.outDir, 'report.json'), JSON.stringify(report, null, 2));
  return { index, report };
}

/**
 * The "Faction: …" category names on a catalogue's root entries and those of the catalogues it imports, sorted. The
 * .gst's own root entries (fortifications every army may take, a Chaos Bastion among them) are left out.
 */
function catalogueFactions(files: RosterFile[], rosterScope: string[], catalogueId: string): string[] {
  const scope = buildScope(rosterScope.flatMap((slug) => files.filter((f) => f.slug === slug)));
  const systemRoots = new Set(scope.system.rootEntries);
  const names = new Set<string>();
  for (const n of rootEntriesFor(scope, catalogueId)) {
    if (systemRoots.has(n)) continue;
    for (const link of resolve(scope, n).cats) {
      const name = scope.category(link.targetId)?.name;
      if (name?.startsWith('Faction: ')) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Checks the stratagem overrides against the Wahapedia snapshot and the playable catalogue names: one
 * stratagem-factions.json entry per playable catalogue, known faction and subfaction ids (a subfaction's parent_id is the
 * entry's faction), `groups` that each name a group the entry would otherwise list, and known stratagem ids whose
 * title-cased name matches in stratagems.json, stratagem-details.json (whose subfaction must be a child of the
 * stratagem's faction) and core-stratagems.json.
 */
export function validateStratagemOverrides(
  w: Wahapedia,
  o: Pick<Overrides, 'stratagemFactions' | 'excludedStratagems' | 'stratagemDetails' | 'coreStratagems'>,
  playable: Set<string>,
): void {
  const factions = new Map(w.factions.map((f) => [f.id, f]));
  const seen = new Set<string>();
  for (const e of o.stratagemFactions) {
    const where = `stratagem-factions.json (${e.catalogueName})`;
    if (!playable.has(e.catalogueName)) throw new Error(`stratagem-factions.json names unknown catalogue "${e.catalogueName}" (or a library)`);
    if (seen.has(e.catalogueName)) throw new Error(`${where} is listed twice`);
    seen.add(e.catalogueName);
    if (!factions.has(e.factionId)) throw new Error(`${where} names unknown faction "${e.factionId}"`);
    if (e.subfactions === 'all') continue;
    for (const sub of e.subfactions) {
      if (factions.get(sub)?.parent_id !== e.factionId) throw new Error(`${where} names unknown subfaction "${sub}" of "${e.factionId}"`);
    }
  }
  const excluded = new Set(o.excludedStratagems.map((x) => x.id));
  for (const e of o.stratagemFactions.filter((x) => x.groups)) {
    const present = new Set(selectStratagems(w, { ...e, groups: undefined }, excluded, o.stratagemDetails).map((s) => s.group));
    for (const g of e.groups!) if (!present.has(g)) throw new Error(`stratagem-factions.json (${e.catalogueName}) names unknown group "${g}"`);
  }
  for (const name of playable) if (!seen.has(name)) throw new Error(`no stratagem-factions entry for catalogue "${name}"`);
  const byId = new Map(w.stratagems.map((s) => [s.id, s]));
  for (const [file, list] of [['stratagems.json', o.excludedStratagems], ['stratagem-details.json', o.stratagemDetails], ['core-stratagems.json', o.coreStratagems]] as const) {
    for (const e of list) {
      const row = byId.get(e.id);
      if (!row) throw new Error(`${file} names unknown stratagem "${e.id}"`);
      if (titleCase(row.name) !== e.name) throw new Error(`${file}: stratagem ${e.id} is "${titleCase(row.name)}", not "${e.name}"`);
    }
  }
  for (const d of o.stratagemDetails) {
    const row = byId.get(d.id)!;
    if (!d.group && !d.subfactionId) throw new Error(`stratagem-details.json (${d.id}) sets neither group nor subfactionId`);
    if (d.subfactionId && factions.get(d.subfactionId)?.parent_id !== row.faction_id) {
      throw new Error(`stratagem-details.json (${d.id}) names unknown subfaction "${d.subfactionId}" of "${row.faction_id}"`);
    }
  }
}

/**
 * The matched-play policy overrides, copied for the browser after checking every name and id against the roster files
 * (catalogue names, .gst force entry names, faction category names, Rule of Two/Three entries and categories, Battle
 * Brothers exceptions, units that must be the Warlord).
 */
export function loadPolicy(overridesDir: string, files: RosterFile[]): PolicyData {
  const read = <T>(f: string): T => JSON.parse(readFileSync(join(overridesDir, f), 'utf8')) as T;
  const aooAllies = read<AooAllies[]>('aoo-allies.json');
  const equivalence = read<DatasheetEquivalence[]>('datasheet-equivalence.json');
  const battleBrothers = read<BattleBrothers[]>('battle-brothers.json');
  const mustBeWarlord = read<MustBeWarlord[]>('must-be-warlord.json');
  const system = files.find((f) => f.slug === SYSTEM_ROSTER_SLUG)!;
  const byName = new Map(files.filter((f) => f !== system).map((f) => [f.name, f]));
  const categoryNames = new Set(files.flatMap((f) => f.categories.map((c) => c.name)));
  const catalogue = (name: string, where: string): RosterFile => {
    const f = byName.get(name);
    if (!f) throw new Error(`${where} names unknown catalogue "${name}"`);
    return f;
  };
  for (const a of aooAllies) {
    catalogue(a.catalogueName, 'aoo-allies.json');
    for (const ally of a.allies) {
      const where = `aoo-allies.json (${a.catalogueName})`;
      catalogue(ally.catalogueName, where);
      for (const d of ally.detachments) if (!system.forces.some((f) => f.name === d)) throw new Error(`${where} names unknown detachment "${d}"`);
      for (const c of ally.onlyFactions ?? []) if (!categoryNames.has(c)) throw new Error(`${where} names unknown category "${c}"`);
    }
  }
  for (const e of equivalence) {
    const where = `datasheet-equivalence.json (${e.name})`;
    if (e.categoryName && !categoryNames.has(e.categoryName)) throw new Error(`${where} names unknown category "${e.categoryName}"`);
    for (const x of e.entries ?? []) {
      const root = catalogue(x.catalogueName, where).rootEntries.find((n) => n.name === x.entryName);
      if (!root || (root.targetId ?? root.id) !== x.entryId) throw new Error(`${where}: "${x.entryName}" is not root entry ${x.entryId} in "${x.catalogueName}"`);
    }
  }
  for (const b of battleBrothers) {
    const where = `battle-brothers.json (${b.catalogueName})`;
    catalogue(b.catalogueName, where);
    for (const f of b.alsoAllowFactions) if (!categoryNames.has(`Faction: ${f}`)) throw new Error(`${where} names unknown category "Faction: ${f}"`);
  }
  // A unit's name is its target entry's (a root link's own name can differ: "!Captain-General Trajann Valoris").
  const entryNames = new Map(files.flatMap((f) => [...f.rootEntries, ...f.shared].map((n) => [n.id, n.name.trim()] as const)));
  for (const m of mustBeWarlord) {
    const where = `must-be-warlord.json (${m.entryName})`;
    const root = catalogue(m.catalogueName, where).rootEntries.find((n) => (n.targetId ?? n.id) === m.entryId);
    if (!root || entryNames.get(m.entryId) !== m.entryName) throw new Error(`${where}: "${m.entryName}" is not root entry ${m.entryId} in "${m.catalogueName}"`);
  }
  return { aooAllies, equivalence, battleBrothers, mustBeWarlord };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = join(import.meta.dirname, '..');
  const started = Date.now();
  const { index, report } = buildAll({
    rawDir: join(root, 'raw'),
    overridesDir: join(root, 'overrides'),
    outDir: join(root, 'generated'),
  });
  const totals = Object.values(report).reduce((a, r) => ({ u: a.u + r.units, m: a.m + r.matched, s: a.s + r.stratagems }), { u: 0, m: 0, s: 0 });
  console.log(
    `Built ${index.catalogues.length} catalogues, ${totals.u} units (${totals.m} matched to Wahapedia), ${totals.s} stratagems in ${Date.now() - started} ms`,
  );
}
