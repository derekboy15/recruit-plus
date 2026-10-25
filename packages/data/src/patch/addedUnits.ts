/**
 * Units BSData v9.8.0 never added (overrides/added-units.json), copied from another catalogue's entry into the target
 * catalogue's parsed BattleScribe tree before anything reads it, so units, roster files and info files all see them as
 * native data. The copy:
 * - drops the named parts (`drop`: any element with that name, at any depth);
 * - re-points each link the target's scope can't resolve to the target catalogue's own entry of the same name and
 *   kind, else copies the linked entry along (into the target's shared entries);
 * - drops modifiers whose conditions name things that only exist in the source catalogue (a Legion choice);
 * - swaps the faction categories and the primary battlefield role;
 * - sets the points;
 * - gives every copied element a new id derived from `newId`, shaped like BattleScribe's ids, so the copy and its
 *   original never collide in an army that allies the two catalogues.
 */
import { createHash } from 'node:crypto';
import { buildIdIndex, catalogueScope } from '../bsdata/gamedata';
import type { GameData, RawCatalogue, RawNode } from '../bsdata/types';

export interface AddedUnit {
  /** The catalogue the unit is added to, and the unit's name there. */
  catalogueName: string;
  entryName: string;
  /** The BSData entry copied. */
  from: { catalogueName: string; entryId: string };
  /** A stable key for the copy: its id, and every copied element's, is derived from it (see `copyId`). */
  newId: string;
  /** The battlefield role category (by name) the copy is in. */
  primaryRole: string;
  /** Faction categories (by name, resolved in the target's scope) replacing the source's "Faction: …" links. */
  factionCategories: string[];
  /** Points of every model entry in the copy. */
  costPerModel?: number;
  /** Points on the unit entry itself. */
  costTotal?: number;
  /** Names of elements left out of the copy, wherever they are (relic groups, source-only options and rules). */
  drop?: string[];
  /** Spelling changes to the names inside the copied unit (not the entries it links to): [from, to] text pairs. */
  rename?: [string, string][];
  /** The Wahapedia datasheet the copy must join (the build fails if it joins another). */
  wahapediaId: string;
  source: string;
}

const FILE = 'added-units.json';
/** Condition `childId`s that name a kind of selection, not an element. */
const KINDS = new Set(['model', 'unit', 'upgrade', 'any']);
const LINKS = new Set(['entryLink', 'infoLink', 'categoryLink']);
const SHARED: Record<string, string> = {
  selectionEntry: 'sharedSelectionEntries',
  selectionEntryGroup: 'sharedSelectionEntryGroups',
  profile: 'sharedProfiles',
  rule: 'sharedRules',
  infoGroup: 'sharedInfoGroups',
};

const clone = (n: RawNode): RawNode => ({ tag: n.tag, attrs: { ...n.attrs }, children: n.children.map(clone), ...(n.text !== undefined ? { text: n.text } : {}) });
const walk = (n: RawNode, f: (n: RawNode) => void) => {
  f(n);
  n.children.forEach((c) => walk(c, f));
};
const container = (parent: RawNode, tag: string): RawNode => {
  let c = parent.children.find((x) => x.tag === tag);
  if (!c) parent.children.push((c = { tag, attrs: {}, children: [] }));
  return c;
};
const dropNamed = (n: RawNode, names: Set<string>): RawNode => ({
  ...n,
  children: n.children.filter((c) => !names.has(c.attrs.name ?? '')).map((c) => dropNamed(c, names)),
});

export function applyAddedUnits(gd: GameData, added: AddedUnit[]): void {
  const all = [...gd.catalogues.values(), gd.system];
  const byName = (name: string, what: string): RawCatalogue => {
    const c = all.find((x) => x.name === name);
    if (!c) throw new Error(`${FILE}: "${what}" names unknown catalogue "${name}"`);
    return c;
  };
  for (const a of added) {
    const target = byName(a.catalogueName, a.entryName);
    const source = byName(a.from.catalogueName, a.entryName);
    const srcIndex = buildIdIndex(catalogueScope(gd, source.id));
    const original = srcIndex.get(a.from.entryId);
    if (!original || original.tag !== 'selectionEntry') {
      throw new Error(`${FILE}: "${a.entryName}" copies entry ${a.from.entryId}, which isn't a selection entry in "${source.name}"`);
    }
    const tgtScope = catalogueScope(gd, target.id);
    const tgtIndex = buildIdIndex(tgtScope);
    const drop = new Set(a.drop ?? []);
    const own = new Map<string, RawNode>(); // the target file's own elements, by "tag|type|name"
    walk(target.root, (n) => {
      if (n.attrs.id && n.attrs.name) own.set(`${n.tag}|${n.attrs.type ?? ''}|${n.attrs.name.toLowerCase()}`, n);
    });
    const categoriesByName = new Map<string, RawNode>();
    for (const c of tgtScope) walk(c.root, (n) => n.tag === 'categoryEntry' && n.attrs.name && !categoriesByName.has(n.attrs.name) && categoriesByName.set(n.attrs.name, n));
    const category = (name: string) => {
      const c = categoriesByName.get(name);
      if (!c) throw new Error(`${FILE}: "${a.entryName}": no category "${name}" in the scope of "${target.name}"`);
      return c;
    };

    const unit = dropNamed(clone(original), drop);
    const copies = new Map<string, RawNode>(); // source id -> copy, for linked entries the target can't resolve
    const pending: RawNode[] = [unit];
    // Links: keep what resolves, re-point to the target's own same-named element, else copy the element along.
    while (pending.length) {
      const root = pending.pop()!;
      walk(root, (n) => {
        if (!LINKS.has(n.tag)) return;
        const id = n.attrs.targetId;
        if (!id || tgtIndex.has(id) || copies.has(id)) return;
        const linked = srcIndex.get(id);
        const mine = linked && own.get(`${linked.tag}|${linked.attrs.type ?? ''}|${(linked.attrs.name ?? '').toLowerCase()}`);
        if (mine) {
          n.attrs.targetId = mine.attrs.id;
          return;
        }
        if (n.tag === 'categoryLink' || !linked) {
          n.attrs.dropMe = 'true'; // a source-only category ("Icon") or a dangling link
          return;
        }
        const copy = dropNamed(clone(linked), drop);
        copies.set(id, copy);
        pending.push(copy);
      });
    }
    const removeMarked = (n: RawNode): RawNode => ({ ...n, children: n.children.filter((c) => c.attrs.dropMe !== 'true').map(removeMarked) });
    let tree = removeMarked(unit);
    const copied = [...copies.values()].map(removeMarked);

    // Modifiers whose conditions name something the target never has (a Legion, an Army of Renown) are dropped.
    const known = (id: string) => KINDS.has(id) || tgtIndex.has(id) || copies.has(id) || [tree, ...copied].some((r) => hasId(r, id));
    const unknownCondition = (m: RawNode) => {
      let bad = false;
      walk(m, (n) => {
        if ((n.tag === 'condition' || n.tag === 'repeat') && n.attrs.childId && !known(n.attrs.childId)) bad = true;
      });
      return bad;
    };
    const pruneModifiers = (n: RawNode): RawNode => ({
      ...n,
      children: n.children.filter((c) => !((c.tag === 'modifier' || c.tag === 'modifierGroup') && unknownCondition(c))).map(pruneModifiers),
    });
    tree = pruneModifiers(tree);
    const prunedCopies = copied.map(pruneModifiers);

    // The target's spelling for the unit's own models, profiles and rules ("Berserker" -> "Berzerker").
    for (const [from, to] of a.rename ?? []) walk(tree, (n) => { if (n.attrs.name?.includes(from)) n.attrs.name = n.attrs.name.split(from).join(to); });

    // Faction categories and the primary role.
    const links = container(tree, 'categoryLinks');
    const nameOf = (id: string) => srcIndex.get(id)?.attrs.name ?? tgtIndex.get(id)?.attrs.name ?? '';
    links.children = links.children.filter((l) => !nameOf(l.attrs.targetId ?? '').startsWith('Faction: '));
    for (const f of a.factionCategories) {
      const c = category(f);
      links.children.push({ tag: 'categoryLink', attrs: { id: copyId(a.newId, `faction:${c.attrs.id}`), name: f, hidden: 'false', targetId: c.attrs.id, primary: 'false' }, children: [] });
    }
    const role = category(a.primaryRole);
    const primary = links.children.find((l) => l.attrs.primary === 'true');
    if (primary) Object.assign(primary.attrs, { targetId: role.attrs.id, name: a.primaryRole });
    else links.children.push({ tag: 'categoryLink', attrs: { id: copyId(a.newId, 'role'), name: a.primaryRole, hidden: 'false', targetId: role.attrs.id, primary: 'true' }, children: [] });

    // Points.
    const setPts = (n: RawNode, value: number) => {
      const costs = container(n, 'costs');
      const pts = costs.children.find((c) => c.attrs.typeId === 'points');
      if (pts) pts.attrs.value = String(value);
      else costs.children.push({ tag: 'cost', attrs: { name: 'pts', typeId: 'points', value: String(value) }, children: [] });
    };
    if (a.costPerModel !== undefined) walk(tree, (n) => n.tag === 'selectionEntry' && n.attrs.type === 'model' && setPts(n, a.costPerModel!));
    if (a.costTotal !== undefined) setPts(tree, a.costTotal);

    // New ids for everything copied, and every reference to them.
    const ids = new Map<string, string>();
    for (const r of [tree, ...prunedCopies]) walk(r, (n) => n.attrs.id && ids.set(n.attrs.id, copyId(a.newId, n.attrs.id)));
    for (const oldId of copies.keys()) ids.set(oldId, copyId(a.newId, oldId));
    ids.set(original.attrs.id, copyId(a.newId));
    for (const r of [tree, ...prunedCopies]) {
      walk(r, (n) => {
        for (const [k, v] of Object.entries(n.attrs)) if (ids.has(v)) n.attrs[k] = ids.get(v)!;
      });
    }
    Object.assign(tree.attrs, { id: copyId(a.newId), name: a.entryName, hidden: 'false' });

    container(target.root, 'selectionEntries').children.push(tree);
    for (const c of prunedCopies) container(target.root, SHARED[c.tag] ?? 'sharedSelectionEntries').children.push(c);
  }
}

function hasId(root: RawNode, id: string): boolean {
  let found = false;
  walk(root, (n) => { if (n.attrs.id === id) found = true; });
  return found;
}

/** A BattleScribe-shaped id ("xxxx-xxxx-xxxx-xxxx") for the copy (`key` alone) or one of its elements, stable across builds. */
export function copyId(key: string, element?: string): string {
  const h = createHash('sha1').update(element === undefined ? key : `${key}|${element}`).digest('hex');
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}`;
}
