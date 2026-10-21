/**
 * Plain-text export of a roster: the list people paste into chats and tournament forms. Browser-safe.
 * Numbers use en-GB thousands separators; lines end with "\n"; there is no trailing newline.
 */
import { BATTLEFIELD_ROLES } from '../model/types';
import type { ForceView, RosterView, SelView } from './evaluate';
import { factionDisplayName, stripCpSuffix } from './names';
import { BATTLE_SIZES, BATTLE_SIZE_ENTRY, DETACHMENT_COMMAND_COST_ENTRY, GAME_TYPE_ENTRY } from './policy';
import type { Scope } from './scope';
import { COST_CP, COST_PL, COST_PTS, type CostMap } from './types';

const FOOTER = 'Built with Recruit+ (unofficial fan-made tool)';
const CONFIGURATION = 'Configuration';
const WARLORD = 'Warlord';
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
  const blocks = [[roster.name, header], ...view.forces.map((fv) => forceBlock(fv, scope)), [FOOTER]];
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
      if (v.children.length && !AUTO_MANAGED.has(v.merged.target.id)) lines.push(`Army: ${v.name}: ${v.children.map((c) => c.name).join(', ')}`);
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
 * Leaf upgrades (not models, not the Warlord, nothing selected under them, not zero) aggregated by name, first seen
 * first. A parent option is shown through its leaves. `skipModels` leaves out everything inside a model stack.
 */
function aggregate(children: SelView[], skipModels = false): Map<string, number> {
  const out = new Map<string, number>();
  const visit = (vs: SelView[], copies: number) => {
    for (const v of vs) {
      if (skipModels && v.type === 'model') continue;
      const qty = copies * v.sel.count;
      if (v.type !== 'model' && v.name !== WARLORD && qty > 0 && !v.children.length) out.set(v.name, (out.get(v.name) ?? 0) + qty);
      visit(v.children, qty);
    }
  };
  visit(children, 1);
  return out;
}

const hasWarlord = (v: SelView) => [...descendants(v.children, 1)].some(({ v: d, qty }) => d.name === WARLORD && qty > 0);

function unitLines(v: SelView): string[] {
  const copies = v.sel.count > 1 ? `${num(v.sel.count)}x ` : '';
  const models = v.models > 1 ? ` (${num(v.models)} models)` : '';
  const lines = [`- ${copies}${v.name}${models} · ${num(cost(v.total, COST_PTS))} pts`];
  if (hasWarlord(v)) lines.push(`${INDENT}${WARLORD}`);
  const stacks = modelStacks(v);
  const perModel = stacks.length > 1;
  for (const [name, qty] of aggregate(v.children, perModel)) lines.push(`${INDENT}${num(qty)}x ${name}`);
  if (perModel) lines.push(...stacks.map((s) => `${INDENT}${s.name} (${num(s.count)})${s.upgrades ? `: ${s.upgrades}` : ''}`));
  return lines;
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
    else stacks.set(key, { name: m.name, count: m.sel.count, upgrades });
  }
  return [...stacks.values()];
}
