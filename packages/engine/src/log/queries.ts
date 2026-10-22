/** Read-only questions the board UI, lessons and companion ask about the current state. */
import type { GameState, Phase, Step } from '../core/state';
import { other, type PlayerId } from '../core/types';
import { distance3d, within } from '../geometry/measure';
import { selectedOut } from '../interact/activation';
import type { Pending } from '../interact/windows';
import { isEngaged } from '../move/movement';
import { canFight, fightOrder } from '../phases/fight';
import { needsMoraleTest } from '../phases/morale';
import { onBoard, placedModel, sheetOf, unitHas, unitsOf } from '../setup/units';

export interface CurrentStep {
  round: number;
  active: PlayerId;
  phase: Phase;
  step: Step;
  pending: Pending | null;
  /** Who has to do something next. */
  actingPlayer: PlayerId;
  /** Units in the current activation, attack or decision (Milestone 5 shows their faction abilities and stratagems). */
  involvedUnitIds: string[];
}

export function currentStep(s: GameState): CurrentStep {
  const involved = new Set<string>();
  if (s.activation) involved.add(s.activation.unitId);
  if (s.activation?.kind === 'charge') s.activation.targets.forEach((t) => involved.add(t));
  if (s.attack) for (const g of s.attack.groups) (involved.add(g.attackerUnitId), involved.add(g.targetUnitId));
  if (s.pending?.kind === 'reaction' && s.pending.subjectUnitId) involved.add(s.pending.subjectUnitId);
  let acting: PlayerId = s.active;
  if (s.pending) acting = s.pending.player;
  else if (s.placements?.length) acting = s.placements[0].player;
  else if (s.phase === 'fight' && !s.activation) {
    // With no unit left to fight, the player whose turn it is ends the phase.
    const order = fightOrder(s);
    acting = order.selectable.length ? order.picker : s.active;
  } else if (s.phase === 'morale' && s.step === 'morale-tests' && needsMoraleTest(s).length)
    acting = needsMoraleTest(s, s.morale.next).length ? s.morale.next : other(s.morale.next);
  else if (s.phase === 'charge' && s.step === 'heroic-interventions') acting = other(s.active);
  return { round: s.round, active: s.active, phase: s.phase, step: s.step, pending: s.pending, actingPlayer: acting, involvedUnitIds: [...involved] };
}

export type EligibleKind = 'move' | 'shoot' | 'charge' | 'fight' | 'psychic' | 'morale' | 'heroic';

/** Units that could act now in the given way (a first filter: the command still checks everything). */
export function eligibleUnits(s: GameState, kind: EligibleKind): string[] {
  const mine = unitsOf(s, s.active).filter((u) => u.location === 'battlefield');
  switch (kind) {
    case 'move':
      return mine.filter((u) => !selectedOut(u, 'move') && !u.turn.arrived && !u.turn.brokeOut).map((u) => u.id);
    case 'shoot':
      return mine
        .filter((u) => !selectedOut(u, 'shoot') && !u.turn.brokeOut && (u.turn.moved !== 'fall-back' || unitHas(s, u.id, 'TITANIC')))
        .filter((u) => sheetOf(s, u.id).weapons.some((w) => w.type !== 'Melee'))
        .map((u) => u.id);
    case 'charge':
      return mine
        .filter((u) => !selectedOut(u, 'charge') && u.turn.moved !== 'advance' && u.turn.moved !== 'fall-back' && !u.turn.disembarkedFromDestroyed && !u.turn.brokeOut)
        .filter((u) => !isEngaged(s, u.id, true))
        .filter((u) =>
          unitsOf(s, other(s.active)).some((e) =>
            onBoard(s, e.id).some((x) => onBoard(s, u.id).some((m) => within(distance3d(placedModel(s, m), placedModel(s, x)), 12))),
          ),
        )
        .map((u) => u.id);
    case 'fight':
      return Object.values(s.units).filter((u) => canFight(s, u.id)).map((u) => u.id);
    case 'psychic':
      return mine.filter((u) => unitHas(s, u.id, 'PSYKER') && !s.psychic.done.includes(u.id) && u.turn.moved !== 'fall-back').map((u) => u.id);
    case 'morale':
      return needsMoraleTest(s);
    case 'heroic':
      return unitsOf(s, other(s.active))
        .filter((u) => u.location === 'battlefield' && unitHas(s, u.id, 'CHARACTER') && !u.turn.heroic && !isEngaged(s, u.id, true))
        .map((u) => u.id);
  }
}
