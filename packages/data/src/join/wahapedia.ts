import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BattlefieldRole, FactionGroup, UnitOut } from '../model/types';
import type { AddedConstraint, ConstraintOverride, CostOverride, FactionKeywordOverride } from '../roster/emit';
import { htmlToText, normalizeName } from '../text';
import type { Row, Wahapedia } from '../wahapedia/load';

export interface FactionMapEntry {
  group: FactionGroup;
  wahapediaFactionIds: string[];
}

export interface NameMatch {
  catalogueName: string;
  bsdataName: string;
  wahapediaDatasheetId: string;
  source: string;
}

export interface Overrides {
  factionMap: Record<string, FactionMapEntry>;
  nameMatches: NameMatch[];
  /** Names of catalogues BSData flags as libraries that are nevertheless playable armies. */
  playableCatalogues: Set<string>;
  /** Corrections to BSData costs, applied to the roster files (overrides/costs.json). */
  costs: CostOverride[];
  /** Faction keywords BSData leaves off units, added to the roster files (overrides/faction-keywords.json). */
  factionKeywords: FactionKeywordOverride[];
  /** BSData constraints pinned at another value in the roster files (overrides/constraints.json). */
  constraints: ConstraintOverride[];
  /** Limits BSData leaves out, added to the roster files (overrides/add-constraints.json). */
  addedConstraints: AddedConstraint[];
}

export function loadOverrides(dir: string): Overrides {
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const playable: { catalogueName: string }[] = read('playable-catalogues.json');
  return {
    factionMap: read('faction-map.json'),
    nameMatches: read('name-matches.json'),
    playableCatalogues: new Set(playable.map((p) => p.catalogueName)),
    costs: read('costs.json'),
    factionKeywords: read('faction-keywords.json'),
    constraints: read('constraints.json'),
    addedConstraints: read('add-constraints.json'),
  };
}

/**
 * Minimum unit cost: each model line's cost times the smallest count in models_per_unit ("4-9" -> 4).
 * When every line is optional ("0-4"), the unit's minimum size is filled with its cheapest model.
 * Returns null rather than a misleading 0 when that can't be worked out.
 */
export function minimumPoints(models: Row[], minModels: number | null = null): number | null {
  if (!models.length || models.some((m) => m.Cost === '' || Number.isNaN(Number(m.Cost)))) return null;
  const total = models.reduce((sum, m) => {
    const min = Number((m.models_per_unit || '1').split('-')[0]) || 0;
    return sum + Number(m.Cost) * min;
  }, 0);
  if (total > 0) return total;
  if (!minModels) return null;
  return minModels * Math.min(...models.map((m) => Number(m.Cost)));
}

/**
 * Progressively looser name keys for cross-source matching, most specific first:
 * exact normalised name ("w/" read as "with", "Armor" as "Armour"), then without a loadout
 * suffix ("with bolters"), then without "Squad"/"Squadron", then without a plural "s".
 * Exact keys are always tried first, so "Big Mek w/ Shokk Attack Gun" finds its own datasheet.
 */
export function matchKeys(name: string): string[] {
  const k0 = normalizeName(name.replace(/[[(]legends[\])}]/gi, ''))
    .replace(/\barmor\b/g, 'armour')
    .replace(/\s+w\/\s*/g, ' with ');
  const k1 = k0.replace(/\s+with\s.*$/, '').trim();
  const k2 = k1.replace(/\s+(squad|squadron)$/, '');
  const k3 = k2.replace(/s$/, '');
  return [...new Set([k0, k1, k2, k3])];
}

const WAHAPEDIA_ROLES: Record<string, BattlefieldRole> = {
  HQ: 'HQ',
  Troops: 'Troops',
  Elites: 'Elites',
  'Fast Attack': 'Fast Attack',
  'Heavy Support': 'Heavy Support',
  Flyers: 'Flyer',
  'Dedicated Transport': 'Dedicated Transport',
  'Lords of War': 'Lord of War',
  Fortifications: 'Fortification',
};

/** Lookup tables built once per Wahapedia snapshot. */
const cache = new WeakMap<Wahapedia, ReturnType<typeof buildLookups>>();
function buildLookups(w: Wahapedia) {
  const group = <T extends Row>(rows: T[], key: string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
    return m;
  };
  return {
    datasheetsById: new Map(w.datasheets.map((d) => [d.id, d])),
    modelsByDatasheet: group(w.datasheetsModels, 'datasheet_id'),
    abilityLinksByDatasheet: group(w.datasheetsAbilities, 'datasheet_id'),
    abilitiesById: new Map(w.abilities.map((a) => [a.id, a])),
  };
}

export function joinWahapedia(
  units: UnitOut[],
  catalogueName: string,
  w: Wahapedia,
  overrides: Overrides,
): { units: UnitOut[]; unmatched: string[] } {
  const faction = overrides.factionMap[catalogueName];
  if (!faction) throw new Error(`No faction-map entry for catalogue "${catalogueName}"`);
  const lk = cache.get(w) ?? buildLookups(w);
  cache.set(w, lk);

  // Mapped factions first (in map order, so a faction's own datasheet beats an ally's),
  // then every other faction, for imported allies such as Inquisitors and Assassins.
  const byName = new Map<string, Row>();
  const order = [
    ...faction.wahapediaFactionIds,
    ...[...new Set(w.datasheets.map((d) => d.faction_id))].filter((f) => !faction.wahapediaFactionIds.includes(f)),
  ];
  for (const fid of order) {
    for (const d of w.datasheets) {
      if (d.faction_id !== fid || d.virtual === 'true') continue;
      for (const key of matchKeys(d.name)) if (!byName.has(key)) byName.set(key, d);
    }
  }
  const lookup = (name: string) => matchKeys(name).map((k) => byName.get(k)).find(Boolean);

  const unmatched: string[] = [];
  const out = units.map((u) => {
    const manual = overrides.nameMatches.find((m) => m.catalogueName === catalogueName && m.bsdataName === u.name);
    const ds = manual ? lk.datasheetsById.get(manual.wahapediaDatasheetId) : lookup(u.name);
    if (!ds) {
      unmatched.push(u.name);
      return u;
    }
    const models = lk.modelsByDatasheet.get(ds.id) ?? [];
    const abilities = u.abilities.map((a) => ({ ...a }));
    for (const link of lk.abilityLinksByDatasheet.get(ds.id) ?? []) {
      const ability = lk.abilitiesById.get(link.ability_id);
      if (!ability) continue;
      const text = htmlToText(ability.description);
      const existing = abilities.find((a) => normalizeName(a.name) === normalizeName(ability.name));
      if (existing && !existing.text) Object.assign(existing, { text, source: 'wahapedia' as const });
      else if (!existing) abilities.push({ name: ability.name, text, source: 'wahapedia' });
    }
    return {
      ...u,
      abilities,
      // BSData sometimes sets the role only through conditional modifiers; Wahapedia always has it.
      role: u.role ?? WAHAPEDIA_ROLES[ds.role] ?? null,
      wahapediaId: ds.id,
      points: ds.cost_per_unit === 'true' && ds.Cost !== '' ? Number(ds.Cost) : minimumPoints(models, u.minModels),
      baseSize: models.find((m) => m.base_size)?.base_size ?? null,
    };
  });
  return { units: out, unmatched };
}
