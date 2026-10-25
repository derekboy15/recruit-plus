import { test, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAll, validateStratagemOverrides } from '../src/build';
import { selectStratagems } from '../src/extract/stratagems';
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
const matchedPlay = (r: Row) => r.is_boarding_action !== 'true' && !/Boarding Action|Crusade/.test(r.type);

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

test('Wahapedia text is read as UTF-8: the T’au group keeps its curly apostrophe and nothing holds U+FFFD', () => {
  // Wahapedia writes "T’au" (U+2019) where BSData writes "T'au"; the CSV is UTF-8 with a BOM.
  expect(new Set(catalogue('tau-empire').stratagems.map((s) => s.group))).toContain('T’au Empire');
  expect(w.stratagems.filter((r) => Object.values(r).some((v) => v.includes('�'))).map((r) => r.name)).toEqual([]);
  const garbled = catalogues().flatMap((c) => c.stratagems).filter((s) => `${s.group}|${s.name}`.includes('�'));
  expect(garbled.map((s) => `${s.group}: ${s.name}`)).toEqual([]);
});

test('no boarding or crusade stratagems in any catalogue', () => {
  const byId = new Map(w.stratagems.map((r) => [r.id, r]));
  for (const c of catalogues()) {
    for (const s of c.stratagems) {
      const row = byId.get(s.id)!;
      expect(row, `${c.name}: ${s.name}`).toBeDefined();
      expect(matchedPlay(row), `${c.name}: ${s.name} (${row.type})`).toBe(true);
      expect(s.kind, `${c.name}: ${s.name}`).not.toMatch(/Boarding|Crusade/);
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

test('stratagem overrides naming an unknown catalogue, id, subfaction or group throw', () => {
  const playable = new Set(index.catalogues.filter((c) => !c.library).map((c) => c.name));
  expect(() => validateStratagemOverrides(w, overrides, playable)).not.toThrow();
  const bad = (patch: Partial<Overrides>) => () => validateStratagemOverrides(w, { ...overrides, ...patch }, playable);
  const [first, ...rest] = overrides.stratagemFactions;
  expect(bad({ stratagemFactions: [{ ...first, catalogueName: 'Nope' }, ...rest] })).toThrow(/unknown catalogue "Nope"/);
  expect(bad({ stratagemFactions: [{ ...first, factionId: 'XX' }, ...rest] })).toThrow(/unknown faction "XX"/);
  expect(bad({ stratagemFactions: [{ ...first, subfactions: ['CHXX'] }, ...rest] })).toThrow(/CHXX/);
  expect(bad({ stratagemFactions: [{ ...first, groups: ['No Such Group'] }, ...rest] })).toThrow(/unknown group "No Such Group"/);
  expect(bad({ stratagemFactions: [{ ...first, ids: ['000002134002'] }, ...rest] })).toThrow(/does not otherwise list stratagem "000002134002"/);
  expect(bad({ stratagemFactions: rest })).toThrow(/no stratagem-factions entry/);
  expect(bad({ excludedStratagems: [{ id: '000000000000', name: 'X', reason: 'x', source: 'x' }] })).toThrow(/unknown stratagem "000000000000"/);
  expect(bad({ coreStratagems: [{ id: '000002134002', name: 'Wrong Name', source: 'x' }] })).toThrow(/Wrong Name/);
  const details = overrides.stratagemDetails.filter((d) => d.id !== '000003187002');
  const swordBrethren = { id: '000003187002', name: 'Sword Brethren', group: 'Sword Brethren (Specialist Detachment)', source: 'x' };
  expect(bad({ stratagemDetails: [...details, { ...swordBrethren, subfactionId: 'LGBL' }] })).toThrow(/LGBL/);
  expect(bad({ stratagemDetails: [...details, { ...swordBrethren, group: undefined }] })).toThrow(/neither group nor subfactionId/);
});

test('an ids allow-list keeps only those stratagems', () => {
  const necrons = overrides.stratagemFactions.find((e) => e.catalogueName === 'Necrons')!;
  const all = selectStratagems(w, necrons, new Set(), overrides.stratagemDetails);
  const keep = [all[3].id, all[0].id];
  expect(selectStratagems(w, { ...necrons, ids: keep }, new Set(), overrides.stratagemDetails).map((s) => s.id).sort()).toEqual([...keep].sort());
});

const names = (slug: string) => catalogue(slug).stratagems.map((s) => s.name);
const groups = (slug: string) => [...new Set(catalogue(slug).stratagems.map((s) => s.group))].sort();

test('Agents of the Imperium has no matched-play stratagems', () => {
  expect(catalogue('imperium-agents-of-the-imperium').stratagems).toEqual([]);
});

test('Specialist Detachment stratagems are grouped under their detachment', () => {
  const csm = catalogue('chaos-chaos-space-marines').stratagems;
  const bringers = csm.filter((s) => s.group === 'Bringers of Despair (Specialist Detachment)').map((s) => s.name).sort();
  expect(bringers).toEqual(['Bringers of Despair', 'Brutal Subjugation', 'Chosen Enforcers']);
  expect(csm.find((s) => s.name === 'Bringers of Despair' && s.group === 'Black Legion')).toBeDefined();
  const swift = catalogue('imperium-adeptus-astartes-dark-angels').stratagems.filter((s) => s.name === 'Swift Strike');
  expect(swift.map((s) => s.group).sort()).toEqual(['Dark Angels', 'Ravenwing Attack Squadron (Specialist Detachment)']);
  // Every stratagem from the Vigilus books belongs to a Specialist Detachment; none is left under a bare label.
  const vigilus = new Set(w.stratagems.filter((r) => r.source_id === '000000051' || r.source_id === '000000060').map((r) => r.id));
  for (const c of catalogues()) {
    for (const s of c.stratagems) {
      expect(s.group, `${c.name}: ${s.name}`).not.toBe('Specialist Detachment');
      if (vigilus.has(s.id)) expect(s.group, `${c.name}: ${s.name}`).toMatch(/ \(Specialist Detachment\)$/);
    }
  }
});

test("chapter catalogues don't list other chapters' stratagems", () => {
  const ba = names('imperium-adeptus-astartes-blood-angels');
  for (const n of ['Sword Brethren', 'Victrix Guard', 'Stalker Pack', 'Crimson Fists Liberator Strike Force', 'Attack Squadron', 'Uphold the Honour of the Emperor', 'Specialism Extremis']) {
    expect(ba, n).not.toContain(n);
  }
  expect(names('imperium-adeptus-astartes-black-templars')).toContain('Sword Brethren');
  expect(names('imperium-adeptus-astartes-ultramarines')).toContain('Victrix Guard');
  // Kill Team Strike Force is the Deathwatch Army of Renown; Vanguard Spearhead excludes DEATHWATCH.
  const withKillTeam = catalogues().filter((c) => c.stratagems.some((s) => s.group === 'Kill Team Strike Force')).map((c) => c.name);
  expect(withKillTeam).toEqual(['Imperium - Adeptus Astartes - Deathwatch']);
  expect(groups('imperium-adeptus-astartes-deathwatch')).not.toContain('Vanguard Spearhead');
});

test('Harlequins list no craftworld stratagems; Craftworlds list the Harlequins ones', () => {
  const hq = groups('aeldari-harlequins');
  expect(hq.filter((g) => /Alaitoc|Biel-Tan|Iyanden|Saim-Hann|Ulthwé|Altansar|Ynnari|Windrider|Wraith/.test(g))).toEqual([]);
  expect(hq).toContain('Aeldari (Harlequins)');
  expect(groups('aeldari-craftworlds')).toEqual(expect.arrayContaining(['Aeldari (Alaitoc)', 'Aeldari (Harlequins)', 'Ynnari']));
});

test('catalogues limited to some groups list exactly those', () => {
  for (const e of overrides.stratagemFactions.filter((x) => x.groups)) {
    const slug = index.catalogues.find((c) => c.name === e.catalogueName)!.slug;
    expect(groups(slug), e.catalogueName).toEqual([...e.groups!].sort());
  }
  expect(groups('fallen')).toEqual(['Fallen Angels', 'Fallen Angels (Specialist Detachment)']);
  expect(groups('imperium-legion-of-the-damned')).toEqual(['Adeptus Astartes']);
});

test('an "X Stratagem" type that names no kind is group X, kind Stratagem', () => {
  expect(catalogue('imperium-adeptus-astartes-ultramarines').stratagems.find((s) => s.name === 'Chief Librarian')).toMatchObject({
    group: 'Blood Ravens',
    kind: 'Stratagem',
  });
  const gellerpox = catalogue('chaos-death-guard').stratagems.filter((s) => s.group === 'Gellerpox Infected');
  expect(gellerpox).toHaveLength(8);
  for (const s of gellerpox) expect(s.kind).toBe('Stratagem');
});

test('matched-play Requisition stratagems are kept', () => {
  expect(catalogue('imperium-adeptus-astartes-dark-angels').stratagems.find((s) => s.name === 'Honoured by the Rock')).toMatchObject({
    group: 'Dark Angels',
    kind: 'Requisition',
  });
  // Successor-chapter relic requisitions stay with their parent chapter; Kill Team Strike Force's stays with Deathwatch.
  expect(names('imperium-adeptus-astartes-ultramarines')).toContain('Honoured by Macragge');
  const ba = names('imperium-adeptus-astartes-blood-angels');
  for (const n of ['Honoured by Macragge', 'Gift of the Khans', 'Bequeathed by the Iron Council', 'Honoured Veteran of the Watch']) expect(ba, n).not.toContain(n);
  expect(catalogue('fallen').stratagems.find((s) => s.name === 'Fallen Angels')).toMatchObject({
    group: 'Fallen Angels (Specialist Detachment)',
    kind: 'Requisition',
  });
});
