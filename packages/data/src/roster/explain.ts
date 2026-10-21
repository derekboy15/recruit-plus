/**
 * Plain-English explanations of validation issues, with the label of the button that applies the issue's fix.
 * Browser-safe. Copy rules: the user's own unit and detachment names, a concrete fix, "pts", no BattleScribe jargon
 * ("selection", "entry", "force", "constraint"). Every template states its direction (needs at least / can have at
 * most) from whether the count is below or above the limit, never from the rule kind alone.
 */
import { BATTLEFIELD_ROLES, type BattlefieldRole } from '../model/types';
import { childConstraints, evaluateCandidate } from './children';
import { findSelView } from './edit';
import { childIndex, type ForceView, type RosterView, type SelView } from './evaluate';
import { displayName, factionDisplayName, stripCpSuffix } from './names';
import { availableUnits } from './options';
import { BATTLE_SIZES, FORCE, SPECIALIST_DETACHMENT_CATEGORY, SUPREME_COMMANDER_CATEGORY, isSupremeCommander } from './policy';
import { resolve, type Scope } from './scope';
import type { Issue } from './types';

export interface Explanation { text: string; fixLabel?: string }

const WARLORD = 'Warlord';

export interface ExplainOptions {
  /** The unit whose editor is showing the problem: a hint that would say "Open {unit}" points to its options below. */
  shownUnitId?: string;
}

interface Ctx { issue: Issue; view: RosterView; scope: Scope; shownUnitId?: string }

export function explain(issue: Issue, view: RosterView, scope: Scope, options: ExplainOptions = {}): Explanation {
  const ctx: Ctx = { issue, view, scope, shownUnitId: options.shownUnitId };
  const choice = choiceName(ctx);
  const text = choice ? `Your army needs a "${choice}" choice. Tap to add it.` : textFor(ctx);
  const fixLabel = labelFor(ctx, choice);
  return fixLabel ? { text, fixLabel } : { text };
}

// ---------- formatting ----------

const num = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const clean = displayName;
/** "a" or "an" before a category name, by sound: vowels, and "HQ" ("aitch-cue"). */
const article = (word: string) => (/^(?:[aeiou]|HQ(?![a-z]))/i.test(word.trim()) ? 'an' : 'a');
const stripCp = stripCpSuffix;
/** "A", "A or B", "A, B or C". */
const orList = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`);
/** "A", "A and B", "A, B and C". */
const andList = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

// ---------- lookups ----------

const forceView = ({ issue, view }: Ctx): ForceView | undefined => view.forces.find((f) => f.force.id === issue.forceSelId);
/** The detachment's name without its CP cost, falling back to the issue's subject. */
const forceName = (ctx: Ctx) => stripCp(forceView(ctx)?.name ?? ctx.issue.subject.name);
const sizeName = ({ view }: Ctx) => BATTLE_SIZES[view.roster.battleSize]?.name ?? 'this battle size';
const rootOf = (s: SelView): SelView => (s.parent ? rootOf(s.parent) : s);
/** The unit (root selection) the issue's selection belongs to. */
const unitView = ({ issue, view }: Ctx): SelView | undefined => {
  const s = issue.selId ? findSelView(view, issue.selId) : undefined;
  return s && rootOf(s);
};
const unitName = (ctx: Ctx) => clean(unitView(ctx)?.name ?? ctx.issue.subject.name);
const selUnitName = (ctx: Ctx, selId: string) => {
  const s = findSelView(ctx.view, selId);
  return s ? clean(rootOf(s).name) : clean(ctx.issue.subject.name);
};

/** The name of a root entry the force can add: its unit-picker name, else the issue's own subject, else the entry's. */
function entryName(ctx: Ctx, forceSelId: string, entryId: string): string {
  const hit = availableUnits(ctx.scope, ctx.view.roster, forceSelId).find((u) => u.entryId === entryId);
  if (hit) return clean(hit.name);
  if (entryId === ctx.issue.subject.id) return clean(ctx.issue.subject.name);
  const node = ctx.scope.node(entryId);
  return node ? clean(resolve(ctx.scope, node).name) : clean(ctx.issue.subject.name);
}

/** Candidate unit names of an add-unit fix, in the fix's order (cheapest first). */
function candidateNames(ctx: Ctx): string[] {
  const fix = ctx.issue.fix;
  if (fix?.kind !== 'add-unit') return [];
  const units = availableUnits(ctx.scope, ctx.view.roster, fix.forceSelId);
  return fix.entryIds.flatMap((id) => units.find((u) => u.entryId === id)?.name ?? []).map(clean);
}

/**
 * The name of the choice (Battle Size, Game Type, Detachment Command Cost…) a minimum is asking for: the issue wants
 * more of something, and the fix adds exactly one entry that is an upgrade or group rather than a unit.
 */
function choiceName(ctx: Ctx): string | undefined {
  const { issue, scope } = ctx;
  const fix = issue.fix;
  if (!['unit-limit', 'option-required', 'other'].includes(issue.rule) || issue.actual >= issue.limit) return undefined;
  if (fix?.kind !== 'add-unit' || fix.entryIds.length !== 1) return undefined;
  const node = scope.node(fix.entryIds[0]);
  if (!node) return undefined;
  const fv = ctx.view.forces.find((f) => f.force.id === fix.forceSelId);
  const role = fv ? scope.category(evaluateCandidate(scope, ctx.view, fv, node).primary ?? '')?.name : undefined;
  const isUnit = resolve(scope, node).type !== 'upgrade' && node.kind !== 'group';
  if (isUnit || BATTLEFIELD_ROLES.includes(role as BattlefieldRole)) return undefined;
  return clean(issue.subject.name);
}

// ---------- text ----------

function textFor(ctx: Ctx): string {
  const { issue } = ctx;
  const { rule, limit, actual } = issue;
  const name = clean(issue.subject.name);
  const over = actual - limit;
  switch (rule) {
    case 'slot-min': return slotMin(ctx);
    case 'slot-max': {
      const units = [num(actual), name, plural(actual, 'unit', 'units')].filter(Boolean).join(' ');
      return `Your ${forceName(ctx)} has ${units} but can only take ${num(limit)}. Remove ${num(over)}, or move ${plural(over, 'it', 'them')} to another detachment.`;
    }
    case 'points-over':
      return `Your army is ${num(over)} pts over the ${num(limit)} pts limit for ${name}. Remove units or wargear worth at least ${num(over)} pts.`;
    case 'cp-negative':
      return `You've spent ${num(limit - actual)} CP more than you have. Remove a detachment or an upgrade that costs CP.`;
    case 'warlord-missing': {
      const fix = issue.fix;
      // Shown in the editor of the unit the fix would open: its Warlord option is right below the hint.
      const shown = fix?.kind === 'open' && fix.selId === ctx.shownUnitId ? fix.selId : undefined;
      // A unit that must be the Warlord (policy): one of `subjects` must be.
      if (issue.subjects?.length) {
        const names = issue.subjects.map((s) => clean(s.name));
        if (shown) return `${selUnitName(ctx, shown)} must be your ${WARLORD}. Turn on "${WARLORD}" below.`;
        return names.length === 1
          ? `${names[0]} must be your ${WARLORD}. Open ${names[0]} and turn on "${WARLORD}".`
          : `${orList(names)} must be your ${WARLORD}. Open one of them and turn on "${WARLORD}".`;
      }
      if (fix?.kind !== 'open') return `Choose a Warlord. Add a Character, then turn on "${name}" on it.`;
      if (shown) return `Choose a Warlord. Turn on "${warlordOption(ctx, shown)}" below.`;
      return `Choose a Warlord. Open a Character such as ${selUnitName(ctx, fix.selId)} and turn on "${warlordOption(ctx, fix.selId)}".`;
    }
    case 'warlord-extra':
      return `You have ${num(actual)} Warlords, but an army has exactly ${num(limit)}. Turn "${WARLORD}" off on ${num(over)} of them.`;
    case 'unique':
      return perDetachment(ctx)
        ? `${name} is limited to ${num(limit)} per detachment. Remove ${num(over)} from your ${forceName(ctx)}.`
        : `${name} is a unique unit, so your army can include only ${num(limit)}. Remove ${num(over)}.`;
    case 'unit-limit':
      return unitLimit(ctx);
    case 'rule-of-three':
      return `You have ${num(actual)} ${name} ${plural(actual, 'unit', 'units')}. ${sizeName(ctx)} allows ${num(limit)} of the same datasheet (Troops and Dedicated Transports don't count). Remove ${num(over)}.`;
    case 'model-count':
      return modelCount(ctx);
    case 'wargear-max':
      return `${unitName(ctx)} can take at most ${num(limit)} ${name}. It has ${num(actual)}.`;
    case 'option-required':
      return `${unitName(ctx)} needs ${num(limit - actual)} more from "${name}".`;
    case 'hidden-selected':
      return `${name} can't be in this army any more because of an earlier choice. Remove it, or change that choice.`;
    case 'unknown-entry':
      return "One item in this list isn't in the current rules data, so it was skipped. Remove it.";
    case 'detachment-count':
      return detachmentCount(ctx);
    case 'detachment-not-allowed':
      if (issue.subject.id === SPECIALIST_DETACHMENT_CATEGORY) return `Specialist Detachments aren't used in Arks of Omen games. Remove "${name}".`;
      return `${forceName(ctx)} isn't allowed at ${sizeName(ctx)}. Remove it and pick from the detachments offered.`;
    case 'detachment-faction': {
      const catalogue = forceView(ctx) && ctx.scope.catalogue(forceView(ctx)!.force.catalogueId)?.name;
      const faction = catalogue ? factionDisplayName(catalogue) : '';
      const head = `Every unit in your ${forceName(ctx)} must share a faction${faction ? `, such as ${faction}` : ''}.`;
      return unitView(ctx)
        ? `${head} Move ${unitName(ctx)} to its own detachment or remove it.`
        : `${head} Move the units that don't match to their own detachment or remove them.`;
    }
    case 'army-faction': {
      const head = 'Every unit in your army must share a faction keyword.';
      const odd = outsider(ctx);
      return odd ? `${head} ${odd} doesn't share one with the rest. Remove it.` : `${head} Some of your units don't share one with the rest. Remove the ones that don't.`;
    }
    case 'other':
    default:
      return `${stripCp(issue.subject.name)} ${actual < limit ? 'needs at least' : 'can have at most'} ${num(limit)} here. It has ${num(actual)}.`;
  }
}

/** Whether the limit counts within one detachment rather than the whole army (the issue's scope; older issues have none). */
const perDetachment = ({ issue }: Ctx) => issue.scope === 'force';

function unitLimit(ctx: Ctx): string {
  const { issue } = ctx;
  const { limit, actual } = issue;
  if (issue.subject.id === SUPREME_COMMANDER_CATEGORY) return supremeCommanders(ctx);
  const name = clean(issue.subject.name);
  const who = perDetachment(ctx) ? `Your ${forceName(ctx)}` : 'Your army';
  if (actual >= limit) return `${who} can include at most ${num(limit)} ${name}. Remove ${num(actual - limit)}.`;
  const head = `${who} needs at least ${num(limit)} ${name}.`;
  // The army wording always says how many to add; the per-detachment wording does when the fix adds units.
  return !perDetachment(ctx) || issue.fix?.kind === 'add-unit' ? `${head} Add ${num(limit - actual)} more.` : head;
}

/** Arks of Omen's one SUPREME COMMANDER (policy): names them all. */
function supremeCommanders(ctx: Ctx): string {
  const { issue, view, scope } = ctx;
  const names = view.forces.flatMap((fv) => fv.selections.filter((v) => v.merged && isSupremeCommander(scope, v)).map((v) => clean(v.name)));
  const over = issue.actual - issue.limit;
  return `An Arks of Omen army can include only ${num(issue.limit)} Supreme Commander. You have ${num(issue.actual)}: ${andList(names)}. Remove ${num(over)}.`;
}

function slotMin(ctx: Ctx): string {
  const { issue } = ctx;
  const n = issue.limit - issue.actual;
  const noun = [clean(issue.subject.name), plural(n, 'unit', 'units')].filter(Boolean).join(' ');
  const head = `Your ${forceName(ctx)} needs ${num(n)} more ${noun}`;
  const names = candidateNames(ctx);
  return names.length
    ? `${head}. Add ${orList(names)}.`
    : `${head}, but ${factionOf(ctx)} has nothing it can take there. Pick a different detachment.`;
}

/** The display name of the faction (catalogue) the detachment belongs to, else the army's. */
function factionOf(ctx: Ctx): string {
  const id = forceView(ctx)?.force.catalogueId ?? ctx.view.roster.catalogueId;
  const name = ctx.scope.catalogue(id)?.name;
  return name ? factionDisplayName(name) : 'your faction';
}

/** The name of the unit's option that makes it the Warlord (by name or category), as the player sees it. */
function warlordOption(ctx: Ctx, selId: string): string {
  const unit = findSelView(ctx.view, selId);
  if (unit?.merged) {
    for (const { node } of childIndex(ctx.scope, unit.merged.children).values()) {
      const t = evaluateCandidate(ctx.scope, ctx.view, unit, node);
      if (t.name === WARLORD || t.categories.includes(ctx.issue.subject.id)) return clean(t.name);
    }
  }
  return WARLORD;
}

/** "between min and max", "at least min", "at most max", from the failing limit and the unit's other model limits. */
function modelCount(ctx: Ctx): string {
  const { issue, scope, view } = ctx;
  const holder = issue.selId ? findSelView(view, issue.selId) : undefined;
  const node = scope.node(issue.subject.id);
  let min: number | undefined;
  let max: number | undefined;
  if (holder && node) {
    for (const c of childConstraints(scope, view, holder, node)) {
      if (c.field !== 'selections' || c.scope === 'self' || c.percent || c.value < 0) continue;
      if (c.type === 'min') min = Math.max(min ?? 0, c.value);
      else max = Math.min(max ?? Infinity, c.value);
    }
  }
  // The limit that failed is always right; the other side is only added when it agrees with it.
  if (issue.actual < issue.limit) min = issue.limit;
  else max = issue.limit;
  if (min !== undefined && max !== undefined && min > max) {
    if (issue.actual < issue.limit) max = undefined;
    else min = undefined;
  }
  const unit = unitName(ctx);
  const has = `It has ${num(issue.actual)}.`;
  if (min !== undefined && max !== undefined) {
    return min === max ? `${unit} must have exactly ${num(min)} ${plural(min, 'model', 'models')}. ${has}` : `${unit} must have between ${num(min)} and ${num(max)} ${plural(max, 'model', 'models')}. ${has}`;
  }
  return min !== undefined
    ? `${unit} must have at least ${num(min)} ${plural(min, 'model', 'models')}. ${has}`
    : `${unit} must have at most ${num(max!)} ${plural(max!, 'model', 'models')}. ${has}`;
}

function detachmentCount(ctx: Ctx): string {
  const { issue, view } = ctx;
  const bs = BATTLE_SIZES[view.roster.battleSize];
  if (bs?.mode === 'aoo') {
    const head = 'An Arks of Omen army has exactly 1 Arks of Omen Detachment and at most 1 allied detachment.';
    return issue.actual > issue.limit ? `${head} Remove the extra detachment.` : `${head} Add an Arks of Omen Detachment.`;
  }
  const over = issue.actual - issue.limit;
  // A detachment type that is limited on its own (one Supreme Command Detachment per army).
  if (bs && issue.subject.id !== bs.id) {
    return `An army can include only ${num(issue.limit)} ${stripCp(issue.subject.name)}. Remove ${num(over)}.`;
  }
  return `${bs?.name ?? 'This battle size'} allows ${num(issue.limit)} ${plural(issue.limit, 'detachment', 'detachments')}. Remove ${num(over)}.`;
}

/** The first battlefield unit from another faction's detachment: the likeliest one that breaks Army Faction. */
function outsider(ctx: Ctx): string | undefined {
  const { view, scope } = ctx;
  const aoo = BATTLE_SIZES[view.roster.battleSize]?.mode === 'aoo';
  for (const fv of view.forces) {
    if (fv.force.catalogueId === view.roster.catalogueId || (aoo && fv.force.forceId !== FORCE.arksOfOmen)) continue;
    const unit = fv.selections.find((s) => s.merged && BATTLEFIELD_ROLES.includes((scope.category(s.primary ?? '')?.name ?? '') as BattlefieldRole));
    if (unit) return clean(unit.name);
  }
  return undefined;
}

// ---------- fix button ----------

function labelFor(ctx: Ctx, choice: string | undefined): string | undefined {
  const { issue } = ctx;
  const fix = issue.fix;
  if (!fix) return undefined;
  switch (fix.kind) {
    case 'add-unit':
      if (choice) return `Choose ${choice}`;
      if (fix.entryIds.length === 1) return `Add ${entryName(ctx, fix.forceSelId, fix.entryIds[0])}`;
      if (issue.rule !== 'slot-min') return 'Choose a unit';
      const category = clean(issue.subject.name);
      return `Add ${article(category)} ${[category, 'unit'].filter(Boolean).join(' ')}`;
    case 'remove':
      return `Remove ${num(fix.selIds.length)}`;
    case 'set-count':
      return findSelView(ctx.view, fix.selId)?.type === 'model' ? `Set to ${num(fix.count)} ${plural(fix.count, 'model', 'models')}` : `Set to ${num(fix.count)}`;
    case 'open':
      return `Open ${selUnitName(ctx, fix.selId)}`;
  }
}
