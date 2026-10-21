/** Pure helpers for the list editor's screens: number formatting, units by role, and which units have problems. No React. */
import { BATTLEFIELD_ROLES } from '@recruit/data/model';
import {
  AUTO_MANAGED_ENTRIES,
  BATTLE_SIZES,
  displayName,
  findSelView,
  isSpecialistDetachment,
  resolve,
  type Cond,
  type CondGroup,
  type ForceView,
  type Issue,
  type Mod,
  type OptionNode,
  type RNode,
  type Roster,
  type RosterView,
  type Scope,
  type SelView,
} from '@recruit/data/roster';

export const fmt = (n: number) => n.toLocaleString('en-GB');
export const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
export const problemsLabel = (n: number) => (n === 0 ? '✓ Legal' : plural(n, 'problem', 'problems'));

const LEGENDS_TAG = /\s*\[legends\]/i;
/** A unit name without BattleScribe's "[Legends]" tag (the picker shows a badge instead) or decoration. */
export const unitName = (name: string) => displayName(name.replace(LEGENDS_TAG, ''));

const CONFIGURATION = 'Configuration';
const STRATAGEMS = 'Stratagems';
/** Army-wide entries the app sets itself (Game Type, Battle Size, Detachment Command Cost): never edited by the player. */
const AUTO_MANAGED = new Set(AUTO_MANAGED_ENTRIES);

export const roleOf = (scope: Scope, v: SelView): string | null => (v.primary ? (scope.category(v.primary)?.name ?? null) : null);
/** Configuration or Stratagems: army choices, not units. */
export const isArmyOption = (scope: Scope, v: SelView) => [CONFIGURATION, STRATAGEMS].includes(roleOf(scope, v) ?? '');
export const isAutoManaged = (v: SelView) => v.merged !== null && AUTO_MANAGED.has(v.merged.target.id);
export function isAutoManagedEntry(scope: Scope, entryId: string): boolean {
  const node = scope.node(entryId);
  return node !== undefined && AUTO_MANAGED.has(resolve(scope, node).target.id);
}

/**
 * Whether an army option is offered at the roster's battle size: Specialist Detachments aren't used in Arks of Omen games
 * (the validator still reports one a saved list has).
 */
export function offeredAtSize(scope: Scope, roster: Roster, entryId: string): boolean {
  const node = scope.node(entryId);
  return !(node && BATTLE_SIZES[roster.battleSize]?.mode === 'aoo' && isSpecialistDetachment(scope, resolve(scope, node)));
}

/**
 * BattleScribe display helpers that sit among the army options but are not choices a player makes about the army:
 * - unit filters for BattleScribe's own lists ("Hide Imperial Agents"),
 * - rules shown on request ("Show Vows", "Deeds and Sagas [Reference]", "Warlord Traits (Reference)"),
 * - the .gst "Use Beta Rules" switch (a BattleScribe setting).
 * A switch whose selection reveals units or options in this army's data is a real choice whatever its name: "Use Beta
 * Rules" reveals the Chaos Deimos Predator [LEGENDS] for Chaos Space Marines (see revealingIds).
 * An option holding only such helpers is one too: "Unit Filter" holds only "Hide …" switches, "Detachment Bonuses"
 * only "Show Bonuses". The full list this hides in BSData v9.8.0 is pinned by editorView.test.ts.
 */
const HELPER_NAMES = [/^Hide /, /^Show /, /\(Reference\)|\[Reference\]/i, /^Use Beta Rules$/];

export function isHelperOption(scope: Scope, entryId: string): boolean {
  const node = scope.node(entryId);
  return node !== undefined && isHelperNode(scope, node);
}

function isHelperNode(scope: Scope, node: RNode): boolean {
  const merged = resolve(scope, node);
  if (HELPER_NAMES.some((re) => re.test(merged.name.trim()))) return !merged.ids.some((id) => revealingIds(scope).has(id));
  return merged.children.length > 0 && merged.children.every((child) => isHelperNode(scope, child));
}

const revealingCache = new WeakMap<Scope, Set<string>>();

/**
 * Ids whose selection reveals something: a `hidden` modifier that un-hides when the id is selected (`hidden=false`
 * when at least 1) or hides while it isn't (`hidden=true` when fewer than 1). Unit filters work the other way round
 * (`Hide …` sets `hidden=true` when selected), so they never land here. Built once per scope.
 */
function revealingIds(scope: Scope): Set<string> {
  let out = revealingCache.get(scope);
  if (out) return out;
  const ids = new Set<string>();
  const visitMods = (mods: Mod[] | undefined) => {
    for (const m of mods ?? []) {
      if (m.field !== 'hidden' || !m.when) continue;
      for (const c of conditions(m.when)) if (reveals(m.value, c)) ids.add(c.childId);
    }
  };
  const visitNodes = (nodes: RNode[]) => {
    for (const n of nodes) {
      visitMods(n.mods);
      n.cats?.forEach((l) => visitMods(l.mods));
      if (n.children) visitNodes(n.children);
    }
  };
  for (const f of scope.files) {
    visitNodes(f.rootEntries);
    visitNodes(f.shared);
    f.categories.forEach((c) => visitMods(c.mods));
    for (const fe of f.forces) {
      visitMods(fe.mods);
      fe.cats.forEach((l) => visitMods(l.mods));
    }
  }
  revealingCache.set(scope, (out = ids));
  return out;
}

const conditions = (g: CondGroup): Cond[] => [...g.conds, ...g.groups.flatMap(conditions)];

/** Whether the condition holds once its id is selected and the modifier then shows (or stops hiding) something. */
function reveals(value: string, c: Cond): boolean {
  if (value === 'false') {
    return (c.type === 'atLeast' && c.value >= 1) || (c.type === 'greaterThan' && c.value >= 0) || (c.type === 'equalTo' && c.value >= 1) || (c.type === 'notEqualTo' && c.value === 0);
  }
  if (value === 'true') return (c.type === 'lessThan' && c.value >= 1) || (c.type === 'atMost' && c.value === 0) || (c.type === 'equalTo' && c.value === 0);
  return false;
}

export interface RoleGroup { role: string; units: SelView[] }

const OTHER = 'Other';
const rank = (role: string) => {
  const i = (BATTLEFIELD_ROLES as string[]).indexOf(role);
  return i < 0 ? BATTLEFIELD_ROLES.length + (role === OTHER ? 1 : 0) : i;
};

/** The detachment's units by battlefield role, in rulebook order (anything else under "Other"); army options left out. */
export function unitsByRole(scope: Scope, fv: ForceView): RoleGroup[] {
  const groups = new Map<string, SelView[]>();
  for (const v of fv.selections) {
    if (v.merged && isArmyOption(scope, v)) continue;
    const role = (v.merged && roleOf(scope, v)) || OTHER;
    groups.set(role, [...(groups.get(role) ?? []), v]);
  }
  return [...groups].map(([role, units]) => ({ role, units })).sort((a, b) => rank(a.role) - rank(b.role) || a.role.localeCompare(b.role));
}

const rootOf = (v: SelView): SelView => (v.parent ? rootOf(v.parent) : v);

/** The selections an issue is about: its own, and the ones its fix opens, removes or changes. */
function issueSelIds(i: Issue): string[] {
  const ids = i.selId ? [i.selId] : [];
  const f = i.fix;
  if (f?.kind === 'remove') ids.push(...f.selIds);
  else if (f?.kind === 'open' || f?.kind === 'set-count') ids.push(f.selId);
  return ids;
}

/** Ids of the units (root selections) that have at least one problem. */
export function unitsWithIssues(view: RosterView, issues: Issue[]): Set<string> {
  const out = new Set<string>();
  for (const i of issues) {
    for (const id of issueSelIds(i)) {
      const v = findSelView(view, id);
      if (v) out.add(rootOf(v).sel.id);
    }
  }
  return out;
}

/** The issues about one unit (or anything inside it). */
export function issuesOfUnit(view: RosterView, issues: Issue[], unitSelId: string): Issue[] {
  return issues.filter((i) => issueSelIds(i).some((id) => {
    const v = findSelView(view, id);
    return v !== undefined && rootOf(v).sel.id === unitSelId;
  }));
}

/** Option nodes that are plain options, looking inside nested groups. */
export const leaves = (nodes: OptionNode[]): OptionNode[] => nodes.flatMap((n) => (n.kind === 'group' ? leaves(n.children) : [n]));

/** Whether the player has anything to decide among these options (not just wargear that always comes with the model). */
export function hasChoices(nodes: OptionNode[]): boolean {
  return nodes.some((n) => (n.kind === 'group' ? leaves(n.children).length > 1 || n.min !== n.max || hasChoices(n.children) : n.min !== n.max));
}
