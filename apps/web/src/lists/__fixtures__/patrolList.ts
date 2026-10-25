import { addChild, addForce, addUnit, availableUnits, childOptions, FORCE, type Roster, type Scope } from '@recruit/data/roster';
import { applyPicks, armyChoices, startingRoster } from '../newListSetup';

export const NECRONS = '61c6-c8c5-a304-ff5f';

/** Adds the named unit to a detachment (the first unless given) and returns the roster. */
export function addNamed(scope: Scope, r: Roster, name: string, forceIndex = 0): Roster {
  const force = r.forces[forceIndex];
  const unit = availableUnits(scope, r, force.id).find((u) => u.name === name);
  if (!unit) throw new Error(`No unit called ${name}`);
  return addUnit(scope, r, force.id, unit.entryId).roster;
}

/** Turns on the option (or picks the group's option) named `option` on the selection `selId`. */
export function pickOption(scope: Scope, r: Roster, selId: string, option: string): Roster {
  const all = (nodes: ReturnType<typeof childOptions>): ReturnType<typeof childOptions> =>
    nodes.flatMap((n) => (n.kind === 'group' ? all(n.children) : [n]));
  const node = all(childOptions(scope, r, selId)).find((o) => o.name === option);
  if (!node) throw new Error(`No option called ${option}`);
  return addChild(scope, r, selId, node.id);
}

/**
 * Test-only: a Novokh Combat Patrol (Core Book rules, so the Warlord takes a trait without a stratagem): an Overlord as
 * Warlord with Blood-Fuelled Fury (90 pts), a Royal Warden (70 pts) and five Immortals.
 */
export function novokhPatrol(scope: Scope): Roster {
  let r = startingRoster(scope, { name: 'Novokh Patrol', catalogueId: NECRONS, sizeId: 'combat-patrol', forceId: FORCE.patrol });
  const dynasty = armyChoices(scope, r).find((c) => c.title === 'Dynasty Choice')!;
  r = applyPicks(scope, r, [dynasty], { [dynasty.key]: dynasty.options.find((o) => o.name === 'Dynasty: Novokh')!.id });
  r = addNamed(scope, r, 'Overlord');
  const overlord = r.forces[0].selections.at(-1)!.id;
  r = pickOption(scope, r, overlord, 'Warlord');
  r = pickOption(scope, r, overlord, 'Warlord Trait (Novokh): Blood-Fuelled Fury');
  r = addNamed(scope, r, 'Royal Warden');
  return addNamed(scope, r, 'Immortals');
}

/** Test-only: a Necrons Onslaught with two Patrol Detachments, an Overlord in the first and Necron Warriors in the second. */
export function twoPatrols(scope: Scope): Roster {
  let r = startingRoster(scope, { name: 'Two Patrols', catalogueId: NECRONS, sizeId: 'onslaught', forceId: FORCE.patrol });
  r = addForce(scope, r, FORCE.patrol, NECRONS);
  r = addNamed(scope, r, 'Overlord', 0);
  return addNamed(scope, r, 'Necron Warriors', 1);
}
