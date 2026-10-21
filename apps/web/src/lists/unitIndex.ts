/** Datasheet facts for the builder (Forge World badge, datasheet link), from the faction JSON the factions pages use. */
import type { UnitOut } from '@recruit/data/model';
import { resolve, type Scope } from '@recruit/data/roster';
import { getCatalogue } from '../factions/dataClient';

export interface UnitInfo { unit: UnitOut; /** The faction page the datasheet lives under. */ slug: string }
/** Datasheets by BattleScribe id (a unit's resolved target id). */
export type UnitIndex = Map<string, UnitInfo>;

/** The datasheets of these factions (first faction first, so a shared datasheet links to the army's own page). */
export async function loadUnitIndex(slugs: string[]): Promise<UnitIndex> {
  const catalogues = await Promise.all(slugs.map(getCatalogue));
  const out: UnitIndex = new Map();
  catalogues.forEach((c, i) => {
    for (const unit of c.units) if (!out.has(unit.id)) out.set(unit.id, { unit, slug: slugs[i] });
  });
  return out;
}

/** The datasheet of a root entry (unit picker option or unit in the list), matched by the entry's resolved target id. */
export function unitInfo(scope: Scope, index: UnitIndex | null, entryId: string): UnitInfo | undefined {
  const node = scope.node(entryId);
  return node && index ? index.get(resolve(scope, node).target.id) : undefined;
}

export const datasheetPath = (info: UnitInfo) => `/factions/${info.slug}/units/${info.unit.slug}`;
