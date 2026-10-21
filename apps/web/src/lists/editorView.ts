/** Pure helpers for the list editor's screens: number formatting, units by role, and which units have problems. No React. */
import { BATTLEFIELD_ROLES } from '@recruit/data/model';
import {
  BATTLE_SIZE_ENTRY,
  DETACHMENT_COMMAND_COST_ENTRY,
  GAME_TYPE_ENTRY,
  displayName,
  findSelView,
  resolve,
  type ForceView,
  type Issue,
  type OptionNode,
  type RNode,
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
/** Army-wide entries the app sets itself: never shown as something to edit. */
const AUTO_MANAGED = new Set([GAME_TYPE_ENTRY, BATTLE_SIZE_ENTRY, DETACHMENT_COMMAND_COST_ENTRY]);

export const roleOf = (scope: Scope, v: SelView): string | null => (v.primary ? (scope.category(v.primary)?.name ?? null) : null);
/** Configuration or Stratagems: army choices, not units. */
export const isArmyOption = (scope: Scope, v: SelView) => [CONFIGURATION, STRATAGEMS].includes(roleOf(scope, v) ?? '');
export const isAutoManaged = (v: SelView) => v.merged !== null && AUTO_MANAGED.has(v.merged.target.id);
export function isAutoManagedEntry(scope: Scope, entryId: string): boolean {
  const node = scope.node(entryId);
  return node !== undefined && AUTO_MANAGED.has(resolve(scope, node).target.id);
}

/**
 * BattleScribe display helpers that sit among the army options but are not choices a player makes about the army:
 * - unit filters for BattleScribe's own lists ("Hide Imperial Agents"),
 * - rules shown on request ("Show Vows", "Deeds and Sagas [Reference]", "Warlord Traits (Reference)"),
 * - the .gst "Use Beta Rules" switch (a BattleScribe setting, not a matched-play choice).
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
  if (HELPER_NAMES.some((re) => re.test(merged.name.trim()))) return true;
  return merged.children.length > 0 && merged.children.every((child) => isHelperNode(scope, child));
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
