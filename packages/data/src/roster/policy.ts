/**
 * Matched-play policy: the army-building rules BSData doesn't encode (battle sizes, which detachments a battle size
 * allows, the Rule of Two/Three, points and CP limits, Battle Brothers and Army Faction), layered over the roster engine.
 * Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2, §4, §7.1, §7.2 and §7.5.
 * Browser-safe: the override data arrives as generated/roster/policy.json (PolicyData), never through node imports.
 */
import { BATTLEFIELD_ROLES, type BattlefieldRole, type CatalogueSummary } from '../model/types';
import { addForce, addUnit, chooseInGroup } from './edit';
import { evaluate, type ForceView, type RosterView, type SelView } from './evaluate';
import { availableUnits } from './options';
import { resolve, rootEntriesFor, type Scope } from './scope';
import { COST_CP, COST_PTS, type BattleSizeId, type CostMap, type Fix, type Issue, type Roster } from './types';
import { validateConstraints } from './validate';

// ---------- v9.8.0 .gst ids ----------

/** Detachment Command Cost (the root entry's target; the root link is ec87-f19e-eee2-1ba8). */
export const DETACHMENT_COMMAND_COST_ENTRY = '9d97-2793-9882-d48a';
/** Game Type (the root entry's target; the root link is 4bcc-b0f4-b425-f38e). */
export const GAME_TYPE_ENTRY = 'bf09-85b2-c097-1071';
/** Game Type (the choice group inside the Game Type entry). */
export const GAME_TYPE_GROUP = 'c30c-e1e6-e679-c42c';
/** Matched (group inside Game Type). */
export const MATCHED_GROUP = '58c5-1d35-3869-613f';
/** 1. Eternal War (inside Matched). */
export const ETERNAL_WAR = '3854-d05a-3596-0480';
/** 5. Chapter Approved: Arks of Omen (inside Matched). */
export const ARKS_OF_OMEN_PACK = '76d2-6e71-243f-ad3d';
/** Battle Size (the root entry's target; the root link is 44e3-c224-ba82-1b55). */
export const BATTLE_SIZE_ENTRY = 'f29d-8a5d-18b6-a071';
/** Battle Size (the choice group inside the Battle Size entry). */
export const BATTLE_SIZE_GROUP = '2883-57e8-87a6-38e2';

/** .gst force entries, by their v9.8.0 names (modifiers may rename them, e.g. "… 0CP"). */
export const FORCE = {
  patrol: 'a0c7-2a71-bae0-215d', // Patrol Detachment -2CP
  battalion: '564e-55d5-79bc-a4d7', // Battalion Detachment -3CP
  brigade: 'cccd-3d99-d4af-d668', // Brigade Detachment -4CP
  vanguard: '41af-75ce-79d2-ddff', // Vanguard Detachment -3CP
  spearhead: '120c-9e15-1d3f-637e', // Spearhead Detachment -3CP
  outrider: '3c85-9649-d2da-9bde', // Outrider Detachment -3CP
  supremeCommand: '5baf-eed5-bb85-7325', // Supreme Command Detachment 0CP
  superHeavy: 'd513-cbf5-9bfc-7270', // Super-Heavy Detachment -3CP
  superHeavyAuxiliary: '224b-1070-218f-fdf4', // Super-Heavy Auxiliary Detachment -3CP
  fortificationNetwork: 'dcee-07fa-ec14-7dec', // Fortification Network -1CP
  auxiliarySupport: '8a87-f0e3-f2f2-ad1a', // Auxiliary Support Detachment -2CP
  arksOfOmen: 'fa51-993c-2f8b-9be4', // Arks of Omen Detachment
} as const;

/** The Core Book detachments offered at Combat Patrol and Onslaught (never Unbound, Reinforcements, Order of Battle, Boarding Patrol). */
const CORE_DETACHMENTS: string[] = [
  FORCE.patrol, FORCE.battalion, FORCE.brigade, FORCE.vanguard, FORCE.spearhead, FORCE.outrider,
  FORCE.supremeCommand, FORCE.superHeavy, FORCE.superHeavyAuxiliary, FORCE.fortificationNetwork, FORCE.auxiliarySupport,
];

// ---------- battle sizes ----------

export interface BattleSize {
  id: BattleSizeId; name: string; points: number; mode: 'core' | 'aoo';
  /** Core: the Core Book cap. Arks of Omen: the detachment plus one ally. */
  maxDetachments: number;
  /** Rule of Two/Three: copies of one datasheet allowed. */
  sameDatasheetLimit: number;
  gameTypeEntryId: string; missionPackEntryId: string; battleSizeEntryId: string;
}

export const BATTLE_SIZES: Record<BattleSizeId, BattleSize> = {
  'combat-patrol': { id: 'combat-patrol', name: 'Combat Patrol', points: 500, mode: 'core', maxDetachments: 1, sameDatasheetLimit: 3, gameTypeEntryId: MATCHED_GROUP, missionPackEntryId: ETERNAL_WAR, battleSizeEntryId: 'af70-08c1-1c6f-0770' },
  incursion: { id: 'incursion', name: 'Incursion', points: 1000, mode: 'aoo', maxDetachments: 2, sameDatasheetLimit: 2, gameTypeEntryId: MATCHED_GROUP, missionPackEntryId: ARKS_OF_OMEN_PACK, battleSizeEntryId: '5686-7cd9-6664-635b' },
  'strike-force': { id: 'strike-force', name: 'Strike Force', points: 2000, mode: 'aoo', maxDetachments: 2, sameDatasheetLimit: 3, gameTypeEntryId: MATCHED_GROUP, missionPackEntryId: ARKS_OF_OMEN_PACK, battleSizeEntryId: '09f9-b586-8d63-7635' },
  onslaught: { id: 'onslaught', name: 'Onslaught', points: 3000, mode: 'core', maxDetachments: 4, sameDatasheetLimit: 3, gameTypeEntryId: MATCHED_GROUP, missionPackEntryId: ETERNAL_WAR, battleSizeEntryId: 'fad2-035f-88a7-60c0' },
};

// ---------- policy data (overrides/aoo-allies.json, overrides/datasheet-equivalence.json) ----------

export interface AooAlly {
  catalogueName: string;
  /** .gst force entry names: Patrol, Super-Heavy Auxiliary or Auxiliary Support. */
  detachments: string[];
  /** When set, every unit in the ally detachment must carry one of these faction categories (by name). */
  onlyFactions?: string[];
  /** A further restriction the app doesn't check, for the record. */
  restriction?: string;
}
/** The allied detachments an Arks of Omen army of `catalogueName` may take. */
export interface AooAllies { catalogueName: string; allies: AooAlly[]; source: string }
/** Datasheets that count as one for the Rule of Two/Three: every selection carrying the category, or any of the entries. */
export interface DatasheetEquivalence {
  name: string;
  categoryName?: string;
  /** entryId is the root entry's resolved target id. */
  entries?: { catalogueName: string; entryName: string; entryId: string }[];
  source: string;
}
export interface PolicyData { aooAllies: AooAllies[]; equivalence: DatasheetEquivalence[] }

// ---------- creating rosters ----------

export function createRoster(scope: Scope, opts: { name: string; catalogueId: string; battleSize: BattleSizeId; forceId: string }): Roster {
  const empty: Roster = { schema: 1, name: opts.name, catalogueId: opts.catalogueId, battleSize: opts.battleSize, forces: [] };
  // addForce adds the required root entries (Game Type, Battle Size, Detachment Command Cost, faction choices…).
  return setBattleSize(scope, addForce(scope, empty, opts.forceId, opts.catalogueId), opts.battleSize);
}

/**
 * Sets the battle size and swaps the Game Type (Matched → the size's mission pack) and Battle Size choices, adding
 * either selection to the first force if it is missing. Every other selection, and every force, is kept.
 */
export function setBattleSize(scope: Scope, r: Roster, size: BattleSizeId): Roster {
  const bs = BATTLE_SIZES[size];
  let roster: Roster = { ...r, battleSize: size };
  if (!bs || !roster.forces.length) return roster;
  for (const [entry, group, choice] of [
    [GAME_TYPE_ENTRY, GAME_TYPE_GROUP, bs.missionPackEntryId],
    [BATTLE_SIZE_ENTRY, BATTLE_SIZE_GROUP, bs.battleSizeEntryId],
  ]) {
    const found = ensureRoot(scope, roster, entry);
    roster = found.roster;
    if (found.selId) roster = chooseInGroup(scope, roster, found.selId, group, choice);
  }
  return roster;
}

/** The first root selection (any force) of the entry with this target id, added to the first force if missing. */
function ensureRoot(scope: Scope, r: Roster, targetId: string): { roster: Roster; selId: string } {
  const hit = evaluate(scope, r).forces.flatMap((f) => f.selections).find((v) => v.merged?.target.id === targetId);
  if (hit) return { roster: r, selId: hit.sel.id };
  const first = r.forces[0];
  const node = rootEntriesFor(scope, first.catalogueId).find((n) => resolve(scope, n).target.id === targetId);
  return node ? addUnit(scope, r, first.id, node.id) : { roster: r, selId: '' };
}

// ---------- detachment choices ----------

export interface DetachmentChoice { forceId: string; name: string; catalogueId: string; allied: boolean }

/**
 * The detachments the roster can add next.
 * - Combat Patrol and Onslaught: the Core Book detachments and the catalogue's own force entries, for the primary
 *   catalogue and every playable catalogue in its faction group (`allied` when not the primary).
 * - Incursion and Strike Force: the Arks of Omen Detachment until there is one; then the allied detachments listed for
 *   the primary catalogue in aoo-allies.json (`allied: true`); nothing once there is an ally.
 * A catalogue's own force entries are only known when its file is in the scope. Adding a detachment from another
 * catalogue needs a scope that includes it: the caller rebuilds the scope as the union of each catalogue's rosterScope.
 */
export function detachmentChoices(scope: Scope, r: Roster, policy: PolicyData, catalogues: CatalogueSummary[]): DetachmentChoice[] {
  const bs = BATTLE_SIZES[r.battleSize];
  if (!bs) return [];
  if (bs.mode === 'core') {
    const primary = catalogues.find((c) => c.id === r.catalogueId);
    const group = primary ? catalogues.filter((c) => c.id !== primary.id && !c.library && c.group === primary.group) : [];
    return [r.catalogueId, ...group.map((c) => c.id)].flatMap((id) => coreChoices(scope, id, id !== r.catalogueId));
  }
  if (!r.forces.some((f) => f.forceId === FORCE.arksOfOmen)) return choice(scope, FORCE.arksOfOmen, r.catalogueId, false);
  if (r.forces.some((f) => f.forceId !== FORCE.arksOfOmen)) return [];
  const primaryName = catalogues.find((c) => c.id === r.catalogueId)?.name ?? scope.catalogue(r.catalogueId)?.name;
  const allies = policy.aooAllies.find((a) => a.catalogueName === primaryName)?.allies ?? [];
  return allies.flatMap((a) => {
    const id = catalogues.find((c) => c.name === a.catalogueName)?.id;
    return id ? a.detachments.flatMap((name) => choice(scope, systemForceId(scope, name), id, true)) : [];
  });
}

function coreChoices(scope: Scope, catalogueId: string, allied: boolean): DetachmentChoice[] {
  const own = (scope.catalogue(catalogueId)?.forces ?? []).map((f) => f.id);
  return [...CORE_DETACHMENTS, ...own].flatMap((id) => choice(scope, id, catalogueId, allied));
}

function choice(scope: Scope, forceId: string | undefined, catalogueId: string, allied: boolean): DetachmentChoice[] {
  const entry = forceId ? scope.force(forceId) : undefined;
  return entry && !entry.hidden ? [{ forceId: entry.id, name: entry.name, catalogueId, allied }] : [];
}

const systemForceId = (scope: Scope, name: string) => scope.system.forces.find((f) => f.name === name)?.id;

// ---------- validation ----------

const BROAD_FACTIONS = new Set(['imperium', 'chaos', 'aeldari', 'ynnari', 'tyranids']);
const UNALIGNED = 'unaligned';
const FACTION_PREFIX = 'Faction: ';
const AGENT_OF_THE_IMPERIUM = 'Agent of the Imperium';
/** Exempt from the Rule of Two/Three (by effective primary category). */
const RULE_OF_THREE_EXEMPT = new Set(['Troops', 'Dedicated Transport', 'Fortification']);
/** Core Book detachments allowed at most once per army (§4). */
const ONE_PER_ARMY: string[] = [FORCE.supremeCommand, FORCE.fortificationNetwork];
/** Most suggested units for an empty Auxiliary Support Detachment. */
const MAX_SUGGESTIONS = 3;

/**
 * evaluate + validateConstraints + validatePolicy. BSData issues are deduplicated (see dedupe); policy issues are each a
 * different rule, so they are kept even when their fix matches a BSData one (a 4th Canoptek Wraiths unit in an Arks of
 * Omen Detachment breaks both the Fast Attack slot and the Rule of Three). BSData `forces` constraints are left to the policy.
 */
export function validate(scope: Scope, roster: Roster, policy: PolicyData): { view: RosterView; issues: Issue[] } {
  const view = evaluate(scope, roster);
  waiveDetachmentCommandCosts(view);
  return { view, issues: [...dedupe(validateConstraints(scope, view, { ignoreFields: ['forces'] })), ...validatePolicy(scope, view, policy)] };
}

/**
 * Arks of Omen battle sizes (§2.3, §7.5): every detachment costs 0 CP, an allied Patrol, Super-Heavy Auxiliary or
 * Auxiliary Support included. BSData charges those through the force's Detachment Command Cost selection, so its CP is
 * set to 0 in the view (and the force and army totals). Starting CP (Battle Size) and stratagems are left as they are.
 */
function waiveDetachmentCommandCosts(view: RosterView): void {
  for (const fv of view.forces) {
    for (const v of fv.selections) {
      const cp = detachmentCommandCp(view, v);
      if (!cp) continue;
      v.own = withoutCp(v.own, cp);
      v.total = withoutCp(v.total, cp);
      fv.total = withoutCp(fv.total, cp);
      view.total = withoutCp(view.total, cp);
    }
  }
}

/** The CP an Arks of Omen battle size waives on this selection: a Detachment Command Cost selection's CP, else 0. */
function detachmentCommandCp(view: RosterView, v: SelView): number {
  if (BATTLE_SIZES[view.roster.battleSize]?.mode !== 'aoo' || v.merged?.target.id !== DETACHMENT_COMMAND_COST_ENTRY) return 0;
  return v.total[COST_CP] ?? 0;
}

/** Detachment Command Cost CP an Arks of Omen battle size waives that is still in the view's total. */
function unwaivedDetachmentCp(view: RosterView): number {
  return view.forces.reduce((n, fv) => n + fv.selections.reduce((k, v) => k + detachmentCommandCp(view, v), 0), 0);
}

/** The cost map less `cp` CP, without a zero entry (cost maps keep only non-zero entries). */
function withoutCp(costs: CostMap, cp: number): CostMap {
  const { [COST_CP]: current = 0, ...rest } = costs;
  const left = current - cp;
  return left ? { ...rest, [COST_CP]: left } : rest;
}

/** Drops an issue whose fix is the same as an earlier issue's (one problem BSData reports twice, e.g. a second Warlord). Issues without a fix stay. */
function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    if (!i.fix) return true;
    const f = i.fix;
    const key =
      f.kind === 'add-unit' ? `${f.kind}\n${f.forceSelId}\n${f.entryIds.join(',')}`
      : f.kind === 'remove' ? `${f.kind}\n${f.selIds.join(',')}`
      : f.kind === 'set-count' ? `${f.kind}\n${f.selId}\n${f.count}`
      : `${f.kind}\n${f.selId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The matched-play rules, in this order: points-over, cp-negative, detachment-count, detachment-not-allowed,
 * Auxiliary Support's one unit (slot-min / slot-max), rule-of-three, detachment-faction, army-faction.
 *
 * Units are root unit and model selections, plus upgrade-typed ones with a battlefield-role primary category.
 * A unit's faction keywords are the `Faction: ` categories on it and its descendants. Faction checks ignore
 * UNALIGNED units and units with no faction keyword; a detachment's check also ignores AGENT OF THE IMPERIUM units
 * (§8.2) unless the detachment has nothing else. In Arks of Omen battle sizes, the units of a permitted ally don't
 * count towards Army Faction (the pack allows e.g. a Leagues of Votann Patrol with an IMPERIUM army).
 */
export function validatePolicy(scope: Scope, view: RosterView, policy: PolicyData): Issue[] {
  return new PolicyCheck(scope, view, policy).run();
}

interface Unit { v: SelView; factions: Set<string> }

class PolicyCheck {
  private readonly issues: Issue[] = [];
  private readonly r: Roster;
  private readonly bs: BattleSize | undefined;
  private readonly primaryName: string | undefined;

  constructor(private readonly scope: Scope, private readonly view: RosterView, private readonly policy: PolicyData) {
    this.r = view.roster;
    this.bs = BATTLE_SIZES[this.r.battleSize];
    this.primaryName = scope.catalogue(this.r.catalogueId)?.name;
  }

  run(): Issue[] {
    const { view, bs } = this;
    if (bs) {
      const pts = view.total[COST_PTS] ?? 0;
      if (pts > bs.points) this.issues.push({ rule: 'points-over', subject: { id: bs.id, name: bs.name }, limit: bs.points, actual: pts });
    }
    // validate() has already waived Arks of Omen detachment costs; a view straight from evaluate() still carries them.
    const cp = (view.total[COST_CP] ?? 0) - unwaivedDetachmentCp(view);
    if (cp < 0) this.issues.push({ rule: 'cp-negative', subject: { id: COST_CP, name: 'CP' }, limit: 0, actual: cp });
    if (bs) this.detachmentCount(bs);
    for (const fv of view.forces) {
      if (!this.allowed(fv)) this.issues.push({ rule: 'detachment-not-allowed', forceSelId: fv.force.id, subject: { id: fv.force.forceId, name: fv.name }, limit: 0, actual: 1 });
    }
    for (const fv of view.forces) if (fv.force.forceId === FORCE.auxiliarySupport) this.auxiliarySupport(fv);
    if (bs) this.ruleOfThree(bs);
    for (const fv of view.forces) if (fv.force.forceId !== FORCE.fortificationNetwork) this.detachmentFaction(fv);
    this.armyFaction();
    return this.issues;
  }

  // ---------- detachments ----------

  private detachmentCount(bs: BattleSize): void {
    const forces = this.view.forces;
    if (bs.mode === 'core') {
      if (forces.length > bs.maxDetachments) {
        this.issues.push({ rule: 'detachment-count', forceSelId: forces[bs.maxDetachments].force.id, subject: { id: bs.id, name: bs.name }, limit: bs.maxDetachments, actual: forces.length });
      }
      // §4: max one per army.
      for (const forceId of ONE_PER_ARMY) {
        const same = forces.filter((f) => f.force.forceId === forceId);
        if (same.length > 1) this.issues.push({ rule: 'detachment-count', forceSelId: same[1].force.id, subject: { id: forceId, name: same[1].name }, limit: 1, actual: same.length });
      }
      return;
    }
    const arks = forces.filter((f) => f.force.forceId === FORCE.arksOfOmen);
    if (arks.length !== 1) {
      const name = this.scope.force(FORCE.arksOfOmen)?.name ?? 'Arks of Omen Detachment';
      this.issues.push({ rule: 'detachment-count', ...(arks[1] ? { forceSelId: arks[1].force.id } : {}), subject: { id: FORCE.arksOfOmen, name }, limit: 1, actual: arks.length });
    }
    const allies = forces.filter((f) => f.force.forceId !== FORCE.arksOfOmen);
    if (allies.length > 1) {
      const extra = allies[1];
      this.issues.push({ rule: 'detachment-count', forceSelId: extra.force.id, subject: { id: extra.force.forceId, name: extra.name }, limit: 1, actual: allies.length });
    }
  }

  /** Whether the force's detachment may be in the roster at all (counts are detachmentCount's). */
  private allowed(fv: ForceView): boolean {
    if (!fv.entry || fv.hidden) return false;
    if (!this.bs) return true;
    const { forceId, catalogueId } = fv.force;
    if (this.bs.mode === 'core') return CORE_DETACHMENTS.includes(forceId) || (this.scope.catalogue(catalogueId)?.forces.some((f) => f.id === forceId) ?? false);
    if (forceId === FORCE.arksOfOmen) return catalogueId === this.r.catalogueId;
    return !!this.ally(fv);
  }

  /** The aoo-allies entry permitting this (non-Arks of Omen) force, in an Arks of Omen battle size. */
  private ally(fv: ForceView): AooAlly | undefined {
    if (this.bs?.mode !== 'aoo' || fv.force.forceId === FORCE.arksOfOmen || !fv.entry) return undefined;
    const name = this.scope.catalogue(fv.force.catalogueId)?.name;
    const allies = this.policy.aooAllies.find((a) => a.catalogueName === this.primaryName)?.allies ?? [];
    return allies.find((a) => a.catalogueName === name && a.detachments.includes(fv.entry!.name));
  }

  /** Exactly one unit (§4): BSData's own limit counts nothing under the engine's conventions. */
  private auxiliarySupport(fv: ForceView): void {
    const units = fv.selections.filter((v) => this.isUnit(v));
    const n = units.reduce((k, v) => k + v.sel.count, 0);
    const subject = { id: fv.force.forceId, name: '' };
    if (n === 0) {
      const entryIds = availableUnits(this.scope, this.r, fv.force.id).sort((a, b) => a.points - b.points).slice(0, MAX_SUGGESTIONS).map((u) => u.entryId);
      this.issues.push({ rule: 'slot-min', forceSelId: fv.force.id, subject, limit: 1, actual: 0, ...(entryIds.length ? { fix: { kind: 'add-unit', forceSelId: fv.force.id, entryIds } } : {}) });
    } else if (n > 1) {
      this.issues.push({ rule: 'slot-max', forceSelId: fv.force.id, selId: units.at(-1)!.sel.id, subject, limit: 1, actual: n, fix: trimNewest(units, n - 1) });
    }
  }

  // ---------- Rule of Two/Three ----------

  private ruleOfThree(bs: BattleSize): void {
    const byKey = new Map<string, { name: string; sels: SelView[] }>();
    for (const v of this.units()) {
      if (RULE_OF_THREE_EXEMPT.has(this.primaryRole(v) ?? '')) continue;
      const group = this.policy.equivalence.find((e) => this.isEquivalent(v, e));
      const key = group?.name ?? v.merged!.target.id;
      let entry = byKey.get(key);
      if (!entry) byKey.set(key, (entry = { name: group?.name ?? v.name, sels: [] }));
      entry.sels.push(v);
    }
    for (const [key, { name, sels }] of byKey) {
      const actual = sels.reduce((k, v) => k + v.sel.count, 0);
      if (actual <= bs.sameDatasheetLimit) continue;
      const newest = sels.at(-1)!;
      this.issues.push({
        rule: 'rule-of-three', forceSelId: newest.force.force.id, selId: newest.sel.id, subject: { id: key, name },
        limit: bs.sameDatasheetLimit, actual, fix: trimNewest(sels, actual - bs.sameDatasheetLimit),
      });
    }
  }

  private isEquivalent(v: SelView, e: DatasheetEquivalence): boolean {
    if (e.categoryName && v.categories.some((id) => this.scope.category(id)?.name === e.categoryName)) return true;
    return e.entries?.some((x) => v.merged!.ids.includes(x.entryId)) ?? false;
  }

  // ---------- factions ----------

  /** Battle Brothers (§7.1): a detachment's units share a faction keyword other than the broad ones. */
  private detachmentFaction(fv: ForceView): void {
    if (!fv.entry) return;
    let units = this.factionUnits(fv.selections);
    const notAgents = units.filter((u) => !this.hasCategory(u.v, AGENT_OF_THE_IMPERIUM));
    if (notAgents.length) units = notAgents;
    if (!units.length) return;
    const issue: Issue = { rule: 'detachment-faction', forceSelId: fv.force.id, subject: { id: fv.force.forceId, name: fv.name }, limit: 1, actual: 0 };
    if (![...shared(units)].some((k) => !BROAD_FACTIONS.has(k))) {
      this.issues.push(issue);
      return;
    }
    const only = this.ally(fv)?.onlyFactions?.map(keyword);
    const offender = only && units.find((u) => !only.some((k) => u.factions.has(k)));
    if (offender) this.issues.push({ ...issue, selId: offender.v.sel.id });
  }

  /** Army Faction (§1): every unit shares at least one faction keyword. */
  private armyFaction(): void {
    const sels = this.view.forces.filter((fv) => !this.ally(fv)).flatMap((fv) => fv.selections);
    const units = this.factionUnits(sels);
    if (units.length && shared(units).size === 0) {
      this.issues.push({ rule: 'army-faction', subject: { id: this.r.catalogueId, name: this.primaryName ?? '' }, limit: 1, actual: 0 });
    }
  }

  /** Units with faction keywords, without UNALIGNED ones. */
  private factionUnits(sels: SelView[]): Unit[] {
    return sels
      .filter((v) => this.isUnit(v))
      .map((v) => ({ v, factions: this.factions(v) }))
      .filter((u) => u.factions.size > 0 && !u.factions.has(UNALIGNED));
  }

  private factions(v: SelView): Set<string> {
    const out = new Set<string>();
    const walk = (s: SelView) => {
      for (const id of s.categories) {
        const name = this.scope.category(id)?.name;
        if (name?.startsWith(FACTION_PREFIX)) out.add(keyword(name));
      }
      s.children.forEach(walk);
    };
    walk(v);
    return out;
  }

  // ---------- helpers ----------

  private units(): SelView[] {
    return this.view.forces.flatMap((fv) => fv.selections.filter((v) => this.isUnit(v)));
  }

  private isUnit(v: SelView): boolean {
    if (!v.merged) return false;
    return v.type === 'unit' || v.type === 'model' || (v.type === 'upgrade' && BATTLEFIELD_ROLES.includes(this.primaryRole(v) as BattlefieldRole));
  }

  private primaryRole(v: SelView): string | null {
    return v.primary === null ? null : (this.scope.category(v.primary)?.name ?? null);
  }

  private hasCategory(v: SelView, name: string): boolean {
    return v.categories.some((id) => this.scope.category(id)?.name === name);
  }
}

/** "Faction: Astra Militarum" → "astra militarum". */
const keyword = (categoryName: string) => categoryName.slice(FACTION_PREFIX.length).trim().toLowerCase();

function shared(units: Unit[]): Set<string> {
  const [first, ...rest] = units;
  return new Set([...first.factions].filter((k) => rest.every((u) => u.factions.has(k))));
}

/**
 * Shrinks the newest stack that alone has more than `excess` copies; otherwise removes the newest selections until
 * `excess` copies are gone (a Fix is one kind of action, so that can remove a few copies more than needed).
 */
function trimNewest(sels: SelView[], excess: number): Fix {
  const stack = [...sels].reverse().find((v) => v.sel.count > excess);
  if (stack) return { kind: 'set-count', selId: stack.sel.id, count: stack.sel.count - excess };
  const selIds: string[] = [];
  let removed = 0;
  for (let i = sels.length - 1; i >= 0 && removed < excess; i--) {
    selIds.unshift(sels[i].sel.id);
    removed += sels[i].sel.count;
  }
  return { kind: 'remove', selIds };
}
