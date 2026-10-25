/** CLI + library: BSData + Wahapedia (+ packages/content plain English) -> generated/{index.json, catalogues/<slug>.json, core-stratagems.json, plain-report.json, missions.json, missions-report.json, rules.json, lessons.json, guides/<slug>.json, roster/<slug>.json, roster/policy.json, info/<slug>.json, points-report.json, report.json}. */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogueScope, isPlayableCatalogue, loadGameData } from './bsdata/gamedata';
import type { RawCatalogue, RawNode } from './bsdata/types';
import { coreStratagems, selectStratagems } from './extract/stratagems';
import { applyPlain, loadPlainStore, type CoverageReport } from './plain/store';
import { buildContent } from './content/build';
import { extractUnits } from './extract/units';
import { attachInfoPlain, attachOptionStratagems, emitInfoFile, infoTextKeys, optionTierOf, TIER_NAMES, type InfoPlainReport } from './info';
import { writeMissions, type MissionsReport } from './missions/build';
import { applyEnginePoints, type PointsDisagreement } from './join/points';
import { joinWahapedia, loadOverrides, type Overrides } from './join/wahapedia';
import { emitRosterFile, gearIds } from './roster/emit';
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
  /** packages/content: plain-English texts are read from <contentDir>/plain. Without it no plain English is attached. */
  contentDir?: string;
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

/** An army rule BSData carries that isn't a current 9th Edition rule (an 8th-edition leftover, a page reference, an empty entry). */
export interface RuleExclusion {
  catalogueName: string;
  name: string;
  /** Only the row with this BSData id, when the catalogue has several rules of that name (an empty duplicate). */
  id?: string;
  reason: string;
  source: string;
}

/** The catalogue's rules without its excluded ones; throws if an exclusion matches nothing or lacks a reason or source. */
export function excludeRules(catalogueName: string, rules: CatalogueOut['rules'], exclusions: RuleExclusion[]): CatalogueOut['rules'] {
  const own = exclusions.filter((x) => x.catalogueName === catalogueName);
  const hits = (x: RuleExclusion, r: CatalogueOut['rules'][number]) => r.name === x.name && (!x.id || r.id === x.id);
  for (const x of own) {
    if (!x.reason || !x.source) throw new Error(`rule-exclusions.json: ${catalogueName} "${x.name}" needs a reason and a source`);
    if (!rules.some((r) => hits(x, r))) {
      throw new Error(`rule-exclusions.json: ${catalogueName} has no army rule "${x.name}"${x.id ? ` with id ${x.id}` : ''}`);
    }
  }
  return rules.filter((r) => !own.some((x) => hits(x, r)));
}

/** The .gst's roster file is always `system`. */
export const SYSTEM_ROSTER_SLUG = 'system';

const roleOrder = (u: UnitOut) => (u.role ? BATTLEFIELD_ROLES.indexOf(u.role) : BATTLEFIELD_ROLES.length);

/** Units whose points the roster engine set, and how many of those differ from Wahapedia's. */
export interface PointsSummary {
  priced: number;
  differ: number;
}

export interface InfoSummary {
  files: number;
  entries: number;
  plain: InfoPlainReport;
}

export function buildAll(opts: BuildOptions): { index: DataIndex; report: Record<string, ReportEntry>; plain: CoverageReport; missions: MissionsReport; info: InfoSummary; points: PointsSummary } {
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
  const amendments: Amendment[] = JSON.parse(readFileSync(join(opts.overridesDir, 'amendments.json'), 'utf8'));
  const ruleExclusions: RuleExclusion[] = JSON.parse(readFileSync(join(opts.overridesDir, 'rule-exclusions.json'), 'utf8'));
  for (const x of ruleExclusions) if (!catalogues.some((c) => c.name === x.catalogueName)) throw new Error(`rule-exclusions.json names unknown catalogue "${x.catalogueName}"`);
  validateAmendments(amendments, new Set(catalogues.map((c) => c.name)));
  const amendmentTotals = new Map<Amendment, number>();
  const outs: CatalogueOut[] = [];
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
      rules: excludeRules(cat.name, catalogueRules(cat), ruleExclusions.filter((x) => x.catalogueName === cat.name)),
      stratagems: library ? [] : selectStratagems(w, stratagemFaction.get(cat.name)!, excludedStratagems, overrides.stratagemDetails),
    };
    for (const [a, n] of applyAmendments(out, amendments.filter((a) => a.catalogueName === cat.name || a.catalogueName === '*'))) {
      amendmentTotals.set(a, (amendmentTotals.get(a) ?? 0) + n);
    }
    outs.push(out);
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
  checkSelectorMatches(amendments, amendmentTotals);
  const core = coreStratagems(w, overrides.coreStratagems.map((c) => c.id));
  // Plain English is attached after amendments: a text's key covers its amendment.
  const plainStore = loadPlainStore(opts.contentDir ? join(opts.contentDir, 'plain') : '');
  // Info files: what every army-building option is and does, one per roster file. Their texts keep their plain
  // English entries from being reported as orphans.
  const rosterSources = [...catalogues, gd.system];
  const infoFiles = rosterSources.map((cat) => emitInfoFile(gd, cat, rosterSlug(cat)));
  // Marker options with no text anywhere in BattleScribe get the Stratagem they buy (before plain English is matched).
  attachOptionStratagems(infoFiles, overrides.optionStratagems, outs, (name) => {
    const cat = rosterSources.find((c) => c.name === name);
    if (!cat) throw new Error(`option-stratagems.json names unknown catalogue "${name}"`);
    return rosterSlug(cat);
  });
  const plain = applyPlain(outs, core, plainStore, infoTextKeys(infoFiles));
  writeFileSync(join(opts.outDir, 'core-stratagems.json'), JSON.stringify(core));
  const missions = writeMissions(opts, w);
  // Rules Reference and faction guides (none without a content directory).
  const content = opts.contentDir
    ? buildContent(opts.contentDir, outs, new Set(core.map((c) => `strat-${c.id}`)))
    : { rules: { articles: [], glossary: [] }, guides: [], lessons: { lessons: [] } };
  writeFileSync(join(opts.outDir, 'rules.json'), JSON.stringify(content.rules));
  writeFileSync(join(opts.outDir, 'lessons.json'), JSON.stringify(content.lessons));
  rmSync(join(opts.outDir, 'guides'), { recursive: true, force: true });
  mkdirSync(join(opts.outDir, 'guides'), { recursive: true });
  for (const g of content.guides) writeFileSync(join(opts.outDir, 'guides', `${g.slug}.json`), JSON.stringify(g));

  mkdirSync(join(opts.outDir, 'roster'), { recursive: true });
  for (const [file, list] of [['costs.json', overrides.costs], ['faction-keywords.json', overrides.factionKeywords], ['constraints.json', overrides.constraints], ['add-constraints.json', overrides.addedConstraints], ['modifier-removals.json', overrides.modifierRemovals]] as const) {
    for (const o of list) if (!rosterSources.some((c) => c.name === o.catalogueName)) throw new Error(`${file} names unknown catalogue "${o.catalogueName}"`);
  }
  // The .gst's category ids by name: faction-keywords.json links units to its "Faction: …" categories.
  const systemCategories = new Map<string, string>();
  for (const c of gd.system.root.children.find((n) => n.tag === 'categoryEntries')?.children ?? []) {
    if (!systemCategories.has(c.attrs.name)) systemCategories.set(c.attrs.name, c.attrs.id);
  }
  const rosterFiles: RosterFile[] = [];
  // Weapon profiles are often in a library or the .gst: which entries carry one is worked out across every file.
  const gear = gearIds(rosterSources);
  for (const cat of rosterSources) {
    const slug = rosterSlug(cat);
    const scopeCategories = categoryNamesById(cat === gd.system ? [gd.system] : catalogueScope(gd, cat.id));
    const file = emitRosterFile(cat, slug, { costs: overrides.costs, factionKeywords: overrides.factionKeywords, constraints: overrides.constraints, addedConstraints: overrides.addedConstraints, modifierRemovals: overrides.modifierRemovals, systemCategories, scopeCategories, gearIds: gear });
    rosterFiles.push(file);
    writeFileSync(join(opts.outDir, 'roster', `${slug}.json`), JSON.stringify(file));
  }
  writeFileSync(join(opts.outDir, 'roster', 'policy.json'), JSON.stringify(loadPolicy(opts.overridesDir, rosterFiles)));

  rmSync(join(opts.outDir, 'info'), { recursive: true, force: true });
  mkdirSync(join(opts.outDir, 'info'), { recursive: true });
  const infoPlain = attachInfoPlain(infoFiles, plainStore, optionTierOf(rosterFiles));
  for (const f of infoFiles) writeFileSync(join(opts.outDir, 'info', `${f.slug}.json`), JSON.stringify(f));
  // One coverage report: the pages' texts, then the option texts by owning shard (info-plain-report.json, Plan D's, is gone).
  const coverage: CoverageReport = { ...plain, options: infoPlain.shards };
  writeFileSync(join(opts.outDir, 'plain-report.json'), JSON.stringify(coverage, null, 2));
  rmSync(join(opts.outDir, 'info-plain-report.json'), { force: true });
  const info: InfoSummary = { files: infoFiles.length, entries: infoFiles.reduce((n, f) => n + Object.keys(f.entries).length, 0), plain: infoPlain };
  for (const summary of index.catalogues) summary.factions = catalogueFactions(rosterFiles, summary.rosterScope, summary.id);

  // Faction pages show the builder's points, so catalogues are written once the roster files can price their units.
  const pointsReport: PointsDisagreement[] = [];
  let priced = 0;
  for (const out of outs) {
    const scopeSlugs = index.catalogues.find((c) => c.id === out.id)!.rosterScope;
    const p = applyEnginePoints(out, scopeSlugs.map((slug) => rosterFiles.find((f) => f.slug === slug)!));
    priced += p.priced;
    pointsReport.push(...p.disagreements);
    writeFileSync(join(opts.outDir, 'catalogues', `${out.slug}.json`), JSON.stringify(out));
  }
  writeFileSync(join(opts.outDir, 'points-report.json'), JSON.stringify(pointsReport, null, 2));
  const points: PointsSummary = { priced, differ: pointsReport.filter((r) => r.engine !== null).length };

  writeFileSync(join(opts.outDir, 'index.json'), JSON.stringify(index, null, 2));
  writeFileSync(join(opts.outDir, 'report.json'), JSON.stringify(report, null, 2));
  return { index, report, plain: coverage, missions, info, points };
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
 * A final GW change (dataslate, FAQ) that BSData and Wahapedia both missed, from overrides/amendments.json. `note` is our
 * own words, one or two sentences; `source` says where the change is recorded. An item can carry several amendments:
 * their notes are joined with a space, in file order.
 */
export type Amendment = ItemAmendment | KeywordAmendment;

/**
 * A note on every unit ability with `name`, or on the named rule or stratagem. An ability amendment can instead select
 * by `unitKeyword` (a keyword of the ability's unit) and `textPattern` (a case-insensitive regex the ability's text
 * matches); only a selector may use `catalogueName: '*'` (every catalogue).
 */
export interface ItemAmendment {
  catalogueName: string;
  kind: 'ability' | 'rule' | 'stratagem';
  name?: string;
  unitKeyword?: string;
  textPattern?: string;
  /** A stratagem's corrected CP cost. */
  cp?: string;
  note: string;
  source: string;
}

/** Keywords removed from every unit with `name`; the optional note goes into the unit's `amended`. */
export interface KeywordAmendment {
  catalogueName: string;
  kind: 'unit-keywords';
  name: string;
  remove: string[];
  note?: string;
  source: string;
}

const AMENDMENT_KINDS = new Set<string>(['ability', 'rule', 'stratagem', 'unit-keywords']);
const ALL_CATALOGUES = '*';
const isSelector = (a: Amendment): boolean => a.kind === 'ability' && (a.unitKeyword !== undefined || a.textPattern !== undefined);
const describeAmendment = (a: Amendment) =>
  `${a.kind} ${a.kind === 'ability' && isSelector(a) ? `selector (unit keyword ${a.unitKeyword}, text /${a.textPattern}/)` : `"${a.name}"`}`;
const sameKeyword = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();
// A unit can match several keyword selectors that carry the same note; the note is added once.
const addNote = (existing: string | undefined, note: string) =>
  !existing ? note : existing.includes(note) ? existing : `${existing} ${note}`;

/**
 * Checks amendments.json: known kinds and catalogue names (`*` only for an ability selector); a name, or for a selector
 * both unitKeyword and a valid textPattern; keywords to remove on a unit-keywords amendment; a cp only on stratagems;
 * a note (optional on unit-keywords) and a source on each.
 */
export function validateAmendments(amendments: Amendment[], catalogueNames: Set<string>): void {
  for (const a of amendments) {
    const where = `amendments.json (${a.catalogueName}: ${describeAmendment(a)})`;
    if (!AMENDMENT_KINDS.has(a.kind)) throw new Error(`${where} has unknown kind "${a.kind}"`);
    if (a.catalogueName === ALL_CATALOGUES ? !isSelector(a) : !catalogueNames.has(a.catalogueName)) {
      const why = a.catalogueName === ALL_CATALOGUES ? ' (only an ability selector may use *)' : '';
      throw new Error(`amendments.json names unknown catalogue "${a.catalogueName}"${why}`);
    }
    if (!a.source?.trim()) throw new Error(`${where} has no source`);
    if (a.kind === 'unit-keywords') {
      if (!a.name?.trim()) throw new Error(`${where} has no name`);
      if (!Array.isArray(a.remove) || !a.remove.length) throw new Error(`${where} removes no keywords`);
      if ('cp' in a) throw new Error(`${where} sets cp on a unit-keywords amendment`);
      continue;
    }
    if (isSelector(a)) {
      if (a.name !== undefined) throw new Error(`${where} sets both a name and a selector`);
      if (!a.unitKeyword?.trim() || !a.textPattern) throw new Error(`${where} needs both unitKeyword and textPattern`);
      try {
        new RegExp(a.textPattern, 'i');
      } catch {
        throw new Error(`${where} has an invalid textPattern`);
      }
    } else {
      if (a.unitKeyword !== undefined || a.textPattern !== undefined) throw new Error(`${where}: only ability amendments can select`);
      if (!a.name?.trim()) throw new Error(`${where} has no name`);
    }
    if (a.cp !== undefined && a.kind !== 'stratagem') throw new Error(`${where} sets cp on a ${a.kind}`);
    if (!a.note?.trim()) throw new Error(`${where} has no note`);
  }
}

/**
 * Applies a catalogue's amendments in place, in order: a note goes into `amended` (after any earlier note) on every
 * unit ability with that name or matching the selector, or on the named rule or stratagem, whose cp is replaced when
 * the amendment sets one; a unit-keywords amendment removes keywords from every unit with that name. Returns how many
 * items each amendment matched. Throws if an amendment for this catalogue matches nothing or a keyword to remove isn't
 * there; a `*` selector may match nothing in one catalogue, so the caller checks its total (`checkSelectorMatches`).
 */
export function applyAmendments(out: CatalogueOut, amendments: Amendment[]): Map<Amendment, number> {
  const counts = new Map<Amendment, number>();
  for (const a of amendments) {
    let matched = 0;
    if (a.kind === 'unit-keywords') {
      for (const u of out.units.filter((x) => x.name === a.name)) {
        matched++;
        for (const k of a.remove) {
          if (!u.keywords.some((x) => sameKeyword(x, k))) throw new Error(`amendments.json: unit "${a.name}" in "${out.name}" has no keyword "${k}"`);
        }
        u.keywords = u.keywords.filter((x) => !a.remove.some((k) => sameKeyword(x, k)));
        if (a.note) u.amended = addNote(u.amended, a.note);
      }
    } else if (a.kind === 'ability') {
      const pattern = isSelector(a) ? new RegExp(a.textPattern!, 'i') : null;
      for (const u of out.units) {
        if (pattern && !u.keywords.some((k) => sameKeyword(k, a.unitKeyword!))) continue;
        const hit = (x: { name: string; text: string }) => (pattern ? pattern.test(x.text) : x.name === a.name);
        u.abilities = u.abilities.map((x) => (hit(x) ? (matched++, { ...x, amended: addNote(x.amended, a.note) }) : x));
      }
    } else if (a.kind === 'rule') {
      out.rules = out.rules.map((r) => (r.name === a.name ? (matched++, { ...r, amended: addNote(r.amended, a.note) }) : r));
    } else {
      out.stratagems = out.stratagems.map((s) =>
        s.name === a.name ? (matched++, { ...s, amended: addNote(s.amended, a.note), ...(a.cp ? { cp: a.cp } : {}) }) : s,
      );
    }
    if (!matched && a.catalogueName !== ALL_CATALOGUES) throw new Error(`amendments.json: ${describeAmendment(a)} matches nothing in "${out.name}"`);
    counts.set(a, matched);
  }
  return counts;
}

/** Throws if a `*` selector matched nothing in any catalogue (`totals`: summed applyAmendments counts). */
export function checkSelectorMatches(amendments: Amendment[], totals: Map<Amendment, number>): void {
  for (const a of amendments) {
    if (a.catalogueName === ALL_CATALOGUES && !totals.get(a)) throw new Error(`amendments.json: ${describeAmendment(a)} matches nothing in any catalogue`);
  }
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
  for (const e of o.stratagemFactions.filter((x) => x.ids)) {
    const present = new Set(selectStratagems(w, { ...e, ids: undefined }, excluded, o.stratagemDetails).map((s) => s.id));
    for (const id of e.ids!) if (!present.has(id)) throw new Error(`stratagem-factions.json (${e.catalogueName}) does not otherwise list stratagem "${id}"`);
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
    const own = catalogue(a.catalogueName, 'aoo-allies.json');
    const where = `aoo-allies.json (${a.catalogueName})`;
    const category = (c: string) => {
      if (!categoryNames.has(c)) throw new Error(`${where} names unknown category "${c}"`);
    };
    for (const ally of [...a.allies, ...(a.armiesOfRenown ?? []).flatMap((r) => r.allies)]) {
      catalogue(ally.catalogueName, where);
      for (const d of ally.detachments) if (!system.forces.some((f) => f.name === d)) throw new Error(`${where} names unknown detachment "${d}"`);
      for (const c of [...(ally.onlyFactions ?? []), ...(ally.onlyKeywords ?? [])]) category(c);
      for (const c of ally.onlyFactionsIf ?? []) [c.armyFaction, ...c.onlyFactions].forEach(category);
    }
    for (const r of a.armiesOfRenown ?? []) {
      if (!own.rootEntries.some((n) => n.name === r.entryName)) throw new Error(`${where} names unknown Army of Renown entry "${r.entryName}"`);
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
  const { index, report, plain, missions, info, points } = buildAll({
    rawDir: join(root, 'raw'),
    overridesDir: join(root, 'overrides'),
    outDir: join(root, 'generated'),
    contentDir: join(root, '..', 'content'),
  });
  const totals = Object.values(report).reduce((a, r) => ({ u: a.u + r.units, m: a.m + r.matched, s: a.s + r.stratagems }), { u: 0, m: 0, s: 0 });
  console.log(
    `Built ${index.catalogues.length} catalogues, ${totals.u} units (${totals.m} matched to Wahapedia), ${totals.s} stratagems in ${Date.now() - started} ms`,
  );
  const p = Object.values(plain.shards).reduce((a, r) => ({ t: a.t + r.total, w: a.w + r.written, f: a.f + r.flagged.length + r.copied.length }), { t: 0, w: 0, f: 0 });
  console.log(`Plain English: ${p.w} of ${p.t} texts written, ${p.f} flagged, ${plain.orphans.length} orphaned (see generated/plain-report.json)`);
  console.log(`Missions: plain English ${missions.written} of ${missions.total} written, ${missions.flagged.length} flagged, ${missions.orphans.length} orphaned; faction secondaries ${missions.faction.written} of ${missions.faction.total} (see generated/missions-report.json)`);
  console.log(`Info: ${info.files} files, ${info.entries} entries`);
  const tiers = ([1, 2, 3, 4] as const).map((t) => {
    const c = Object.values(info.plain.shards).reduce((a, r) => ({ total: a.total + r.tiers[t].total, written: a.written + r.tiers[t].written }), { total: 0, written: 0 });
    return `${TIER_NAMES[t]} ${c.written}/${c.total}`;
  });
  console.log(`Option texts: ${info.plain.written} of ${info.plain.total} written, ${info.plain.flagged} flagged (${tiers.join(' · ')}) (see generated/plain-report.json)`);
  console.log(`Points: ${points.priced} units priced by the engine, ${points.differ} differ from Wahapedia (see generated/points-report.json)`);
}
