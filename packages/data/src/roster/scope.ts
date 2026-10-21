/** Roster engine: id lookup across a catalogue's scope files, link resolution and root entries. Browser-safe. */
import type { CatLink, Constraint, CostMap, Mod, RCategory, RForce, RNode, RosterFile } from './types';

export interface Scope {
  /** In scope order: the first file defining an id wins. */
  files: RosterFile[];
  /** The game system (.gst) file. */
  system: RosterFile;
  node(id: string): RNode | undefined;
  category(id: string): RCategory | undefined;
  force(id: string): RForce | undefined;
  catalogue(id: string): RosterFile | undefined;
  /** Groups enclosing the node, innermost first, up to its nearest enclosing entry (or the file's top level). */
  parentGroups(nodeId: string): string[];
}

/** A node with its link (if any) applied over the target. Treat as read-only: results are cached per scope. */
export interface Merged {
  node: RNode;
  target: RNode;
  /** [link id, target id] for links, [id] otherwise. */
  ids: string[];
  name: string;
  type: RNode['type'];
  hidden: boolean;
  collective: boolean;
  /** Cost of one copy before modifiers. */
  costs: CostMap;
  cats: CatLink[];
  constraints: Constraint[];
  mods: Mod[];
  children: RNode[];
}

const SYSTEM_SLUG = 'system';

export function buildScope(files: RosterFile[]): Scope {
  const nodes = new Map<string, RNode>();
  const groups = new Map<string, string[]>();
  const categories = new Map<string, RCategory>();
  const forces = new Map<string, RForce>();
  const catalogues = new Map<string, RosterFile>();
  const setFirst = <T>(map: Map<string, T>, id: string, value: T) => {
    if (!map.has(id)) map.set(id, value);
  };
  const index = (ns: RNode[], enclosing: string[]) => {
    for (const n of ns) {
      setFirst(nodes, n.id, n);
      setFirst(groups, n.id, enclosing);
      if (n.children) index(n.children, n.kind === 'group' ? [n.id, ...enclosing] : []);
    }
  };
  for (const f of files) {
    setFirst(catalogues, f.id, f);
    index(f.rootEntries, []);
    index(f.shared, []);
    for (const c of f.categories) setFirst(categories, c.id, c);
    for (const fe of f.forces) setFirst(forces, fe.id, fe);
  }
  const system = files.find((f) => f.slug === SYSTEM_SLUG) ?? files[files.length - 1];
  return {
    files,
    system,
    node: (id) => nodes.get(id),
    category: (id) => categories.get(id),
    force: (id) => forces.get(id),
    catalogue: (id) => catalogues.get(id),
    parentGroups: (id) => groups.get(id) ?? [],
  };
}

const mergedCache = new WeakMap<Scope, WeakMap<RNode, Merged>>();

export function resolve(scope: Scope, node: RNode): Merged {
  let cache = mergedCache.get(scope);
  if (!cache) mergedCache.set(scope, (cache = new WeakMap()));
  let m = cache.get(node);
  if (!m) cache.set(node, (m = merge(scope, node)));
  return m;
}

function merge(scope: Scope, node: RNode): Merged {
  const linked = node.kind === 'link' && node.targetId ? scope.node(node.targetId) : undefined;
  const target = linked && linked.kind !== 'link' ? linked : node;
  const layers = target === node ? [node] : [node, target];
  const costs: CostMap = {};
  for (const t of new Set(layers.flatMap((l) => Object.keys(l.costs ?? {})))) {
    costs[t] = node.costs?.[t] ?? target.costs?.[t] ?? 0;
  }
  return {
    node,
    target,
    ids: layers.map((l) => l.id),
    name: node.name,
    type: target.type,
    hidden: layers.some((l) => l.hidden),
    collective: layers.some((l) => l.collective),
    costs,
    cats: layers.flatMap((l) => l.cats ?? []),
    constraints: layers.flatMap((l) => l.constraints ?? []),
    mods: layers.flatMap((l) => l.mods ?? []),
    children: layers.flatMap((l) => l.children ?? []),
  };
}

const rootCache = new WeakMap<Scope, Map<string, RNode[]>>();

/** The catalogue's root entries, then those of catalogues it links with importRootEntries (recursively), then the system's. */
export function rootEntriesFor(scope: Scope, catalogueId: string): RNode[] {
  let cache = rootCache.get(scope);
  if (!cache) rootCache.set(scope, (cache = new Map()));
  const hit = cache.get(catalogueId);
  if (hit) return hit;
  const out: RNode[] = [];
  const seenNodes = new Set<string>();
  const seenFiles = new Set<string>();
  const add = (file: RosterFile | undefined) => {
    if (!file || seenFiles.has(file.id)) return;
    seenFiles.add(file.id);
    for (const n of file.rootEntries) {
      if (!seenNodes.has(n.id)) {
        seenNodes.add(n.id);
        out.push(n);
      }
    }
    for (const l of file.links) if (l.importRootEntries) add(scope.catalogue(l.targetId));
  };
  add(scope.catalogue(catalogueId));
  add(scope.system);
  cache.set(catalogueId, out);
  return out;
}
