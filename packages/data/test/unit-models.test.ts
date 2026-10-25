/**
 * Plan H: each unit keeps its kinds of model (spec §3, §7a): which stat line each uses, how many the unit has as the
 * list editor adds it, and which are optional extras ("Can also take"). Reads generated/ (npm run data:build).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { buildIdIndex, catalogueScope, loadGameData } from '../src/bsdata/gamedata';
import type { RawNode } from '../src/bsdata/types';
import type { CatalogueOut, DataIndex, ModelKindOut, UnitOut } from '../src/model/types';

const GENERATED = join(__dirname, '..', 'generated');
const index: DataIndex = JSON.parse(readFileSync(join(GENERATED, 'index.json'), 'utf8'));
const catalogue = (slug: string): CatalogueOut => JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`), 'utf8'));
const unit = (slug: string, name: string): UnitOut => {
  const u = catalogue(slug).units.find((x) => x.name === name);
  if (!u) throw new Error(`${slug} has no unit "${name}"`);
  return u;
};
/** Default models per stat line, optional extras left out: { "Veteran": 4 }. */
const defaults = (u: UnitOut) => {
  const out: Record<string, number> = {};
  for (const k of u.modelKinds ?? []) if (!k.optional && k.defaultCount) out[u.models[k.profile]?.name ?? k.name] = (out[u.models[k.profile]?.name ?? k.name] ?? 0) + k.defaultCount;
  return out;
};

describe('Cadian Command Squad', () => {
  const u = unit('imperium-astra-militarum', 'Cadian Command Squad');

  test('5 models: a Commander and four Veterans, the Veterans counted although they sit in a squad of their own', () => {
    expect(u.minModels).toBe(5);
    expect(defaults(u)).toEqual({ 'Cadian Commander': 1, Veteran: 4 });
    const veterans = (u.modelKinds ?? []).filter((k) => k.defaultCount && u.models[k.profile]?.name === 'Veteran').map((k) => k.name);
    expect(veterans.sort()).toEqual([
      'Cadian Veteran w/ Master-Vox',
      'Cadian Veteran w/ Medi-pack',
      'Cadian Veteran w/ Regimental Standard',
      'Cadian Veteran w/ chainsword',
    ]);
  });

  test('the attachés are optional extras, none in the squad as added', () => {
    const optional = (u.modelKinds ?? []).filter((k) => k.optional);
    expect(optional.map((k) => k.name).sort()).toEqual(['Astropath', 'Master of Ordnance', 'Nork Deddog', 'Officer of the Fleet', 'Ogryn Bodyguard']);
    expect(optional.every((k) => k.defaultCount === 0)).toBe(true);
  });

  test('each kind names the BSData entry that selects it', () => {
    const commander = (u.modelKinds ?? []).find((k) => k.name === 'Cadian Commander')!;
    expect(commander.entryIds).toContain('02fc-c1cf-4cdb-07ed');
  });
});

test('Necron Warriors: 10 Warriors as added, 10 to 20', () => {
  const u = unit('necrons', 'Necron Warriors');
  expect([u.minModels, u.maxModels]).toEqual([10, 20]);
  expect(defaults(u)).toEqual({ 'Necron Warrior': 10 });
});

test('Intercessor Squad: a Sergeant and four Intercessors as added', () => {
  expect(defaults(unit('imperium-adeptus-astartes-ultramarines', 'Intercessor Squad'))).toEqual({ 'Intercessor Sergeant': 1, Intercessor: 4 });
});

test('Tempestus and Platoon Command Squads keep their 5 models', () => {
  for (const name of ['Militarum Tempestus Command Squad', 'Platoon Command Squad']) {
    const u = unit('imperium-astra-militarum', name);
    expect([u.minModels, u.maxModels], name).toEqual([5, 5]);
  }
});

/** Units the list editor adds short, leaving the player to pick models from several loadouts (no default to fill with). */
const ADDED_SHORT = new Set(['Fallen', 'Rough Riders [Legends]', 'Kroot Farstalkers']);

test('a unit added short has no optional extras: its other models are choices (Kroot Farstalkers)', () => {
  const u = unit('tau-empire', 'Kroot Farstalkers');
  expect((u.modelKinds ?? []).filter((k) => k.optional)).toEqual([]);
});

describe('every playable unit', () => {
  for (const c of index.catalogues.filter((x) => !x.library)) {
    test(`${c.slug}: model kinds point at real stat lines, and the unit as added fits its model count`, () => {
      const problems: string[] = [];
      for (const u of catalogue(c.slug).units) {
        for (const k of u.modelKinds ?? []) if (k.profile < -1 || k.profile >= u.models.length) problems.push(`${u.name}: ${k.name} profile ${k.profile}`);
        const added = (u.modelKinds ?? []).filter((k) => !k.optional).reduce((n, k) => n + k.defaultCount, 0);
        if (added && u.minModels !== null && u.maxModels !== null && ((added < u.minModels && !ADDED_SHORT.has(u.name)) || added > u.maxModels)) problems.push(`${u.name}: ${added} as added, ${u.minModels}–${u.maxModels}`);
      }
      expect(problems).toEqual([]);
    });
  }
});

// ---------- Task 2: what each model carries ----------

const kind = (u: UnitOut, name: string): ModelKindOut => {
  const k = (u.modelKinds ?? []).find((x) => x.name === name);
  if (!k) throw new Error(`${u.name} has no model "${name}"`);
  return k;
};
const weaponNames = (u: UnitOut, k: ModelKindOut) => k.weapons.map((i) => u.weapons[i].name);
const abilityNames = (u: UnitOut, idx: number[]) => idx.map((i) => u.abilities[i].name);

describe('what each model carries: the Cadian Command Squad', () => {
  const u = unit('imperium-astra-militarum', 'Cadian Command Squad');

  test('the Commander: laspistol, chainsword, frag grenades', () => {
    const w = weaponNames(u, kind(u, 'Cadian Commander'));
    expect(w).toEqual(expect.arrayContaining(['Laspistol', 'Chainsword', 'Frag grenades']));
    expect(w).not.toContain('Lasgun');
  });

  test('each Veteran carries their own kit, and the gear that grants an ability brings it', () => {
    const medic = kind(u, 'Cadian Veteran w/ Medi-pack');
    expect(weaponNames(u, medic)).toEqual(expect.arrayContaining(['Lasgun', 'Frag grenades']));
    expect(weaponNames(u, medic)).not.toContain('Laspistol');
    expect(abilityNames(u, medic.abilities)).toContain('Medi-pack');
    const vox = kind(u, 'Cadian Veteran w/ Master-Vox');
    expect(weaponNames(u, vox)).toEqual(expect.arrayContaining(['Laspistol', 'Frag grenades']));
    expect(abilityNames(u, vox.abilities)).toContain('Master Vox');
    expect(abilityNames(u, kind(u, 'Cadian Veteran w/ Regimental Standard').abilities)).toContain('Regimental Standard');
    // A second "Frag grenades" entry (a different BSData id) still reaches this Veteran (Review Focus 2).
    expect(weaponNames(u, kind(u, 'Cadian Veteran w/ chainsword'))).toEqual(expect.arrayContaining(['Laspistol', 'Chainsword', 'Frag grenades']));
  });

  test('rules for the whole unit sit on the unit; a rule the tree puts on a model stays with it', () => {
    expect(abilityNames(u, u.unitGear?.abilities ?? [])).toContain('Regimental Tactics');
    for (const k of u.modelKinds ?? []) expect(abilityNames(u, k.abilities), k.name).not.toContain('Regimental Tactics');
    // BattleScribe links Voice of Command and Refractor Field from the Commander's entry.
    expect(abilityNames(u, kind(u, 'Cadian Commander').abilities)).toEqual(expect.arrayContaining(['Voice of Command', 'Refractor Field']));
  });

  test('every model is in the entry map, by its target id', () => {
    for (const k of u.modelKinds ?? []) expect(k.entryIds.some((id) => u.entries?.[id]), k.name).toBe(true);
  });
});

test('a loadout variant with no stat line of its own is not an extra (Traitor Guardsman w/ plasma gun)', () => {
  const u = unit('chaos-chaos-space-marines', 'Traitor Guardsman Squad');
  expect((u.modelKinds ?? []).filter((k) => k.optional).map((k) => k.name)).toEqual([]);
});

test('a single model stored as an upgrade is one model kind with its weapons (Chaos Warlord Titan, Vashtorr)', () => {
  const titan = unit('chaos-chaos-titan-legions', 'Chaos Warlord Titan');
  expect(titan.modelKinds).toHaveLength(1);
  expect(titan.modelKinds![0].defaultCount).toBe(1);
  expect(weaponNames(titan, titan.modelKinds![0]).length).toBeGreaterThan(0);
  expect(unit('chaos-chaos-space-marines', 'Vashtorr the Arkifane').modelKinds).toHaveLength(1);
});

test('a unit with no model entries keeps its gear on the unit (Medusa Carriage Battery)', () => {
  const u = unit('chaos-renegades-heretics-legends', 'Medusa Carriage Battery');
  expect(u.modelKinds).toBeUndefined();
  expect((u.unitGear?.weapons ?? []).length).toBeGreaterThan(0);
});

describe('attribution comes from the tree (spec §4.1, §7a)', () => {
  const gd = loadGameData(join(__dirname, '..', 'raw', 'bsdata'));
  const kidsOf = (n: RawNode) =>
    n.children.filter((c) => ['selectionEntries', 'selectionEntryGroups', 'entryLinks', 'infoLinks'].includes(c.tag)).flatMap((c) => c.children);
  for (const c of index.catalogues.filter((x) => !x.library)) {
    test(`${c.slug}: each weapon and ability shown against a model is reachable from that model's entry`, () => {
      const idx = buildIdIndex(catalogueScope(gd, c.id));
      const problems: string[] = [];
      for (const u of catalogue(c.slug).units) {
        for (const k of u.modelKinds ?? []) {
          // Every entry below the model (and the unit, for a single model), following links.
          const reach = new Set<string>();
          const walk = (n: RawNode | undefined) => {
            if (!n?.attrs.id || reach.has(n.attrs.id)) return;
            reach.add(n.attrs.id);
            for (const ch of kidsOf(n)) {
              if (!ch.attrs.targetId) walk(ch);
              else {
                reach.add(ch.attrs.id);
                walk(idx.get(ch.attrs.targetId));
              }
            }
          };
          k.entryIds.forEach((id) => walk(idx.get(id)));
          const fromReach = (key: 'w' | 'a') => new Set([...reach].flatMap((id) => u.entries?.[id]?.[key] ?? []));
          const w = fromReach('w');
          const a = fromReach('a');
          for (const i of k.weapons) if (!w.has(i) && !(u.everyone ?? []).includes(i)) problems.push(`${u.name}: ${k.name} weapon ${u.weapons[i]?.name}`);
          for (const i of k.abilities) if (!a.has(i)) problems.push(`${u.name}: ${k.name} ability ${u.abilities[i]?.name}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});

// Per-model data costs about 40% (Space Wolves 146 → 209 kB gzip of its 300 kB budget): the entry map that joins a list's
// selections to their gear 34 kB, options 17 kB, model kinds 11 kB. This guards against more.
test('no catalogue grows by more than 45% (plan H size ceiling)', () => {
  const before: Record<string, number> = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'catalogue-gzip-before-plan-h.json'), 'utf8'));
  const over: string[] = [];
  for (const [slug, size] of Object.entries(before)) {
    const now = gzipSync(readFileSync(join(GENERATED, 'catalogues', `${slug}.json`)), { level: 9 }).length;
    if (now > size * 1.45) over.push(`${slug}: ${size} → ${now}`);
  }
  expect(over).toEqual([]);
});

// ---------- Task 3: the unit's options ----------

describe('options: swaps and additions, and who can take them', () => {
  const choiceNames = (o: { choices: { name: string }[] }) => o.choices.map((c) => c.name);

  test('the Command Squad can add attachés: one option on the unit whose choices add models', () => {
    const u = unit('imperium-astra-militarum', 'Cadian Command Squad');
    const att = (u.options ?? []).find((o) => ['Astropath', 'Master of Ordnance'].every((n) => choiceNames(o).includes(n)));
    expect(att, JSON.stringify((u.options ?? []).map((o) => o.name))).toBeDefined();
    expect(att!.who).toEqual([]);
    expect(choiceNames(att!)).toEqual(expect.arrayContaining(['Astropath', 'Master of Ordnance', 'Officer of the Fleet', 'Ogryn Bodyguard', 'Nork Deddog']));
    expect(att!.choices.every((c) => (c.models ?? []).length === 1)).toBe(true);
  });

  test("a Shock Trooper with a special weapon chooses it: the option belongs to that model", () => {
    const u = unit('imperium-astra-militarum', 'Cadian Shock Troops');
    const sp = (u.options ?? []).find((o) => choiceNames(o).includes('Meltagun'));
    expect(sp).toBeDefined();
    expect(sp!.who).toEqual(['Shock Trooper w/ Special Weapon']);
    expect(choiceNames(sp!)).toEqual(expect.arrayContaining(['Meltagun', 'Plasma gun', 'Flamer']));
  });

  test('the Commander can swap a pistol: the option says what it replaces', () => {
    const u = unit('imperium-astra-militarum', 'Cadian Command Squad');
    const pistols = (u.options ?? []).find((o) => o.who.includes('Cadian Commander') && choiceNames(o).includes('Plasma pistol'));
    expect(pistols).toBeDefined();
    expect((pistols!.replaces ?? []).map((i) => u.weapons[i].name)).toEqual(['Laspistol']);
  });

  test('a single model with no choices has no options; relics and Warlord traits are never options', () => {
    for (const o of unit('necrons', 'Necron Warriors').options ?? []) expect(choiceNames(o).some((n) => /relic|warlord/i.test(n)), o.name).toBe(false);
  });

  for (const c of index.catalogues.filter((x) => !x.library)) {
    test(`${c.slug}: every option's weapons and models are the unit's own`, () => {
      const problems: string[] = [];
      for (const u of catalogue(c.slug).units)
        for (const o of u.options ?? [])
          for (const ch of o.choices) {
            for (const i of ch.weapons) if (i < 0 || i >= u.weapons.length) problems.push(`${u.name}: ${o.name}: ${ch.name} weapon ${i}`);
            for (const i of ch.models ?? []) if (i < 0 || i >= (u.modelKinds ?? []).length) problems.push(`${u.name}: ${o.name}: ${ch.name} model ${i}`);
            if (!ch.weapons.length && !ch.abilities.length && !(ch.models ?? []).length) problems.push(`${u.name}: ${o.name}: ${ch.name} brings nothing`);
          }
      expect(problems).toEqual([]);
    });
  }
});
