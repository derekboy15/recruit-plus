/** Transports (TS §3.4): embarking at the end of a move. Disembarking and destroyed transports are added in Task 10. */
import type { GameState } from '../core/state';
import type { Problem } from '../core/types';
import { horizontalGap, within } from '../geometry/measure';
import type { Placed } from '../geometry/shapes';
import { livingModels, onBoard, placedModel, sheetOf, unitHas } from '../setup/units';

/** Models already aboard (or about to be). */
export function passengers(s: GameState, transportId: string): number {
  return Object.values(s.units)
    .filter((u) => u.location === 'embarked' && u.embarkedIn === transportId)
    .reduce((a, u) => a + livingModels(s, u.id).length, 0);
}

/** Problems with embarking: every model ends within 3" of a friendly TRANSPORT not in enemy Engagement Range, with room. */
export function embarkProblems(s: GameState, unitId: string, transportId: string, placed: Placed[]): Problem[] {
  const u = s.units[unitId];
  const t = s.units[transportId];
  const rule = '[TS §3.4]';
  if (!t || t.player !== u.player || t.location !== 'battlefield' || !unitHas(s, t.id, 'TRANSPORT'))
    return [{ code: 'not-a-transport', message: 'Pick one of your Transports on the battlefield.', rule, unitId }];
  if (u.turn.disembarkedThisPhase) return [{ code: 'disembarked-this-phase', message: `${u.name} got out this phase, so it can't get back in.`, rule, unitId }];
  const out: Problem[] = [];
  const hull = onBoard(s, t.id).map((m) => placedModel(s, m));
  const far = placed.filter((p) => !hull.some((h) => within(horizontalGap(p, h), 3)));
  if (far.length) out.push({ code: 'too-far-to-embark', message: `Every model of ${u.name} must end within 3" of ${t.name} to embark.`, rule, unitId, modelIds: far.map((p) => p.id) });
  const engaged = Object.values(s.models).some(
    (m) => m.pos && !m.destroyed && s.units[m.unitId].player !== u.player && hull.some((h) => within(horizontalGap(h, placedModel(s, m)), 1) && Math.abs(h.pos.z - m.pos!.z) <= 5),
  );
  if (engaged) out.push({ code: 'transport-engaged', message: `${t.name} is within 1" of the enemy, so nothing can embark.`, rule, unitId });
  const capacity = sheetOf(s, t.id).transportCapacity;
  const count = passengers(s, t.id) + livingModels(s, unitId).length;
  if (capacity !== null && count > capacity) out.push({ code: 'transport-full', message: `${t.name} can carry ${capacity} models; that would be ${count}.`, rule, unitId });
  return out;
}
