/**
 * The Shooting phase (TS §5): who can shoot, choosing targets (range, visibility, Look Out, Sir, friendly combats),
 * the weapon types (TS §5.4), Big Guns Never Tire (TS §5.2), Blast (TS §5.5), Dense Cover and Indirect Fire. Overwatch
 * (charge.ts) builds its attacks with the same function.
 */
import { registerHandler, type Ctx } from '../core/context';
import type { GameState } from '../core/state';
import { other, type Cmd, type PlayerId, type Problem } from '../core/types';
import { currentChars, has } from '../datasheet/profile';
import type { WeaponProfile } from '../datasheet/types';
import { distance3d, horizontalGap, within } from '../geometry/measure';
import { startAttacks, type AttackGroup } from '../attack/sequence';
import { noActivation, selectedOut } from '../interact/activation';
import { consumeNextActivation, effectsFor } from '../interact/effects';
import { noPending, registerContinuation } from '../interact/windows';
import { isEngaged } from '../move/movement';
import { charsOf, livingModels, modelView, onBoard, placedModel, profileOf, sheetOf, unitHas, unitsOf, unitView, type ModelState } from '../setup/units';
import { denseCoverPenalty, unitVisibleTo } from '../terrain/visibility';
import { inBattle, registerEndCheck } from '../turn/phases';
import { inEngagementRange } from '../geometry/measure';
import { registerApplier } from '../core/apply';
import type { Evt } from '../core/types';

export interface Assignment { modelId: string; weapon: string; targetUnitId: string }

declare module '../interact/activation' {
  interface ActivationMap {
    shoot: { kind: 'shoot'; unitId: string };
  }
}
declare module '../core/types' {
  interface CommandMap {
    shoot: Cmd<'shoot'> & { unitId: string; assignments: Assignment[] };
  }
  interface EventMap {
    unitShot: Evt<'unitShot'> & { unitId: string };
  }
}

registerApplier('unitShot', (s, e) => {
  s.units[e.unitId].turn.shot = true;
});

/** Is this enemy unit engaged with (within Engagement Range of) the given unit? */
export function unitsEngaged(s: GameState, a: string, b: string): boolean {
  const bm = onBoard(s, b);
  return onBoard(s, a).some((x) => bm.some((y) => inEngagementRange(placedModel(s, x), placedModel(s, y))));
}

const isCharacterUnderTen = (s: GameState, unitId: string) =>
  unitHas(s, unitId, 'CHARACTER') && livingModels(s, unitId).some((m) => profileOf(s, m).chars.W <= 9);

/**
 * Look Out, Sir (WCR; TS §5.3): a unit with a CHARACTER of W 9 or less can't be targeted with ranged weapons while within
 * 3" of a friendly unit with a VEHICLE/MONSTER of W 10+, a non-CHARACTER unit with a VEHICLE or MONSTER, or a
 * non-CHARACTER unit of 3+ models — unless it is visible to and the closest enemy unit to the firing model (ignoring
 * other such character units).
 */
export function lookOutSirProtects(s: GameState, target: string, firer: ModelState): boolean {
  if (!isCharacterUnderTen(s, target)) return false;
  const owner = s.units[target].player;
  const guards = unitsOf(s, owner).filter((u) => {
    if (u.id === target || u.location !== 'battlefield') return false;
    const models = livingModels(s, u.id);
    const bigBeast = (unitHas(s, u.id, 'VEHICLE') || unitHas(s, u.id, 'MONSTER')) && models.some((m) => profileOf(s, m).chars.W >= 10);
    const nonChar = !unitHas(s, u.id, 'CHARACTER');
    const beast = nonChar && (unitHas(s, u.id, 'VEHICLE') || unitHas(s, u.id, 'MONSTER'));
    const crowd = nonChar && models.length >= 3;
    if (!bigBeast && !beast && !crowd) return false;
    const tm = onBoard(s, target).map((m) => placedModel(s, m));
    return onBoard(s, u.id).some((m) => tm.some((t) => within(horizontalGap(t, placedModel(s, m)), 3)));
  });
  if (!guards.length) return false;
  const from = placedModel(s, firer);
  const gapTo = (unitId: string) => Math.min(...onBoard(s, unitId).map((m) => horizontalGap(from, placedModel(s, m))));
  const mine = gapTo(target);
  const closer = unitsOf(s, owner).some((u) => u.id !== target && u.location === 'battlefield' && onBoard(s, u.id).length && !isCharacterUnderTen(s, u.id) && gapTo(u.id) < mine - 1e-9);
  const visible = unitVisibleTo(modelView(s, firer), unitView(s, target), s.setup.terrain);
  return closer || !visible;
}

/** "Plasma gun - standard" and "Plasma gun - supercharge" are two profiles of one weapon (R-16). */
export const weaponBase = (name: string) => name.split(/\s+[-–]\s+|\s*\(|\s*\[|,\s*/)[0].trim().toLowerCase();

export interface ShootOpts { overwatch?: { needs: 5 | 6; chargerId: string } }

/** Checks a unit's shooting and builds its attack groups (engaged targets first, Big Guns Never Tire leftovers last). */
export function buildShootingGroups(s: GameState, unitId: string, assignments: Assignment[], o: ShootOpts = {}): { groups: AttackGroup[]; problems: Problem[] } {
  const u = s.units[unitId];
  const ds = sheetOf(s, unitId);
  const problems: Problem[] = [];
  const fail = (code: string, message: string, rule: string, modelIds?: string[]) => problems.push({ code, message, rule, unitId, ...(modelIds ? { modelIds } : {}) });
  const engaged = isEngaged(s, unitId);
  const advanced = u.turn.moved === 'advance' && !o.overwatch;
  const bigGuns = has(ds, 'VEHICLE') || has(ds, 'MONSTER');
  const moved = !o.overwatch && !u.flags.countsAsStationary && (['normal', 'advance', 'fall-back'].includes(u.turn.moved) || u.turn.arrived || u.turn.disembarked);
  if (!assignments.length) fail('nothing-to-shoot', 'Choose which weapons shoot at which targets.', '[TS §5.1]');
  const seen = new Set<string>();
  const grenadiers = new Set<string>();
  const perModel = new Map<string, WeaponProfile[]>();
  const groups = new Map<string, AttackGroup & { order: number }>();
  let order = 0;
  for (const a of assignments) {
    const m = s.models[a.modelId];
    if (!m || m.unitId !== unitId || m.destroyed || !m.pos) {
      fail('unknown-model', `That isn't a model of ${u.name} on the battlefield.`, '[TS §5.1]', [a.modelId]);
      continue;
    }
    const w = ds.weapons.find((x) => x.name === a.weapon);
    if (!w || !m.weapons.includes(a.weapon) || w.type === 'Melee') {
      fail('no-such-weapon', `That model doesn't have a ranged weapon called ${a.weapon}.`, '[TS §5.1]', [m.id]);
      continue;
    }
    const key = `${m.id}|${w.name}`;
    if (seen.has(key)) fail('weapon-twice', `A model fires each weapon once.`, '[TS §5.1]', [m.id]);
    seen.add(key);
    perModel.set(m.id, [...(perModel.get(m.id) ?? []), w]);
    if (w.type === 'Grenade') grenadiers.add(m.id);
    const target = s.units[a.targetUnitId];
    if (!target || target.player === u.player || target.location !== 'battlefield' || !onBoard(s, target.id).length) {
      fail('bad-target', 'Pick an enemy unit on the battlefield.', '[TS §5.1]', [m.id]);
      continue;
    }
    if (o.overwatch && target.id !== o.overwatch.chargerId) fail('overwatch-target', 'Overwatch can only shoot the charging unit.', '[CS §2]', [m.id]);
    if (advanced && w.type !== 'Assault')
      fail('advanced', `${u.name} Advanced this turn, so it can only shoot Assault weapons.`, '[TS §5.1]', [m.id]);
    const targetEngagedWithUs = unitsEngaged(s, unitId, target.id);
    if (engaged) {
      const ok = (w.type === 'Pistol' || bigGuns) && targetEngagedWithUs;
      const bgntLater = bigGuns && w.type !== 'Pistol' && !targetEngagedWithUs;
      if (!ok && !bgntLater) fail('engaged', `${u.name} is within 1" of the enemy: only Pistols (and Vehicles or Monsters) can shoot, at the units it's fighting.`, '[TS §5.1]', [m.id]);
    }
    if (w.blast && targetEngagedWithUs) fail('blast-engaged', `${w.name} is a Blast weapon: it can never shoot at a unit within 1" of ${u.name}.`, '[TS §5.5]', [m.id]);
    if (!targetEngagedWithUs) {
      const friendlyFight = unitsOf(s, u.player).some((f) => f.id !== unitId && f.location === 'battlefield' && unitsEngaged(s, f.id, target.id));
      if (friendlyFight) fail('engaged-with-friendly', `${target.name} is fighting your units: you can't shoot at it.`, '[TS §5.1]', [m.id]);
    }
    const from = placedModel(s, m);
    const targets = onBoard(s, target.id).map((x) => placedModel(s, x));
    const closest = Math.min(...targets.map((t) => distance3d(from, t)));
    if (w.range !== null && closest > w.range + 1e-6) fail('out-of-range', `${target.name} is out of range of ${w.name} (${w.range}").`, '[TS §5.1]', [m.id]);
    if (w.minRange && targets.every((t) => distance3d(from, t) < w.minRange! - 1e-6))
      fail('minimum-range', `${target.name} is wholly within ${w.name}'s minimum range of ${w.minRange}".`, '[TS §1.1]', [m.id]);
    const visible = unitVisibleTo(modelView(s, m), unitView(s, target.id), s.setup.terrain);
    if (!visible && !w.indirect) fail('not-visible', `${target.name} isn't visible to that model.`, '[TS §5.1]', [m.id]);
    if (!o.overwatch && lookOutSirProtects(s, target.id, m))
      fail('look-out-sir', `${target.name} is protected by Look Out, Sir: it can only be shot when it's the closest visible enemy unit.`, '[TS §5.3]', [m.id]);
    if (problems.length) continue;
    const hitMods: { source: string; value: number }[] = [];
    if (advanced && w.type === 'Assault') hitMods.push({ source: 'Assault weapon after Advancing', value: -1 });
    if (w.type === 'Heavy' && moved && has(ds, 'INFANTRY')) hitMods.push({ source: 'Heavy weapon after moving', value: -1 });
    if (w.type === 'Heavy' && bigGuns && engaged) hitMods.push({ source: 'Big Guns Never Tire (Heavy)', value: -1 });
    const ignoreCover = effectsFor(s, unitId, 'attacking').some((e) => e.kind === 'ignore-cover');
    if (!o.overwatch && !ignoreCover && denseCoverPenalty(modelView(s, m), unitView(s, target.id), s.setup.terrain)) hitMods.push({ source: 'Dense Cover', value: -1 });
    const half = w.range !== null && closest <= w.range / 2 + 1e-6;
    const chars = charsOf(s, m);
    const requiresClear = engaged && bigGuns && !targetEngagedWithUs ? unitsOf(s, other(u.player)).filter((e) => e.location === 'battlefield' && unitsEngaged(s, unitId, e.id)).map((e) => e.id) : undefined;
    const gkey = [w.name, target.id, chars.BS, chars.S, hitMods.map((h) => h.source).join('+'), !visible, half && (w.type === 'Rapid Fire' || w.type === 'Dakka'), requiresClear ? 'later' : ''].join('|');
    const existing = groups.get(gkey);
    if (existing) {
      existing.modelIds.push(m.id);
      if (half) existing.closeModels!.push(m.id);
    } else
      groups.set(gkey, {
        order: (requiresClear ? 1000 : 0) + order++,
        attackerUnitId: unitId,
        modelIds: [m.id],
        weapon: w,
        targetUnitId: target.id,
        melee: false,
        closeModels: half ? [m.id] : [],
        targetModels: targets.length,
        hitMods,
        ...(!visible ? { indirect: true } : {}),
        ...(o.overwatch ? { overwatch: { needs: o.overwatch.needs } } : {}),
        ...(requiresClear ? { requiresClear } : {}),
        ...(ignoreCover ? { ignoreCover: true } : {}),
      });
  }
  // Per-model choices: Pistols or other weapons (WCR); one Grenade per unit, and its thrower fires nothing else (TS §5.4).
  for (const [id, ws] of perModel) {
    if (ws.some((w) => w.type === 'Pistol') && ws.some((w) => w.type !== 'Pistol'))
      fail('pistol-or-other', 'A model fires either its Pistols or its other ranged weapons, not both.', '[WCR]', [id]);
    if (ws.some((w) => w.type === 'Grenade') && ws.length > 1) fail('grenade-only', 'A model that throws a grenade fires nothing else.', '[TS §5.4]', [id]);
    const bases = ws.map((w) => weaponBase(w.name));
    if (new Set(bases).size < bases.length && ws.length > 1) fail('one-profile', 'A model fires only one profile of each weapon.', '[R-16]', [id]);
  }
  if (grenadiers.size > 1) fail('one-grenade', 'Only one model in a unit can throw a grenade.', '[TS §5.4]', [...grenadiers]);
  // Group order: targets in the order chosen; engaged targets before Big Guns Never Tire targets outside the combat.
  const list = [...groups.values()].sort((a, b) => a.order - b.order).map(({ order: _o, ...g }) => g);
  return { groups: list, problems };
}

registerHandler('shoot', (ctx, cmd) => {
  inBattle(ctx);
  noPending(ctx);
  noActivation(ctx);
  const s = ctx.state;
  const u = s.units[cmd.unitId];
  if (!u || u.player !== cmd.by) return ctx.reject('not-your-unit', 'Pick one of your own units.', '[TS §5.1]');
  if (cmd.by !== s.active || s.phase !== 'shooting') ctx.reject('wrong-phase', 'Units shoot in your Shooting phase.', '[TS §5.1]');
  if (u.location !== 'battlefield') ctx.reject('not-on-battlefield', `${u.name} isn't on the battlefield.`, '[TS §5.1]');
  if (selectedOut(u, 'shoot')) ctx.reject('already-shot', `${u.name} has already shot this phase.`, '[TS §5.1]', { unitId: u.id });
  if (u.turn.brokeOut || u.turn.arrivedLarge) ctx.reject('cannot-act', `${u.name} can't do anything else this turn.`, '[CS §2]', { unitId: u.id });
  if (u.turn.moved === 'fall-back' && !unitHas(s, u.id, 'TITANIC') && !u.flags.countsAsStationary)
    ctx.reject('fell-back', `${u.name} Fell Back this turn, so it can't shoot.`, '[TS §3.1]', { unitId: u.id });
  const { groups, problems } = buildShootingGroups(s, u.id, cmd.assignments);
  if (problems.length) ctx.fail(problems);
  ctx.emit({ type: 'unitSelected', unitId: u.id, kind: 'shoot', delta: 1 });
  ctx.emit({ type: 'activationSet', activation: { kind: 'shoot', unitId: u.id } });
  ctx.emit({ type: 'unitShot', unitId: u.id });
  afterShootingStarts(ctx, u.id);
  startAttacks(ctx, groups, 'shooting', { module: 'shooting', step: 'done', data: { unitId: u.id } });
});

registerContinuation('shooting', 'done', (ctx, d: { unitId: string }) => {
  ctx.emit({ type: 'activationCleared' });
  consumeNextActivation(ctx, d.unitId);
});

type Hook = (ctx: Ctx, unitId: string) => void;
const startHooks: Hook[] = [];
/** Runs when a unit starts shooting (its action fails, Task 18). */
export function registerShootHook(fn: Hook): void {
  startHooks.push(fn);
}
function afterShootingStarts(ctx: Ctx, unitId: string): void {
  for (const h of startHooks) h(ctx, unitId);
}

registerEndCheck('shooting', null, (s) =>
  s.activation?.kind === 'shoot' || s.attack ? { code: 'activation-open', message: 'Finish the current shooting first.', rule: '[TS §5.1]' } : null,
);

export { currentChars, type PlayerId };
