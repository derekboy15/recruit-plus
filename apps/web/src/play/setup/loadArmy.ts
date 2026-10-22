/** A saved army-builder list → an engine army, with what didn't muster in plain English (R-20). */
import type { BattleSizeId } from '@recruit/data/roster';
import { evaluate } from '@recruit/data/roster';
import type { ArmyInput, PlayerId } from '@recruit/engine';
import { musterFromRoster, type MusterProblem, type UnitLookup } from '@recruit/engine/data';
import { getCatalogue, getIndex, getRosterScope } from '../../factions/dataClient';
import type { ListData } from '../../lists/listStore';
import { slugsFor } from '../../lists/useRosterEditor';
import type { Doc } from '../../storage/types';

export interface LoadedArmy {
  army: ArmyInput;
  problems: string[];
  /** Every catalogue the list's datasheets can come from (the game screen loads their ability texts). */
  catalogueSlugs: string[];
  faction: string;
  battleSize: BattleSizeId;
  points: number;
}

const SYSTEM = 'system';

export function musterProblemText(p: MusterProblem): string {
  if (p.kind === 'unknown-unit') return `${p.unit} isn't in the game: its datasheet couldn't be found.`;
  if (p.kind === 'unmatched-model') return `${p.unit}: the model "${p.detail}" couldn't be matched, so it uses the first profile.`;
  return `${p.unit}: "${p.detail}" couldn't be matched to a weapon and won't be used.`;
}

/** Musters a saved list for `player`. Unit ids become `${player}:${id}`, so one list can face itself. */
export async function loadArmy(list: Doc<ListData>, player: PlayerId): Promise<LoadedArmy> {
  const { roster, summary } = list.data;
  const { catalogues } = await getIndex();
  const primary = catalogues.find((c) => c.id === roster.catalogueId)?.slug ?? summary.catalogueSlug;
  const slugs = slugsFor(roster, catalogues, primary);
  const catalogueSlugs = [...new Set(slugs.flatMap((s) => catalogues.find((c) => c.slug === s)?.rosterScope ?? [s]))].filter((s) => s !== SYSTEM);
  const [scope, loaded] = await Promise.all([getRosterScope(slugs), Promise.allSettled(catalogueSlugs.map(getCatalogue))]);
  const units: UnitLookup = new Map();
  for (const r of loaded) if (r.status === 'fulfilled') for (const unit of r.value.units) if (!units.has(unit.id)) units.set(unit.id, { unit, catalogueName: r.value.name });
  const { army, problems } = musterFromRoster(evaluate(scope, roster), units, player);
  const out: ArmyInput = { ...army, player, name: roster.name, units: army.units.map((u) => ({ ...u, id: `${player}:${u.id}` })) };
  const texts = problems.map(musterProblemText);
  if (!out.units.length) texts.push(`${roster.name} has no units.`);
  return { army: out, problems: texts, catalogueSlugs, faction: summary.faction, battleSize: roster.battleSize, points: summary.points };
}
