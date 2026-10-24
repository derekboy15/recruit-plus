import type { UnitOut } from '@recruit/data/model';
import {
  addChild,
  addForce,
  addUnit,
  availableUnits,
  childOptions,
  chooseInGroup,
  evaluate,
  findSelView,
  FORCE,
  optionDisplay,
  validate,
  type OptionNode,
  type Roster,
  type RosterView,
  type Scope,
  type SelView,
} from '@recruit/data/roster';
import { getIndex, getPolicy, getRosterScope } from '../../../factions/dataClient';
import { unitName } from '../../editorView';
import type { ListData } from '../../listStore';
import { applyPicks, armyChoices, listData, startingRoster } from '../../newListSetup';
import { loadUnitIndex, type UnitIndex } from '../../unitIndex';
import { slugsFor } from '../../useRosterEditor';

const NECRONS = '61c6-c8c5-a304-ff5f';

/** Every selection under a unit, depth first. */
const descendants = (v: SelView): SelView[] => v.children.flatMap((c) => [c, ...descendants(c)]);

/**
 * Test-only: adds the option shown as `displayName` (optionDisplay) found among the options of the unit and of every
 * selection under it, choosing it in its group when the group takes one. Throws when there is no such option, so a
 * data change can't quietly weaken a test.
 */
export function pickOption(scope: Scope, roster: Roster, unitSelId: string, displayName: string): Roster {
  const unit = findSelView(evaluate(scope, roster), unitSelId);
  if (!unit) throw new Error(`No unit ${unitSelId}`);
  for (const holder of [unit, ...descendants(unit)]) {
    const found = findLeaf(childOptions(scope, roster, holder.sel.id), displayName, null);
    if (!found) continue;
    const { leaf, group } = found;
    return group && group.max === 1 ? chooseInGroup(scope, roster, holder.sel.id, group.id, leaf.id) : addChild(scope, roster, holder.sel.id, leaf.id);
  }
  throw new Error(`No option "${displayName}" under ${unit.name}`);
}

function findLeaf(nodes: OptionNode[], name: string, group: OptionNode | null): { leaf: OptionNode; group: OptionNode | null } | null {
  for (const n of nodes) {
    if (n.kind === 'group') {
      const found = findLeaf(n.children, name, n);
      if (found) return found;
    } else if (optionDisplay(n.name).name === name) return { leaf: n, group };
  }
  return null;
}

/**
 * Test-only: a Necrons Incursion list, "Novokh Incursion" (Arks of Omen Detachment, Novokh dynasty): an Overlord as
 * Warlord (no trait: at Arks of Omen sizes that takes the 1 CP requisition), a Royal Warden, Necron Warriors, Immortals
 * and Skorpekh Destroyers. `secondDetachment` adds a Necrons Patrol Detachment holding Canoptek Scarab Swarms (added
 * directly: Necrons have no Arks of Omen allies to choose from). Needs stubGeneratedData().
 */
export async function novokhIncursionData(opts: { secondDetachment?: boolean } = {}): Promise<ListData> {
  const [scope, policy, index] = await Promise.all([getRosterScope(['necrons']), getPolicy(), getIndex()]);
  let r = startingRoster(scope, { name: 'Novokh Incursion', catalogueId: NECRONS, sizeId: 'incursion', forceId: FORCE.arksOfOmen });
  const isNovokh = (o: { name: string }) => optionDisplay(o.name).name === 'Novokh';
  const dynasty = armyChoices(scope, r).find((c) => c.options.some(isNovokh));
  if (!dynasty) throw new Error('No dynasty choice offering Novokh');
  r = applyPicks(scope, r, [dynasty], { [dynasty.key]: dynasty.options.find(isNovokh)!.id });
  const add = (roster: Roster, forceIndex: number, name: string) => {
    const force = roster.forces[forceIndex];
    const entry = availableUnits(scope, roster, force.id).find((u) => u.name === name);
    if (!entry) throw new Error(`No unit "${name}" to add`);
    return addUnit(scope, roster, force.id, entry.entryId);
  };
  const overlord = add(r, 0, 'Overlord');
  r = pickOption(scope, overlord.roster, overlord.selId, 'Warlord');
  for (const name of ['Royal Warden', 'Necron Warriors', 'Immortals', 'Skorpekh Destroyers']) r = add(r, 0, name).roster;
  if (opts.secondDetachment) {
    r = addForce(scope, r, FORCE.patrol, NECRONS);
    r = add(r, 1, 'Canoptek Scarab Swarms').roster;
  }
  return listData(scope, policy, r, index.catalogues.find((c) => c.id === NECRONS)!);
}

/** Test-only: what Play mode loads for a list: its validated view, scope, datasheets and catalogue slugs. */
export async function viewOf(data: ListData): Promise<{ view: RosterView; scope: Scope; units: UnitIndex; slugs: string[] }> {
  const [{ catalogues }, policy] = await Promise.all([getIndex(), getPolicy()]);
  const slugs = slugsFor(data.roster, catalogues, data.summary.catalogueSlug);
  const [scope, units] = await Promise.all([getRosterScope(slugs), loadUnitIndex(slugs)]);
  return { view: validate(scope, data.roster, policy).view, scope, units, slugs };
}

/** Test-only: the first unit (root selection) with this name, in any detachment. */
export function unitNamed(view: RosterView, name: string): SelView {
  const v = view.forces.flatMap((f) => f.selections).find((s) => unitName(s.name) === name);
  if (!v) throw new Error(`No unit "${name}" in the list`);
  return v;
}

/** Test-only: the datasheet with this name. */
export function datasheet(units: UnitIndex, name: string): UnitOut {
  const u = [...units.values()].find((i) => i.unit.name === name)?.unit;
  if (!u) throw new Error(`No datasheet "${name}"`);
  return u;
}
