import { test, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAll, validateStratagemOverrides } from '../src/build';
import { loadOverrides, type Overrides } from '../src/join/wahapedia';
import type { CatalogueOut, DataIndex, StratagemOut } from '../src/model/types';
import { loadWahapedia, type Row, type Wahapedia } from '../src/wahapedia/load';

const ROOT = join(__dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'recruit-stratagems-'));
let index: DataIndex;
let w: Wahapedia;
let overrides: Overrides;
const catalogue = (slug: string): CatalogueOut => JSON.parse(readFileSync(join(out, 'catalogues', `${slug}.json`), 'utf8'));
const catalogues = () => index.catalogues.map((c) => catalogue(c.slug));
const matchedPlay = (r: Row) => r.is_boarding_action !== 'true' && !/Boarding Action|Requisition|Crusade/.test(r.type);

beforeAll(() => {
  index = buildAll({ rawDir: join(ROOT, 'raw'), overridesDir: join(ROOT, 'overrides'), outDir: out }).index;
  w = loadWahapedia(join(ROOT, 'raw', 'wahapedia'));
  overrides = loadOverrides(join(ROOT, 'overrides'));
});

test('every playable catalogue has one stratagem-factions entry; libraries have none', () => {
  const playable = index.catalogues.filter((c) => !c.library).map((c) => c.name).sort();
  expect(playable).toHaveLength(42);
  expect(overrides.stratagemFactions.map((e) => e.catalogueName).sort()).toEqual(playable);
  for (const c of index.catalogues.filter((x) => x.library)) expect(catalogue(c.slug).stratagems, c.name).toEqual([]);
});

test('no boarding, requisition or crusade stratagems in any catalogue', () => {
  const byId = new Map(w.stratagems.map((r) => [r.id, r]));
  for (const c of catalogues()) {
    for (const s of c.stratagems) {
      const row = byId.get(s.id)!;
      expect(row, `${c.name}: ${s.name}`).toBeDefined();
      expect(matchedPlay(row), `${c.name}: ${s.name} (${row.type})`).toBe(true);
      expect(s.kind, `${c.name}: ${s.name}`).not.toMatch(/Boarding|Requisition|Crusade/);
    }
  }
});

test('no catalogue lists two stratagems with the same name and group', () => {
  for (const c of catalogues()) {
    const keys = c.stratagems.map((s) => `${s.group} / ${s.name}`);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes, c.name).toEqual([]);
  }
});

test('core stratagems are the ten ids in order', () => {
  const core: StratagemOut[] = JSON.parse(readFileSync(join(out, 'core-stratagems.json'), 'utf8'));
  expect(core.map((s) => [s.id, s.name])).toEqual([
    ['000002134002', 'Command Re-roll'],
    ['000002134003', 'Cut Them Down'],
    ['000002134004', 'Desperate Breakout'],
    ['000002134005', 'Emergency Disembarkation'],
    ['000002134006', 'Fire Overwatch'],
    ['000002134007', 'Counter-offensive'],
    ['000002134008', 'Insane Bravery'],
    ['000008013002', 'Warlord Trait'],
    ['000008013003', 'Relic'],
    ['000008013004', 'Heroic Support'],
  ]);
  expect(core[0]).toMatchObject({ cp: '1', group: 'Core Book', kind: 'Core' });
  expect(core.find((s) => s.name === 'Desperate Breakout')!.phases).toContain('Movement phase');
  for (const s of core.slice(7)) expect(s, s.name).toMatchObject({ group: 'Arks of Omen', kind: 'Requisition' });
  for (const s of core) expect(s.text.length, s.name).toBeGreaterThan(0);
});

test('Necrons: Swift Dismemberment is an Annihilation Legion battle tactic', () => {
  const s = catalogue('necrons').stratagems.find((x) => x.name === 'Swift Dismemberment');
  expect(s).toMatchObject({ group: 'Annihilation Legion', kind: 'Battle Tactic', cp: '1' });
});

test('Necrons: exactly one Resurrection Protocols, an epic deed', () => {
  const found = catalogue('necrons').stratagems.filter((x) => x.name === 'Resurrection Protocols');
  expect(found).toHaveLength(1);
  expect(found[0].kind).toBe('Epic Deed');
});

test('Necrons: every stratagem has text and at least one phase', () => {
  const necrons = catalogue('necrons').stratagems;
  expect(necrons.length).toBeGreaterThan(40);
  for (const s of necrons) expect(s.text.trim().length, s.name).toBeGreaterThan(0);
  expect(necrons.filter((s) => s.phases.length === 0).map((s) => s.name)).toEqual([]);
});

test('every matched-play stratagem of a mapped faction appears in a catalogue', () => {
  const mapped = new Set(overrides.stratagemFactions.map((e) => e.factionId));
  const excluded = new Set(overrides.excludedStratagems.map((e) => e.id));
  const listed = new Set(catalogues().flatMap((c) => c.stratagems.map((s) => s.id)));
  const missing = w.stratagems
    .filter((r) => mapped.has(r.faction_id) && !excluded.has(r.id) && matchedPlay(r) && !listed.has(r.id))
    .map((r) => `${r.faction_id}/${r.subfaction_id || '-'} ${r.name} (${r.type})`);
  expect(missing).toEqual([]);
});

test('stratagem overrides naming an unknown catalogue or id throw', () => {
  const playable = new Set(index.catalogues.filter((c) => !c.library).map((c) => c.name));
  expect(() => validateStratagemOverrides(w, overrides, playable)).not.toThrow();
  const bad = (patch: Partial<Overrides>) => () => validateStratagemOverrides(w, { ...overrides, ...patch }, playable);
  const [first, ...rest] = overrides.stratagemFactions;
  expect(bad({ stratagemFactions: [{ ...first, catalogueName: 'Nope' }, ...rest] })).toThrow(/unknown catalogue "Nope"/);
  expect(bad({ stratagemFactions: [{ ...first, factionId: 'XX' }, ...rest] })).toThrow(/unknown faction "XX"/);
  expect(bad({ stratagemFactions: [{ ...first, subfactions: ['CHXX'] }, ...rest] })).toThrow(/CHXX/);
  expect(bad({ stratagemFactions: rest })).toThrow(/no stratagem-factions entry/);
  expect(bad({ excludedStratagems: [{ id: '000000000000', name: 'X', reason: 'x', source: 'x' }] })).toThrow(/unknown stratagem "000000000000"/);
  expect(bad({ coreStratagems: [{ id: '000002134002', name: 'Wrong Name', source: 'x' }] })).toThrow(/Wrong Name/);
});
