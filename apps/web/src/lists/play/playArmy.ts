/** The read-only army Play mode shows: units by role with what they carry and their datasheets. Pure, no React. */
import { BATTLEFIELD_ROLES, type UnitOut } from '@recruit/data/model';
import {
  BATTLE_SIZES,
  COST_CP,
  COST_PL,
  COST_PTS,
  displayName,
  factionDisplayName,
  optionDisplay,
  UNTITLED_LIST,
  unitSummary,
  type RosterView,
  type Scope,
  type SelView,
} from '@recruit/data/roster';
import { isArmyOption, isAutoManaged, unitName, unitsByRole } from '../editorView';
import { unitInfo, type UnitIndex } from '../unitIndex';

export interface PlayUnit {
  selId: string;
  name: string;
  role: string;
  models: number;
  points: number;
  /** What it carries, in player words: weapons ("10x Gauss Flayer"), then relics, then any other upgrade. */
  wargear: string[];
  warlord: boolean;
  warlordTrait: string | null;
  /** Its datasheet; null when the rules data has none (or no longer has the item at all). */
  unit: UnitOut | null;
  /** The datasheet's weapons it carries (takenWeapons); undefined: show them all. */
  taken: string[] | undefined;
}
/** An army-wide choice the player made: { heading: 'Dynasty', name: 'Novokh', entryId }. */
export interface PlayChoice { heading: string; name: string; entryId: string }
export interface PlayArmy {
  name: string;
  faction: string;
  sizeName: string;
  points: number;
  pointsLimit: number;
  powerLevel: number;
  commandPoints: number;
  choices: PlayChoice[];
  /** Rulebook order, every detachment's units together under their role. */
  roles: { role: string; units: PlayUnit[] }[];
  /** The same units, flat, in the order shown (for Previous and Next). */
  units: PlayUnit[];
}

/** For matching names: lower case, trimmed, single spaces, curly apostrophes straight. */
const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Every selection under `v` with its number of copies (the product of the counts down to it), none of them zero. */
function counted(children: SelView[], copies = 1): { name: string; qty: number }[] {
  return children.flatMap((c) => {
    const qty = copies * c.sel.count;
    // By its display name: a relic chosen as "Relic (Novokh): Blood Scythe" has the profile "Blood Scythe".
    return qty > 0 ? [{ name: norm(optionDisplay(c.name).name), qty }, ...counted(c.children, qty)] : [];
  });
}

/**
 * The datasheet's weapon profiles this unit carries: a profile matches a selection by name, or as one of its modes
 * ("Staff of Light" → "Staff of Light (Shooting)" and "(Melee)"), ignoring case, spacing and apostrophes. A weapon the
 * unit has several of reads "10x Gauss Flayer", which DatasheetView shows as ×10. Undefined when nothing matches, so
 * the datasheet shows every weapon rather than none.
 */
export function takenWeapons(v: SelView, unit: UnitOut): string[] | undefined {
  const held = new Map<string, number>();
  for (const { name, qty } of counted(v.children)) held.set(name, (held.get(name) ?? 0) + qty);
  // The summary counts a unit-wide choice once per model ("5x Gauss Blaster"), which the plain walk above can't know.
  for (const g of unitSummary(v).gear) {
    const m = /^([\d,]+)x (.+)$/.exec(g);
    const name = norm(m ? m[2] : g);
    if (held.has(name)) held.set(name, m ? Number(m[1].replace(/,/g, '')) : 1);
  }
  const out: string[] = [];
  for (const p of unit.weapons) {
    const name = norm(p.name);
    const qty = [...held].find(([h]) => name === h || name.startsWith(`${h} (`))?.[1];
    if (qty !== undefined) out.push(qty > 1 ? `${qty}x ${p.name}` : p.name);
  }
  return out.length ? out : undefined;
}

const OTHER = 'Other';
/** As unitsByRole sorts: battlefield roles in rulebook order, then any other role, then "Other". */
const rank = (role: string) => {
  const i = (BATTLEFIELD_ROLES as string[]).indexOf(role);
  return i < 0 ? BATTLEFIELD_ROLES.length + (role === OTHER ? 1 : 0) : i;
};

function playUnit(scope: Scope, units: UnitIndex | null, v: SelView, role: string): PlayUnit {
  const s = v.merged ? unitSummary(v) : null;
  const unit = v.merged ? (unitInfo(scope, units, v.sel.entryId)?.unit ?? null) : null;
  return {
    selId: v.sel.id,
    name: unitName(v.name),
    role,
    models: v.models,
    points: v.total[COST_PTS] ?? 0,
    wargear: s ? [...s.gear, ...s.relics, ...s.other] : [],
    warlord: s?.warlord ?? false,
    warlordTrait: s?.traits[0] ?? null,
    unit,
    taken: unit ? takenWeapons(v, unit) : undefined,
  };
}

/**
 * The army choices made in any detachment (Dynasty, Army of Renown…), each chosen option once: an allied detachment's
 * own choice (a Knights household) counts too. The app's own settings (battle size, game type) are left out.
 */
function playChoices(scope: Scope, view: RosterView): PlayChoice[] {
  const out: PlayChoice[] = [];
  for (const fv of view.forces) {
    for (const v of fv.selections) {
      if (!v.merged || !isArmyOption(scope, v) || isAutoManaged(v)) continue;
      for (const c of v.children) {
        if (c.sel.count <= 0 || out.some((x) => x.entryId === c.sel.entryId)) continue;
        const d = optionDisplay(c.name);
        out.push({ heading: d.heading ?? displayName(v.name), name: d.name, entryId: c.sel.entryId });
      }
    }
  }
  return out;
}

/** A validated roster as Play mode shows it. `units` null: no datasheets (every unit still listed). */
export function playArmy(view: RosterView, scope: Scope, units: UnitIndex | null): PlayArmy {
  const { roster } = view;
  const size = BATTLE_SIZES[roster.battleSize];
  const byRole = new Map<string, PlayUnit[]>();
  for (const fv of view.forces) {
    for (const g of unitsByRole(scope, fv)) {
      byRole.set(g.role, [...(byRole.get(g.role) ?? []), ...g.units.map((v) => playUnit(scope, units, v, g.role))]);
    }
  }
  const roles = [...byRole].map(([role, list]) => ({ role, units: list })).sort((a, b) => rank(a.role) - rank(b.role) || a.role.localeCompare(b.role));
  return {
    name: roster.name.trim() || UNTITLED_LIST,
    faction: factionDisplayName(scope.catalogue(roster.catalogueId)?.name ?? ''),
    sizeName: size?.name ?? roster.battleSize,
    points: view.total[COST_PTS] ?? 0,
    pointsLimit: size?.points ?? 0,
    powerLevel: view.total[COST_PL] ?? 0,
    commandPoints: view.total[COST_CP] ?? 0,
    choices: playChoices(scope, view),
    roles,
    units: roles.flatMap((r) => r.units),
  };
}
