/**
 * Checking a unit's models' moves: distance (with climbing and Difficult Ground), not through other models, Engagement
 * Range during and at the end, and where they end up. Shared by moves, charges, Heroic Interventions, pile-ins and
 * consolidations; each caller adds its own rules.
 */
import type { GameState } from '../core/state';
import type { Problem } from '../core/types';
import { has } from '../datasheet/profile';
import { inEngagementRange, moreThan, overlaps } from '../geometry/measure';
import { pathLength, samplePath } from '../geometry/path';
import { dist, type Placed, type Pos, type Pt } from '../geometry/shapes';
import { climbCost, difficultGroundOnPath } from '../terrain/movement';
import type { TerrainFeature } from '../terrain/types';
import { livingModels, placedModel, sheetOf, unitHas, type ModelState } from '../setup/units';
import { placementProblems } from './placement';

export type MoveType = 'normal' | 'advance' | 'fall-back' | 'charge' | 'pile-in' | 'consolidate' | 'heroic' | 'breakout' | 'disembark';
export interface MoveSpec { to: Pos; path?: Pt[] }
export interface MoveRules {
  type: MoveType;
  /** Inches the model may move before Difficult Ground. */
  allowance: (m: ModelState) => number;
  /** Difficult Ground applies (-2 to Move, or to the charge roll) (TR §3.2). */
  difficultGround: boolean;
}
export interface MoveCheck { placed: Placed[]; final: Record<string, Pos>; problems: Problem[]; difficultGround: TerrainFeature[] }

const BREACHERS = ['INFANTRY', 'BEAST', 'SWARM'];
const FLY_MOVES: MoveType[] = ['normal', 'advance', 'fall-back'];

/** The moves of a unit, checked. Models not in `moves` stay where they are. */
export function checkMoves(s: GameState, unitId: string, moves: Record<string, MoveSpec>, r: MoveRules): MoveCheck {
  const u = s.units[unitId];
  const ds = sheetOf(s, unitId);
  const problems: Problem[] = [];
  const alive = livingModels(s, unitId).filter((m) => m.pos);
  const unknown = Object.keys(moves).filter((id) => !alive.some((m) => m.id === id));
  if (unknown.length) problems.push({ code: 'unknown-model', message: `Those aren't models of ${u.name} on the battlefield.`, rule: '[TS §3.1]', unitId, modelIds: unknown });
  const fly = has(ds, 'FLY');
  const flyRule = fly && FLY_MOVES.includes(r.type);
  const titanic = has(ds, 'TITANIC');
  const aircraft = has(ds, 'AIRCRAFT');
  const canBreach = ds.keywords.some((k) => BREACHERS.includes(k));
  const terrain = s.setup.terrain;
  const paths = new Map<string, Pt[]>();
  for (const m of alive) if (moves[m.id]) paths.set(m.id, [{ x: m.pos!.x, y: m.pos!.y }, ...(moves[m.id].path ?? []), { x: moves[m.id].to.x, y: moves[m.id].to.y }]);

  // Difficult Ground: if any model moves over it, every model's Move (or the charge roll) is 2 lower (TR §3.2).
  let dg: TerrainFeature[] = [];
  if (r.difficultGround && !fly) {
    const crossed = new Map<string, TerrainFeature>();
    for (const [, path] of paths) for (const f of difficultGroundOnPath(path, ds.base, terrain)) crossed.set(f.id, f);
    dg = [...crossed.values()].filter((f) => !(titanic && f.height < 3));
  }
  const penalty = dg.length ? 2 : 0;

  const tooFar: string[] = [];
  const tooShort: string[] = [];
  for (const m of alive) {
    const path = paths.get(m.id);
    if (!path) continue;
    const to = moves[m.id].to;
    const climb = climbCost(path, m.pos!.z, to.z, terrain, { canBreach, fliesOverTerrain: flyRule });
    const max = Math.max(0, r.allowance(m) - penalty);
    if (moreThan(pathLength(path) + climb, max)) tooFar.push(m.id);
    const M = ds.models.find((p) => p.name === m.profile)?.chars.M;
    if (aircraft && M?.kind === 'range' && (r.type === 'normal' || r.type === 'advance') && dist(path[0], path[path.length - 1]) < M.min - 1e-6) tooShort.push(m.id);
  }
  if (tooFar.length)
    problems.push({ code: 'too-far', message: `${u.name} can't move that far${penalty ? ' (Difficult Ground takes 2" off)' : ''}.`, rule: penalty ? '[TR §3.2]' : '[TS §3.1]', unitId, modelIds: tooFar });
  if (tooShort.length) problems.push({ code: 'aircraft-minimum', message: `${u.name} is an Aircraft: it must move at least its minimum Move.`, rule: '[TS §3.5]', unitId, modelIds: tooShort });

  // Not through other models (TS §3.1). FLY moves over models; anything may move over AIRCRAFT (TS §3.5).
  const ownIds = new Set(u.modelIds);
  const others = Object.values(s.models).filter((m) => m.pos && !m.destroyed && !ownIds.has(m.id) && !unitHas(s, m.unitId, 'AIRCRAFT'));
  const enemies = others.filter((m) => s.units[m.unitId].player !== u.player);
  const through: string[] = [];
  const nearEnemy: string[] = [];
  for (const m of alive) {
    const path = paths.get(m.id);
    if (!path) continue;
    const start = placedModel(s, m);
    const blockers = flyRule ? [] : others.filter((o) => !overlaps(start, placedModel(s, o)) && !(r.type === 'breakout' && s.units[o.unitId].player !== u.player));
    const watchEr = (r.type === 'normal' || r.type === 'advance') && !aircraft;
    for (const p of samplePath(path).slice(1, -1)) {
      const at: Placed = { id: m.id, base: ds.base, pos: { ...moves[m.id].to, x: p.x, y: p.y } };
      if (blockers.some((o) => overlaps(at, placedModel(s, o)))) {
        through.push(m.id);
        break;
      }
      if (watchEr && enemies.some((o) => inEngagementRange(at, placedModel(s, o)))) {
        nearEnemy.push(m.id);
        break;
      }
    }
  }
  if (through.length) problems.push({ code: 'through-models', message: `${u.name} can't move through other models.`, rule: '[TS §3.1]', unitId, modelIds: through });
  if (nearEnemy.length)
    problems.push({ code: 'engagement-during-move', message: `${u.name} can't move within 1" of enemy models during this move.`, rule: '[TS §3.1]', unitId, modelIds: nearEnemy });

  const final: Record<string, Pos> = {};
  for (const m of alive) final[m.id] = moves[m.id]?.to ?? m.pos!;
  const placed = alive.map((m) => placedModel(s, m, final[m.id]));
  const allowEngagement = ['charge', 'pile-in', 'consolidate', 'heroic', 'breakout'].includes(r.type);
  problems.push(...placementProblems(s, unitId, placed, { allowEngagement }));
  return { placed, final, problems, difficultGround: dg };
}

/** The model's Move characteristic in inches (an Aircraft's maximum; 0 when it can't move). */
export function moveInches(s: GameState, m: ModelState): number {
  const M = sheetOf(s, m.unitId).models.find((p) => p.name === m.profile)?.chars.M;
  if (!M || M.kind === 'none') return 0;
  return M.kind === 'fixed' ? M.inches : M.max;
}
