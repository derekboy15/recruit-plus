/**
 * What a datasheet shows, worked out from the unit's per-model data (Plan H, spec §3): stat rows labelled by model,
 * weapons with who carries them, abilities with who has them. Pure: the view renders it as it comes.
 */
import type { AbilityOut, ModelKindOut, ProfileOut, UnitOptionOut, UnitOut } from '@recruit/data/model';
import { optionDisplay, type SelView } from '@recruit/data/roster';
import { woundBracket, woundTracks } from './format';

export interface Bracket {
  label: string;
  from: number;
  profile: ProfileOut;
}
/** One kind of model's stat line: "Veteran ×4"; a degrading model's top bracket with its track. */
export interface SheetStatRow {
  label: string;
  count?: number;
  profile: ProfileOut;
  track?: Bracket[];
}
/** A weapon, its profiles (a plasma gun's standard and supercharge), how many and who carries it ('' for one model). */
export interface SheetWeaponRow {
  name: string;
  profiles: ProfileOut[];
  count?: number;
  carriedBy: string;
}
export interface SheetAbility {
  ability: AbilityOut;
  /** "Unit", "Everyone", a model ("Cadian Commander"), or several. '' when the data can't say. */
  who: string;
}
/** A model or group of identical models in a list, with what it carries (in-list view only). */
export interface SheetModelRow {
  count: number;
  name: string;
  gear: string[];
}
export interface SheetModel {
  models: SheetModelRow[];
  stats: SheetStatRow[];
  weapons: SheetWeaponRow[];
  options: UnitOptionOut[];
  canAlsoTake: ModelKindOut[];
  abilities: SheetAbility[];
  extras: { weapons: ProfileOut[]; abilities: AbilityOut[] };
  keywords: { faction: string[]; unit: string[]; perModel: { model: string; keywords: string[] }[] };
}

const isExtra = (x: ProfileOut | AbilityOut) => (x as { extra?: true }).extra === true;

/** "Veteran" → "Veterans", "Guardsman" → "Guardsmen". */
export function plural(name: string): string {
  if (/man$/i.test(name)) return name.replace(/man$/i, 'men');
  if (/s$/i.test(name)) return name;
  if (/[^aeiou]y$/i.test(name)) return name.replace(/y$/i, 'ies');
  return `${name}s`;
}

/** "Cadian Veteran w/ Medi-pack" → "Cadian Veteran with Medi-pack". */
const kindLabel = (k: ModelKindOut) => k.name.replace(/\s+w\/\s+/gi, ' with ');

/** A weapon profile's name without its mode: "Plasma pistol, Standard" → "Plasma pistol". */
const baseName = (name: string) => name.split(/, | - | \(/)[0].trim();

/** Stat rows for the given (kind, count) pairs, grouped by stat line; degrading models fold into one row with a track. */
function statRows(unit: UnitOut, picks: { profile: number; count?: number }[]): SheetStatRow[] {
  const tracks = woundTracks(unit.models);
  const rows: SheetStatRow[] = [];
  for (const { profile: i, count } of picks) {
    const profile = unit.models[i];
    if (!profile) continue;
    const base = woundBracket(profile.name)?.base;
    const track = base !== undefined ? tracks.get(base) : undefined;
    const label = track ? base! : profile.name;
    const row = rows.find((r) => r.label === label);
    if (row) {
      if (count !== undefined) row.count = (row.count ?? 0) + count;
      continue;
    }
    rows.push(track ? { label, profile: track[0].profile, track, ...(count !== undefined && { count }) } : { label, profile, ...(count !== undefined && { count }) });
  }
  return rows;
}

/** Weapon rows, consecutive profiles of one weapon (same base name, same carriers) under one row. */
function weaponRows(unit: UnitOut, entries: { index: number; carriedBy: string; count?: number }[]): SheetWeaponRow[] {
  const rows: SheetWeaponRow[] = [];
  for (const e of entries) {
    const w = unit.weapons[e.index];
    if (!w) continue;
    const base = baseName(w.name);
    const last = rows[rows.length - 1];
    if (last && last.name === base && last.carriedBy === e.carriedBy && last.profiles.length && baseName(last.profiles[0].name) === base && last.profiles[0].name !== base) {
      last.profiles.push(w);
      continue;
    }
    rows.push({ name: w.name === base ? w.name : base, profiles: [w], carriedBy: e.carriedBy, ...(e.count !== undefined && { count: e.count }) });
  }
  // A lone profile keeps its full name ("Grenade launcher (Frag)" when the krak profile isn't carried).
  for (const r of rows) if (r.profiles.length === 1) r.name = r.profiles[0].name;
  return rows;
}

/** Weapon rows for the given weapons, a weapon's profiles grouped (an option's choices). */
export function profileRows(unit: UnitOut, indexes: number[]): SheetWeaponRow[] {
  return weaponRows(unit, indexes.map((index) => ({ index, carriedBy: '' })));
}

/**
 * An option as a sentence: "Cadian Commander can replace their Laspistol with one of: Bolt pistol, Plasma pistol";
 * "The unit can take any of: …". The choices exclude the one it replaces.
 */
export function optionLine(unit: UnitOptionOut, weapons: ProfileOut[]): { text: string; choices: number[] } {
  const who = unit.who.length ? unit.who.map((w) => w.replace(/\s+w\/\s+/gi, ' with ')).join(', ') : 'The unit';
  const replaced = new Set(unit.replaces ?? []);
  const keep = unit.choices.filter((c) => !(replaced.size && c.weapons.length && c.weapons.every((i) => replaced.has(i))));
  const names = keep.map((c) => c.name).join(', ');
  const rest = [...new Set(keep.flatMap((c) => c.weapons))].filter((i) => !replaced.has(i));
  if (replaced.size) {
    const what = [...new Set([...replaced].map((i) => weapons[i]?.name).filter(Boolean).map((n) => baseName(n!)))].join(' and ');
    return { text: `${who} can replace their ${what} with one of: ${names}`, choices: rest };
  }
  const how = unit.max === 1 ? 'one of' : 'any of';
  return { text: `${who} can take ${how}: ${names}`, choices: rest };
}

/** "Cadian Commander, 2 Veterans", or "Everyone" when every model of the unit carries it. */
function carriers(groups: Map<string, number>, total: number): string {
  const n = [...groups.values()].reduce((a, b) => a + b, 0);
  if (total > 1 && n >= total) return 'Everyone';
  return [...groups].map(([label, c]) => (c > 1 ? `${c} ${plural(label)}` : label)).join(', ');
}

function keywordsOf(unit: UnitOut): SheetModel['keywords'] {
  const per = unit.modelKeywords ?? [];
  const common = per.length ? per.map((m) => new Set(m.keywords)).reduce((a, b) => new Set([...a].filter((k) => b.has(k)))) : new Set(unit.keywords);
  return {
    faction: unit.factionKeywords,
    unit: per.length ? unit.keywords.filter((k) => common.has(k)) : unit.keywords,
    perModel: per.map((m) => ({ model: m.model, keywords: m.keywords.filter((k) => !common.has(k)) })).filter((m) => m.keywords.length),
  };
}

/** The unit as the list editor adds it (spec §3.1); for data without per-model structure, every profile and weapon. */
export function factionSheet(unit: UnitOut): SheetModel {
  const kinds = unit.modelKinds ?? [];
  const extras = { weapons: unit.weapons.filter(isExtra), abilities: unit.abilities.filter(isExtra) };
  if (!kinds.length) {
    return {
      models: [],
      stats: statRows(unit, unit.models.map((_, i) => ({ profile: i }))),
      weapons: weaponRows(unit, unit.weapons.map((w, index) => ({ index, carriedBy: w && (unit.unitGear?.weapons ?? []).includes(index) ? 'Unit' : '' })).filter((e) => !isExtra(unit.weapons[e.index]))),
      options: unit.options ?? [],
      canAlsoTake: [],
      abilities: unit.abilities.filter((a) => !isExtra(a)).map((ability, i) => ({ ability, who: (unit.unitGear?.abilities ?? []).includes(i) ? 'Unit' : '' })),
      extras,
      keywords: keywordsOf(unit),
    };
  }
  const added = kinds.filter((k) => !k.optional && k.defaultCount > 0);
  // A unit the editor adds short: every kind it can have, uncounted.
  const shown = added.length ? added : kinds.filter((k) => !k.optional);
  const counted = added.length > 0;
  const total = counted ? added.reduce((n, k) => n + k.defaultCount, 0) : 0;
  const single = counted && total === 1;

  // Weapons: who carries each, by stat line ("2 Veterans"); the unit's own and unit-wide ones by name.
  const by = new Map<number, Map<string, number>>();
  for (const k of shown) {
    const label = unit.models[k.profile]?.name ?? kindLabel(k);
    for (const i of k.weapons) {
      const m = by.get(i) ?? new Map<string, number>();
      m.set(label, (m.get(label) ?? 0) + (counted ? k.defaultCount : 1));
      by.set(i, m);
    }
  }
  const weaponEntries: { index: number; carriedBy: string }[] = [];
  for (const i of unit.everyone ?? []) weaponEntries.push({ index: i, carriedBy: single ? '' : 'Everyone' });
  for (const i of unit.unitGear?.weapons ?? []) if (!weaponEntries.some((e) => e.index === i)) weaponEntries.push({ index: i, carriedBy: single ? '' : 'Unit' });
  for (const [i, groups] of [...by].sort((a, b) => a[0] - b[0])) {
    if (weaponEntries.some((e) => e.index === i)) continue;
    weaponEntries.push({ index: i, carriedBy: single || !counted ? '' : carriers(groups, total) });
  }
  weaponEntries.sort((a, b) => a.index - b.index);

  // Abilities: who has each.
  const who = new Map<number, string[]>();
  const give = (i: number, label: string) => who.set(i, [...new Set([...(who.get(i) ?? []), label])]);
  for (const i of unit.unitGear?.abilities ?? []) give(i, 'Unit');
  for (const k of shown) for (const i of k.abilities) give(i, single ? '' : kindLabel(k));
  for (const k of kinds.filter((x) => x.optional)) for (const i of k.abilities) if (!who.has(i)) give(i, `${kindLabel(k)} (if taken)`);
  for (const o of unit.options ?? []) for (const c of o.choices) for (const i of c.abilities) if (!who.has(i)) give(i, `${c.name} (option)`);
  const everyKind = (labels: string[]) => !single && shown.length > 1 && shown.every((k) => labels.includes(kindLabel(k)));
  const abilities: SheetAbility[] = unit.abilities
    .map((ability, i) => ({ ability, i }))
    .filter(({ ability }) => !isExtra(ability))
    .map(({ ability, i }) => {
      const given = who.get(i) ?? ['Unit'];
      // On the unit and on a model in the data: the model is the more useful answer.
      const labels = given.length > 1 ? given.filter((l) => l !== 'Unit') : given;
      return { ability, who: everyKind(labels) ? 'Everyone' : labels.filter(Boolean).join(', ') };
    });
  const rank = (w: string) => (w === 'Unit' ? 0 : w === 'Everyone' ? 1 : /\((option|if taken)\)/.test(w) ? 3 : 2);
  abilities.sort((a, b) => rank(a.who) - rank(b.who));

  return {
    models: [],
    stats: statRows(unit, shown.map((k) => ({ profile: k.profile, ...(counted && { count: k.defaultCount }) }))),
    weapons: weaponRows(unit, weaponEntries),
    options: unit.options ?? [],
    canAlsoTake: kinds.filter((k) => k.optional),
    abilities,
    extras,
    keywords: keywordsOf(unit),
  };
}

/** The ids a selection was made through: its entry (a link's id for a link) and the entry's target. */
const idsOf = (s: SelView) => [...new Set([s.sel.entryId, s.merged?.target.id].filter((x): x is string => !!x))];
/** Everything chosen below a selection, with how many of each per copy of it. */
const below = (s: SelView, per = 1): { v: SelView; n: number }[] =>
  s.children.filter((c) => c.sel.count > 0).flatMap((c) => [{ v: c, n: per * c.sel.count }, ...below(c, per * c.sel.count)]);
/** A choice as New Recruit lists it: "2x Frag grenades"; one that wraps others with them in brackets. */
const gearName = (v: SelView, n: number): string => {
  const inner = v.children.filter((c) => c.sel.count > 0).map((c) => gearName(c, c.sel.count));
  return `${n > 1 ? `${n}x ` : ''}${optionDisplay(v.name).name}${inner.length ? ` (${inner.join(', ')})` : ''}`;
};

/**
 * A unit in a list (spec §3.2, New Recruit's order), from the player's own selections: each model, or group of
 * identical models, with what it carries; stats for the models it has; only the weapons carried, with how many and who;
 * the abilities that apply. Gear on the unit itself is a "Unit" row; a unit-wide choice goes on every model.
 */
export function listSheet(unit: UnitOut, v: SelView): SheetModel {
  const entries = unit.entries ?? {};
  const kinds = unit.modelKinds ?? [];
  const kindOf = (s: SelView) => kinds.find((k) => idsOf(s).some((id) => k.entryIds.includes(id)));
  const gather = (ids: string[], key: 'w' | 'a') => [...new Set(ids.flatMap((id) => entries[id]?.[key] ?? []))];

  // Read the unit: its models (in a squad inside the squad too), unit-wide choices, and gear on the unit.
  type Model = { v: SelView; copies: number; kind: ModelKindOut | undefined; gear: { v: SelView; n: number }[] };
  const models: Model[] = [];
  const everyone: { v: SelView; n: number }[] = [];
  const onUnit: { v: SelView; n: number }[] = [];
  /** The choices made on the unit itself (outside any model), for the Unit row; and the squads' own entries. */
  const unitChoices: { v: SelView; n: number }[] = [];
  const containers: SelView[] = [v];
  const single = v.type !== 'unit' || (kinds.length === 1 && !!kindOf(v));
  if (single) models.push({ v, copies: Math.max(1, v.sel.count), kind: kinds[0], gear: below(v) });
  else {
    const walk = (s: SelView, copies: number) => {
      for (const c of s.children.filter((x) => x.sel.count > 0)) {
        if (c.type === 'model') models.push({ v: c, copies: copies * c.sel.count, kind: kindOf(c), gear: below(c) });
        else if (c.type === 'unit') {
          containers.push(c);
          walk(c, copies * c.sel.count);
        } else {
          if (!c.merged?.node.perModel) unitChoices.push({ v: c, n: c.sel.count });
          (c.merged?.node.perModel ? everyone : onUnit).push({ v: c, n: c.sel.count }, ...below(c, c.sel.count));
        }
      }
    };
    walk(v, 1);
  }
  const total = models.reduce((n, m) => n + m.copies, 0);

  // Models: grouped when the same kind carries the same gear.
  const rows: SheetModelRow[] = [];
  for (const m of models) {
    const name = m.kind?.name ?? optionDisplay(m.v.name).name;
    const own = m.v === v ? v.children : m.v.children;
    const gear = [
      ...own.filter((c) => c.sel.count > 0).map((c) => gearName(c, c.sel.count)),
      ...everyone.filter((e) => e.v.merged?.node.perModel && e.v.parent === v).map((e) => gearName(e.v, 1)),
    ].sort((a, b) => a.localeCompare(b));
    const row = rows.find((r) => r.name === name && r.gear.join('|') === gear.join('|'));
    if (row) row.count += m.copies;
    else rows.push({ count: m.copies, name, gear });
  }
  // The unit's own gear: choices on it, and what its entry (or a squad inside it) carries without a choice.
  const ownWeapons = single ? [] : gather(containers.flatMap(idsOf), 'w');
  const unitRow = [...unitChoices.map((g) => gearName(g.v, g.n)), ...ownWeapons.map((i) => unit.weapons[i]?.name).filter((x): x is string => !!x)];
  if (unitRow.length) rows.push({ count: 0, name: 'Unit', gear: [...new Set(unitRow)].sort((a, b) => a.localeCompare(b)) });

  // Weapons: how many of each, and who carries it.
  const carriedBy = new Map<number, Map<string, number>>();
  const counts = new Map<number, number>();
  const label = (m: Model) => (m.kind && unit.models[m.kind.profile]?.name) || optionDisplay(m.v.name).name;
  for (const m of models) {
    for (const i of gather([...idsOf(m.v), ...m.gear.flatMap((g) => idsOf(g.v))], 'w')) {
      const g = carriedBy.get(i) ?? new Map<string, number>();
      g.set(label(m), (g.get(label(m)) ?? 0) + m.copies);
      carriedBy.set(i, g);
      counts.set(i, (counts.get(i) ?? 0) + m.copies);
    }
  }
  const weaponEntries: { index: number; carriedBy: string; count?: number }[] = [];
  for (const i of gather(everyone.flatMap((e) => idsOf(e.v)), 'w')) weaponEntries.push({ index: i, carriedBy: single ? '' : 'Everyone', count: total });
  for (const g of onUnit) for (const i of gather(idsOf(g.v), 'w')) if (!weaponEntries.some((e) => e.index === i)) weaponEntries.push({ index: i, carriedBy: single ? '' : 'Unit', count: g.n });
  for (const i of ownWeapons) if (!weaponEntries.some((e) => e.index === i)) weaponEntries.push({ index: i, carriedBy: 'Unit' });
  for (const [i, groups] of carriedBy) if (!weaponEntries.some((e) => e.index === i)) weaponEntries.push({ index: i, carriedBy: single ? '' : carriers(groups, total), count: counts.get(i) });
  weaponEntries.sort((a, b) => a.index - b.index);

  // Abilities: the unit's own, those its models and their gear grant, and any the data gives no entry (the datasheet's).
  const attributed = new Set(Object.values(entries).flatMap((e) => e.a ?? []));
  const who = new Map<number, string[]>();
  const give = (i: number, l: string) => who.set(i, [...new Set([...(who.get(i) ?? []), l])]);
  for (const i of unit.unitGear?.abilities ?? []) give(i, 'Unit');
  for (const i of gather([...onUnit, ...everyone].flatMap((g) => idsOf(g.v)), 'a')) give(i, 'Unit');
  for (const m of models) for (const i of gather([...idsOf(m.v), ...m.gear.flatMap((g) => idsOf(g.v))], 'a')) give(i, single ? '' : (m.kind ? m.kind.name : optionDisplay(m.v.name).name).replace(/\s+w\/\s+/gi, ' with '));
  unit.abilities.forEach((a, i) => !isExtra(a) && !attributed.has(i) && give(i, 'Unit'));
  const abilities: SheetAbility[] = [...who].map(([i, given]) => {
    const labels = given.length > 1 ? given.filter((l) => l !== 'Unit') : given;
    return { ability: unit.abilities[i], who: labels.filter(Boolean).join(', ') };
  }).filter((a) => a.ability);
  const rank = (w: string) => (w === 'Unit' ? 0 : 1);
  abilities.sort((a, b) => rank(a.who) - rank(b.who));

  return {
    models: rows,
    stats: kinds.length ? statRows(unit, models.filter((m) => m.kind).map((m) => ({ profile: m.kind!.profile, count: m.copies }))) : factionSheet(unit).stats,
    weapons: weaponRows(unit, weaponEntries),
    options: [],
    canAlsoTake: [],
    abilities,
    extras: { weapons: [], abilities: [] },
    keywords: keywordsOf(unit),
  };
}
