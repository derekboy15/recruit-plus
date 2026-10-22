/** Moving between phases, steps, turns and battle rounds (TS §1.9). */
import { registerApplier } from '../core/apply';
import type { Ctx } from '../core/context';
import type { Phase, Step } from '../core/state';
import type { Evt, PlayerId } from '../core/types';

declare module '../core/types' {
  interface EventMap {
    phaseChanged: Evt<'phaseChanged'> & { round: number; turn: 'first' | 'second' | null; active: PlayerId; phase: Phase; step: Step };
  }
}

registerApplier('phaseChanged', (s, e) => {
  s.round = e.round;
  s.turn = e.turn;
  s.active = e.active;
  s.phase = e.phase;
  s.step = e.step;
});

export const PHASE_ORDER: Phase[] = ['command', 'movement', 'psychic', 'shooting', 'charge', 'fight', 'morale'];
export const PHASE_STEPS: Record<Phase, Step[]> = {
  'pre-battle': ['deploy', 'first-turn'],
  command: ['main'],
  movement: ['move-units', 'reinforcements'],
  psychic: ['main'],
  shooting: ['main'],
  charge: ['charges', 'heroic-interventions'],
  fight: ['main'],
  morale: ['morale-tests', 'coherency'],
  ended: ['main'],
};

/** Moves the game to a phase/step, emitting the change. Entry effects are added by the turn module (Task 7). */
export function goTo(ctx: Ctx, to: { round?: number; turn?: 'first' | 'second' | null; active?: PlayerId; phase: Phase; step?: Step }): void {
  const s = ctx.state;
  ctx.emit({
    type: 'phaseChanged',
    round: to.round ?? s.round,
    turn: to.turn === undefined ? s.turn : to.turn,
    active: to.active ?? s.active,
    phase: to.phase,
    step: to.step ?? PHASE_STEPS[to.phase][0],
  });
}
