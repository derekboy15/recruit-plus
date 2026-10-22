/** CS §2 Desperate Breakout: 2 CP, an engaged unit that hasn't moved; 1s die, then a Fall Back through enemy models. */
import { registerApplier } from '../core/apply';
import { registerHandler } from '../core/context';
import type { Cmd, Evt } from '../core/types';
import { casualtyOrder } from '../attack/allocate';
import { noActivation, selectedOut } from '../interact/activation';
import { spendStratagem } from '../interact/stratagems';
import { livingModels, removeModels } from '../setup/units';
import { isEngaged, moveGuards, setBreakoutRemoval } from './movement';

declare module '../core/types' {
  interface CommandMap {
    desperateBreakout: Cmd<'desperateBreakout'> & { unitId: string };
  }
  interface EventMap {
    brokeOut: Evt<'brokeOut'> & { unitId: string };
  }
}

registerApplier('brokeOut', (s, e) => {
  s.units[e.unitId].turn.brokeOut = true;
});

setBreakoutRemoval((ctx, ids) => removeModels(ctx, ids, 'caught at the end of a Desperate Breakout', true));

registerHandler('desperateBreakout', (ctx, cmd) => {
  const u = moveGuards(ctx, cmd.by, cmd.unitId);
  noActivation(ctx);
  const s = ctx.state;
  if (selectedOut(u, 'move')) ctx.reject('already-moved', `${u.name} has already been selected to move this phase.`, '[CS §2]', { unitId: u.id });
  if (!isEngaged(s, u.id)) ctx.reject('not-engaged', `${u.name} isn't within 1" of an enemy unit.`, '[CS §2]', { unitId: u.id });
  spendStratagem(ctx, cmd.by, 'Desperate Breakout', 2, [u.id]);
  ctx.emit({ type: 'unitSelected', unitId: u.id, kind: 'move', delta: 1 });
  ctx.emit({ type: 'brokeOut', unitId: u.id });
  const ones = ctx.roll(livingModels(s, u.id).length, 6, 'other', cmd.by, { context: 'Desperate Breakout' }).dice.filter((d) => d.value === 1).length;
  if (ones) removeModels(ctx, casualtyOrder(ctx.state, u.id).slice(0, ones).map((m) => m.id), 'Desperate Breakout', true);
  if (livingModels(ctx.state, u.id).length)
    ctx.emit({ type: 'activationSet', activation: { kind: 'move', unitId: u.id, moveKind: 'fall-back', bonus: 0, rolled: true, breakout: true } });
});
