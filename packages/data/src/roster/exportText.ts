/**
 * Plain-text export of a roster: the list people paste into chats and tournament forms. Browser-safe.
 * Numbers use en-GB thousands separators; lines end with "\n"; there is no trailing newline.
 */
import { BATTLEFIELD_ROLES } from '../model/types';
import type { ForceView, RosterView, SelView } from './evaluate';
import { displayName, factionDisplayName, optionDisplay, stripCpSuffix } from './names';
import { BATTLE_SIZES, BATTLE_SIZE_ENTRY, DETACHMENT_COMMAND_COST_ENTRY, GAME_TYPE_ENTRY } from './policy';
import type { Scope } from './scope';
import { COST_CP, COST_PL, COST_PTS, type CostMap } from './types';

const FOOTER = 'Built with Recruit+ (unofficial fan-made tool)';
const CONFIGURATION = 'Configuration';
const WARLORD = 'Warlord';
/** Shown where a list has no name (a cleared name box is saved as ''), so the first line is never empty. */
export const UNTITLED_LIST = 'Untitled list';
const OTHER = 'Other';
const INDENT = '    ';
/** Configuration entries the app manages itself (Game Type, Battle Size, Detachment Command Cost): never printed. */
const AUTO_MANAGED = new Set([GAME_TYPE_ENTRY, BATTLE_SIZE_ENTRY, DETACHMENT_COMMAND_COST_ENTRY]);

const num = (n: number) => n.toLocaleString('en-GB');
const cost = (costs: CostMap, id: string) => costs[id] ?? 0;

export function exportText(view: RosterView, scope: Scope): string {
  const { roster } = view;
  const size = BATTLE_SIZES[roster.battleSize];
  const faction = factionDisplayName(scope.catalogue(roster.catalogueId)?.name ?? '');
  const header = [
    faction,
    size?.name ?? roster.battleSize,
    `${num(cost(view.total, COST_PTS))} / ${num(size?.points ?? 0)} pts`,
    `${num(cost(view.total, COST_PL))} PL`,
    `${num(cost(view.total, COST_CP))} CP`,
  ].join(' · ');
  const blocks = [[roster.name.trim() || UNTITLED_LIST, header], ...view.forces.map((fv) => forceBlock(fv, scope)), [FOOTER]];
  return blocks.map((b) => b.join('\n')).join('\n\n');
}

// ---------- detachments ----------

const isConfiguration = (v: SelView, scope: Scope) => scope.category(v.primary ?? '')?.name === CONFIGURATION;

function forceBlock(fv: ForceView, scope: Scope): string[] {
  const catalogue = scope.catalogue(fv.force.catalogueId)?.name;
  const lines = [`== ${stripCpSuffix(fv.name)} (${catalogue ? factionDisplayName(catalogue) : ''}) ==`];
  const units = new Map<string, SelView[]>();
  for (const v of fv.selections) {
    if (!v.merged) continue; // an item the rules data no longer has
    if (isConfiguration(v, scope)) {
      if (v.children.length && !AUTO_MANAGED.has(v.merged.target.id)) lines.push(`Army: ${displayName(v.name)}: ${v.children.map((c) => displayName(c.name)).join(', ')}`);
      continue;
    }
    const role = scope.category(v.primary ?? '')?.name ?? '';
    const key = (BATTLEFIELD_ROLES as string[]).includes(role) ? role : OTHER;
    units.set(key, [...(units.get(key) ?? []), v]);
  }
  for (const role of [...BATTLEFIELD_ROLES, OTHER]) {
    const inRole = units.get(role);
    if (!inRole) continue;
    lines.push(role);
    for (const v of inRole) lines.push(...unitLines(v));
  }
  return lines;
}

// ---------- units ----------

/** Descendants in document order with the number of copies of each (the product of the counts down to it). */
function* descendants(children: SelView[], copies: number): Generator<{ v: SelView; qty: number }> {
  for (const v of children) {
    const qty = copies * v.sel.count;
    yield { v, qty };
    yield* descendants(v.children, qty);
  }
}

/**
 * Models in one copy of a unit, for a unit-wide wargear choice; 1 for a model-type unit (a character). A unit-wide
 * choice (perModel, emit.ts) is one selection under the unit that every model carries, so it is counted once per model.
 */
const modelsPerCopy = (unit: SelView) => (unit.type === 'unit' && unit.models > 1 ? unit.models / Math.max(1, unit.sel.count) : 1);
/** Copies of a direct child of the unit: per model for a unit-wide choice (never for a model chosen in a one-of group). */
const childCopies = (v: SelView, perModel: number) => v.sel.count * (v.type !== 'model' && v.merged?.node.perModel ? perModel : 1);

/**
 * Leaf upgrades (not models, not the Warlord, nothing selected under them, not zero) aggregated by name, first seen
 * first. A parent option is shown through its leaves. `skipModels` leaves out everything inside a model stack;
 * `perModel` is the model count a unit-wide choice among `children` is multiplied by.
 */
function aggregate(children: SelView[], skipModels = false, perModel = 1): Map<string, number> {
  const out = new Map<string, number>();
  const visit = (vs: SelView[], copies: number, top: boolean) => {
    for (const v of vs) {
      if (skipModels && v.type === 'model') continue;
      const qty = copies * (top ? childCopies(v, perModel) : v.sel.count);
      if (v.type !== 'model' && v.name !== WARLORD && qty > 0 && !v.children.length) {
        const name = displayName(v.name);
        out.set(name, (out.get(name) ?? 0) + qty);
      }
      visit(v.children, qty, false);
    }
  };
  visit(children, 1, true);
  return out;
}

const hasWarlord = (v: SelView) => [...descendants(v.children, 1)].some(({ v: d, qty }) => d.name === WARLORD && qty > 0);

/** One unit as the export prints it: "- {title} · {points}", then the details, each indented. */
export interface UnitExport {
  /** E.g. "2x Necron Warriors (20 models)". */
  title: string;
  /** E.g. "220 pts". */
  points: string;
  /** Warlord, wargear and per-model lines, without the indent. */
  details: string[];
}

export function unitExport(v: SelView): UnitExport {
  const copies = v.sel.count > 1 ? `${num(v.sel.count)}x ` : '';
  const models = v.models > 1 ? ` (${num(v.models)} models)` : '';
  const details: string[] = [];
  if (hasWarlord(v)) details.push(WARLORD);
  const stacks = modelStacks(v);
  const perModel = stacks.length > 1;
  for (const [name, qty] of aggregate(v.children, perModel, modelsPerCopy(v))) details.push(`${num(qty)}x ${name}`);
  if (perModel) details.push(...stacks.map((s) => `${s.name} (${num(s.count)})${s.upgrades ? `: ${s.upgrades}` : ''}`));
  return { title: `${copies}${displayName(v.name)}${models}`, points: `${num(cost(v.total, COST_PTS))} pts`, details };
}

/** What a unit holds, in player words (spec §4): for list rows (Plan B) and Play mode (Plan C). */
export interface UnitSummary {
  /** Weapons, counted like the export ("5x Gauss Blaster"); a single one reads just its name ("Staff of Light"). */
  gear: string[];
  warlord: boolean;
  /** Warlord trait names (optionDisplay names, no prefixes). */
  traits: string[];
  /** Relic names. */
  relics: string[];
  /** Any other chosen upgrade (stratagem upgrades, psychic powers, wargear without a weapon profile…), optionDisplay names. */
  other: string[];
}

/** The Requisition stratagems (optionDisplay names under "Stratagem"): the trait or relic they buy is shown instead. */
const REQUISITIONS = new Set(['Warlord trait', 'Relic']);

/**
 * A unit's chosen upgrades sorted for display, walked like the export: a Warlord trait is one whose heading is
 * "Warlord trait…" or that was chosen in a Warlord traits group (extraKind, emit.ts), a relic likewise; the Warlord
 * upgrade sets `warlord`; the Requisition stratagems are left out; a leaf that carries a weapon (gear) is gear and
 * anything else is other. A trait's or relic's own sub-options are not listed again. Names go through optionDisplay.
 */
export function unitSummary(v: SelView): UnitSummary {
  const out: UnitSummary = { gear: [], warlord: hasWarlord(v), traits: [], relics: [], other: [] };
  const gear = new Map<string, number>();
  const add = (list: string[], name: string) => void (list.includes(name) || list.push(name));
  const perModel = modelsPerCopy(v);
  const visit = (vs: SelView[], copies: number, top: boolean) => {
    for (const c of vs) {
      const qty = copies * (top ? childCopies(c, perModel) : c.sel.count);
      if (qty <= 0) continue;
      const d = optionDisplay(c.name);
      const kind = c.merged?.node.extraKind;
      if (c.type !== 'model' && c.name !== WARLORD) {
        if (kind === 'trait' || d.heading?.startsWith('Warlord trait')) {
          add(out.traits, d.name);
          continue;
        }
        if (kind === 'relic' || d.heading?.startsWith('Relic')) {
          add(out.relics, d.name);
          continue;
        }
        if (!c.children.length && !(d.heading === 'Stratagem' && REQUISITIONS.has(d.name))) {
          if (c.merged?.node.gear || c.merged?.target.gear) gear.set(d.name, (gear.get(d.name) ?? 0) + qty);
          else add(out.other, d.name);
        }
      }
      visit(c.children, qty, false);
    }
  };
  visit(v.children, 1, true);
  out.gear = [...gear].map(([name, n]) => (n > 1 ? `${num(n)}x ${name}` : name));
  return out;
}

function unitLines(v: SelView): string[] {
  const u = unitExport(v);
  return [`- ${u.title} · ${u.points}`, ...u.details.map((d) => `${INDENT}${d}`)];
}

/** The unit's distinct model stacks (same model and upgrades merge): the per-model lines are printed when there are several. */
function modelStacks(unit: SelView): { name: string; count: number; upgrades: string }[] {
  const stacks = new Map<string, { name: string; count: number; upgrades: string }>();
  for (const m of unit.children) {
    if (m.type !== 'model' || m.sel.count <= 0) continue;
    const upgrades = [...aggregate(m.children)].map(([name, qty]) => (qty > 1 ? `${num(qty)}x ${name}` : name)).join(', ');
    const key = `${m.name}\u0000${upgrades}`;
    const stack = stacks.get(key);
    if (stack) stack.count += m.sel.count;
    else stacks.set(key, { name: displayName(m.name), count: m.sel.count, upgrades });
  }
  return [...stacks.values()];
}
