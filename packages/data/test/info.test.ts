import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { loadGameData } from '../src/bsdata/gamedata';
import { attachInfoPlain, emitInfoFile, infoTextKeys } from '../src/info';
import type { DataIndex, InfoFile } from '../src/model/types';
import { textKey } from '../src/plain/collect';
import type { PlainStore } from '../src/plain/store';
import type { PlainReport } from '../src/plain/store';
import { buildScope, resolve } from '../src/roster/scope';
import type { RosterFile } from '../src/roster/types';

describe('info fixture', () => {
  const gd = loadGameData(join(__dirname, 'fixtures', 'info'));
  const faction = emitInfoFile(gd, gd.catalogues.get('cat-info')!, 'info-faction');
  const library = emitInfoFile(gd, gd.catalogues.get('cat-ilib')!, 'info-library');

  test('the file is keyed by entry id', () => {
    expect(faction).toMatchObject({ schema: 1, slug: 'info-faction' });
    expect(Object.keys(faction.entries).sort()).toEqual(['el-own', 'se-dyn', 'se-gun', 'se-trait', 'sg-traits']);
  });

  test('a rule in a linked library resolves, and a hidden rule or link is still read', () => {
    expect(faction.entries['se-trait'].rules).toEqual([{ name: 'Blood-Fuelled Fury', text: 'Add 1 to the Attacks characteristic of this model.' }]);
  });

  test('a profile in a linked library resolves', () => {
    expect(faction.entries['se-trait'].profiles).toEqual([
      { name: 'Indomitable', type: 'Abilities', chars: { Description: 'Each time an attack is allocated to a model in this unit, worsen the AP by 1.' } },
    ]);
  });

  test("an infoGroup's profiles and rules are flattened, nested groups included", () => {
    const dyn = faction.entries['se-dyn'];
    expect(dyn.profiles?.map((p) => p.name)).toEqual(['Awakened By Murder', 'Blood Rites']);
    expect(dyn.rules?.map((r) => r.name)).toEqual(['Blood-Fuelled Fury']);
  });

  test('a weapon keeps only its characteristics with text', () => {
    expect(faction.entries['se-gun'].profiles).toEqual([{ name: 'Gauss blaster', type: 'Weapon', chars: { Range: '24"', S: '5' } }]);
  });

  test("an entry link carries only its own info (its target's is under the target's id)", () => {
    expect(faction.entries['el-own']).toEqual({ rules: [{ name: 'Combi Weapon', text: 'When the bearer shoots with this weapon, choose one or both of the profiles below.' }] });
  });

  test('a group with its own rules is included', () => {
    expect(faction.entries['sg-traits'].rules?.[0].name).toBe('Traits');
  });

  test('units, models, links to them and entries without info are left out; an empty rule is dropped', () => {
    for (const id of ['se-unit', 'se-model', 'el-unit', 'se-nothing', 'el-relic', 'el-dyn', 'sg-shared', 'se-honour']) expect(faction.entries[id]).toBeUndefined();
    expect(faction.entries['se-trait'].rules?.some((r) => r.name === 'Empty')).toBe(false);
  });

  test("a library's own options are in its own file", () => {
    expect(Object.keys(library.entries)).toEqual(['se-lib-relic']);
    expect(library.entries['se-lib-relic'].profiles?.[0].chars.Description).toMatch(/5\+/);
  });

  test('the game system has its own file', () => {
    expect(emitInfoFile(gd, gd.system, 'system')).toEqual({ schema: 1, slug: 'system', entries: {} });
  });
});

describe('attachInfoPlain', () => {
  const RULE = 'Add 1 to charge rolls made for this unit.';
  const DESC = 'Each time an attack is allocated to a model in this unit, worsen the AP by 1.';
  const file = (): InfoFile => ({
    schema: 1,
    slug: 'necrons',
    entries: {
      a: { rules: [{ name: 'Awakened', text: RULE }] },
      b: { profiles: [{ name: 'Indomitable', type: 'Abilities', chars: { Description: DESC } }] },
      c: { profiles: [{ name: 'Gun', type: 'Weapon', chars: { Range: '24"', S: '5' } }] },
    },
  });
  const store = (entries: [string, string][]): PlainStore =>
    new Map(entries.map(([official, plain]) => [textKey(official), { name: 'x', kind: 'ability' as const, plain, shard: 'necrons' }]));

  test('plain English that passes the checks is attached to rules and profile text', () => {
    const f = file();
    const report = attachInfoPlain([f], store([[RULE, 'This unit adds 1 to its charge rolls.'], [DESC, 'Attacks on this unit get 1 worse AP.']]));
    expect(f.entries.a.rules?.[0].plain).toBe('This unit adds 1 to its charge rolls.');
    expect(f.entries.b.profiles?.[0].plain).toEqual({ Description: 'Attacks on this unit get 1 worse AP.' });
    expect(f.entries.c.profiles?.[0].plain).toBeUndefined();
    expect(report).toEqual({ total: 2, written: 2, missing: [] });
  });

  test('plain English that fails the checks is not attached and the text is reported missing', () => {
    const f = file();
    const report = attachInfoPlain([f], store([[RULE, 'This unit adds 2 to its charge rolls.']]));
    expect(f.entries.a.rules?.[0].plain).toBeUndefined();
    expect(report.total).toBe(2);
    expect(report.written).toBe(0);
    expect(report.missing).toEqual([
      { slug: 'necrons', entryId: 'a', name: 'Awakened', key: textKey(RULE) },
      { slug: 'necrons', entryId: 'b', name: 'Indomitable', key: textKey(DESC) },
    ]);
  });

  test('infoTextKeys gives the keys of the texts attachInfoPlain looks up', () => {
    expect([...infoTextKeys([file()])].sort()).toEqual([textKey(RULE), textKey(DESC)].sort());
  });

  test('the same text in many entries counts once', () => {
    const f = file();
    f.entries.d = { rules: [{ name: 'Awakened', text: RULE }] };
    const report = attachInfoPlain([f], store([[RULE, 'This unit adds 1 to its charge rolls.']]));
    expect(f.entries.d.rules?.[0].plain).toBe('This unit adds 1 to its charge rolls.');
    expect(report).toMatchObject({ total: 2, written: 1 });
  });
});

describe('generated info files', () => {
  const GEN = join(__dirname, '..', 'generated');
  const INFO = join(GEN, 'info');
  let index: DataIndex;
  const info = (slug: string): InfoFile => JSON.parse(readFileSync(join(INFO, `${slug}.json`), 'utf8'));
  const roster = (slug: string): RosterFile => JSON.parse(readFileSync(join(GEN, 'roster', `${slug}.json`), 'utf8'));

  beforeAll(() => {
    if (!existsSync(INFO)) throw new Error('Run npm run data:build first');
    index = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
  });

  test('there is one info file per roster file, the game system included', () => {
    const rosterSlugs = readdirSync(join(GEN, 'roster')).filter((f) => f !== 'policy.json');
    expect(readdirSync(INFO).sort()).toEqual(rosterSlugs.sort());
    expect(info('system').slug).toBe('system');
  });

  test('Novokh (Dynasty: Novokh, 9c06-82d0-11f1-04da) carries Awakened By Murder', () => {
    const novokh = info('necrons').entries['9c06-82d0-11f1-04da'];
    expect(novokh.profiles?.map((p) => p.name)).toContain('Awakened By Murder');
    expect(JSON.stringify(novokh)).toMatch(/charge roll/i);
  });

  test('Relic Gauss Blaster (3cfe-2ba4-da94-0050) has its weapon profile', () => {
    const w = info('necrons').entries['3cfe-2ba4-da94-0050'].profiles!.find((p) => p.type === 'Weapon')!;
    expect(w.chars).toMatchObject({ Range: expect.stringMatching(/"/), S: expect.any(String), AP: expect.any(String) });
  });

  test('a chapter relic reached through the Space Marines library resolves for Ultramarines', () => {
    const um = index.catalogues.find((c) => c.slug === 'imperium-adeptus-astartes-ultramarines')!;
    expect(um.rosterScope).toContain('imperium-space-marines');
    const scope = buildScope(um.rosterScope.map(roster));
    const entries = Object.assign({}, ...um.rosterScope.map((s) => info(s).entries));
    // Codex Relics (a Space Marines library group the Ultramarines link to) holds a link to The Shield Eternal.
    const link = scope.node('4dff-baa9-6a16-bb97')!;
    const target = resolve(scope, link).target;
    expect(target.id).toBe('1c07-cb29-d498-1472');
    expect(entries[target.id].profiles?.[0].chars.Description).toMatch(/wound is not lost/);
  });

  test('an Ultramarines option whose infoLinks are in the Space Marines library resolves', () => {
    // Tome Keepers (an Ultramarines successor chapter) links to Space Marines library profiles.
    const tk = info('imperium-adeptus-astartes-ultramarines').entries['5799-9802-635e-a641'];
    expect(tk.profiles?.map((p) => p.name)).toEqual(expect.arrayContaining(['Indomitable', 'Bolter Fusillades']));
  });

  test('no unit or model entries, or links to them, are included', () => {
    const scopes: [string, string[]][] = [...index.catalogues.map((c) => [c.slug, c.rosterScope] as [string, string[]]), ['system', ['system']]];
    for (const [slug, rosterScope] of scopes) {
      const scope = buildScope(rosterScope.map(roster));
      const own = new Set<string>();
      const visit = (n: RosterFile['shared'][number]) => {
        own.add(n.id);
        n.children?.forEach(visit);
      };
      const r = roster(slug);
      [...r.rootEntries, ...r.shared].forEach(visit);
      for (const id of Object.keys(info(slug).entries)) {
        expect(own.has(id), `${slug} ${id} is in the file`).toBe(true);
        expect(resolve(scope, scope.node(id)!).type ?? 'group', `${slug} ${id}`).not.toMatch(/^(unit|model)$/);
      }
    }
  });

  test('every info file is within 150 kB gzip', () => {
    for (const f of readdirSync(INFO)) expect(gzipSync(readFileSync(join(INFO, f))).length, f).toBeLessThanOrEqual(150_000);
  });

  test('info texts are not part of plain-English coverage', () => {
    const report: PlainReport = JSON.parse(readFileSync(join(GEN, 'plain-report.json'), 'utf8'));
    const totals = Object.values(report.shards).reduce((a, r) => ({ total: a.total + r.total, written: a.written + r.written }), { total: 0, written: 0 });
    // 5034 before info files existed; 4742 once relics and other list-building options left the datasheets' own texts
    // (Task 4: their texts are option texts, in the info files, and keep their plain English there). Info files add none.
    expect(totals).toEqual({ total: 4742, written: 4742 });
    const infoReport = JSON.parse(readFileSync(join(GEN, 'info-plain-report.json'), 'utf8'));
    expect(infoReport).toMatchObject({ total: expect.any(Number), written: expect.any(Number), missing: expect.any(Array) });
  });
});
