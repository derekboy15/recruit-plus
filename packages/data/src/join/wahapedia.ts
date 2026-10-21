import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FactionGroup, UnitOut } from '../model/types';
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
}

export function loadOverrides(dir: string): Overrides {
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return { factionMap: read('faction-map.json'), nameMatches: read('name-matches.json') };
}

/** Minimum unit cost: each model line's cost times the smallest count in models_per_unit ("4-9" -> 4). */
export function minimumPoints(models: Row[]): number | null {
  if (!models.length || models.some((m) => m.Cost === '' || Number.isNaN(Number(m.Cost)))) return null;
  return models.reduce((sum, m) => {
    const min = Number((m.models_per_unit || '1').split('-')[0]) || 0;
    return sum + Number(m.Cost) * min;
  }, 0);
}

/**
 * Progressively looser name keys for cross-source matching, most specific first:
 * exact normalised name, then without loadout suffix ("w/ bolters"), then without
 * "Squad"/"Squadron", then without a plural "s". "Armor" is treated as "Armour".
 */
export function matchKeys(name: string): string[] {
  const k0 = normalizeName(name.replace(/[[(]legends[\])}]/gi, '')).replace(/\barmor\b/g, 'armour');
  const k1 = k0.replace(/\s+w\/.*$/, '').trim();
  const k2 = k1.replace(/\s+(squad|squadron)$/, '');
  const k3 = k2.replace(/s$/, '');
  return [...new Set([k0, k1, k2, k3])];
}

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
      wahapediaId: ds.id,
      points: minimumPoints(models),
      baseSize: models.find((m) => m.base_size)?.base_size ?? null,
    };
  });
  return { units: out, unmatched };
}
