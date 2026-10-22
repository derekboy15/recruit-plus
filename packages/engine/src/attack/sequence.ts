/**
 * The attack sequence (TS §5.6) for a unit's shooting, Overwatch or fight: groups of identical attacks ("fast dice")
 * go through number of attacks → hit → wound → allocate and save → damage, each roll in a window (Task 8). Mortal
 * wounds added during the sequence are applied after all its normal damage (FAQ §2.1).
 */
import { registerApplier } from '../core/apply';
import type { Ctx } from '../core/context';
import { isRandom, total, type Die } from '../core/dice';
import { registerInitialiser, type GameState } from '../core/state';
import { other, type Evt, type PlayerId } from '../core/types';
import type { WeaponProfile } from '../datasheet/types';
import { effectsFor } from '../interact/effects';
import { registerContinuation, rollWindowed, runContinuation, type Continuation } from '../interact/windows';
import { charsOf, livingModels, modelView, placedModel, sheetOf, unitHas, type ModelState } from '../setup/units';
import { coverFor } from '../terrain/cover';
import { allocationTarget, feelNoPain, inflictMortalWounds, loseWounds, setMortalQueue } from './allocate';
import { bestSave, blastShots, capMod, hitSucceeds, majorityToughness, saveSucceeds, strengthOf, woundNeeded, woundSucceeds, type SaveChoice } from './resolve';

export interface AttackGroup {
  attackerUnitId: string;
  /** The models making these attacks. */
  modelIds: string[];
  weapon: WeaponProfile;
  targetUnitId: string;
  melee: boolean;
  /** Melee: attacks each model makes with this weapon (assigned when it fights). */
  attacksPerModel?: Record<string, number>;
  /** Models within half range: Rapid Fire doubles, Dakka uses its short value (TS §5.4). */
  closeModels?: string[];
  /** Models in the target unit when it was targeted (Blast, TS §5.5). */
  targetModels: number;
  hitMods: { source: string; value: number }[];
  /** Indirect Fire at a target the firer can't see: BS 1 worse, +1 to the armour save (R-1). */
  indirect?: boolean;
  /** Overwatch hits only on an unmodified 6 (5 with Hold Steady) (CS §2). */
  overwatch?: { needs: 5 | 6 };
  /** Big Guns Never Tire: these engaged enemy units must be destroyed before this group resolves (TS §5.2). */
  requiresClear?: string[];
  ignoreCover?: boolean;
}

type Stage = 'attacks' | 'hit' | 'wound' | 'save' | 'damage' | 'done';
export interface AttackSequence {
  id: string;
  kind: 'shooting' | 'melee' | 'overwatch';
  player: PlayerId;
  groups: AttackGroup[];
  index: number;
  stage: Stage;
  attacks: number;
  hits: number;
  wounds: number;
  /** Failed saves waiting for damage. */
  failed: number;
  /** Per group: what happened, for the log. */
  results: { attacks: number; hits: number; wounds: number; unsaved: number; lost?: string }[];
  /** Mortal wounds to apply when the sequence ends, by unit. */
  mortals: Record<string, number>;
  onDone: Continuation;
}

declare module '../core/state' {
  interface GameState {
    attack: AttackSequence | null;
    nextAttack: number;
  }
}
declare module '../core/types' {
  interface EventMap {
    attackStarted: Evt<'attackStarted'> & { sequence: AttackSequence };
    attackUpdated: Evt<'attackUpdated'> & { patch: Partial<AttackSequence> };
    attackEnded: Evt<'attackEnded'>;
  }
}

registerInitialiser((s) => {
  s.attack = null;
  s.nextAttack = 1;
});
registerApplier('attackStarted', (s, e) => {
  s.attack = e.sequence;
  s.nextAttack += 1;
});
registerApplier('attackUpdated', (s, e) => {
  Object.assign(s.attack!, e.patch);
});
registerApplier('attackEnded', (s) => {
  s.attack = null;
});

const seq = (ctx: Ctx) => ctx.state.attack!;
const group = (ctx: Ctx) => seq(ctx).groups[seq(ctx).index];
const patch = (ctx: Ctx, p: Partial<AttackSequence>) => ctx.emit({ type: 'attackUpdated', patch: p });
const C = (step: string, data: object = {}): Continuation => ({ module: 'attack', step, data });

export function startAttacks(ctx: Ctx, groups: AttackGroup[], kind: AttackSequence['kind'], onDone: Continuation): void {
  const player = ctx.state.units[groups[0]?.attackerUnitId]?.player ?? ctx.state.active;
  ctx.emit({
    type: 'attackStarted',
    sequence: { id: `a${ctx.state.nextAttack}`, kind, player, groups, index: -1, stage: 'attacks', attacks: 0, hits: 0, wounds: 0, failed: 0, results: [], mortals: {}, onDone },
  });
  nextGroup(ctx);
}

/** Queues mortal wounds caused during the sequence; they are applied after its normal damage (FAQ §2.1). */
export function queueMortalWounds(ctx: Ctx, unitId: string, count: number): void {
  const m = seq(ctx).mortals;
  patch(ctx, { mortals: { ...m, [unitId]: (m[unitId] ?? 0) + count } });
}
setMortalQueue(queueMortalWounds);

const hasModels = (s: GameState, unitId: string) => livingModels(s, unitId).some((m) => m.pos);
const attackers = (ctx: Ctx, g: AttackGroup) => g.modelIds.map((id) => ctx.state.models[id]).filter((m) => !m.destroyed);

function record(ctx: Ctx, lost?: string): void {
  const a = seq(ctx);
  patch(ctx, { results: [...a.results, { attacks: a.attacks, hits: a.hits, wounds: a.wounds, unsaved: 0, ...(lost ? { lost } : {}) }] });
}

function nextGroup(ctx: Ctx): void {
  for (;;) {
    const a = seq(ctx);
    const index = a.index + 1;
    if (index >= a.groups.length) return finish(ctx);
    patch(ctx, { index, stage: 'attacks', attacks: 0, hits: 0, wounds: 0, failed: 0 });
    const g = a.groups[index];
    if (!hasModels(ctx.state, g.targetUnitId)) {
      record(ctx, 'no models left in the target unit');
      continue;
    }
    if (g.requiresClear?.some((u) => hasModels(ctx.state, u))) {
      record(ctx, 'the firing unit is still engaged with another enemy unit');
      continue;
    }
    if (!attackers(ctx, g).length) {
      record(ctx, 'no models left to make these attacks');
      continue;
    }
    return stageAttacks(ctx);
  }
}

function finish(ctx: Ctx): void {
  const a = seq(ctx);
  for (const [unitId, n] of Object.entries(a.mortals)) if (n > 0) inflictMortalWounds(ctx, unitId, n, 'mortal wounds');
  ctx.emit({ type: 'attackEnded' });
  runContinuation(ctx, a.onDone);
}

/** Number of attacks: Rapid Fire / Dakka per model, random shots rolled, Blast floors and ceilings (TS §5.4, §5.5). */
function stageAttacks(ctx: Ctx): void {
  const g = group(ctx);
  const models = attackers(ctx, g);
  if (g.melee || g.attacksPerModel) {
    const n = models.reduce((sum, m) => sum + (g.attacksPerModel?.[m.id] ?? 0), 0);
    patch(ctx, { attacks: n, stage: 'hit' });
    return stageHit(ctx);
  }
  const exprs = models.map((m) => (g.weapon.dakkaShort && g.closeModels?.includes(m.id) ? g.weapon.dakkaShort : g.weapon.shots));
  const dice = exprs.reduce((n, e) => n + e.n, 0);
  if (!exprs.some(isRandom)) return countAttacks(ctx, exprs.map(() => [] as Die[]));
  const player = seq(ctx).player;
  rollWindowed(ctx, dice, exprs.find(isRandom)!.sides, 'attacks', player, { context: `${g.weapon.name}: number of attacks`, then: C('attacksRolled') });
}

registerContinuation('attack', 'attacksRolled', (ctx, d: { rollId: string }) => {
  const g = group(ctx);
  const models = attackers(ctx, g);
  const dice = ctx.state.rolls[d.rollId].dice;
  let at = 0;
  const perModel = models.map((m) => {
    const e = g.weapon.dakkaShort && g.closeModels?.includes(m.id) ? g.weapon.dakkaShort : g.weapon.shots;
    const mine = dice.slice(at, at + e.n);
    at += e.n;
    return mine;
  });
  countAttacks(ctx, perModel);
});

function countAttacks(ctx: Ctx, perModel: Die[][]): void {
  const g = group(ctx);
  const models = attackers(ctx, g);
  let n = 0;
  models.forEach((m, i) => {
    const e = g.weapon.dakkaShort && g.closeModels?.includes(m.id) ? g.weapon.dakkaShort : g.weapon.shots;
    let shots = total({ dice: perModel[i] }) + e.plus;
    if (g.weapon.blast) shots = blastShots(e, shots, g.targetModels);
    if (g.weapon.type === 'Rapid Fire' && g.closeModels?.includes(m.id)) shots *= 2;
    n += shots;
  });
  patch(ctx, { attacks: n, stage: 'hit' });
  stageHit(ctx);
}

/** Effects on the attacker's side and the target's side, summed for one kind of roll. */
function modsFor(s: GameState, g: AttackGroup, roll: 'hit' | 'wound'): number {
  const atk = effectsFor(s, g.attackerUnitId, 'attacking').reduce((a, e) => a + (e.kind === 'mod' && e.roll === roll ? e.value : 0), 0);
  const def = effectsFor(s, g.targetUnitId, 'defending').reduce((a, e) => a + (e.kind === 'mod' && e.roll === roll ? e.value : 0), 0);
  return atk + def;
}

function rerollFor(s: GameState, unitId: string, side: 'attacking' | 'defending', roll: 'hit' | 'wound' | 'save'): 'ones' | 'failed' | null {
  const fx = effectsFor(s, unitId, side).flatMap((e) => (e.kind === 'reroll' && e.roll === roll ? [e.which] : []));
  return fx.includes('failed') ? 'failed' : fx.includes('ones') ? 'ones' : null;
}

/** The skill the group hits with: the attackers' WS or BS (degrading profiles apply), 1 worse for Indirect Fire (R-1). */
function skillOf(ctx: Ctx, g: AttackGroup): number {
  const c = charsOf(ctx.state, attackers(ctx, g)[0]);
  const base = (g.melee ? c.WS : c.BS) ?? 7;
  return base + (g.indirect ? 1 : 0);
}

function stageHit(ctx: Ctx): void {
  const g = group(ctx);
  const a = seq(ctx);
  if (a.attacks <= 0) {
    record(ctx);
    return nextGroup(ctx);
  }
  if (g.weapon.autoHit) {
    patch(ctx, { hits: a.attacks, stage: 'wound' });
    return stageWound(ctx);
  }
  const needed = skillOf(ctx, g);
  const mod = g.overwatch ? 0 : capMod(g.hitMods.reduce((x, m) => x + m.value, 0) + modsFor(ctx.state, g, 'hit'));
  const hit = (v: number) => (g.overwatch ? v >= g.overwatch.needs : hitSucceeds(v, needed, mod));
  const rr = rerollFor(ctx.state, g.attackerUnitId, 'attacking', 'hit');
  rollWindowed(ctx, a.attacks, 6, 'hit', a.player, {
    context: `${g.weapon.name}: hit rolls (${g.overwatch ? `${g.overwatch.needs}s` : `${needed}+`}${mod ? `, ${mod > 0 ? '+' : ''}${mod}` : ''})`,
    autoReroll: rr ? (d) => (rr === 'ones' ? d.value === 1 : !hit(d.value)) : undefined,
    then: C('hitRolled', { needed, mod }),
  });
}

registerContinuation('attack', 'hitRolled', (ctx, d: { rollId: string; needed: number; mod: number }) => {
  const g = group(ctx);
  const dice = ctx.state.rolls[d.rollId].dice;
  const hits = dice.filter((x) => (g.overwatch ? x.value >= g.overwatch.needs : hitSucceeds(x.value, d.needed, d.mod))).length;
  patch(ctx, { hits, stage: 'wound' });
  stageWound(ctx);
});

function toughness(s: GameState, unitId: string): number {
  return majorityToughness(livingModels(s, unitId).filter((m) => m.pos).map((m) => charsOf(s, m).T));
}

function stageWound(ctx: Ctx): void {
  const g = group(ctx);
  const a = seq(ctx);
  if (a.hits <= 0) {
    record(ctx);
    return nextGroup(ctx);
  }
  const S = strengthOf(charsOf(ctx.state, attackers(ctx, g)[0]), g.weapon);
  const needed = woundNeeded(S, toughness(ctx.state, g.targetUnitId));
  const mod = capMod(modsFor(ctx.state, g, 'wound'));
  const rr = rerollFor(ctx.state, g.attackerUnitId, 'attacking', 'wound');
  rollWindowed(ctx, a.hits, 6, 'wound', a.player, {
    context: `${g.weapon.name}: wound rolls (${needed}+${mod ? `, ${mod > 0 ? '+' : ''}${mod}` : ''})`,
    autoReroll: rr ? (dd) => (rr === 'ones' ? dd.value === 1 : !woundSucceeds(dd.value, needed, mod)) : undefined,
    then: C('woundRolled', { needed, mod }),
  });
}

registerContinuation('attack', 'woundRolled', (ctx, d: { rollId: string; needed: number; mod: number }) => {
  const wounds = ctx.state.rolls[d.rollId].dice.filter((x) => woundSucceeds(x.value, d.needed, d.mod)).length;
  patch(ctx, { wounds, stage: 'save' });
  stageSave(ctx);
});

/** The save a model takes against this group's attacks, with cover, Indirect Fire and effects. */
export function saveFor(s: GameState, g: AttackGroup, m: ModelState): SaveChoice | null {
  const c = charsOf(s, m);
  const atkFx = effectsFor(s, g.attackerUnitId, 'attacking');
  const defFx = effectsFor(s, g.targetUnitId, 'defending');
  const apBonus = atkFx.reduce((a, e) => a + (e.kind === 'ap' ? e.value : 0), 0);
  const ap = Math.min(0, g.weapon.ap - apBonus);
  const ignoreCover = g.ignoreCover || atkFx.some((e) => e.kind === 'ignore-cover');
  let armour = g.indirect ? 1 : 0;
  if (!ignoreCover && m.pos) {
    const firer = attackers({ state: s } as Ctx, g).find((x) => x.pos);
    const cover = coverFor(modelView(s, m), firer ? placedModel(s, firer) : null, g.melee ? 'melee' : 'ranged', s.setup.terrain);
    if (!g.melee && cover.light) armour += 1;
    if (g.melee && cover.heavy && !s.units[m.unitId].turn.charged) armour += 1;
  }
  let all = 0;
  for (const e of defFx) if (e.kind === 'mod' && e.roll === 'save') e.armourOnly ? (armour += e.value) : (all += e.value);
  const invFx = defFx.flatMap((e) => (e.kind === 'invuln' ? [e.value] : []));
  return bestSave(c, invFx.length ? Math.min(...invFx) : null, ap, armour, all, g.melee);
}

const sameSave = (a: SaveChoice | null, b: SaveChoice | null) => (a === null ? b === null : !!b && a.needed === b.needed && a.mod === b.mod && a.kind === b.kind);

function stageSave(ctx: Ctx): void {
  const g = group(ctx);
  const a = seq(ctx);
  if (a.wounds <= 0) {
    record(ctx);
    return nextGroup(ctx);
  }
  const s = ctx.state;
  const target = allocationTarget(s, g.targetUnitId);
  if (!target) {
    record(ctx, 'no models left in the target unit');
    return nextGroup(ctx);
  }
  const save = saveFor(s, g, target);
  // Roll the saves together when every model that could take them saves the same way; otherwise one at a time.
  const uniform = livingModels(s, g.targetUnitId).every((m) => sameSave(saveFor(s, g, m), save));
  const batch = uniform ? a.wounds : 1;
  ctx.emit({ type: 'attackAllocated', modelId: target.id });
  if (!save) {
    patch(ctx, { wounds: a.wounds - batch, failed: batch, stage: 'damage' });
    return stageDamage(ctx);
  }
  const rr = rerollFor(s, g.targetUnitId, 'defending', 'save');
  rollWindowed(ctx, batch, 6, 'save', other(a.player), {
    context: `${g.weapon.name}: saving throws (${save.needed}+${save.mod ? `, ${save.mod > 0 ? '+' : ''}${save.mod}` : ''})`,
    autoReroll: rr ? (d) => (rr === 'ones' ? d.value === 1 : !saveSucceeds(d.value, save.needed, save.mod)) : undefined,
    then: C('saveRolled', { batch, needed: save.needed, mod: save.mod }),
  });
}

registerContinuation('attack', 'saveRolled', (ctx, d: { rollId: string; batch: number; needed: number; mod: number }) => {
  const failed = ctx.state.rolls[d.rollId].dice.filter((x) => !saveSucceeds(x.value, d.needed, d.mod)).length;
  patch(ctx, { wounds: seq(ctx).wounds - d.batch, failed, stage: 'damage' });
  stageDamage(ctx);
});

function damageBonus(s: GameState, g: AttackGroup): number {
  return effectsFor(s, g.attackerUnitId, 'attacking').reduce((a, e) => a + (e.kind === 'damage' ? e.value : 0), 0);
}

function stageDamage(ctx: Ctx): void {
  const g = group(ctx);
  const a = seq(ctx);
  if (a.failed <= 0) return stageSave(ctx);
  const d = g.weapon.d;
  if (!isRandom(d)) return applyDamage(ctx, Array(a.failed).fill(d.plus + damageBonus(ctx.state, g)));
  // One damage roll per failed save; a multi-dice damage roll is rolled (and re-rolled) as a whole, one at a time.
  if (d.n === 1) rollWindowed(ctx, a.failed, d.sides, 'damage', a.player, { context: `${g.weapon.name}: damage`, then: C('damageRolled', { per: 1 }) });
  else rollWindowed(ctx, d.n, d.sides, 'damage', a.player, { whole: true, context: `${g.weapon.name}: damage`, then: C('damageRolled', { per: d.n }) });
}

registerContinuation('attack', 'damageRolled', (ctx, x: { rollId: string; per: number }) => {
  const g = group(ctx);
  const dice = ctx.state.rolls[x.rollId].dice;
  const amounts: number[] = [];
  for (let i = 0; i < dice.length; i += x.per) amounts.push(total({ dice: dice.slice(i, i + x.per) }) + g.weapon.d.plus + damageBonus(ctx.state, g));
  if (x.per > 1) {
    // Multi-dice damage is rolled one failed save at a time.
    const left = seq(ctx).failed - 1;
    applyDamage(ctx, amounts, left);
    return;
  }
  applyDamage(ctx, amounts);
});

/** Each failed save's damage goes to the allocated model; excess damage from one attack is lost (TS §5.6). */
function applyDamage(ctx: Ctx, amounts: number[], failedLeft = 0): void {
  const g = group(ctx);
  for (const dmg of amounts) {
    const target = allocationTarget(ctx.state, g.targetUnitId);
    if (!target) break;
    ctx.emit({ type: 'attackAllocated', modelId: target.id });
    loseWounds(ctx, target, Math.max(0, dmg), `attacked by ${ctx.state.units[g.attackerUnitId].name}`, false);
  }
  patch(ctx, { failed: failedLeft });
  if (failedLeft > 0) return stageDamage(ctx);
  stageSave(ctx);
}

export { feelNoPain, sheetOf, unitHas };
