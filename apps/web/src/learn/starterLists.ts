/**
 * Two ready-made Combat Patrol lists for "Your first game", built at runtime with the army builder's roster engine from
 * the real catalogue data, so their points and legality come from the same checks as any list a player builds.
 */
import { addChild, addUnit, availableUnits, childOptions, evaluate, FORCE, type OptionNode, type Roster } from '@recruit/data/roster';
import { getIndex, getPolicy, getRosterScope } from '../factions/dataClient';
import type { ListData } from '../lists/listStore';
import { listData, startingRoster } from '../lists/newListSetup';
import { slugsFor } from '../lists/useRosterEditor';
import type { Doc } from '../storage/types';

export type StarterId = 'ultramarines' | 'necrons';

/**
 * Each list: its catalogue, name and units (smallest unit sizes, default wargear); the first unit is the Warlord.
 * `picks` are the choices the builder insists on, by selection name (a unit, or the army's own options).
 */
export const STARTERS: Record<StarterId, { catalogue: string; name: string; units: string[]; picks: Record<string, string[]> }> = {
  ultramarines: {
    catalogue: 'imperium-adeptus-astartes-ultramarines',
    name: 'Ultramarines Combat Patrol',
    units: ['Captain', 'Librarian', 'Intercessor Squad', 'Assault Intercessor Squad', 'Hellblaster Squad'],
    picks: { Captain: ['Master-crafted boltgun', 'Power sword'], Librarian: ['Bolt pistol'] },
  },
  necrons: {
    catalogue: 'necrons',
    name: 'Necrons Combat Patrol',
    units: ['Overlord', 'Technomancer', 'Necron Warriors', 'Immortals', 'Skorpekh Destroyers', 'Lokhust Heavy Destroyers'],
    picks: { 'Dynasty Choice': ['Dynasty: Sautekh'] },
  },
};

const flat = (nodes: OptionNode[]): OptionNode[] => nodes.flatMap((n) => (n.kind === 'group' ? flat(n.children) : [n]));

/** A ready-made Combat Patrol list (Patrol Detachment, Warlord chosen), as an unsaved list doc with id `starter-<id>`. */
export async function starterList(id: StarterId): Promise<Doc<ListData>> {
  const spec = STARTERS[id];
  const index = await getIndex();
  const cat = index.catalogues.find((c) => c.slug === spec.catalogue);
  if (!cat) throw new Error(`The ${spec.name} needs the ${spec.catalogue} catalogue.`);
  const empty: Roster = { schema: 1, name: spec.name, catalogueId: cat.id, battleSize: 'combat-patrol', forces: [] };
  const [scope, policy] = await Promise.all([getRosterScope(slugsFor(empty, index.catalogues, cat.slug)), getPolicy()]);
  let roster = startingRoster(scope, { name: spec.name, catalogueId: cat.id, sizeId: 'combat-patrol', forceId: FORCE.patrol });
  const forceSelId = roster.forces[0].id;
  const units = availableUnits(scope, roster, forceSelId);
  let warlordSel: string | null = null;
  for (const name of spec.units) {
    const entry = units.find((u) => u.name === name);
    if (!entry) throw new Error(`${name} isn't in the ${spec.catalogue} catalogue.`);
    const added = addUnit(scope, roster, forceSelId, entry.entryId);
    roster = added.roster;
    warlordSel ??= added.selId;
  }
  for (const sel of evaluate(scope, roster).forces.flatMap((f) => f.selections)) {
    for (const option of spec.picks[sel.name] ?? []) {
      const node = flat(childOptions(scope, roster, sel.sel.id)).find((n) => n.name === option);
      if (!node) throw new Error(`${sel.name} has no option "${option}".`);
      roster = addChild(scope, roster, sel.sel.id, node.id);
    }
  }
  const warlord = flat(childOptions(scope, roster, warlordSel!)).find((n) => n.name.trim() === 'Warlord');
  if (!warlord) throw new Error(`${spec.units[0]} can't be the Warlord.`);
  roster = addChild(scope, roster, warlordSel!, warlord.id);
  return { id: `starter-${id}`, kind: 'list', ownerId: '', updatedAt: 0, deleted: false, isPublic: false, dirty: false, data: listData(scope, policy, roster, cat) };
}
