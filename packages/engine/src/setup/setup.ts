/** Checking a game setup before the game starts. */
import { registerSetupCheck } from '../core/record';
import type { GameSetup } from '../core/state';
import { CLOSE_COMBAT_WEAPON } from '../datasheet/profile';

/** Plain-English problems with the setup; empty when it can be played. */
export function validateSetup(s: GameSetup): string[] {
  const out: string[] = [];
  if (!Array.isArray(s.armies) || s.armies.length !== 2 || s.armies[0].player === s.armies[1].player)
    return ['A game needs two armies, one for each player.'];
  const ids = new Set<string>();
  for (const army of s.armies)
    for (const u of army.units) {
      if (ids.has(u.id)) out.push(`Two units share the id "${u.id}".`);
      ids.add(u.id);
      if (!u.models.length || u.models.every((m) => m.count < 1)) out.push(`${u.datasheet.name} has no models.`);
      for (const stack of u.models) {
        if (!u.datasheet.models.some((p) => p.name === stack.profile)) out.push(`${u.datasheet.name} has no model profile called "${stack.profile}".`);
        for (const w of stack.weapons)
          if (w !== CLOSE_COMBAT_WEAPON.name && !u.datasheet.weapons.some((x) => x.name === w)) out.push(`${u.datasheet.name} has no weapon called "${w}".`);
      }
    }
  for (const o of s.objectives ?? [])
    if (o.pos.x < 0 || o.pos.y < 0 || o.pos.x > s.board.w || o.pos.y > s.board.h) out.push(`Objective ${o.id} is off the battlefield.`);
  return out;
}

registerSetupCheck(validateSetup);
