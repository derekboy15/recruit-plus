/** Matched-play stratagems from Wahapedia: per catalogue (overrides/stratagem-factions.json) and the core ones. */
import type { StratagemOut } from '../model/types';
import { htmlToText, normalizeName, titleCase } from '../text';
import type { Row, Wahapedia } from '../wahapedia/load';

/** Which Wahapedia stratagems a catalogue gets (overrides/stratagem-factions.json). */
export interface StratagemFaction {
  catalogueName: string;
  /** Wahapedia Factions.csv id. */
  factionId: string;
  /** Subfaction ids (Factions.csv rows whose parent_id is factionId) whose stratagems the catalogue also gets. */
  subfactions: 'all' | string[];
  /**
   * Only these groups, for catalogues whose units can't meet the faction's general keyword requirements (Fallen units
   * aren't HERETIC ASTARTES, say).
   */
  groups?: string[];
  source: string;
}

/** A Wahapedia stratagem left out of every catalogue (overrides/stratagems.json). */
export interface StratagemExclusion {
  id: string;
  name: string;
  reason: string;
  source: string;
}

/**
 * Per-stratagem corrections (overrides/stratagem-details.json): the group to show it under (a Specialist Detachment's
 * name), and the subfaction it needs when Wahapedia gives none and its type doesn't name one.
 */
export interface StratagemDetail {
  id: string;
  name: string;
  group?: string;
  subfactionId?: string;
  source: string;
}

/** A core stratagem (overrides/core-stratagems.json). */
export interface CoreStratagem {
  id: string;
  name: string;
  source: string;
}

const SEPARATOR = ' – ';
const KINDS = new Set(['Battle Tactic', 'Epic Deed', 'Strategic Ploy', 'Wargear', 'Core', 'Requisition']);

/** Boarding Actions, Crusade and Requisition stratagems are not matched-play in-game stratagems. */
export const isMatchedPlay = (r: Row): boolean =>
  r.is_boarding_action !== 'true' && !/Boarding Action|Requisition|Crusade/.test(r.type);

const withoutSuffix = (type: string) => type.replace(/ ?Stratagem$/, '');

/**
 * Group and kind from the type. "Necrons – Battle Tactic Stratagem" -> Necrons / Battle Tactic. A type with no prefix
 * names a kind ("Battle Tactic Stratagem") or a group ("Space Wolves Stratagem" -> Space Wolves / Stratagem); a group
 * left blank is the faction's name.
 */
function groupAndKind(type: string, factionName: string): { group: string; kind: string } {
  const at = type.indexOf(SEPARATOR);
  if (at >= 0) return { group: type.slice(0, at), kind: withoutSuffix(type.slice(at + SEPARATOR.length)) };
  const x = withoutSuffix(type);
  if (KINDS.has(x)) return { group: factionName, kind: x };
  return { group: x || factionName, kind: 'Stratagem' };
}

/** Name key for matching a type's prefix to a subfaction: "The Hivecult" ~ "Hivecult", "Blood Axe" ~ "Blood Axes". */
const subfactionKey = (s: string) => normalizeName(s).replace(/^the /, '').replace(/s$/, '');

/**
 * The subfaction a type names: its prefix ("Black Templars Stratagem", "Leviathan (Supplement) – …"), the part before
 * brackets, or the part inside them ("Aeldari (Alaitoc) – …"), matched by name against the faction's Factions.csv
 * children. '' when it names none.
 */
function subfactionFromType(r: Row, children: Row[]): string {
  const at = r.type.indexOf(SEPARATOR);
  const prefix = at >= 0 ? r.type.slice(0, at) : withoutSuffix(r.type);
  const bracket = prefix.match(/^(.*?)\s*\((.*)\)$/);
  const candidates = [prefix, ...(bracket ? [bracket[1], bracket[2]] : [])].map(subfactionKey);
  for (const c of candidates) {
    const found = children.filter((f) => subfactionKey(f.name) === c);
    if (found.length === 1) return found[0].id;
  }
  return '';
}

const cache = new WeakMap<Wahapedia, ReturnType<typeof buildLookups>>();
function buildLookups(w: Wahapedia) {
  const phases = new Map<string, string[]>();
  for (const p of w.stratagemPhases) {
    const list = phases.get(p.stratagem_id) ?? [];
    // A handful of ids list the same phase twice.
    if (!list.includes(p.phase)) list.push(p.phase);
    phases.set(p.stratagem_id, list);
  }
  const children = new Map<string, Row[]>();
  for (const f of w.factions) if (f.parent_id) children.set(f.parent_id, [...(children.get(f.parent_id) ?? []), f]);
  return {
    phases,
    children,
    factionNames: new Map(w.factions.map((f) => [f.id, f.name])),
    byId: new Map(w.stratagems.map((s) => [s.id, s])),
  };
}
function lookups(w: Wahapedia) {
  let lk = cache.get(w);
  if (!lk) cache.set(w, (lk = buildLookups(w)));
  return lk;
}

function toOut(w: Wahapedia, r: Row, group: string, kind: string): StratagemOut {
  return {
    id: r.id,
    name: titleCase(r.name),
    cp: r.cp_cost,
    group,
    kind,
    phases: lookups(w).phases.get(r.id) ?? [],
    text: htmlToText(r.description),
  };
}

/**
 * The subfaction a stratagem needs, '' for none: a stratagem-details.json override, else Wahapedia's subfaction_id (the
 * faction's own id counts as none), else the one its type names.
 */
export function stratagemSubfaction(w: Wahapedia, r: Row, detail?: StratagemDetail): string {
  if (detail?.subfactionId) return detail.subfactionId;
  if (r.subfaction_id) return r.subfaction_id === r.faction_id ? '' : r.subfaction_id;
  return subfactionFromType(r, lookups(w).children.get(r.faction_id) ?? []);
}

/**
 * A catalogue's matched-play stratagems: its faction's rows that need no subfaction or one the entry lists, less the
 * excluded ids and, when the entry has `groups`, other groups. Sorted by group, then name.
 */
export function selectStratagems(
  w: Wahapedia,
  entry: StratagemFaction,
  exclude: Set<string>,
  details: StratagemDetail[] = [],
): StratagemOut[] {
  const lk = lookups(w);
  const detailById = new Map(details.map((d) => [d.id, d]));
  const subfactionMatches = (sub: string) => !sub || entry.subfactions === 'all' || entry.subfactions.includes(sub);
  return w.stratagems
    .filter((r) => r.faction_id === entry.factionId && !exclude.has(r.id) && isMatchedPlay(r))
    .filter((r) => subfactionMatches(stratagemSubfaction(w, r, detailById.get(r.id))))
    .map((r) => {
      const { group, kind } = groupAndKind(r.type, lk.factionNames.get(r.faction_id) ?? r.faction_id);
      return toOut(w, r, detailById.get(r.id)?.group ?? group, kind);
    })
    .filter((s) => !entry.groups || entry.groups.includes(s.group))
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

/**
 * The core stratagems, in the order given: the Core Book's ("Core Stratagem", group "Core Book") and the Arks of Omen
 * requisitions ("Core Stratagem – Requisition Stratagem", group "Arks of Omen").
 */
export function coreStratagems(w: Wahapedia, ids: string[]): StratagemOut[] {
  const lk = lookups(w);
  return ids.map((id) => {
    const r = lk.byId.get(id);
    if (!r) throw new Error(`Unknown core stratagem id "${id}"`);
    if (r.type === 'Core Stratagem') return toOut(w, r, 'Core Book', 'Core');
    if (r.type === `Core Stratagem${SEPARATOR}Requisition Stratagem`) return toOut(w, r, 'Arks of Omen', 'Requisition');
    throw new Error(`Stratagem ${id} (${r.name}) is not a core stratagem: "${r.type}"`);
  });
}
