import { addUnit, availableUnits, FORCE, type Roster } from '@recruit/data/roster';
import { getIndex, getPolicy, getRosterScope } from '../../factions/dataClient';
import { listData, startingRoster } from '../newListSetup';
import type { ListData } from '../listStore';

const NECRONS = '61c6-c8c5-a304-ff5f';

/** Test-only: list data for a Necrons Strike Force (Arks of Omen) list, after `edit` has added units. Needs stubGeneratedData(). */
export async function necronsListData(edit: (r: Roster, add: (r: Roster, name: string) => Roster) => Roster = (r) => r): Promise<ListData> {
  const [scope, policy, index] = await Promise.all([getRosterScope(['necrons']), getPolicy(), getIndex()]);
  const start = startingRoster(scope, { name: 'Necrons Strike Force', catalogueId: NECRONS, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  const units = availableUnits(scope, start, start.forces[0].id);
  const add = (r: Roster, name: string) => addUnit(scope, r, r.forces[0].id, units.find((u) => u.name === name)!.entryId).roster;
  return listData(scope, policy, edit(start, add), index.catalogues.find((c) => c.id === NECRONS)!);
}
