/** Checks shared by everything that puts models on the battlefield: deployment, arrivals, disembarking, moves. */
import type { GameState } from '../core/state';
import type { Problem } from '../core/types';
import { inCoherency } from '../geometry/coherency';
import { anyPartWithin, inEngagementRange, overlaps, whollyWithinPolygon } from '../geometry/measure';
import type { Placed, Pos, Pt } from '../geometry/shapes';
import { canEndOn } from '../terrain/movement';
import { livingModels, modelView, placedModel, sheetOf, unitHas, type ModelState } from '../setup/units';

export const boardPolygon = (s: GameState): Pt[] => [
  { x: 0, y: 0 }, { x: s.setup.board.w, y: 0 }, { x: s.setup.board.w, y: s.setup.board.h }, { x: 0, y: s.setup.board.h },
];

/** The unit's living models placed at the given positions (problems if any model is missing or unknown). */
export function placedAt(s: GameState, unitId: string, positions: Record<string, Pos>): { placed: Placed[]; problems: Problem[] } {
  const models = livingModels(s, unitId);
  const name = s.units[unitId].name;
  const problems: Problem[] = [];
  const unknown = Object.keys(positions).filter((id) => !models.some((m) => m.id === id));
  if (unknown.length)
    problems.push({ code: 'unknown-model', message: `Those aren't models of ${name}.`, rule: '[TS §1.2]', unitId, modelIds: unknown });
  const missing = models.filter((m) => !positions[m.id]);
  if (missing.length)
    problems.push({ code: 'missing-model', message: `Place every model of ${name}.`, rule: '[TS §1.2]', unitId, modelIds: missing.map((m) => m.id) });
  return { placed: models.filter((m) => positions[m.id]).map((m) => placedModel(s, m, positions[m.id])), problems };
}

export interface PlacementOpts {
  /** Other models ignored for overlap (e.g. the moving unit's own old positions are never checked anyway). */
  ignoreOverlap?: (m: ModelState) => boolean;
  /** Set up within enemy Engagement Range is allowed (own-edge Strategic Reserves arrival, TS §3.3). */
  allowEngagement?: boolean;
  /** Enemy AIRCRAFT may be overlapped (models can move over them, TS §3.5), but never ended on. */
}

/** On the battlefield, not overlapping other models, coherent, standing somewhere legal, and (by default) out of enemy Engagement Range. */
export function placementProblems(s: GameState, unitId: string, placed: Placed[], o: PlacementOpts = {}): Problem[] {
  const u = s.units[unitId];
  const out: Problem[] = [];
  const board = boardPolygon(s);
  const off = placed.filter((p) => !whollyWithinPolygon(p, board));
  if (off.length) out.push({ code: 'off-board', message: `Every model of ${u.name} must be wholly on the battlefield.`, rule: '[TS §3.1]', unitId, modelIds: off.map((p) => p.id) });
  const ownIds = new Set(u.modelIds);
  const others = Object.values(s.models).filter((m) => m.pos && !m.destroyed && !ownIds.has(m.id) && !(o.ignoreOverlap?.(m) ?? false));
  const clash = placed.filter((p) => others.some((m) => overlaps(p, placedModel(s, m))));
  const selfClash = placed.filter((p, i) => placed.some((q, j) => j !== i && overlaps(p, q)));
  if (clash.length || selfClash.length)
    out.push({ code: 'overlap', message: `Models of ${u.name} can't stand on top of other models.`, rule: '[TS §3.1]', unitId, modelIds: [...clash, ...selfClash].map((p) => p.id) });
  if (!o.allowEngagement) {
    const enemies = others.filter((m) => s.units[m.unitId].player !== u.player);
    const engaged = placed.filter((p) => enemies.some((m) => inEngagementRange(p, placedModel(s, m))));
    if (engaged.length)
      out.push({ code: 'engagement-range', message: `${u.name} can't be placed within 1" of enemy models.`, rule: '[TS §1.3]', unitId, modelIds: engaged.map((p) => p.id) });
  }
  if (!inCoherency(placed)) out.push({ code: 'coherency', message: `${u.name} must end in unit coherency: every model within 2" of another model of the unit, as one group.`, rule: '[TS §1.2]', unitId });
  const kws = [...sheetOf(s, unitId).keywords];
  const floating = placed.filter((p) => p.pos.z > 0 && !s.setup.terrain.some((f) => anyPartWithin(p, f.footprint) && canEndOn(f, kws, p.pos.z)));
  if (floating.length)
    out.push({ code: 'cannot-stand-there', message: `${u.name} can't stand at that height there.`, rule: '[TR §3.2]', unitId, modelIds: floating.map((p) => p.id) });
  return out;
}

/** Placed views of every enemy model of a player that is on the battlefield. */
export function enemyModelsOnBoard(s: GameState, player: string): ModelState[] {
  return Object.values(s.models).filter((m) => m.pos && !m.destroyed && s.units[m.unitId].player !== player);
}

export { modelView, unitHas };
