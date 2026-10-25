/**
 * Plan H: each unit keeps its kinds of model (spec §3, §7a): which stat line each uses, how many the unit has as the
 * list editor adds it, and which are optional extras ("Can also take"). Reads generated/ (npm run data:build).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { CatalogueOut, DataIndex, UnitOut } from '../src/model/types';

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
