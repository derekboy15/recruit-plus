import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { toDatasheet, type AdapterIssue } from '../../src/data/adapter';
import { realCatalogues, realUnit } from '../helpers/realData';

const BASELINE = join(import.meta.dirname, 'adapter-baseline.json');
const mm = (v: number) => v / 25.4;
const sheetOf = (cat: string, name: string) => {
  const { unit, catalogueName } = realUnit(cat, name);
  return toDatasheet(unit, catalogueName);
};

describe('toDatasheet on real units', () => {
  test('Necron Warriors', () => {
    const { datasheet: ds, issues } = sheetOf('Necrons', 'Necron Warriors');
    expect(issues).toEqual([]);
    expect(ds.models[0].chars).toMatchObject({ M: { kind: 'fixed', inches: 5 }, WS: 3, BS: 3, S: 4, T: 4, W: 1, Ld: 10, Sv: 4, invuln: null });
    expect(ds.weapons.find((w) => w.name === 'Gauss Flayer')).toMatchObject({ type: 'Rapid Fire', range: 24, s: { kind: 'fixed', v: 4 }, ap: -1 });
    expect(ds.objectiveSecured).toBe(true);
    expect(ds.keywords).toContain('INFANTRY');
    expect(ds.base).toEqual({ kind: 'circle', d: mm(32) });
    expect(ds.role).toBe('Troops');
  });

  test('Monolith: degrading profile from its bracket profiles', () => {
    const { datasheet: ds } = sheetOf('Necrons', 'Monolith');
    expect(ds.models).toHaveLength(1);
    const m = ds.models[0];
    expect(m.name).toBe('Monolith');
    expect(m.chars.W).toBe(24);
    expect(m.brackets.map((b) => [b.minW, b.maxW, b.chars.BS])).toEqual([
      [13, 24, 3],
      [7, 12, 4],
      [1, 6, 5],
    ]);
    expect(m.brackets.map((b) => b.chars.A)).toEqual([
      { n: 0, sides: 6, plus: 6 },
      { n: 1, sides: 6, plus: 0 },
      { n: 1, sides: 3, plus: 0 },
    ]);
    expect(ds.weapons.find((w) => w.name === 'Particle Whip')).toMatchObject({ type: 'Heavy', shots: { n: 1, sides: 6, plus: 0 }, blast: true });
    expect(ds.weapons.find((w) => w.name === 'Portal of Exile')).toMatchObject({ type: 'Melee', autoHit: true });
    expect(ds.keywords).toEqual(expect.arrayContaining(['TITANIC', 'VEHICLE']));
  });

  test('a woundTrack table fills the starred characteristics', () => {
    const cat = realCatalogues().flatMap((c) => c.units.map((u) => ({ u, c: c.name }))).find(({ u }) => u.woundTrack.length && u.models.some((m) => m.chars.BS === '*'))!;
    const { datasheet: ds } = toDatasheet(cat.u, cat.c);
    const starred = ds.models.find((m) => m.brackets.length)!;
    expect(starred.brackets.length).toBeGreaterThanOrEqual(3);
    expect(starred.chars.BS).toBe(starred.brackets[0].chars.BS);
    expect(starred.brackets[starred.brackets.length - 1].minW).toBe(1);
  });

  test('[R-21] a Daemonic Save: a melee and a ranged value instead of a Save', () => {
    const { datasheet: ds, issues } = sheetOf('Chaos - Daemons', 'Bloodletters');
    expect(ds.models[0].chars.Sv).toBeNull();
    expect(ds.models[0].chars.daemonicSave).toEqual({ melee: 5, ranged: 4 });
    expect(issues.filter((i) => i.kind === 'unparsed-char')).toEqual([]);
  });

  test('bracket profile names with typos still merge', () => {
    const { datasheet: ds } = sheetOf('Imperium - Adeptus Astartes - Black Templars', 'Gladiator Lancer');
    expect(ds.models).toHaveLength(1);
    expect(ds.models[0].brackets.map((b) => [b.minW, b.maxW])).toEqual([
      [7, 12],
      [4, 6],
      [1, 3],
    ]);
    const { datasheet: bel } = sheetOf('Chaos - Daemons', "Be'lakor");
    expect(bel.models.map((m) => m.name)).toEqual(["Be'lakor"]);
    const kratos = realCatalogues().flatMap((c) => c.units.map((u) => ({ u, c: c.name }))).find(({ u }) => u.name === 'Kratos')!;
    expect(toDatasheet(kratos.u, kratos.c).datasheet.models.map((m) => [m.name, m.brackets.length])).toEqual([['Kratos', 3]]);
  });

  test('a Knight counts as 10 models on objectives', () => {
    expect(sheetOf('Imperium - Imperial Knights', 'Knight Paladin').datasheet.ocPerModel).toBe(10);
    expect(sheetOf('Imperium - Imperial Knights', 'Armiger Helverins').datasheet.ocPerModel).toBe(5);
    expect(sheetOf('Necrons', 'Monolith').datasheet.ocPerModel).toBe(1);
  });

  test('psykers know Smite once, plus their datasheet powers', () => {
    const cat = realCatalogues().find((c) => c.name === 'Aeldari - Craftworlds')!;
    const farseer = cat.units.find((u) => u.name === 'Farseer')!;
    const { datasheet: ds } = toDatasheet(farseer, cat.name);
    expect(ds.psyker).toMatchObject({ cast: 2, deny: 2 });
    expect(ds.psyker!.powers.filter((p) => p.smite)).toEqual([{ name: 'Smite', wc: 5, smite: true }]);
  });

  test('transport capacity', () => {
    const cat = realCatalogues().find((c) => c.name === 'Imperium - Adeptus Astartes - Black Templars')!;
    const rhino = cat.units.find((u) => u.name === 'Rhino')!;
    expect(toDatasheet(rhino, cat.name).datasheet.transportCapacity).toBe(10);
  });

  test('every unit in every catalogue converts, and issues stay within the baseline', () => {
    const counts: Record<string, number> = {};
    const examples: Record<string, string[]> = {};
    let units = 0;
    for (const c of realCatalogues())
      for (const u of c.units) {
        units++;
        const { datasheet, issues } = toDatasheet(u, c.name);
        expect(datasheet.models.length + issues.filter((i) => i.kind === 'no-models').length).toBeGreaterThan(0);
        for (const i of issues as AdapterIssue[]) {
          counts[i.kind] = (counts[i.kind] ?? 0) + 1;
          (examples[i.kind] ??= []).length < 5 && examples[i.kind].push(`${c.name}: ${u.name}: ${i.detail}`);
        }
      }
    expect(units).toBeGreaterThan(3500);
    if (!existsSync(BASELINE)) writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    for (const [kind, n] of Object.entries(counts)) expect({ kind, n, examples: examples[kind] }).toMatchObject({ kind, n: expect.toSatisfy((v: number) => v <= (baseline[kind] ?? 0)) });
  });
});
