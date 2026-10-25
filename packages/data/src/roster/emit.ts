/**
 * Node-side: turns one parsed BattleScribe file (.cat or .gst) into compact roster JSON.
 * Keeps what the roster engine evaluates (links, costs, categories, constraints, modifiers,
 * conditions, repeats) and drops display data (profiles, rules, infoLinks, publications, comments), keeping only
 * whether an entry carries a weapon (`gear`, `perModel`) so the export can count wargear.
 */
import type { RawCatalogue, RawNode } from '../bsdata/types';
import type {
  CatLink,
  Cond,
  CondGroup,
  CondType,
  Constraint,
  CostMap,
  Mod,
  ModType,
  RCategory,
  RForce,
  RNode,
  Repeat,
  RosterFile,
} from './types';

/** A correction to one BSData cost (overrides/costs.json). */
export interface CostOverride {
  catalogueName: string;
  entryId: string;
  entryName: string;
  costTypeId: string;
  value: number;
  source: string;
}

/**
 * Faction keywords BSData leaves off a unit (overrides/faction-keywords.json): each name in `add` (without the
 * "Faction: " prefix) becomes a category link to that Faction category on the entry or link `entryId`: the
 * catalogue's own category of that name, else the .gst's.
 */
export interface FactionKeywordOverride {
  catalogueName: string;
  entryId: string;
  entryName: string;
  add: string[];
  source: string;
}

/**
 * A BSData constraint pinned at another value (overrides/constraints.json): the constraint `constraintId` in the
 * catalogue's file gets `value` (and `scope`, when given), and its owner's modifiers of that constraint are dropped, so
 * it stays at `value`.
 * Only the owning node's modifiers are dropped: a modifier of the constraint on any other node (a parent entry, a
 * link to the owner, another file) still applies.
 */
export interface ConstraintOverride {
  catalogueName: string;
  /**
   * The name of the node owning the constraint (an entry, link, group, category or force; a category link goes by its
   * category's name), checked at build like the other overrides' entryName.
   */
  entryName: string;
  constraintId: string;
  value: number;
  /** A new scope for the constraint (e.g. "force" for a once-per-detachment limit BSData counts per roster), set with the value. */
  scope?: (typeof CONSTRAINT_SCOPES)[number];
  source: string;
}
const CONSTRAINT_SCOPES = ['self', 'parent', 'force', 'roster'] as const;

/**
 * A limit BSData leaves out (overrides/add-constraints.json), added to the entry or link `entryId` with the id
 * `<entryId>-added-<type>-<scope>`. It counts child selections and child forces, like BSData's own once-per-army
 * limits, so a constraint on a shared entry counts every link to it.
 */
export interface AddedConstraint {
  catalogueName: string;
  entryId: string;
  entryName: string;
  constraint: { type: 'min' | 'max'; field: 'selections'; scope: (typeof ADDED_SCOPES)[number]; value: number };
  source: string;
}
const ADDED_SCOPES = ['parent', 'force', 'roster'] as const;

/**
 * A BSData modifier that encodes a rule a later GW change removed (overrides/modifier-removals.json): every modifier of
 * `field` (e.g. "hidden") on the entry or link `entryId` is dropped. Other modifiers on the node stay.
 */
export interface ModifierRemoval {
  catalogueName: string;
  entryId: string;
  entryName: string;
  field: string;
  source: string;
}

/**
 * A catalogue-level detachment (forceEntry) that isn't a 9th-edition rule (overrides/force-removals.json): it is left
 * out of the roster file, so the builder never offers it.
 */
export interface ForceRemoval {
  catalogueName: string;
  forceId: string;
  forceName: string;
  source: string;
}

/** Corrections applied while emitting; build.ts loads them from overrides/ and checks their catalogue names. */
export interface EmitOverrides {
  costs: CostOverride[];
  factionKeywords: FactionKeywordOverride[];
  constraints: ConstraintOverride[];
  addedConstraints: AddedConstraint[];
  modifierRemovals: ModifierRemoval[];
  forceRemovals: ForceRemoval[];
  /** The .gst's category ids by name ("Faction: Imperium" → id), for factionKeywords. */
  systemCategories: Map<string, string>;
  /**
   * Category names by id across the catalogue's scope (its linked catalogues and the .gst), for the constraint
   * overrides' entryName guard on category links whose category the file doesn't define.
   */
  scopeCategories: Map<string, string>;
  /**
   * Ids, across every file, of the Weapon and Wargear profiles, the infoGroups holding one and the selection entries
   * carrying one (gearIds): an entry's weapon profile is often in a library or the .gst. Without it, this file's own.
   */
  gearIds: Set<string>;
}

const GEAR_PROFILE_TYPES = new Set(['Weapon', 'Wargear']);

/**
 * The ids of every Weapon or Wargear profile in `files`, of every infoGroup holding one (nested groups and infoLinks
 * included) and of every selection entry carrying one (its own profiles, infoLinks or infoGroups; not its children).
 */
export function gearIds(files: RawCatalogue[]): Set<string> {
  const index = new Map<string, RawNode>();
  const visit = (n: RawNode) => {
    if (n.attrs.id && !index.has(n.attrs.id)) index.set(n.attrs.id, n);
    n.children.forEach(visit);
  };
  files.forEach((f) => visit(f.root));
  const memo = new Map<RawNode, boolean>();
  const carries = (n: RawNode): boolean => {
    const known = memo.get(n);
    if (known !== undefined) return known;
    memo.set(n, false); // a cycle of infoLinks carries nothing more
    const v =
      n.tag === 'profile'
        ? GEAR_PROFILE_TYPES.has(n.attrs.typeName ?? '')
        : kids(n, 'profiles').some(carries) ||
          kids(n, 'infoGroups').some(carries) ||
          kids(n, 'infoLinks').some((l) => {
            const t = index.get(l.attrs.targetId);
            return !!t && carries(t);
          });
    memo.set(n, v);
    return v;
  };
  const out = new Set<string>();
  for (const [id, n] of index) if ((n.tag === 'profile' || n.tag === 'infoGroup' || n.tag === 'selectionEntry') && carries(n)) out.add(id);
  return out;
}

/**
 * A unit-wide wargear choice: a group of exactly one choice (min = max = 1) whose options all carry a weapon, their own
 * or a child's, unless its name says the choice is for some of the models ("Weapons (Neophytes)"; "(per entire unit)"
 * is fine). Survey (2026-10-24): "Unit Weapon Choice" (Immortals, Lychguard), "Unit Weapon Options" (Hellblasters,
 * Aggressors), "Ranged Weapons (per entire unit)" (Wraithguard), "Weapons" (Termagants); the weapon test leaves out
 * Mark of Chaos and Extra Regimental Doctrine. The export counts such a choice once per model of a unit (exportText.ts).
 */
function isUnitWideChoice(group: RNode): boolean {
  const pinned = (type: 'min' | 'max') => group.constraints?.some((c) => c.type === type && c.field === 'selections' && c.scope === 'parent' && c.value === 1);
  if (!pinned('min') || !pinned('max') || !group.children?.length) return false;
  if (/\(/.test(group.name) && !/\(per (entire )?unit\)/i.test(group.name)) return false;
  // A group that picks a model ("Boss", "Plasma or Vox") is not a unit-wide choice, however its model is armed.
  const isModel = (n: RNode) => n.kind === 'entry' && n.type === 'model';
  const carries = (n: RNode): boolean => !isModel(n) && (!!n.gear || (n.children ?? []).some(carries));
  return group.children.every(carries);
}

/**
 * Groups of Warlord traits and of relics, by name ("Warlord Traits (Codex)", "Codex Traits", "Chapter Relics", "Artefacts
 * of the Aeons", "Heirlooms of Conquest", "Treasures of the Aeldari"…; the survey is above EXTRA_GROUP in
 * extract/units.ts): their options are marked extraKind, so a relic named without a "Relic:" prefix is still one.
 */
const TRAIT_GROUP = /\btraits?\b/i;
const RELIC_GROUP = /\b(relics?|artefacts?|heirlooms?|treasures?|trophies)\b/i;

/** List-building extras the builder doesn't offer (their info isn't emitted either: src/info/extract.ts). */
export const DROPPED_NAME = /^(battle honours|battle scars|crusade)\b/i;
const DROPPED_FIELDS = new Set(['page', 'description']);

const kids = (n: RawNode, tag: string) => n.children.find((c) => c.tag === tag)?.children ?? [];
/** Children of every container with one of `tags`, in document order. */
const contained = (n: RawNode, tags: string[]) => n.children.filter((c) => tags.includes(c.tag)).flatMap((c) => c.children);
const nonEmpty = <K extends string, T>(key: K, arr: T[]): Partial<Record<K, T[]>> =>
  (arr.length ? { [key]: arr } : {}) as Partial<Record<K, T[]>>;

/** Non-default BattleScribe flags only. */
function flags(a: Record<string, string>) {
  return {
    ...(a.percentValue === 'true' && { percent: true as const }),
    ...(a.shared === 'false' && { shared: false as const }),
    ...(a.includeChildSelections === 'true' && { childSel: true as const }),
    ...(a.includeChildForces === 'true' && { childForces: true as const }),
  };
}

function cond(n: RawNode): Cond {
  const a = n.attrs;
  return { type: a.type as CondType, field: a.field, scope: a.scope, childId: a.childId, value: Number(a.value), ...flags(a) };
}

function condGroup(n: RawNode): CondGroup {
  return { type: n.attrs.type as CondGroup['type'], conds: kids(n, 'conditions').map(cond), groups: kids(n, 'conditionGroups').map(condGroup) };
}

/** A modifier's (or modifier group's) own conditions and condition groups, ANDed; undefined when it has none. */
function ownWhen(n: RawNode): CondGroup | undefined {
  const conds = kids(n, 'conditions').map(cond);
  const groups = kids(n, 'conditionGroups').map(condGroup);
  return conds.length || groups.length ? { type: 'and', conds, groups } : undefined;
}

function repeats(n: RawNode): Repeat[] {
  return kids(n, 'repeats').map((r) => {
    const a = r.attrs;
    const { percent: _ignored, ...rest } = flags(a);
    return {
      field: a.field,
      scope: a.scope,
      childId: a.childId,
      value: Number(a.value),
      repeats: Number(a.repeats),
      ...(a.roundUp === 'true' && { roundUp: true as const }),
      ...rest,
    };
  });
}

function constraints(n: RawNode): Constraint[] {
  return kids(n, 'constraints').map((c) => {
    const a = c.attrs;
    return { id: a.id, type: a.type as Constraint['type'], field: a.field, scope: a.scope, value: Number(a.value), ...flags(a) };
  });
}

function costs(n: RawNode, keepZero: boolean): CostMap | undefined {
  const out: CostMap = {};
  for (const c of kids(n, 'costs')) {
    const v = Number(c.attrs.value);
    if (keepZero || v !== 0) out[c.attrs.typeId] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Per-file emitter; `charIds` are the characteristic type ids declared in the file. */
function emitter(charIds: Set<string>, gear: Set<string>) {
  /**
   * Kept: hidden, name, category, cost type ids and constraint ids. Dropped: page, description, characteristic ids.
   * Constraint ids may live in another file, so anything not known to be dropped is kept; the vocabulary test
   * checks every kept field across all files is a supported one.
   */
  const keepField = (f: string) => !DROPPED_FIELDS.has(f) && !charIds.has(f);

  function modifier(m: RawNode): Mod | null {
    const a = m.attrs;
    if (!keepField(a.field)) return null;
    const when = ownWhen(m);
    return { type: a.type as ModType, field: a.field, value: a.value, ...(when && { when }), ...nonEmpty('repeats', repeats(m)) };
  }

  /** Modifiers in document order, with modifier groups flattened into their modifiers. */
  function mods(n: RawNode): Mod[] {
    return n.children.flatMap((c) => {
      if (c.tag === 'modifiers') return c.children.map(modifier).filter((x): x is Mod => x !== null);
      if (c.tag === 'modifierGroups') return c.children.flatMap(flattenGroup);
      return [];
    });
  }

  function flattenGroup(g: RawNode): Mod[] {
    const groupConds = kids(g, 'conditions').map(cond);
    const groupGroups = kids(g, 'conditionGroups').map(condGroup);
    const groupRepeats = repeats(g);
    return mods(g).map(({ when: own, repeats: ownRepeats, ...rest }) => {
      const when: CondGroup | undefined =
        groupConds.length || groupGroups.length
          ? { type: 'and', conds: groupConds, groups: [...groupGroups, ...(own ? [own] : [])] }
          : own;
      return { ...rest, ...(when && { when }), ...nonEmpty('repeats', [...(ownRepeats ?? []), ...groupRepeats]) };
    });
  }

  const holder = (n: RawNode) => ({ ...nonEmpty('constraints', constraints(n)), ...nonEmpty('mods', mods(n)) });

  function catLink(n: RawNode): CatLink {
    return { id: n.attrs.id, targetId: n.attrs.targetId, ...(n.attrs.primary === 'true' && { primary: true as const }), ...holder(n) };
  }

  function node(n: RawNode): RNode | null {
    const a = n.attrs;
    if (DROPPED_NAME.test(a.name ?? '')) return null;
    let head: Pick<RNode, 'kind' | 'type' | 'targetId' | 'targetKind' | 'defaultId'>;
    if (n.tag === 'selectionEntry') head = { kind: 'entry', type: a.type as RNode['type'] };
    else if (n.tag === 'selectionEntryGroup')
      head = { kind: 'group', ...(a.defaultSelectionEntryId && { defaultId: a.defaultSelectionEntryId }) };
    else if (n.tag === 'entryLink')
      head = { kind: 'link', targetId: a.targetId, targetKind: a.type === 'selectionEntryGroup' ? 'group' : 'entry' };
    else return null;
    const nodeCosts = costs(n, head.kind === 'link'); // a link's costs override its target's, zeros included
    const carriesGear =
      head.kind !== 'group' &&
      (gear.has(a.id) ||
        (head.kind === 'link' && gear.has(a.targetId)) ||
        kids(n, 'profiles').some((p) => GEAR_PROFILE_TYPES.has(p.attrs.typeName ?? '')) ||
        kids(n, 'infoLinks').some((l) => gear.has(l.attrs.targetId)));
    const out: RNode = {
      id: a.id,
      name: a.name,
      ...head,
      ...(a.hidden === 'true' && { hidden: true as const }),
      ...(a.collective === 'true' && { collective: true as const }),
      ...(nodeCosts && { costs: nodeCosts }),
      ...nonEmpty('cats', kids(n, 'categoryLinks').map(catLink)),
      ...holder(n),
      ...nonEmpty('children', nodes(contained(n, ['selectionEntries', 'selectionEntryGroups', 'entryLinks']))),
      ...(carriesGear && { gear: true as const }),
    };
    if (out.kind === 'group') {
      if (isUnitWideChoice(out)) for (const c of out.children!) c.perModel = true;
      const extraKind = TRAIT_GROUP.test(out.name) ? 'trait' : RELIC_GROUP.test(out.name) ? 'relic' : undefined;
      if (extraKind) for (const c of out.children ?? []) c.extraKind ??= extraKind;
    }
    return out;
  }

  const nodes = (ns: RawNode[]) => ns.map(node).filter((x): x is RNode => x !== null);

  function category(n: RawNode): RCategory {
    return { id: n.attrs.id, name: n.attrs.name, ...(n.attrs.hidden === 'true' && { hidden: true as const }), ...holder(n) };
  }

  /** Top-level force only: nested forceEntries are never read. */
  function force(n: RawNode): RForce {
    return {
      id: n.attrs.id,
      name: n.attrs.name,
      ...(n.attrs.hidden === 'true' && { hidden: true as const }),
      cats: kids(n, 'categoryLinks').map(catLink),
      ...holder(n),
    };
  }

  return { nodes, category, force };
}

function* walk(ns: RNode[]): Generator<RNode> {
  for (const n of ns) {
    yield n;
    yield* walk(n.children ?? []);
  }
}

/** The nodes `entryId` names in the file, after checking there is one and it has the expected name. */
function overrideTargets(file: RosterFile, kind: string, o: { catalogueName: string; entryId: string; entryName: string }): RNode[] {
  const hits = [...walk(file.rootEntries), ...walk(file.shared)].filter((n) => n.id === o.entryId);
  if (!hits.length) throw new Error(`${kind} override for "${o.catalogueName}" entry ${o.entryId} ("${o.entryName}") matches no entry`);
  for (const n of hits) {
    if (n.name !== o.entryName) throw new Error(`${kind} override for "${o.catalogueName}" entry ${o.entryId} expects "${o.entryName}" but found "${n.name}"`);
  }
  return hits;
}

function applyCostOverrides(file: RosterFile, catalogueName: string, overrides: CostOverride[]): void {
  for (const o of overrides.filter((x) => x.catalogueName === catalogueName)) {
    for (const n of overrideTargets(file, 'Cost', o)) n.costs = { ...n.costs, [o.costTypeId]: o.value };
  }
}

function applyFactionKeywordOverrides(file: RosterFile, catalogueName: string, overrides: FactionKeywordOverride[], systemCategories: Map<string, string>): void {
  for (const o of overrides.filter((x) => x.catalogueName === catalogueName)) {
    const nodes = overrideTargets(file, 'Faction keyword', o);
    for (const faction of o.add) {
      const name = `Faction: ${faction}`;
      const targetId = file.categories.find((c) => c.name === name)?.id ?? systemCategories.get(name);
      if (!targetId) throw new Error(`Faction keyword override for "${catalogueName}" entry ${o.entryId} names unknown category "${name}"`);
      for (const n of nodes) {
        if (!n.cats?.some((c) => c.targetId === targetId)) n.cats = [...(n.cats ?? []), { id: `${n.id}-faction-${targetId}`, targetId }];
      }
    }
  }
}

function applyAddedConstraints(file: RosterFile, catalogueName: string, added: AddedConstraint[]): void {
  for (const o of added.filter((x) => x.catalogueName === catalogueName)) {
    const { type, field, scope, value } = o.constraint;
    if (!['min', 'max'].includes(type) || field !== 'selections' || !ADDED_SCOPES.includes(scope) || !Number.isInteger(value) || value < 0) {
      throw new Error(`Added constraint for "${catalogueName}" entry ${o.entryId} ("${o.entryName}") is an unsupported constraint ${JSON.stringify(o.constraint)}`);
    }
    const id = `${o.entryId}-added-${type}-${scope}`;
    for (const n of overrideTargets(file, 'Added constraint', o)) {
      if (n.constraints?.some((c) => c.id === id)) throw new Error(`Added constraint for "${catalogueName}": entry ${o.entryId} already has constraint ${id}`);
      n.constraints = [...(n.constraints ?? []), { id, type, field, scope, value, childSel: true, childForces: true }];
    }
  }
}

function applyModifierRemovals(file: RosterFile, catalogueName: string, removals: ModifierRemoval[]): void {
  const relevant = removals.filter((x) => x.catalogueName === catalogueName);
  if (!relevant.length) return;
  const nodes = [...walk(file.rootEntries), ...walk(file.shared)];
  for (const o of relevant) {
    const node = nodes.find((n) => n.id === o.entryId);
    if (!node) throw new Error(`Modifier removal for "${catalogueName}" names unknown entry ${o.entryId}`);
    if (node.name !== o.entryName) throw new Error(`Modifier removal for "${catalogueName}" entry ${o.entryId} expects "${o.entryName}" but found "${node.name}"`);
    if (!node.mods?.some((m) => m.field === o.field)) throw new Error(`Modifier removal for "${catalogueName}" entry ${o.entryId}: no modifier of ${o.field}`);
    const mods = node.mods.filter((m) => m.field !== o.field);
    if (mods.length) node.mods = mods;
    else delete node.mods;
  }
}

function applyForceRemovals(file: RosterFile, catalogueName: string, removals: ForceRemoval[]): void {
  for (const o of removals.filter((x) => x.catalogueName === catalogueName)) {
    const force = file.forces.find((f) => f.id === o.forceId);
    if (!force) throw new Error(`force-removals.json: "${catalogueName}" has no detachment ${o.forceId}`);
    if (force.name !== o.forceName) throw new Error(`force-removals.json: "${catalogueName}" detachment ${o.forceId} expects "${o.forceName}" but found "${force.name}"`);
    file.forces = file.forces.filter((f) => f !== force);
  }
}

function applyConstraintOverrides(
  file: RosterFile,
  catalogueName: string,
  overrides: ConstraintOverride[],
  systemCategories: Map<string, string>,
  scopeCategories: Map<string, string>,
): void {
  const relevant = overrides.filter((x) => x.catalogueName === catalogueName);
  if (!relevant.length) return;
  // A category link is named after its category: this file's own, else a linked catalogue's or the .gst's.
  const categoryNames = new Map([...systemCategories].map(([name, id]) => [id, name]));
  for (const [id, name] of scopeCategories) categoryNames.set(id, name);
  for (const c of file.categories) categoryNames.set(c.id, c.name);
  const linkName = (l: CatLink) => categoryNames.get(l.targetId) ?? { unknownCategory: l.targetId };
  const nodes = [...walk(file.rootEntries), ...walk(file.shared)];
  const holders: { name: string | { unknownCategory: string }; holder: { constraints?: Constraint[]; mods?: Mod[] } }[] = [
    ...nodes.map((n) => ({ name: n.name, holder: n })),
    ...nodes.flatMap((n) => n.cats ?? []).map((l) => ({ name: linkName(l), holder: l })),
    ...file.categories.map((c) => ({ name: c.name, holder: c })),
    ...file.forces.map((f) => ({ name: f.name, holder: f })),
    ...file.forces.flatMap((f) => f.cats).map((l) => ({ name: linkName(l), holder: l })),
  ];
  for (const o of relevant) {
    if (o.scope !== undefined && !CONSTRAINT_SCOPES.includes(o.scope)) throw new Error(`Constraint override for "${catalogueName}" constraint ${o.constraintId} has unknown scope "${o.scope}"`);
    const found = holders.filter((h) => h.holder.constraints?.some((c) => c.id === o.constraintId));
    if (!found.length) throw new Error(`Constraint override for "${catalogueName}" names unknown constraint ${o.constraintId}`);
    for (const { name } of found) {
      if (typeof name !== 'string') throw new Error(`Constraint override for "${catalogueName}" constraint ${o.constraintId}: unknown category name for ${name.unknownCategory}`);
      if (name !== o.entryName) throw new Error(`Constraint override for "${catalogueName}" constraint ${o.constraintId} expects "${o.entryName}" but found "${name}"`);
    }
    for (const { holder: h } of found) {
      h.constraints = h.constraints!.map((c) => (c.id === o.constraintId ? { ...c, value: o.value, ...(o.scope && { scope: o.scope }) } : c));
      const mods = (h.mods ?? []).filter((m) => m.field !== o.constraintId);
      if (mods.length) h.mods = mods;
      else delete h.mods;
    }
  }
}

export function emitRosterFile(cat: RawCatalogue, slug: string, overrides: Partial<EmitOverrides> = {}): RosterFile {
  const charIds = new Set<string>();
  const collectChars = (n: RawNode) => {
    if (n.tag === 'characteristicType') charIds.add(n.attrs.id);
    n.children.forEach(collectChars);
  };
  kids(cat.root, 'profileTypes').forEach(collectChars);
  const e = emitter(charIds, overrides.gearIds ?? gearIds([cat]));
  const file: RosterFile = {
    schema: 1,
    id: cat.id,
    name: cat.name,
    slug,
    library: cat.library,
    links: cat.links.map((l) => ({ targetId: l.targetId, importRootEntries: l.importRootEntries })),
    rootEntries: e.nodes(contained(cat.root, ['entryLinks', 'selectionEntries'])),
    shared: e.nodes(contained(cat.root, ['sharedSelectionEntries', 'sharedSelectionEntryGroups'])),
    categories: kids(cat.root, 'categoryEntries').map(e.category),
    forces: kids(cat.root, 'forceEntries').map(e.force),
  };
  applyCostOverrides(file, cat.name, overrides.costs ?? []);
  applyFactionKeywordOverrides(file, cat.name, overrides.factionKeywords ?? [], overrides.systemCategories ?? new Map());
  applyAddedConstraints(file, cat.name, overrides.addedConstraints ?? []);
  applyConstraintOverrides(file, cat.name, overrides.constraints ?? [], overrides.systemCategories ?? new Map(), overrides.scopeCategories ?? new Map());
  applyModifierRemovals(file, cat.name, overrides.modifierRemovals ?? []);
  applyForceRemovals(file, cat.name, overrides.forceRemovals ?? []);
  return file;
}
