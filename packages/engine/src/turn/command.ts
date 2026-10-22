/** The Command phase: the Battle-forged CP bonus (TS §2; both players every Command phase in Arks of Omen, GT §5) and the CP gain cap. */
import { registerApplier } from '../core/apply';
import type { Ctx } from '../core/context';
import { registerInitialiser } from '../core/state';
import type { Evt, PlayerId } from '../core/types';
import { registerEnter, registerRoundEnd } from './phases';

declare module '../core/types' {
  interface EventMap {
    cpChanged: Evt<'cpChanged'> & { player: PlayerId; delta: number; reason: string; capped?: boolean };
    roundCpReset: Evt<'roundCpReset'>;
  }
}
declare module '../core/state' {
  interface GameState {
    /** CP gained or refunded this battle round from rules subject to the 1 CP cap (TS §2). */
    cpGainedThisRound: Record<PlayerId, number>;
  }
}

registerInitialiser((s) => {
  s.cpGainedThisRound = { A: 0, B: 0 };
});

registerApplier('cpChanged', (s, e) => {
  s.cp[e.player] = Math.max(0, s.cp[e.player] + e.delta);
  if (e.capped && e.delta > 0) s.cpGainedThisRound[e.player] += e.delta;
});
registerApplier('roundCpReset', (s) => {
  s.cpGainedThisRound = { A: 0, B: 0 };
});

/** Changes a player's CP. `capped` gains count toward the 1-per-battle-round cap and are cut to fit it. */
export function changeCp(ctx: Ctx, player: PlayerId, delta: number, reason: string, capped = false): number {
  let d = delta;
  if (capped && d > 0) d = Math.max(0, Math.min(d, 1 - ctx.state.cpGainedThisRound[player]));
  if (d !== 0 || delta === 0) ctx.emit({ type: 'cpChanged', player, delta: d, reason, ...(capped ? { capped: true } : {}) });
  return d;
}

registerEnter('command', null, (ctx) => {
  const s = ctx.state;
  const gainers: PlayerId[] = s.setup.rules.cpEveryCommandPhase === 'both' ? ['A', 'B'] : [s.active];
  for (const p of gainers) changeCp(ctx, p, 1, 'Battle-forged CP bonus');
});

registerRoundEnd((ctx) => ctx.emit({ type: 'roundCpReset' }));
