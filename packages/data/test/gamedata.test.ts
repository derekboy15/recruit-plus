import { test, expect, describe } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadGameData, catalogueScope, buildIdIndex } from '../src/bsdata/gamedata';
import type { RawNode } from '../src/bsdata/types';

const FIX = join(__dirname, 'fixtures', 'mini');
const RAW = join(__dirname, '..', 'raw', 'bsdata');

function targetIds(node: RawNode, out: string[] = []): string[] {
  if (['entryLink', 'infoLink', 'categoryLink'].includes(node.tag) && node.attrs.targetId) out.push(node.attrs.targetId);
  node.children.forEach((c) => targetIds(c, out));
  return out;
}

describe('fixtures', () => {
  const gd = loadGameData(FIX);
  test('loads the system and both catalogues', () => {
    expect(gd.system.name).toBe('Mini System');
    expect([...gd.catalogues.values()].map((c) => c.name).sort()).toEqual(['Mini Faction', 'Mini Library']);
    expect(gd.catalogues.get('cat-lib')!.library).toBe(true);
  });
  test('scope is catalogue, then linked catalogues, then system', () => {
    expect(catalogueScope(gd, 'cat-mini').map((c) => c.id)).toEqual(['cat-mini', 'cat-lib', 'sys-1']);
  });
  test('every link target resolves and text is decoded', () => {
    const scope = catalogueScope(gd, 'cat-mini');
    const index = buildIdIndex(scope);
    for (const id of scope.flatMap((c) => targetIds(c.root))) expect(index.has(id), id).toBe(true);
    const rule = index.get('rule-obsec')!;
    expect(rule.children.find((c) => c.tag === 'description')!.text).toBe('Counts as more models & holds objectives.');
    expect(index.get('p-warrior')!.children[0].children[0].text).toBe('5"');
  });
});

describe('real BSData v9.8.0', () => {
  const gd = loadGameData(RAW);
  const allowed: { catalogue: string; targetId: string }[] = JSON.parse(
    readFileSync(join(__dirname, '..', 'overrides', 'unresolved-links.json'), 'utf8'),
  );
  test('loads 52 catalogues', () => {
    expect(gd.catalogues.size).toBe(52);
  });
  test('every link resolves within its catalogue scope (or is a listed exception)', () => {
    const unresolved: string[] = [];
    for (const cat of gd.catalogues.values()) {
      const scope = catalogueScope(gd, cat.id);
      const index = buildIdIndex(scope);
      for (const id of targetIds(cat.root)) {
        if (!index.has(id) && !allowed.some((a) => a.catalogue === cat.name && a.targetId === id)) unresolved.push(`${cat.name}: ${id}`);
      }
    }
    expect(unresolved).toEqual([]);
  });
});
