/**
 * The Psychic phase (PP; TS §4): Psychic tests, Perils of the Warp, Deny the Witch, Smite and psychic actions. Effects
 * of powers other than Smite are applied by the players (assisted, spec §3.3).
 */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { total } from '../core/dice';
import { registerInitialiser, type GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId } from '../core/types';
import { horizontalGap, distance3d, within } from '../geometry/measure';
import { inflictMortalWounds } from '../attack/allocate';
import { noActivation } from '../interact/activation';
import { effectsFor } from '../interact/effects';
import { noPending, offerReaction, registerContinuation, rollWindowed } from '../interact/windows';
import { modelView, onBoard, placedModel, sheetOf, unitHas, unitsOf, unitView, type ModelState } from '../setup/units';
import { unitVisibleTo } from '../terrain/visibility';
import { inBattle, PHASE_ORDER, registerLeave, registerRoundEnd } from '../turn/phases';

declare module '../core/types' {
  interface CommandMap {
    manifest: Cmd<'manifest'> & { unitId: string; power: string; wc?: number; targetUnitId?: string };
    psychicAction: Cmd<'psychicAction'> & { unitId: string; action: string; wc: number };
  }
  interface EventMap {
    psychicAttempt: Evt<'psychicAttempt'> & { unitId: string; power: string; wc: number; smite: boolean; action: boolean };
    denyUsed: Evt<'denyUsed'> & { unitId: string };
    powerDenied: Evt<'powerDenied'> & { unitId: string; power: string; by: string };
    powerFailed: Evt<'powerFailed'> & { unitId: string; power: string; reason: string };
    powerManifested: Evt<'powerManifested'> & { unitId: string; power: string; total: number; targetUnitId?: string };
    psychicActionCompleted: Evt<'psychicActionCompleted'> & { unitId: string; action: string };
    psychicReset: Evt<'psychicReset'> & { scope: 'phase' | 'round' };
  }
}

export interface PsychicState {
  /** The psyker currently manifesting, and psykers that have finished this phase (PP §2). */
  current: string | null;
  done: string[];
  /** Smite attempts by each army this phase (PP §5). */
  smites: Record<PlayerId, number>;
  /** Non-Smite powers attempted by each army this battle round (PP §4), and psykers that attempted Smite. */
  powersThisRound: Record<PlayerId, string[]>;
  smitedThisRound: string[];
  /** Deny attempts made by each psyker this phase. */
  denies: Record<string, number>;
  /** Psykers that attempted a psychic action this battle round (PP §7). */
  actedThisRound: string[];
}
declare module '../core/state' {
  interface GameState {
    psychic: PsychicState;
  }
}

const fresh = (): PsychicState => ({ current: null, done: [], smites: { A: 0, B: 0 }, powersThisRound: { A: [], B: [] }, smitedThisRound: [], denies: {}, actedThisRound: [] });
registerInitialiser((s) => {
  s.psychic = fresh();
});
registerApplier('psychicAttempt', (s, e) => {
  const p = s.psychic;
  const player = s.units[e.unitId].player;
  if (p.current && p.current !== e.unitId) p.done.push(p.current);
  p.current = e.unitId;
  s.units[e.unitId].turn.psychicAttempts += 1;
  if (e.action) p.actedThisRound.push(e.unitId);
  else if (e.smite) {
    p.smites[player] += 1;
    p.smitedThisRound.push(e.unitId);
  } else p.powersThisRound[player].push(e.power.toLowerCase());
});
registerApplier('denyUsed', (s, e) => {
  s.psychic.denies[e.unitId] = (s.psychic.denies[e.unitId] ?? 0) + 1;
});
for (const t of ['powerDenied', 'powerFailed', 'powerManifested', 'psychicActionCompleted'] as const) registerApplier(t, () => {});
registerApplier('psychicReset', (s, e) => {
  const p = s.psychic;
  if (e.scope === 'round') s.psychic = fresh();
  else s.psychic = { ...fresh(), powersThisRound: p.powersThisRound, smitedThisRound: p.smitedThisRound, actedThisRound: p.actedThisRound };
});

for (const phase of PHASE_ORDER) if (phase === 'psychic') registerLeave(phase, null, (ctx) => ctx.emit({ type: 'psychicReset', scope: 'phase' }));
registerRoundEnd((ctx) => ctx.emit({ type: 'psychicReset', scope: 'round' }));

function psychicGuards(ctx: Ctx, by: PlayerId, unitId: string) {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[unitId];
  if (!u || u.player !== by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[PP §2]');
  if (by !== s.active || s.phase !== 'psychic') ctx.reject('wrong-phase', 'Psykers manifest powers in your Psychic phase.', '[PP §1]');
  const ds = sheetOf(s, unitId);
  if (!unitHas(s, unitId, 'PSYKER') || !ds.psyker) ctx.reject('not-a-psyker', `${u.name} isn't a Psyker.`, '[PP §2]');
  if (u.location !== 'battlefield') ctx.reject('not-on-battlefield', `${u.name} isn't on the battlefield.`, '[PP §2]');
  if (u.turn.moved === 'fall-back' && !unitHas(s, unitId, 'TITANIC')) ctx.reject('fell-back', `${u.name} Fell Back this turn, so it can't manifest powers.`, '[PP §2]', { unitId });
  if (u.turn.brokeOut || u.turn.arrivedLarge) ctx.reject('cannot-act', `${u.name} can't do anything else this turn.`, '[CS §2]', { unitId });
  if (s.psychic.done.includes(unitId) || (s.psychic.current && s.psychic.current !== unitId && s.psychic.done.includes(unitId)))
    ctx.reject('psyker-done', `${u.name} has finished in this phase: each psyker makes all its attempts before the next one.`, '[PP §2]', { unitId });
  if (s.psychic.actedThisRound.includes(unitId) && s.psychic.current === unitId)
    ctx.reject('psychic-action-done', `${u.name} attempted a psychic action instead of manifesting powers.`, '[PP §7]', { unitId });
  return { u, ds };
}

registerHandler('manifest', (ctx, cmd) => {
  const { u, ds } = psychicGuards(ctx, cmd.by, cmd.unitId);
  const s = ctx.state;
  if (u.turn.psychicAttempts >= ds.psyker!.cast) ctx.reject('no-attempts-left', `${u.name} can attempt ${ds.psyker!.cast} power${ds.psyker!.cast === 1 ? '' : 's'} per Psychic phase.`, '[PP §2]', { unitId: u.id });
  const known = ds.psyker!.powers.find((p) => p.name.toLowerCase() === cmd.power.trim().toLowerCase());
  const smite = known?.smite ?? cmd.power.trim().toLowerCase() === 'smite';
  if (!known && !smite && cmd.wc === undefined) ctx.reject('unknown-power', `${u.name}'s profile doesn't list ${cmd.power}: enter its warp charge.`, '[PP §3]', { unitId: u.id });
  if (smite) {
    if (s.psychic.smitedThisRound.includes(u.id)) ctx.reject('smite-once', `${u.name} has already attempted Smite this battle round.`, '[PP §5]', { unitId: u.id });
  } else if (s.psychic.powersThisRound[cmd.by].includes(cmd.power.trim().toLowerCase()))
    ctx.reject('power-once-per-round', `Your army has already attempted ${cmd.power} this battle round.`, '[PP §4]', { unitId: u.id });
  // PP §5: Smite is WC 5, +1 for each other Smite attempt by your army this phase.
  const wc = smite ? 5 + s.psychic.smites[cmd.by] : (cmd.wc ?? known!.wc ?? 0);
  ctx.emit({ type: 'psychicAttempt', unitId: u.id, power: smite ? 'Smite' : cmd.power.trim(), wc, smite, action: false });
  for (const h of psychicHooks) h(ctx, u.id);
  rollWindowed(ctx, 2, 6, 'psychic', cmd.by, { whole: true, context: `${u.name}: Psychic test for ${smite ? 'Smite' : cmd.power} (${wc}+)`, then: { module: 'psychic', step: 'tested', data: { unitId: u.id, power: smite ? 'Smite' : cmd.power.trim(), wc, smite, targetUnitId: cmd.targetUnitId } } });
});

registerHandler('psychicAction', (ctx, cmd) => {
  const { u } = psychicGuards(ctx, cmd.by, cmd.unitId);
  if (u.turn.psychicAttempts > 0) ctx.reject('already-manifested', `${u.name} has already attempted powers this phase: a psychic action replaces them.`, '[PP §7]', { unitId: u.id });
  if (ctx.state.psychic.actedThisRound.includes(u.id)) ctx.reject('psychic-action-done', `${u.name} has already attempted a psychic action this battle round.`, '[PP §7]', { unitId: u.id });
  ctx.emit({ type: 'psychicAttempt', unitId: u.id, power: cmd.action, wc: cmd.wc, smite: false, action: true });
  rollWindowed(ctx, 2, 6, 'psychic', cmd.by, { whole: true, context: `${u.name}: Psychic test for ${cmd.action} (${cmd.wc}+)`, then: { module: 'psychic', step: 'tested', data: { unitId: u.id, power: cmd.action, wc: cmd.wc, smite: false, action: true } } });
});

interface Attempt { unitId: string; power: string; wc: number; smite: boolean; action?: boolean; targetUnitId?: string }

registerContinuation('psychic', 'tested', (ctx, d: Attempt & { rollId: string }) => {
  const s = ctx.state;
  const roll = s.rolls[d.rollId];
  const mod = effectsFor(s, d.unitId, 'self').reduce((a, e) => a + (e.kind === 'mod' && e.roll === 'psychic' ? e.value : 0), 0);
  const result = total(roll) + mod;
  const [a, b] = roll.dice.map((x) => x.value);
  const player = s.units[d.unitId].player;
  if (a === b && (a === 1 || a === 6)) {
    // PP §6 Perils of the Warp: D3 mortal wounds; if it kills the psyker the power fails and units within 6" suffer D3.
    const last = onBoard(s, d.unitId).map((m) => placedModel(s, m));
    const n = ctx.roll(1, 3, 'perils', player, { context: 'Perils of the Warp' }).dice[0].value;
    inflictMortalWounds(ctx, d.unitId, n, 'Perils of the Warp');
    if (ctx.state.units[d.unitId].location === 'destroyed') {
      for (const u of Object.values(ctx.state.units)) {
        if (u.id === d.unitId || u.location !== 'battlefield') continue;
        if (!onBoard(ctx.state, u.id).some((m) => last.some((p) => within(horizontalGap(p, placedModel(ctx.state, m)), 6)))) continue;
        const mw = ctx.roll(1, 3, 'perils', player, { context: `Perils of the Warp: ${u.name}` }).dice[0].value;
        inflictMortalWounds(ctx, u.id, mw, 'Perils of the Warp');
      }
      ctx.emit({ type: 'powerFailed', unitId: d.unitId, power: d.power, reason: 'the psyker was destroyed by Perils of the Warp' });
      return;
    }
  }
  if (result < d.wc) {
    ctx.emit({ type: 'powerFailed', unitId: d.unitId, power: d.power, reason: `the Psychic test was ${result}` });
    return;
  }
  // PP §4 Deny the Witch: one enemy psyker within 24" with a deny left may try once.
  const caster = onBoard(s, d.unitId).map((m) => placedModel(s, m));
  const deniers = unitsOf(s, other(player)).filter((u) => {
    const ds = sheetOf(s, u.id);
    if (u.location !== 'battlefield' || !ds.psyker || !unitHas(s, u.id, 'PSYKER')) return false;
    if ((s.psychic.denies[u.id] ?? 0) >= ds.psyker.deny) return false;
    return onBoard(s, u.id).some((m) => caster.some((c) => within(distance3d(c, placedModel(s, m)), 24)));
  });
  offerReaction(ctx, {
    reaction: 'deny',
    player: other(player),
    subjectUnitId: d.unitId,
    options: deniers.length ? ['deny'] : [],
    then: { module: 'psychic', step: 'denyChosen', data: { ...d, result, deniers: deniers.map((u) => u.id) } },
  });
});

registerContinuation('psychic', 'denyChosen', (ctx, d: Attempt & { result: number; deniers: string[]; choice: string }) => {
  const denier = d.choice.startsWith('deny') ? (d.choice.split(':')[1] ?? d.deniers[0]) : null;
  if (!denier) return resolve(ctx, d);
  if (!d.deniers.includes(denier)) ctx.reject('bad-denier', 'That psyker can\'t deny this power.', '[PP §4]');
  ctx.emit({ type: 'denyUsed', unitId: denier });
  rollWindowed(ctx, 2, 6, 'deny', ctx.state.units[denier].player, { whole: true, context: `Deny the Witch (beat ${d.result})`, then: { module: 'psychic', step: 'denyRolled', data: { ...d, denier } } });
});

registerContinuation('psychic', 'denyRolled', (ctx, d: Attempt & { result: number; denier: string; rollId: string }) => {
  if (total(ctx.state.rolls[d.rollId]) > d.result) {
    ctx.emit({ type: 'powerDenied', unitId: d.unitId, power: d.power, by: d.denier });
    return;
  }
  resolve(ctx, d);
});

/** PP §5 Smite: D3 mortal wounds (D6 on a test of 11+) to the closest visible enemy unit within 18". */
function resolve(ctx: Ctx, d: Attempt & { result: number }): void {
  const s = ctx.state;
  if (d.action) {
    ctx.emit({ type: 'psychicActionCompleted', unitId: d.unitId, action: d.power });
    return;
  }
  if (!d.smite) {
    ctx.emit({ type: 'powerManifested', unitId: d.unitId, power: d.power, total: d.result, ...(d.targetUnitId ? { targetUnitId: d.targetUnitId } : {}) });
    return;
  }
  const target = smiteTarget(s, d.unitId);
  ctx.emit({ type: 'powerManifested', unitId: d.unitId, power: 'Smite', total: d.result, ...(target ? { targetUnitId: target } : {}) });
  if (!target) return;
  const n = total(ctx.roll(1, d.result >= 11 ? 6 : 3, 'smite', s.units[d.unitId].player, { context: 'Smite' }));
  inflictMortalWounds(ctx, target, n, 'Smite');
}

export function smiteTarget(s: GameState, psykerId: string): string | null {
  const caster = onBoard(s, psykerId);
  let best: { id: string; d: number } | null = null;
  for (const u of unitsOf(s, other(s.units[psykerId].player))) {
    if (u.location !== 'battlefield' || !onBoard(s, u.id).length) continue;
    if (!caster.some((m: ModelState) => unitVisibleTo(modelView(s, m), unitView(s, u.id), s.setup.terrain))) continue;
    const d = Math.min(...caster.flatMap((c) => onBoard(s, u.id).map((m) => distance3d(placedModel(s, c), placedModel(s, m)))));
    if (d <= 18 + 1e-6 && (!best || d < best.d - 1e-9)) best = { id: u.id, d };
  }
  return best?.id ?? null;
}

type Hook = (ctx: Ctx, unitId: string) => void;
const psychicHooks: Hook[] = [];
/** Runs when a psyker attempts to manifest a power (its action fails, Task 18). */
export function registerPsychicHook(fn: Hook): void {
  psychicHooks.push(fn);
}
