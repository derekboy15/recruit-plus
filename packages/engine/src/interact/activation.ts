/** The unit currently being activated (moving, charging, fighting…) and how often each unit has been selected this phase. */
import { registerApplier } from '../core/apply';
import type { Ctx } from '../core/context';
import { registerInitialiser } from '../core/state';
import type { Evt } from '../core/types';
import type { ActivationKind, UnitState } from '../setup/units';

/** Modules add their activation shapes: `declare module '../interact/activation' { interface ActivationMap { … } }`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ActivationMap {}
export type Activation = ActivationMap[keyof ActivationMap];

declare module '../core/state' {
  interface GameState {
    activation: Activation | null;
  }
}
declare module '../core/types' {
  interface EventMap {
    activationSet: Evt<'activationSet'> & { activation: Activation };
    activationCleared: Evt<'activationCleared'>;
    unitSelected: Evt<'unitSelected'> & { unitId: string; kind: ActivationKind; delta: 1 | -1 };
  }
}

registerInitialiser((s) => {
  s.activation = null;
});
registerApplier('activationSet', (s, e) => {
  s.activation = e.activation;
});
registerApplier('activationCleared', (s) => {
  s.activation = null;
});
registerApplier('unitSelected', (s, e) => {
  const t = s.units[e.unitId].turn;
  t.selected[e.kind] = (t.selected[e.kind] ?? 0) + e.delta;
});

/** Has the unit used all its selections of this kind this phase (once, plus any extra activations)? */
export const selectedOut = (u: UnitState, kind: ActivationKind) => (u.turn.selected[kind] ?? 0) >= 1 + (u.turn.extra[kind] ?? 0);

export function noActivation(ctx: Ctx): void {
  if (ctx.state.activation) ctx.reject('activation-open', `Finish what ${ctx.state.units[ctx.state.activation.unitId]?.name ?? 'the current unit'} is doing first.`, '[R-19]');
}
