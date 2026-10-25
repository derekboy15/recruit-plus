/**
 * Which stratagem groups belong to a player's army: the Core Book, the faction's own stratagems, and the groups named
 * after what their list chose (a dynasty, an Army of Renown, a specialist detachment). Everything else waits behind
 * "Show all stratagems".
 */
import type { StratagemOut } from '@recruit/data/model';
import type { Roster, SelView } from '@recruit/data/roster';
import { getIndex, getPolicy, getRosterScope } from '../factions/dataClient';
import { CORE_GROUP } from './stratagemFilter';

/**
 * The display names of every selection in a list (sub-faction, Army of Renown, detachment, units and their upgrades),
 * deduped, in list order. The roster engine is loaded only when a game starts, so the table screens stay small.
 */
export async function chosenNames(roster: Roster, catalogueSlug: string): Promise<string[]> {
  const [{ validate, optionDisplay }, { catalogues }, policy] = await Promise.all([import('@recruit/data/roster'), getIndex(), getPolicy()]);
  const slugs = [catalogues.find((c) => c.id === roster.catalogueId)?.slug ?? catalogueSlug];
  for (const f of roster.forces) {
    const slug = catalogues.find((c) => c.id === f.catalogueId)?.slug;
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  const { view } = validate(await getRosterScope(slugs), roster, policy);
  const names = new Set<string>();
  const walk = (v: SelView) => {
    names.add(optionDisplay(v.name).name);
    v.children.forEach(walk);
  };
  for (const f of view.forces) {
    names.add(optionDisplay(f.name).name);
    f.selections.forEach(walk);
  }
  return [...names];
}

/** The most frequent group other than the Core Book: the faction's own stratagems. A tie goes to the first seen. */
export function mainGroup(stratagems: StratagemOut[]): string | null {
  const counts = new Map<string, number>();
  for (const s of stratagems) if (s.group !== CORE_GROUP) counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
  let best: string | null = null;
  for (const [group, n] of counts) if (best === null || n > counts.get(best)!) best = group;
  return best;
}

/**
 * The groups that belong to the army: the faction's name, a chosen name, or a chosen name followed by " (", as in
 * "Blitz Brigade (Specialist Detachment)". Case doesn't matter.
 */
export function armyGroups(groups: string[], factionName: string, chosen: string[]): string[] {
  const names = [factionName, ...chosen].map((n) => n.toLowerCase());
  return groups.filter((g) => {
    const group = g.toLowerCase();
    return names.some((n) => group === n || group.startsWith(`${n} (`));
  });
}

/** What a player sees by default: the Core Book, the faction's main group and their army's own groups. */
export function defaultGroups(all: StratagemOut[], factionName: string, chosen?: string[]): Set<string> {
  const groups = [...new Set(all.map((s) => s.group))];
  const main = mainGroup(all);
  return new Set([CORE_GROUP, ...(main ? [main] : []), ...armyGroups(groups, factionName, chosen ?? [])]);
}
