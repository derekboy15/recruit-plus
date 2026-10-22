/** Stratagems and CP (CS §1): spend CP, each stratagem once per phase (same name = same stratagem), the CP gain cap. */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { registerInitialiser, type GameState } from '../core/state';
import type { Cmd, Evt, PlayerId } from '../core/types';
import { changeCp } from '../turn/command';
import { inBattle } from '../turn/phases';

declare module '../core/types' {
  interface CommandMap {
    useStratagem: Cmd<'useStratagem'> & { name: string; cp: number; unitIds: string[]; note: string };
    gainCp: Cmd<'gainCp'> & { amount: number; source: 'ability' | 'stratagem' };
  }
  interface EventMap {
    stratagemUsed: Evt<'stratagemUsed'> & { player: PlayerId; name: string; cp: number; phaseKey: string; unitIds: string[] };
  }
}
declare module '../core/state' {
  interface GameState {
    stratagemsUsed: { player: PlayerId; name: string; phaseKey: string }[];
  }
}

registerInitialiser((s) => {
  s.stratagemsUsed = [];
});

/** Identifies the current phase (before the battle: the pre-battle step, where the once-per-phase limit doesn't apply). */
export const phaseKey = (s: GameState) => `${s.round}-${s.turn}-${s.phase}`;

registerApplier('stratagemUsed', (s, e) => {
  s.cp[e.player] -= e.cp;
  s.stratagemsUsed = [...s.stratagemsUsed.filter((x) => x.phaseKey === e.phaseKey), { player: e.player, name: e.name, phaseKey: e.phaseKey }];
});

export function usedThisPhase(s: GameState, player: PlayerId, name: string): boolean {
  const k = phaseKey(s);
  return s.stratagemsUsed.some((x) => x.player === player && x.phaseKey === k && x.name.toLowerCase() === name.toLowerCase());
}

/** Spends CP on a stratagem, refusing if it was already used this phase (CS §1) or the player lacks the CP. */
export function spendStratagem(ctx: Ctx, player: PlayerId, name: string, cp: number, unitIds: string[] = []): void {
  const s = ctx.state;
  if (s.phase !== 'pre-battle' && usedThisPhase(s, player, name))
    ctx.reject('stratagem-once-per-phase', `You've already used ${name} this phase.`, '[CS §1]');
  if (cp > s.cp[player]) ctx.reject('not-enough-cp', `${name} costs ${cp} CP and you have ${s.cp[player]}.`, '[CS §1]');
  ctx.emit({ type: 'stratagemUsed', player, name, cp, phaseKey: phaseKey(s), unitIds });
}

export const canAfford = (s: GameState, player: PlayerId, name: string, cp: number) => s.cp[player] >= cp && !usedThisPhase(s, player, name);

registerHandler('useStratagem', (ctx, cmd) => {
  inBattle(ctx);
  spendStratagem(ctx, cmd.by, cmd.name.trim(), cmd.cp, cmd.unitIds);
});

/** TS §2: gains from abilities are capped at 1 CP per battle round; CP from stratagems isn't (FAQ §2.1). */
registerHandler('gainCp', (ctx, cmd) => {
  inBattle(ctx);
  if (cmd.amount <= 0) ctx.reject('bad-amount', 'Gain at least 1 CP.', '[TS §2]');
  const got = changeCp(ctx, cmd.by, cmd.amount, cmd.source === 'ability' ? 'gained from an ability' : 'gained from a stratagem', cmd.source === 'ability');
  if (got === 0) ctx.emit({ type: 'cpChanged', player: cmd.by, delta: 0, reason: 'no CP gained: the 1 CP per battle round limit is reached', capped: true });
});
