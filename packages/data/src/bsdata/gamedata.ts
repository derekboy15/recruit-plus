import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBsXml } from './xml';
import type { GameData, RawCatalogue, RawNode } from './types';

function toCatalogue(root: RawNode): RawCatalogue {
  const linksNode = root.children.find((c) => c.tag === 'catalogueLinks');
  return {
    id: root.attrs.id,
    name: root.attrs.name,
    library: root.attrs.library === 'true',
    root,
    links: (linksNode?.children ?? []).map((l) => ({
      targetId: l.attrs.targetId,
      importRootEntries: l.attrs.importRootEntries === 'true',
    })),
  };
}

export function loadGameData(dir: string): GameData {
  const files = readdirSync(dir);
  const gst = files.find((f) => f.endsWith('.gst'));
  if (!gst) throw new Error(`No .gst file in ${dir}`);
  const system = toCatalogue(parseBsXml(readFileSync(join(dir, gst), 'utf8')));
  const catalogues = new Map<string, RawCatalogue>();
  for (const f of files.filter((x) => x.endsWith('.cat'))) {
    const cat = toCatalogue(parseBsXml(readFileSync(join(dir, f), 'utf8')));
    catalogues.set(cat.id, cat);
  }
  return { system, catalogues };
}

/** The catalogue, its linked catalogues (depth-first, deduplicated), then the game system. */
export function catalogueScope(gd: GameData, catalogueId: string): RawCatalogue[] {
  const out: RawCatalogue[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    const cat = gd.catalogues.get(id);
    if (!cat || seen.has(id)) return;
    seen.add(id);
    out.push(cat);
    cat.links.forEach((l) => visit(l.targetId));
  };
  visit(catalogueId);
  return [...out, gd.system];
}

/** Every element with an id, first occurrence in scope order wins. */
export function buildIdIndex(scope: RawCatalogue[]): Map<string, RawNode> {
  const index = new Map<string, RawNode>();
  const walk = (n: RawNode) => {
    const id = n.attrs.id;
    if (id && !index.has(id)) index.set(id, n);
    n.children.forEach(walk);
  };
  scope.forEach((c) => walk(c.root));
  return index;
}
