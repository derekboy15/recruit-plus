/** The engine side of the new-list wizard: what each step offers and how the choices become a roster. No React. */
import { BATTLEFIELD_ROLES, type CatalogueSummary } from '@recruit/data/model';
import {
  BATTLE_SIZES,
  BATTLE_SIZE_ENTRY,
  COST_PTS,
  GAME_TYPE_ENTRY,
  addChild,
  addUnit,
  armyOptions,
  childConstraints,
  childOptions,
  chooseInGroup,
  createRoster,
  detachmentChoices,
  displayName,
  evaluate,
  factionDisplayName,
  resolve,
  stripCpSuffix,
  validate,
  type BattleSizeId,
  type OptionNode,
  type PolicyData,
  type RForce,
  type Roster,
  type RosterView,
  type Scope,
} from '@recruit/data/roster';
import { offeredAtSize } from './editorView';
import { cleanLabel, uniqueListName } from './labels';
import type { ListData } from './listStore';

export { uniqueListName };

// ---------- step 2: battle sizes ----------

export interface SizeCard {
  id: BattleSizeId;
  name: string;
  points: number;
  description: string;
  /** The size to start with: Combat Patrol. */
  recommended: boolean;
}

const pts = (n: number) => n.toLocaleString('en-GB');
const SIZE_TEXT: Partial<Record<BattleSizeId, string>> = {
  'combat-patrol': 'Small and quick to play: the best way to learn.',
  incursion: 'Arks of Omen rules: one main detachment.',
  'strike-force': 'The usual size for most games and events. Arks of Omen rules.',
};

export function sizeCards(): SizeCard[] {
  return Object.values(BATTLE_SIZES).map((s) => ({
    id: s.id,
    name: s.name,
    points: s.points,
    description: `${pts(s.points)} points. ${SIZE_TEXT[s.id] ?? `Very large games. Core Book rules: up to ${s.maxDetachments} detachments.`}`,
    recommended: s.id === 'combat-patrol',
  }));
}

// ---------- step 3: detachments ----------

export interface DetachmentCard {
  forceId: string;
  /** Without the command-point cost the data adds to the name. */
  name: string;
  /** Unit slots it offers, e.g. "1–2 HQ · 1–3 Troops". */
  slots: string;
  /** What it is for, from its own info when the data has any. */
  summary: string | null;
}

/** The detachments the first pick of a new army can be: the faction's own, never an ally's. */
export function detachmentCards(
  scope: Scope,
  policy: PolicyData,
  catalogues: CatalogueSummary[],
  catalogueId: string,
  size: BattleSizeId,
  /** The one-line summary of a detachment's own info (none when there is none). */
  describe: (forceId: string) => string | null = () => null,
): DetachmentCard[] {
  const empty: Roster = { schema: 1, name: '', catalogueId, battleSize: size, forces: [] };
  const seen = new Set<string>();
  const cards: DetachmentCard[] = [];
  for (const c of detachmentChoices(scope, empty, policy, catalogues)) {
    const force = scope.force(c.forceId);
    if (c.allied || !force || seen.has(force.id)) continue;
    seen.add(force.id);
    cards.push({ forceId: force.id, name: stripCpSuffix(force.name), slots: slotSummary(scope, force), summary: describe(force.id) });
  }
  return cards;
}

/** "1–2 HQ · 1–3 Troops · up to 2 Elites", from the detachment's slot limits (no limit shows as "any"). */
export function slotSummary(scope: Scope, force: RForce): string {
  const parts: string[] = [];
  for (const link of force.cats) {
    const role = scope.category(link.targetId)?.name;
    if (!role || !(BATTLEFIELD_ROLES as string[]).includes(role)) continue;
    let min = 0;
    let max = -1;
    for (const c of link.constraints ?? []) {
      if (c.field !== 'selections' || c.percent || c.value < 0 || (c.scope !== 'force' && c.scope !== 'parent')) continue;
      if (c.type === 'min') min = Math.max(min, c.value);
      else max = max === -1 ? c.value : Math.min(max, c.value);
    }
    if (max === 0) continue; // not allowed in this detachment
    if (max === -1) parts.push(min > 0 ? `${min}+ ${role}` : `any ${role}`);
    else if (min === max) parts.push(`${min} ${role}`);
    else parts.push(min > 0 ? `${min}–${max} ${role}` : `up to ${max} ${role}`);
  }
  return parts.join(' · ');
}

// ---------- step 4: army options ----------

export interface ArmyChoice {
  /** Identifies the choice in the wizard's state. */
  key: string;
  /** The army option's root entry and the group of choices inside it. */
  entryId: string;
  groupId: string;
  title: string;
  /** How many the group takes (max -1: no limit). Most take exactly one; Imperial Knights' Chivalric Oath takes two. */
  min: number;
  max: number;
  /** selIds: the roster's selections of that option (none when the army option isn't in the roster yet). */
  options: { id: string; name: string; selIds: string[] }[];
  /** The option the starting roster already has, if any (the first, when the group takes several). */
  current: string | null;
}

/** The roster the wizard starts from: the chosen detachment with everything the engine fills in (battle size, game type…). */
export function startingRoster(scope: Scope, args: { name: string; catalogueId: string; sizeId: BattleSizeId; forceId: string }): Roster {
  return createRoster(scope, { name: args.name, catalogueId: args.catalogueId, battleSize: args.sizeId, forceId: args.forceId });
}

/** Battle size and game type follow from steps 1 to 3, so the army-options step never asks about them. */
function isSetBySteps(scope: Scope, entryId: string): boolean {
  const node = scope.node(entryId);
  const target = node ? resolve(scope, node).target.id : entryId;
  return target === GAME_TYPE_ENTRY || target === BATTLE_SIZE_ENTRY;
}

const leafOptions = (nodes: OptionNode[]): OptionNode[] => nodes.flatMap((n) => (n.kind === 'group' ? leafOptions(n.children) : [n]));

/**
 * Each army option with something to pick (Dynasty Choice, Army of Renown, and the compulsory unit type at Arks of Omen
 * sizes) as a single-choice list. Options not in the roster yet are looked at on a scratch copy, so the real roster only
 * gains one when the player picks from it.
 */
export function armyChoices(scope: Scope, roster: Roster): ArmyChoice[] {
  const forceSelId = roster.forces[0]?.id;
  if (!forceSelId) return [];
  const out: ArmyChoice[] = [];
  let scratch = roster;
  for (const option of armyOptions(scope, roster, forceSelId)) {
    if (isSetBySteps(scope, option.entryId)) continue;
    let selId = scratch.forces[0].selections.find((s) => s.entryId === option.entryId)?.id;
    const inRoster = selId !== undefined;
    if (!inRoster && !offeredAtSize(scope, roster, option.entryId)) continue;
    if (!selId) {
      const added = addUnit(scope, scratch, forceSelId, option.entryId);
      scratch = added.roster;
      selId = added.selId;
    }
    const groups = childOptions(scope, scratch, selId).filter((n) => n.kind === 'group');
    for (const g of groups) {
      const options = leafOptions(g.children);
      if (!options.length) continue;
      out.push({
        key: `${option.entryId}|${g.id}`,
        entryId: option.entryId,
        groupId: g.id,
        title: choiceTitle(option.name, groups.length > 1 ? g.name : null),
        min: g.min,
        max: g.max,
        options: options.map((o) => ({ id: o.id, name: displayName(o.name), selIds: inRoster ? o.selIds : [] })),
        current: options.find((o) => o.count > 0)?.id ?? null,
      });
    }
  }
  return out;
}

/** "Hive Fleet" for an army option's only group; "Hive Fleet: Hyper-adaption" when it has several. */
function choiceTitle(optionName: string, groupName: string | null): string {
  const option = cleanLabel(optionName) || optionName.trim();
  const group = groupName === null ? '' : cleanLabel(groupName);
  return group && group !== option ? `${option}: ${group}` : option;
}

/**
 * The roster with the player's picks applied (`picks`: choice key -> option id, or several ids for a group that takes
 * several). Choices left out, or picked as '' (None), are left undecided.
 */
export function applyPicks(scope: Scope, roster: Roster, choices: ArmyChoice[], picks: Record<string, string | string[]>): Roster {
  let r = roster;
  for (const c of choices) {
    const pick = picks[c.key];
    const ids = (Array.isArray(pick) ? pick : [pick]).filter((id): id is string => !!id);
    if (!ids.length) continue;
    const forceSelId = r.forces[0].id;
    let selId = r.forces[0].selections.find((s) => s.entryId === c.entryId)?.id;
    if (!selId) {
      const added = addUnit(scope, r, forceSelId, c.entryId);
      r = added.roster;
      selId = added.selId;
    }
    if (!selId) continue;
    if (Array.isArray(pick)) for (const id of ids) r = addChild(scope, r, selId, id);
    else r = chooseInGroup(scope, r, selId, c.groupId, ids[0]);
  }
  return r;
}

/** Whether the army can do without this choice (Army of Renown), so None is offered. A Dynasty Choice is required. */
export function isOptionalChoice(scope: Scope, roster: Roster, c: ArmyChoice, view: RosterView = evaluate(scope, roster)): boolean {
  const node = scope.node(c.entryId);
  const army = view.forces[0];
  if (!node || !army) return false;
  return !childConstraints(scope, view, army, node).some(
    (k) => k.type === 'min' && k.field === 'selections' && k.value >= 1 && ['parent', 'force', 'roster'].includes(k.scope),
  );
}

// ---------- saving ----------

/** The list to save: the roster plus the numbers the lists page shows. */
export function listData(scope: Scope, policy: PolicyData, roster: Roster, catalogue: CatalogueSummary): ListData {
  const { view, issues } = validate(scope, roster, policy);
  return {
    roster,
    summary: {
      catalogueSlug: catalogue.slug,
      faction: factionDisplayName(catalogue.name),
      battleSize: roster.battleSize,
      points: view.total[COST_PTS] ?? 0,
      pointsLimit: BATTLE_SIZES[roster.battleSize].points,
      issueCount: issues.length,
    },
  };
}

/** "Necrons Combat Patrol", numbered ("… 2") when one of `taken` (the player's list names) already has that name. */
export const defaultListName = (catalogue: CatalogueSummary, size: BattleSizeId, taken: string[] = []) =>
  uniqueListName(`${factionDisplayName(catalogue.name)} ${BATTLE_SIZES[size].name}`, taken);
