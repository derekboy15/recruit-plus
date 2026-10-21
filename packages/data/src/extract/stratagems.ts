/** Matched-play stratagems from Wahapedia: per catalogue (overrides/stratagem-factions.json) and the core ones. */
import type { StratagemOut } from '../model/types';
import { htmlToText, titleCase } from '../text';
import type { Row, Wahapedia } from '../wahapedia/load';

/** Which Wahapedia stratagems a catalogue gets (overrides/stratagem-factions.json). */
export interface StratagemFaction {
  catalogueName: string;
  /** Wahapedia Factions.csv id. */
  factionId: string;
  /** Subfaction ids (Factions.csv rows whose parent_id is factionId) whose stratagems the catalogue also gets. */
  subfactions: 'all' | string[];
  source: string;
}

/** A Wahapedia stratagem left out of every catalogue (overrides/stratagems.json). */
export interface StratagemExclusion {
  id: string;
  name: string;
  reason: string;
  source: string;
}

/** A core stratagem (overrides/core-stratagems.json). */
export interface CoreStratagem {
  id: string;
  name: string;
  source: string;
}

const SEPARATOR = ' – ';

/** Boarding Actions, Crusade and Requisition stratagems are not matched-play in-game stratagems. */
export const isMatchedPlay = (r: Row): boolean =>
  r.is_boarding_action !== 'true' && !/Boarding Action|Requisition|Crusade/.test(r.type);

const withoutSuffix = (type: string) => type.replace(/ Stratagem$/, '');

const cache = new WeakMap<Wahapedia, ReturnType<typeof buildLookups>>();
function buildLookups(w: Wahapedia) {
  const phases = new Map<string, string[]>();
  for (const p of w.stratagemPhases) {
    const list = phases.get(p.stratagem_id) ?? [];
    // A handful of ids list the same phase twice.
    if (!list.includes(p.phase)) list.push(p.phase);
    phases.set(p.stratagem_id, list);
  }
  return {
    phases,
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
 * A catalogue's matched-play stratagems: its faction's rows with no subfaction (or the faction's own id as subfaction),
 * plus those of the listed subfactions, less the excluded ids. Sorted by group, then name.
 */
export function selectStratagems(w: Wahapedia, entry: StratagemFaction, exclude: Set<string>): StratagemOut[] {
  const lk = lookups(w);
  const subfactionMatches = (sub: string) =>
    !sub || sub === entry.factionId || entry.subfactions === 'all' || entry.subfactions.includes(sub);
  return w.stratagems
    .filter((r) => r.faction_id === entry.factionId && subfactionMatches(r.subfaction_id) && !exclude.has(r.id) && isMatchedPlay(r))
    .map((r) => {
      const at = r.type.indexOf(SEPARATOR);
      const group = at >= 0 ? r.type.slice(0, at) : (lk.factionNames.get(r.faction_id) ?? r.faction_id);
      return toOut(w, r, group, withoutSuffix(at >= 0 ? r.type.slice(at + SEPARATOR.length) : r.type));
    })
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
