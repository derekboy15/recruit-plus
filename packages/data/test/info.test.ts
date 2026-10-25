import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { loadGameData } from '../src/bsdata/gamedata';
import { attachInfoPlain, emitInfoFile, infoTextKeys, type TierOf } from '../src/info';
import type { DataIndex, InfoFile } from '../src/model/types';
import { textKey } from '../src/plain/collect';
import type { CoverageReport, PlainStore } from '../src/plain/store';
import { buildScope, resolve } from '../src/roster/scope';
import type { RosterFile } from '../src/roster/types';

describe('info fixture', () => {
  const gd = loadGameData(join(__dirname, 'fixtures', 'info'));
  const faction = emitInfoFile(gd, gd.catalogues.get('cat-info')!, 'info-faction');
  const library = emitInfoFile(gd, gd.catalogues.get('cat-ilib')!, 'info-library');

  test('the file is keyed by entry id', () => {
    expect(faction).toMatchObject({ schema: 1, slug: 'info-faction' });
    expect(Object.keys(faction.entries).sort()).toEqual(['el-lib-marker', 'el-own', 'se-base', 'se-dyn', 'se-gun', 'se-marker', 'se-other', 'se-own', 'se-trait', 'sg-traits']);
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

  // Plan F2: an option with no text of its own takes what its selection reveals (hidden while its count is 0).
  const names = (id: string) => [...(faction.entries[id]?.profiles ?? []), ...(faction.entries[id]?.rules ?? [])].map((x) => x.name);

  test('a marker option takes the weapon profile its selection reveals', () => {
    expect(names('se-marker')).toContain('Marker gun');
  });

  test('the profile a relic hides is not attached to it', () => {
    expect(names('se-marker')).not.toContain('Base gun');
  });

  test('a reveal inside a condition group attaches', () => {
    expect(names('se-marker')).toContain('Marker rule');
  });

  test('a reveal conditioned on another option does not attach', () => {
    expect(names('se-marker')).not.toContain('Other rule');
    expect(names('se-other')).toEqual(['Other rule']);
  });

  test('an option with text of its own gains nothing from reveals', () => {
    expect(faction.entries['se-own']).toEqual({ rules: [{ name: 'Own rule', text: 'This option has a rule of its own.' }] });
  });

  test("a library marker revealed in the faction attaches to the faction's link, not twice", () => {
    expect(names('el-lib-marker')).toEqual(['Library marker rule']);
    expect(library.entries['se-lib-marker']).toBeUndefined();
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
  const unitOption: TierOf = () => 4;

  test('plain English that passes the checks is attached to rules and profile text', () => {
    const f = file();
    const report = attachInfoPlain([f], store([[RULE, 'This unit adds 1 to its charge rolls.'], [DESC, 'Attacks on this unit get 1 worse AP.']]), unitOption);
    expect(f.entries.a.rules?.[0].plain).toBe('This unit adds 1 to its charge rolls.');
    expect(f.entries.b.profiles?.[0].plain).toEqual({ Description: 'Attacks on this unit get 1 worse AP.' });
    expect(f.entries.c.profiles?.[0].plain).toBeUndefined();
    const none = { total: 0, written: 0 };
    expect(report).toEqual({
      total: 2,
      written: 2,
      flagged: 0,
      shards: { necrons: { total: 2, written: 2, flagged: [], copied: [], tiers: { 1: none, 2: none, 3: none, 4: { total: 2, written: 2 } } } },
    });
  });

  test('the report counts each text under its owning shard: written, flagged with its missing tokens, and by tier', () => {
    const HIT = 'Add 1 to hit rolls made for this unit.';
    const SYS = 'Each time this model fights, it can make one extra attack.';
    const nec: InfoFile = { schema: 1, slug: 'necrons', entries: { a: { rules: [{ name: 'Awakened', text: RULE }] }, b: { rules: [{ name: 'Hits', text: HIT }] } } };
    const sys: InfoFile = { schema: 1, slug: 'system', entries: { s: { rules: [{ name: 'Fights', text: SYS }] } } };
    const report = attachInfoPlain([nec, sys], store([[RULE, 'This unit adds 1 to its charge rolls.'], [HIT, 'This unit adds 2 to its hit rolls.']]), unitOption);
    expect(report.shards.necrons).toMatchObject({ total: 2, written: 1 });
    expect(report.shards.necrons.flagged).toEqual([{ key: textKey(HIT), name: 'Hits', missing: ['1'], extra: [] }]);
    expect(report.shards.necrons.tiers[4]).toEqual({ total: 2, written: 1 });
    expect(report.shards.core.total).toBe(1);
    expect(report).toMatchObject({ total: 3, written: 1, flagged: 1 });
    expect(nec.entries.b.rules?.[0].plain).toBeUndefined();
  });

  test('infoTextKeys gives the keys of the texts attachInfoPlain looks up', () => {
    expect([...infoTextKeys([file()])].sort()).toEqual([textKey(RULE), textKey(DESC)].sort());
  });

  test('the same text in many entries counts once', () => {
    const f = file();
    f.entries.d = { rules: [{ name: 'Awakened', text: RULE }] };
    const report = attachInfoPlain([f], store([[RULE, 'This unit adds 1 to its charge rolls.']]), unitOption);
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

  test('options that show only a name take the text their selection reveals', () => {
    const has = (slug: string, id: string, name: string | null) => {
      const e = info(slug).entries[id];
      const all = [...(e?.profiles ?? []), ...(e?.rules ?? [])].map((x) => x.name);
      return name === null ? all.length > 0 : all.includes(name);
    };
    const expected: [string, string, string | null][] = [
      ['chaos-chaos-knights', '253c-8df9-6fb9-8cee', 'The Diamonas'],
      ['chaos-chaos-knights', '20f6-3a9c-732b-72a7', 'The Teeth That Hunger'],
      ['chaos-chaos-knights', '058d-e731-d4bd-092c', 'The Gauntlet of Ascension'],
      ['chaos-death-guard', 'e06c-eb49-b5e6-f07a', 'Torrent of Putrefaction'],
      ['chaos-chaos-space-marines', '2eb6-087d-4893-3167', 'Techinfernal Loci'],
      // Speed Freeks Speed Mob is defined in the game system; Orks links to it, so its revealed text is under the link.
      ['orks', 'd7bd-1e4a-7ce9-0234', 'Adrenaline Junkies'],
      ['imperium-space-marines', '4ad6-eb88-f4b3-590e', null],
    ];
    for (const [slug, id, name] of expected) expect(has(slug, id, name), `${slug} ${id} ${name ?? '(any text)'}`).toBe(true);
    const diamonas = info('chaos-chaos-knights').entries['253c-8df9-6fb9-8cee'].profiles!.find((p) => p.name === 'The Diamonas')!;
    expect(diamonas.type).toBe('Weapon');
  });

  test('every info file is within 150 kB gzip', () => {
    for (const f of readdirSync(INFO)) expect(gzipSync(readFileSync(join(INFO, f))).length, f).toBeLessThanOrEqual(150_000);
  });

  test('option texts are counted apart from page texts', () => {
    const report: CoverageReport = JSON.parse(readFileSync(join(GEN, 'plain-report.json'), 'utf8'));
    const sum = (shards: Record<string, { total: number; written: number }>) =>
      Object.values(shards).reduce((a, r) => ({ total: a.total + r.total, written: a.written + r.written }), { total: 0, written: 0 });
    // 5034 before info files existed; 4742 once relics and other list-building options left the datasheets' own texts
    // (Plan D Task 4: their texts are option texts, in the info files, and keep their plain English there).
    expect(sum(report.shards)).toEqual({ total: 4742, written: 4742 });
    // Plan F wrote the option texts' plain English (1662 of them existed before it, shared with datasheet texts); Plan F2
    // gave 15 marker options the text their selection reveals (3,416 -> 3,431).
    expect(sum(report.options)).toEqual({ total: 3431, written: 3431 });
    expect(existsSync(join(GEN, 'info-plain-report.json'))).toBe(false);
  });
});
