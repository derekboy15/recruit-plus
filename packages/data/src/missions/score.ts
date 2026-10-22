/** Pure mission scoring: what a component scores for given inputs, what is due when, and the Command phase CP bonus. */
import type { CpRule, PlayerKey, ScoringComponent, When } from './types';

export interface ComponentInput {
  controlled?: number;
  opponentControlled?: number;
  flags?: Record<string, boolean>;
  counts?: Record<string, number>;
  pick?: string;
}

/** Take and Hold: 1+, 2+, more than the opponent. Domination: 2+, 3+, more than the opponent. */
export function holdConditions(mode: 'take-and-hold' | 'domination', controlled: number, opponentControlled: number): number {
  const [a, b] = mode === 'take-and-hold' ? [1, 2] : [2, 3];
  return Number(controlled >= a) + Number(controlled >= b) + Number(controlled > opponentControlled);
}

export function scoreComponent(c: ScoringComponent, input: ComponentInput, ctx: { round: number; player: PlayerKey }): number {
  if (c.kind === 'hold') {
    const vp = c.vpPerCondition * holdConditions(c.mode, input.controlled ?? 0, input.opponentControlled ?? 0);
    return Math.min(vp, c.max ?? c.vpPerCondition * 3);
  }
  const flags = input.flags ?? {};
  const counts = input.counts ?? {};
  if (c.lines.some((l) => l.kind === 'flag' && l.gate && !flags[l.id])) return 0;
  const values: number[] = [];
  let setFlags = 0;
  for (const l of c.lines) {
    if (l.kind === 'flag') {
      if (!flags[l.id]) continue;
      if (!l.gate) setFlags++;
      values.push(l.vp);
    } else if (l.kind === 'count') {
      const each = typeof l.vpEach === 'number' ? l.vpEach : (l.vpEach[String(ctx.round)] ?? 0);
      values.push(each * Math.max(0, counts[l.id] ?? 0));
    } else if (l.kind === 'table') {
      const n = Math.max(0, counts[l.id] ?? 0);
      values.push(l.vpByCount[Math.min(n, l.vpByCount.length - 1)] ?? 0);
    } else {
      const option = l.options.find((o) => o.id === input.pick);
      values.push(option?.vp[ctx.player] ?? 0);
    }
  }
  const vp =
    c.combine === 'sum' ? values.reduce((a, b) => a + b, 0)
    : c.combine === 'max' ? Math.max(0, ...values)
    : (c.combine.byCount[Math.min(setFlags, c.combine.byCount.length - 1)] ?? 0);
  return c.max === undefined ? vp : Math.min(vp, c.max);
}

/** The components due at a moment. `activeIsFirst`: the player whose turn it is took the first turn. */
export function dueComponents(components: ScoringComponent[], moment: { at: When; round: number; activeIsFirst: boolean }): ScoringComponent[] {
  return components.filter((c) => {
    if (!c.rounds.includes(moment.round)) return false;
    const shifted = c.kind === 'hold' && c.round5SecondPlayer === 'end-of-turn' && moment.round === 5 && !moment.activeIsFirst;
    return (shifted ? 'end-of-turn' : c.when) === moment.at;
  });
}

/** The CP bonus for `player` at the start of `active`'s Command phase: the base CP, and the gates and extras in play. */
export function cpBonusPlan(rule: CpRule, ctx: { round: number; player: PlayerKey; active: PlayerKey }): { base: number; gates: CpRule['gates']; extras: CpRule['extras'] } {
  const inRound = (r?: number[]) => !r || r.includes(ctx.round);
  if (rule.who === 'active' && ctx.player !== ctx.active) return { base: 0, gates: [], extras: [] };
  const gates = rule.gates.filter((g) => inRound(g.rounds));
  const lost = gates.some((g) => !g.question);
  const extras = ctx.player === ctx.active ? rule.extras.filter((e) => inRound(e.rounds)) : [];
  return { base: lost ? 0 : 1, gates: lost ? [] : gates, extras };
}
