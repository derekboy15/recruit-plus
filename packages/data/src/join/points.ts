/** Faction pages show the builder's points (C1): the roster engine's price for each unit as the builder adds it. */
import type { CatalogueOut } from '../model/types';
import { addUnit, findSelView } from '../roster/edit';
import { evaluate } from '../roster/evaluate';
import { availableUnits } from '../roster/options';
import { createRoster, FORCE } from '../roster/policy';
import { buildScope, resolve, rootEntriesFor } from '../roster/scope';
import { COST_PTS, type RosterFile } from '../roster/types';

/**
 * generated/points-report.json: a unit whose engine price differs from Wahapedia's cost (snapshot 2023-06-26), for
 * review. `engine` is null when the engine can't price the unit (its page keeps the Wahapedia cost); `offered: false`
 * marks a unit the picker doesn't list on a new list (it waits for a sub-faction choice), priced the same way directly.
 */
export interface PointsDisagreement {
  slug: string;
  unit: string;
  engine: number | null;
  wahapedia: number | null;
  offered?: false;
}

/**
 * Sets each unit's points (in place) to what the builder charges for it on a new Strike Force list for the catalogue
 * (Arks of Omen Detachment): the picker's price (availableUnits), or for a unit the picker doesn't offer there, the
 * price addUnit gives it on that list, when that is above 0. A unit the engine can't price keeps its Wahapedia cost.
 * `files` is the catalogue's roster scope. Library catalogues are left as they are (their units are priced in the
 * catalogues that import them). Returns how many units the engine priced, and those whose engine price and Wahapedia
 * cost differ.
 */
export function applyEnginePoints(out: CatalogueOut, files: RosterFile[]): { priced: number; disagreements: PointsDisagreement[] } {
  if (out.library) return { priced: 0, disagreements: [] };
  const scope = buildScope(files);
  const roster = createRoster(scope, { name: 'Points', catalogueId: out.id, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
  const forceSelId = roster.forces[0].id;
  const picker = new Map<string, number>();
  for (const o of availableUnits(scope, roster, forceSelId)) {
    const target = resolve(scope, scope.node(o.entryId)!).target.id;
    if (!picker.has(target)) picker.set(target, o.points);
  }
  const roots = new Map<string, string>();
  for (const n of rootEntriesFor(scope, out.id)) {
    const target = resolve(scope, n).target.id;
    if (!roots.has(target)) roots.set(target, n.id);
  }
  const direct = (unitId: string): number | null => {
    const root = roots.get(unitId);
    if (!root) return null;
    const { roster: added, selId } = addUnit(scope, roster, forceSelId, root);
    const pts = findSelView(evaluate(scope, added), selId)?.total[COST_PTS] ?? 0;
    return pts > 0 ? pts : null;
  };
  const report: PointsDisagreement[] = [];
  let priced = 0;
  for (const u of out.units) {
    const wahapedia = u.points;
    const offered = picker.has(u.id);
    const engine = offered ? picker.get(u.id)! : direct(u.id);
    if (engine !== null) {
      u.points = engine;
      priced++;
    }
    if (engine !== wahapedia) report.push({ slug: out.slug, unit: u.name, engine, wahapedia, ...(!offered && engine !== null && { offered: false as const }) });
  }
  return { priced, disagreements: report };
}
