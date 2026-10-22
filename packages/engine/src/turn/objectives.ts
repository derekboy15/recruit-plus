/** Objective markers, control (TS §9), primary scoring (MP §5, GT §5), VP and caps, conceding and the end of the game. */
import { registerApplier } from '../core/apply';
import { registerHandler, type Ctx } from '../core/context';
import { registerInitialiser, type GameState } from '../core/state';
import { other, type Cmd, type Evt, type PlayerId } from '../core/types';
import { has } from '../datasheet/profile';
import { gapToPoint, within } from '../geometry/measure';
import { placedModel, removeModels, sheetOf, type ModelState } from '../setup/units';
import { endGame, inBattle, registerLeave, registerRoundEnd, registerTurnEnd } from './phases';

declare module '../core/types' {
  interface CommandMap {
    scoreVp: Cmd<'scoreVp'> & { player: PlayerId; category: 'secondary' | 'painted'; name?: string; amount: number };
    concede: Cmd<'concede'>;
    endGame: Cmd<'endGame'>;
  }
  interface EventMap {
    vpScored: Evt<'vpScored'> & { player: PlayerId; category: 'primary' | 'secondary' | 'painted'; name?: string; amount: number; reason: string };
    objectiveSet: Evt<'objectiveSet'> & { objectiveId: string; owner: PlayerId | null; sticky: boolean };
  }
}

export interface Vp { primary: number; secondary: Record<string, number>; painted: number }
declare module '../core/state' {
  interface GameState {
    vp: Record<PlayerId, Vp>;
    /** Sticky control set by mission or faction rules through the toolkit: holds until the opponent controls it. */
    objectives: Record<string, { owner: PlayerId | null; sticky: boolean }>;
  }
}

registerInitialiser((s, setup) => {
  s.vp = { A: { primary: 0, secondary: {}, painted: 0 }, B: { primary: 0, secondary: {}, painted: 0 } };
  s.objectives = Object.fromEntries(setup.objectives.map((o) => [o.id, { owner: null, sticky: false }]));
});

registerApplier('vpScored', (s, e) => {
  const v = s.vp[e.player];
  if (e.category === 'primary') v.primary += e.amount;
  else if (e.category === 'painted') v.painted += e.amount;
  else v.secondary[e.name ?? 'Secondary'] = (v.secondary[e.name ?? 'Secondary'] ?? 0) + e.amount;
});

registerApplier('objectiveSet', (s, e) => {
  s.objectives[e.objectiveId] = { owner: e.owner, sticky: e.sticky };
});

/** The 40mm objective marker's radius (TS §9). */
export const MARKER_RADIUS = 20 / 25.4;

/** Is the model within 3" horizontally and 5" vertically of the marker (measured to its edge)? */
export function inRangeOfObjective(s: GameState, m: ModelState, pos: { x: number; y: number }): boolean {
  if (!m.pos) return false;
  return within(gapToPoint(placedModel(s, m), pos) - MARKER_RADIUS, 3) && within(m.pos.z, 5);
}

/** Does this model count for objectives at all? AIRCRAFT and Fortifications never do (TS §9). */
function counts(s: GameState, m: ModelState): boolean {
  const u = s.units[m.unitId];
  if (m.destroyed || !m.pos || u.location !== 'battlefield') return false;
  const ds = sheetOf(s, u.id);
  return !has(ds, 'AIRCRAFT') && ds.role !== 'Fortification' && !has(ds, 'FORTIFICATION');
}

/** Objective Secured, unless an effect or toolkit flag removes or grants it (removal always wins, TS §9 June 2021). */
export function hasObjectiveSecured(s: GameState, unitId: string): boolean {
  const flag = s.units[unitId].flags.objectiveSecured;
  if (flag === false) return false;
  return flag === true || sheetOf(s, unitId).objectiveSecured;
}

/** Who controls each marker now (TS §9, R-13). */
export function objectiveControl(s: GameState): Record<string, PlayerId | null> {
  const markers = s.setup.objectives;
  const tally = Object.fromEntries(markers.map((o) => [o.id, { A: 0, B: 0, obsecA: false, obsecB: false }]));
  for (const m of Object.values(s.models)) {
    if (!counts(s, m)) continue;
    // R-13: a model in range of several markers counts only for the nearest (first in setup order on a tie).
    let best: { id: string; d: number } | null = null;
    for (const o of markers) {
      if (!inRangeOfObjective(s, m, o.pos)) continue;
      const d = gapToPoint(placedModel(s, m), o.pos);
      if (!best || d < best.d - 1e-9) best = { id: o.id, d };
    }
    if (!best) continue;
    const u = s.units[m.unitId];
    const t = tally[best.id];
    t[u.player] += sheetOf(s, u.id).ocPerModel;
    if (hasObjectiveSecured(s, u.id)) {
      if (u.player === 'A') t.obsecA = true;
      else t.obsecB = true;
    }
  }
  const out: Record<string, PlayerId | null> = {};
  for (const o of markers) {
    const t = tally[o.id];
    let owner: PlayerId | null;
    if (t.obsecA && !t.obsecB) owner = 'A';
    else if (t.obsecB && !t.obsecA) owner = 'B';
    else owner = t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
    const sticky = s.objectives[o.id];
    if (!owner && sticky?.sticky && sticky.owner) owner = sticky.owner;
    out[o.id] = owner;
  }
  return out;
}

/** How many of the primary's conditions the player meets now (MP §5: Take and Hold 1+, 2+, more; Domination 2+, 3+, more). */
export function primaryConditions(s: GameState, p: PlayerId): number {
  const control = objectiveControl(s);
  const held = Object.values(control).filter((x) => x === p).length;
  const opp = Object.values(control).filter((x) => x === other(p)).length;
  const t = s.setup.rules.primary.kind === 'domination' ? [2, 3] : [1, 2];
  return [held >= t[0], held >= t[1], held > opp].filter(Boolean).length;
}

/** Scores VP, cutting anything above the caps (MP §5). */
export function scoreVp(ctx: Ctx, player: PlayerId, category: 'primary' | 'secondary' | 'painted', amount: number, reason: string, name?: string): void {
  const s = ctx.state;
  const caps = s.setup.rules.vpCaps;
  const v = s.vp[player];
  const have = category === 'primary' ? v.primary : category === 'painted' ? v.painted : (v.secondary[name ?? 'Secondary'] ?? 0);
  const cap = category === 'primary' ? caps.primary : category === 'painted' ? caps.painted : caps.secondary;
  const add = Math.max(-have, Math.min(amount, cap - have));
  if (add !== 0) ctx.emit({ type: 'vpScored', player, category, amount: add, reason, ...(name ? { name } : {}) });
}

function scorePrimary(ctx: Ctx): void {
  const s = ctx.state;
  const p = s.active;
  const r = s.setup.rules.primary;
  const vp = Math.min(r.maxPerTurn, primaryConditions(s, p) * r.vpPerCondition);
  if (vp > 0) scoreVp(ctx, p, 'primary', vp, `primary objective, battle round ${s.round}`);
}

const secondScoresAtEnd = (s: GameState) =>
  s.round === s.setup.rules.battleRounds && s.turn === 'second' && s.setup.rules.secondPlayerRound5 === 'end-of-turn';

/** MP §5: primaries score at the end of the active player's Command phase from battle round 2. */
registerLeave('command', null, (ctx) => {
  const s = ctx.state;
  if (s.round >= 2 && !secondScoresAtEnd(s)) scorePrimary(ctx);
});

/** GT §5: in the last round the second player scores at the end of their turn instead. */
registerTurnEnd((ctx) => {
  if (secondScoresAtEnd(ctx.state)) scorePrimary(ctx);
});

/** Sticky objectives stop being sticky once the opponent controls them. */
registerTurnEnd((ctx) => updateSticky(ctx));
export function updateSticky(ctx: Ctx): void {
  const s = ctx.state;
  const control = objectiveControl(s);
  for (const [id, o] of Object.entries(s.objectives))
    if (o.sticky && o.owner && control[id] === other(o.owner)) ctx.emit({ type: 'objectiveSet', objectiveId: id, owner: control[id], sticky: false });
}

/** TS §3.2 / MP §4: reserves not on the battlefield at the end of the deadline round are destroyed. */
registerRoundEnd((ctx) => {
  const s = ctx.state;
  if (s.round !== s.setup.rules.reservesDeadlineRound) return;
  const offTable = Object.values(s.units).filter((u) => u.location === 'reserves');
  const riders = Object.values(s.units).filter((u) => u.location === 'embarked' && offTable.some((t) => t.id === u.embarkedIn));
  const ids = [...offTable, ...riders].flatMap((u) => u.modelIds.filter((m) => !s.models[m].destroyed));
  if (ids.length) removeModels(ctx, ids, 'not arrived from reserves by the end of battle round 3', false);
});

registerHandler('scoreVp', (ctx, cmd) => {
  inBattle(ctx);
  if (cmd.amount === 0) return;
  scoreVp(ctx, cmd.player, cmd.category, cmd.amount, 'scored by hand', cmd.category === 'secondary' ? (cmd.name ?? 'Secondary') : undefined);
});

registerHandler('concede', (ctx, cmd) => {
  inBattle(ctx);
  endGame(ctx, 'concede', cmd.by);
});

registerHandler('endGame', (ctx) => {
  inBattle(ctx);
  endGame(ctx, 'agreed');
});
