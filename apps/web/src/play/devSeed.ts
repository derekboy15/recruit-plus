/**
 * DEV only: saves a list straight from the roster engine, without the builder screens, so the sandbox's browser tests
 * don't depend on how the builder looks. GamesPage puts it on `window.__practice` in development builds.
 */
import { addUnit, availableUnits, FORCE, type BattleSizeId, type Roster } from '@recruit/data/roster';
import { getIndex, getPolicy, getRosterScope } from '../factions/dataClient';
import { createList } from '../lists/listStore';
import { listData, startingRoster } from '../lists/newListSetup';
import { slugsFor } from '../lists/useRosterEditor';
import type { Repository } from '../storage/repository';

export interface SeedSpec {
  catalogue: string;
  name: string;
  size: BattleSizeId;
  /** Unit names as the builder lists them; each is added once at its smallest size with default wargear. */
  units: string[];
}

declare global {
  interface Window {
    __practice?: { seedList(spec: SeedSpec): Promise<string> };
  }
}

/** Saves a Patrol Detachment list with the named units under `ownerId` and returns its id. */
export async function seedPracticeList(repo: Repository, ownerId: string, spec: SeedSpec): Promise<string> {
  const index = await getIndex();
  const cat = index.catalogues.find((c) => c.slug === spec.catalogue);
  if (!cat) throw new Error(`There is no ${spec.catalogue} catalogue.`);
  const empty: Roster = { schema: 1, name: spec.name, catalogueId: cat.id, battleSize: spec.size, forces: [] };
  const [scope, policy] = await Promise.all([getRosterScope(slugsFor(empty, index.catalogues, cat.slug)), getPolicy()]);
  let roster = startingRoster(scope, { name: spec.name, catalogueId: cat.id, sizeId: spec.size, forceId: FORCE.patrol });
  const forceSelId = roster.forces[0].id;
  const units = availableUnits(scope, roster, forceSelId);
  for (const name of spec.units) {
    const entry = units.find((u) => u.name === name);
    if (!entry) throw new Error(`${name} isn't in the ${spec.catalogue} catalogue.`);
    roster = addUnit(scope, roster, forceSelId, entry.entryId).roster;
  }
  return createList(repo, ownerId, listData(scope, policy, roster, cat));
}
