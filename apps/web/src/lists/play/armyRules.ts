/** The army's own rules and stratagems for Play mode: what its choices and its units' faction rules say. Pure. */
import type { CatalogueOut, EntryInfo, StratagemOut } from '@recruit/data/model';
import { factionDisplayName, type Scope } from '@recruit/data/roster';
import { entryInfo, type EntryInfoIndex } from '../../data/entryInfo';
import { CORE_GROUP } from '../../table/stratagemFilter';
import type { PlayArmy } from './playArmy';

/** `from`: the choice that gives the rule ("Novokh") or the faction whose rule it is ("Necrons"). */
export interface ArmyRule { name: string; text: string; plain?: string; amended?: string; from: string }

/** The columns an option's ability profile keeps its text in, most likely first. */
const TEXT_COLUMNS = ['Description', 'Effect', 'Abilities', 'Details'];
const hasText = (s: string | undefined): s is string => !!s && s.trim() !== '' && s.trim() !== '-';

/** An option's texts: its rules as they are, then each ability profile's text (weapon profiles are not rules). */
export function infoTexts(info: EntryInfo): { name: string; text: string; plain?: string }[] {
  const out: { name: string; text: string; plain?: string }[] = (info.rules ?? []).map((r) => ({ ...r }));
  for (const p of info.profiles ?? []) {
    if (p.type === 'Weapon') continue;
    const key = TEXT_COLUMNS.find((k) => hasText(p.chars[k]));
    if (key) out.push({ name: p.name, text: p.chars[key], ...(p.plain?.[key] && { plain: p.plain[key] }) });
  }
  return out;
}

const same = (a: string) => a.trim().toLowerCase();

/**
 * The rules the army plays by: what each of its choices does (the chosen dynasty, Army of Renown…), then each faction
 * rule one of its units has as an ability (Reanimation Protocols, but not a reference rule no datasheet names), once.
 */
export function armyRules(army: PlayArmy, scope: Scope, info: EntryInfoIndex | null, catalogues: CatalogueOut[]): ArmyRule[] {
  const out: ArmyRule[] = army.choices.flatMap((c) => infoTexts(entryInfo(scope, info, c.entryId) ?? {}).map((t) => ({ ...t, from: c.name })));
  const abilities = new Set(army.units.flatMap((u) => u.unit?.abilities.map((a) => same(a.name)) ?? []));
  const seen = new Set<string>();
  for (const c of catalogues) {
    for (const r of c.rules) {
      if (!abilities.has(same(r.name)) || seen.has(same(r.name))) continue;
      seen.add(same(r.name));
      out.push({ name: r.name, text: r.text, ...(r.plain && { plain: r.plain }), ...(r.amended && { amended: r.amended }), from: factionDisplayName(c.name) });
    }
  }
  return out;
}

const ARKS_OF_OMEN = 'Arks of Omen';
const SPECIALIST = /\(specialist detachment\)\s*$/i;
/**
 * A stratagem group or choice name compared loosely: case, either apostrophe, and a "(Specialist Detachment)" or
 * "(Supplement)" ending ignored, so "Leviathan (Supplement)" goes with the Leviathan choice.
 */
const groupKey = (s: string) =>
  s.toLowerCase().replace(/[’‘�]/g, "'").replace(/\s*\((specialist detachment|supplement)\)\s*$/, '').replace(/\s+/g, ' ').trim();

/**
 * The stratagem groups to show: a group named after a choice the army could have made (a dynasty, an Army of Renown, a
 * Specialist Detachment) only when it was made; every other group (the faction's own, Cult of the Cryptek…) always.
 */
export function shownStratagemGroups(groups: string[], chosen: string[], offered: string[]): Set<string> {
  const picked = new Set(chosen.map(groupKey));
  const notPicked = new Set(offered.map(groupKey).filter((k) => !picked.has(k)));
  return new Set(groups.filter((g) => !notPicked.has(groupKey(g))));
}

export interface PhaseGroup { phase: string; stratagems: StratagemOut[] }

const PHASES = ['Command', 'Movement', 'Psychic', 'Shooting', 'Charge', 'Fight', 'Morale'];
/** When stratagems are used, in the order a battle runs. */
const PHASE_ORDER = [
  'Before battle',
  'During deployment',
  'At the start of battle round',
  ...PHASES.map((p) => `${p} phase`),
  'End of your turn',
  ...PHASES.map((p) => `Enemy ${p} phase`),
  'Being targeted',
  'Taking casualties',
  'Enemy taking casualties',
  'Any phase',
  'Any of your phases',
  'Any time',
];

/** Stratagems by when they're used, in battle order; each once, under the first of its phases in that order. */
export function stratagemsByPhase(list: StratagemOut[]): PhaseGroup[] {
  const unknown: string[] = [];
  const rankOf = (phase: string) => {
    const i = PHASE_ORDER.indexOf(phase);
    if (i >= 0) return i;
    if (!unknown.includes(phase)) unknown.push(phase);
    return PHASE_ORDER.length + unknown.indexOf(phase);
  };
  const groups = new Map<string, StratagemOut[]>();
  for (const s of list) {
    const first = [...s.phases].sort((a, b) => rankOf(a) - rankOf(b))[0] ?? 'Any time';
    groups.set(first, [...(groups.get(first) ?? []), s]);
  }
  return [...groups].sort(([a], [b]) => rankOf(a) - rankOf(b)).map(([phase, stratagems]) => ({ phase, stratagems }));
}

/**
 * The army's stratagems. `all`: every stratagem of its catalogues, then the core ones (and the Arks of Omen ones at
 * Arks of Omen sizes). `mine`: those, without the groups of choices the army didn't make (shownStratagemGroups), and
 * at Arks of Omen sizes without the Specialist Detachments' (not used in those games).
 */
export function playStratagems(a: { catalogues: CatalogueOut[]; core: StratagemOut[]; aoo: boolean; chosen: string[]; offered: string[] }): { mine: StratagemOut[]; all: StratagemOut[] } {
  const ids = new Set<string>();
  const once = (s: StratagemOut) => !ids.has(s.id) && Boolean(ids.add(s.id));
  const all = [
    ...a.catalogues.flatMap((c) => c.stratagems),
    ...a.core.filter((s) => s.group === CORE_GROUP || (a.aoo && s.group === ARKS_OF_OMEN)),
  ].filter(once);
  const shown = shownStratagemGroups([...new Set(all.map((s) => s.group))], a.chosen, a.offered);
  const mine = all.filter((s) => s.group === CORE_GROUP || s.group === ARKS_OF_OMEN || (shown.has(s.group) && !(a.aoo && SPECIALIST.test(s.group))));
  return { mine, all };
}
