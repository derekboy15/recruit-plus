/**
 * Node-side: turns one parsed BattleScribe file (.cat or .gst) into compact roster JSON.
 * Keeps what the roster engine evaluates (links, costs, categories, constraints, modifiers,
 * conditions, repeats) and drops display data (profiles, rules, infoLinks, publications, comments).
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
 * "Faction: " prefix) becomes a category link to that .gst Faction category on the entry or link `entryId`.
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

/** Corrections applied while emitting; build.ts loads them from overrides/ and checks their catalogue names. */
export interface EmitOverrides {
  costs: CostOverride[];
  factionKeywords: FactionKeywordOverride[];
  constraints: ConstraintOverride[];
  /** The .gst's category ids by name ("Faction: Imperium" → id), for factionKeywords. */
  systemCategories: Map<string, string>;
  /**
   * Category names by id across the catalogue's scope (its linked catalogues and the .gst), for the constraint
   * overrides' entryName guard on category links whose category the file doesn't define.
   */
  scopeCategories: Map<string, string>;
}

/** List-building extras the builder doesn't offer. */
const DROPPED_NAME = /^(battle honours|battle scars|crusade)\b/i;
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
function emitter(charIds: Set<string>) {
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
    return {
      id: a.id,
      name: a.name,
      ...head,
      ...(a.hidden === 'true' && { hidden: true as const }),
      ...(a.collective === 'true' && { collective: true as const }),
      ...(nodeCosts && { costs: nodeCosts }),
      ...nonEmpty('cats', kids(n, 'categoryLinks').map(catLink)),
      ...holder(n),
      ...nonEmpty('children', nodes(contained(n, ['selectionEntries', 'selectionEntryGroups', 'entryLinks']))),
    };
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
      const targetId = systemCategories.get(name);
      if (!targetId) throw new Error(`Faction keyword override for "${catalogueName}" entry ${o.entryId} names unknown category "${name}"`);
      for (const n of nodes) {
        if (!n.cats?.some((c) => c.targetId === targetId)) n.cats = [...(n.cats ?? []), { id: `${n.id}-faction-${targetId}`, targetId }];
      }
    }
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
  const e = emitter(charIds);
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
  applyConstraintOverrides(file, cat.name, overrides.constraints ?? [], overrides.systemCategories ?? new Map(), overrides.scopeCategories ?? new Map());
  return file;
}
