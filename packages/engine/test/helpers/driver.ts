/**
 * A simple automatic player for scenario tests: it makes legal, unsurprising choices in every phase (move towards the
 * enemy, shoot the closest unit, charge when close, fight, take Morale tests) through the public commands only.
 */
import {
  CLOSE_COMBAT_WEAPON,
  charsOf,
  dispatch,
  fightOrder,
  horizontalGap,
  isEngaged,
  meleeTargets,
  moveInches,
  needsMoraleTest,
  onBoard,
  other,
  placedModel,
  sheetOf,
  stateOf,
  unitsOf,
  type Command,
  type GameRecord,
  type GameState,
  type ModelState,
  type PlayerId,
  type Pos,
} from '../../src';

const tryPlay = (g: GameRecord, cmd: Command): GameRecord | null => {
  const r = dispatch(g, cmd);
  return r.ok ? r.game : null;
};
const must = (g: GameRecord, cmd: Command): GameRecord => {
  const r = dispatch(g, cmd);
  if (!r.ok) throw new Error(`${(cmd as { type: string }).type}: ${r.problems.map((p) => p.message).join(' ')}`);
  return r.game;
};

/** Answers whatever the game is waiting for: confirm rolls, accept reactions where possible, place nobody. */
export function settle(g: GameRecord): GameRecord {
  for (let guard = 0; guard < 500; guard++) {
    const s = stateOf(g);
    if (s.pending?.kind === 'roll') {
      g = must(g, { type: 'confirmRoll', by: s.pending.player } as Command);
      continue;
    }
    if (s.pending?.kind === 'reaction') {
      const p = s.pending;
      const tries: string[] = [];
      if (p.options.includes('overwatch') && s.activation?.kind === 'charge') tries.push(...s.activation.targets.map((t) => `overwatch:${t}`));
      for (const o of p.options) if (o !== 'overwatch' && o !== 'hold-steady' && o !== 'set-to-defend') tries.push(o);
      let next: GameRecord | null = null;
      for (const choice of tries) if ((next = tryPlay(g, { type: 'respond', by: p.player, choice } as Command))) break;
      g = next ?? must(g, { type: 'respond', by: p.player, choice: 'decline' } as Command);
      continue;
    }
    if (s.placements.length) {
      const p = s.placements[0];
      g = must(g, { type: 'placePassengers', by: p.player, transportId: p.transportId, placements: {}, emergency: false } as Command);
      continue;
    }
    return g;
  }
  throw new Error('settle: the game kept waiting');
}

const enemyModels = (s: GameState, p: PlayerId) => unitsOf(s, other(p)).filter((u) => u.location === 'battlefield').flatMap((u) => onBoard(s, u.id));
const nearestEnemy = (s: GameState, m: ModelState) =>
  enemyModels(s, s.units[m.unitId].player).reduce<ModelState | null>((best, e) => (!best || horizontalGap(placedModel(s, m), placedModel(s, e)) < horizontalGap(placedModel(s, m), placedModel(s, best)) ? e : best), null);

/** Moves every model of the unit the same way: towards the enemy's nearest model, `d` inches. */
function shiftTowards(s: GameState, unitId: string, d: number): Record<string, { to: Pos }> {
  const models = onBoard(s, unitId);
  const lead = models[0];
  const target = nearestEnemy(s, lead);
  if (!target) return {};
  const dx = target.pos!.x - lead.pos!.x;
  const dy = target.pos!.y - lead.pos!.y;
  const len = Math.hypot(dx, dy) || 1;
  return Object.fromEntries(models.map((m) => [m.id, { to: { ...m.pos!, x: m.pos!.x + (dx / len) * d, y: m.pos!.y + (dy / len) * d } }]));
}

function movementPhase(g: GameRecord): GameRecord {
  const p = stateOf(g).active;
  for (const u of unitsOf(stateOf(g), p)) {
    const s = stateOf(g);
    if (s.units[u.id].location !== 'battlefield') continue;
    if (isEngaged(s, u.id)) {
      g = tryPlay(g, { type: 'remainStationary', by: p, unitId: u.id } as Command) ?? g;
      continue;
    }
    const lead = onBoard(s, u.id)[0];
    const target = lead && nearestEnemy(s, lead);
    if (!target) continue;
    let d = Math.min(moveInches(s, lead), horizontalGap(placedModel(s, lead), placedModel(s, target)) - 1.5);
    let moved: GameRecord | null = null;
    while (d >= 0.5 && !moved) {
      const begun = tryPlay(g, { type: 'beginMove', by: p, unitId: u.id, kind: 'normal' } as Command);
      if (!begun) break;
      moved = tryPlay(begun, { type: 'completeMove', by: p, unitId: u.id, moves: shiftTowards(stateOf(begun), u.id, d) } as Command);
      d /= 2;
    }
    g = moved ?? tryPlay(g, { type: 'remainStationary', by: p, unitId: u.id } as Command) ?? g;
  }
  g = must(g, { type: 'endStep', by: p } as Command);
  // Reinforcements: arrive along your own edge, spread out.
  const s = stateOf(g);
  if (s.round >= s.setup.rules.reservesFromRound)
    for (const u of unitsOf(s, p).filter((x) => x.location === 'reserves')) {
      const south = s.setup.edges[p] === 'south';
      for (let x0 = 2; x0 < s.setup.board.w - 10; x0 += 4) {
        const ids = stateOf(g).units[u.id].modelIds.filter((id) => !stateOf(g).models[id].destroyed);
        const positions = Object.fromEntries(ids.map((id, i) => [id, { x: x0 + (i % 6) * 1.5, y: south ? 1.5 + Math.floor(i / 6) * 1.5 : s.setup.board.h - 1.5 - Math.floor(i / 6) * 1.5, z: 0, rot: 0 }]));
        const arrived = tryPlay(g, { type: 'arrive', by: p, unitId: u.id, positions } as Command);
        if (arrived) {
          g = arrived;
          break;
        }
      }
    }
  return must(g, { type: 'endPhase', by: p } as Command);
}

function psychicPhase(g: GameRecord): GameRecord {
  const p = stateOf(g).active;
  for (const u of unitsOf(stateOf(g), p)) if (sheetOf(stateOf(g), u.id).psyker) g = settle(tryPlay(g, { type: 'manifest', by: p, unitId: u.id, power: 'Smite' } as Command) ?? g);
  return must(g, { type: 'endPhase', by: p } as Command);
}

function shootingPhase(g: GameRecord): GameRecord {
  const p = stateOf(g).active;
  for (const u of unitsOf(stateOf(g), p)) {
    const s = stateOf(g);
    if (s.units[u.id].location !== 'battlefield') continue;
    const ds = sheetOf(s, u.id);
    const models = onBoard(s, u.id);
    if (!models.length) continue;
    // Enemy units, closest first.
    const gap = (unitId: string) => Math.min(...onBoard(s, unitId).map((e) => horizontalGap(placedModel(s, models[0]), placedModel(s, e))));
    const targets = unitsOf(s, other(p)).filter((e) => e.location === 'battlefield' && onBoard(s, e.id).length).sort((a, b) => gap(a.id) - gap(b.id));
    let done = false;
    for (const target of targets) {
      for (const kind of ['main', 'pistol'] as const) {
        const assignments = models.flatMap((m) => {
          const w = m.weapons.map((n) => ds.weapons.find((x) => x.name === n)).find((x) => x && x.type !== 'Melee' && x.type !== 'Grenade' && (kind === 'pistol') === (x.type === 'Pistol'));
          return w ? [{ modelId: m.id, weapon: w.name, targetUnitId: target.id }] : [];
        });
        if (!assignments.length) continue;
        const shot = tryPlay(g, { type: 'shoot', by: p, unitId: u.id, assignments } as Command);
        if (shot) {
          g = settle(shot);
          done = true;
          break;
        }
      }
      if (done) break;
    }
  }
  return must(g, { type: 'endPhase', by: p } as Command);
}

function chargePhase(g: GameRecord): GameRecord {
  const p = stateOf(g).active;
  for (const u of unitsOf(stateOf(g), p)) {
    const s = stateOf(g);
    if (s.units[u.id].location !== 'battlefield' || isEngaged(s, u.id, true)) continue;
    const lead = onBoard(s, u.id)[0];
    const target = lead && nearestEnemy(s, lead);
    if (!target || horizontalGap(placedModel(s, lead), placedModel(s, target)) > 11) continue;
    const declared = tryPlay(g, { type: 'declareCharge', by: p, unitId: u.id, targetIds: [target.unitId] } as Command);
    if (!declared) continue;
    g = settle(declared);
    const a = stateOf(g).activation;
    if (!a || a.kind !== 'charge' || a.roll === null) continue;
    const gap = horizontalGap(placedModel(stateOf(g), onBoard(stateOf(g), u.id)[0]), placedModel(stateOf(g), target));
    const charged = gap - 0.3 <= a.roll ? tryPlay(g, { type: 'chargeMove', by: p, unitId: u.id, moves: shiftTowards(stateOf(g), u.id, gap - 0.3) } as Command) : null;
    g = charged ?? must(g, { type: 'failCharge', by: p, unitId: u.id } as Command);
  }
  return must(g, { type: 'endPhase', by: p } as Command);
}

function fightPhase(g: GameRecord): GameRecord {
  for (let guard = 0; guard < 50; guard++) {
    const s = stateOf(g);
    const order = fightOrder(s);
    if (!order.selectable.length) break;
    const unitId = order.selectable[0];
    const by = order.picker;
    g = must(g, { type: 'selectFighter', by, unitId } as Command);
    g = must(g, { type: 'pileIn', by, unitId, moves: {} } as Command);
    const st = stateOf(g);
    const u = st.units[unitId];
    const ds = sheetOf(st, unitId);
    const allowed = u.turn.charged ? new Set([...u.turn.chargeTargets, ...Object.values(st.units).filter((x) => x.turn.heroic).map((x) => x.id)]) : null;
    const assignments = onBoard(st, unitId).flatMap((m) => {
      const targets = meleeTargets(st, m).filter((t) => !allowed || allowed.has(t));
      const A = charsOf(st, m).A;
      if (!targets.length || A.n > 0 || A.plus < 1) return [];
      const melee = m.weapons.find((n) => ds.weapons.find((w) => w.name === n)?.type === 'Melee') ?? CLOSE_COMBAT_WEAPON.name;
      return [{ modelId: m.id, weapon: melee, attacks: A.plus, targetUnitId: targets[0] }];
    });
    g = settle(must(g, { type: 'fightAttacks', by, unitId, assignments } as Command));
    g = settle(must(g, { type: 'consolidate', by, unitId, moves: {} } as Command));
  }
  return must(g, { type: 'endPhase', by: stateOf(g).active } as Command);
}

function moralePhase(g: GameRecord): GameRecord {
  for (let guard = 0; guard < 50; guard++) {
    const s = stateOf(g);
    const next = needsMoraleTest(s, s.morale.next).length ? s.morale.next : other(s.morale.next);
    const unitId = needsMoraleTest(s, next)[0];
    if (!unitId) break;
    g = must(g, { type: 'moraleTest', by: next, unitId } as Command);
  }
  return must(g, { type: 'endPhase', by: stateOf(g).active } as Command);
}

/** Plays the current player's turn from its Command phase to the next turn (or the end of the game). */
export function autoTurn(g: GameRecord): GameRecord {
  const p = stateOf(g).active;
  g = must(g, { type: 'endPhase', by: p } as Command);
  for (const phase of [movementPhase, psychicPhase, shootingPhase, chargePhase, fightPhase, moralePhase]) {
    if (stateOf(g).ended) return g;
    g = settle(phase(settle(g)));
  }
  return g;
}

/** Plays turns until the given battle round's first Command phase (or the end of the game). */
export function autoPlayUntil(g: GameRecord, round: number): GameRecord {
  for (let guard = 0; guard < 40 && !stateOf(g).ended && stateOf(g).round < round; guard++) g = autoTurn(g);
  return g;
}
