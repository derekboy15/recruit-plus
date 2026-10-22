import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogueOut, DataIndex, StratagemOut, UnitOut } from '../src/model/types';
import { collectOfficialTexts, officialFor, ruleKeys, spotSample, textKey, textsInCatalogue } from '../src/plain/collect';
import { applyPlain, loadPlainStore, type PlainShard } from '../src/plain/store';
import { checkPlain, normaliseRulesText } from '../src/plain/check';

const REANIMATE = 'Each time a model in this unit is destroyed, roll one D6: on a 5+ it is set up again within 3" of the unit.';
const RULE = 'While a CORE unit from your army is within 6" of this model, add 1 to its hit rolls.';
const STRAT = 'Use this Stratagem in your Shooting phase. Select one NECRONS unit; until the end of the phase it can re-roll hit rolls.';
const GUN = 'Each time an attack is made with this weapon, an unmodified hit roll of 6 scores 1 additional hit.';

function unit(name: string, catalogueId: string, over: Partial<UnitOut> = {}): UnitOut {
  return {
    id: `${name}-id`, slug: name.toLowerCase(), name, catalogueId, role: 'Troops', keywords: [], factionKeywords: [],
    models: [], weapons: [], abilities: [], psychic: [], woundTrack: [], transport: null, minModels: 1, maxModels: 1,
    powerLevel: 1, points: 10, baseSize: null, wahapediaId: null, legends: false, forgeWorld: false, ...over,
  };
}
const strat = (name: string, text: string): StratagemOut => ({ id: name, name, cp: '1', group: 'Necrons', kind: 'Battle Tactic', phases: ['Shooting phase'], text });

function fixture(): CatalogueOut[] {
  const lib: CatalogueOut = {
    id: 'lib', slug: 'library', name: 'Library', group: 'Xenos', library: true, rules: [], stratagems: [],
    units: [unit('Warriors', 'lib', { abilities: [{ name: 'Reanimate', text: REANIMATE, source: 'bsdata' }] })],
  };
  const nec: CatalogueOut = {
    id: 'nec', slug: 'necrons', name: 'Necrons', group: 'Xenos', library: false,
    rules: [{ id: 'r1', name: 'Command Protocols', text: RULE }],
    stratagems: [strat('Hit Them', STRAT)],
    units: [
      unit('Warriors', 'lib', { abilities: [{ name: 'Reanimate', text: REANIMATE, source: 'bsdata' }] }),
      unit('Immortals', 'nec', {
        abilities: [{ name: 'Reanimate', text: REANIMATE, source: 'bsdata' }],
        weapons: [
          { name: 'Gauss blaster', chars: { Range: '24"', Type: 'Rapid Fire 1', Abilities: GUN } },
          { name: 'Tesla carbine', chars: { Range: '24"', Type: 'Assault 2', Abilities: 'Blast' } },
        ],
      }),
    ],
  };
  return [lib, nec];
}

function store(shards: Record<string, PlainShard>): string {
  const dir = mkdtempSync(join(tmpdir(), 'recruit-plain-'));
  for (const [shard, entries] of Object.entries(shards)) writeFileSync(join(dir, `${shard}.json`), JSON.stringify(entries));
  return dir;
}

test('keys are stable and ignore whitespace and quote style', () => {
  expect(textKey('within 6" of  this model')).toBe(textKey('within 6″ of this\nmodel'));
  expect(textKey('within 6" of this model')).toMatch(/^[0-9a-f]{12}$/);
  expect(textKey('within 6" of this model')).not.toBe(textKey('within 9" of this model'));
});

test('a text shared by two catalogues is collected once, in the first shard', () => {
  const texts = collectOfficialTexts(fixture(), []);
  const reanimate = texts.filter((t) => t.name === 'Reanimate');
  expect(reanimate).toHaveLength(1);
  expect(reanimate[0]).toMatchObject({ shard: 'library', kind: 'ability', text: REANIMATE });
  expect(texts.find((t) => t.name === 'Command Protocols')).toMatchObject({ shard: 'necrons', kind: 'rule' });
  expect(texts.find((t) => t.name === 'Hit Them')).toMatchObject({ shard: 'necrons', kind: 'stratagem' });
  expect(texts.find((t) => t.name === 'Gauss blaster')).toMatchObject({ shard: 'necrons', kind: 'weapon', text: GUN });
});

test('core stratagems are collected first, in the core shard', () => {
  const texts = collectOfficialTexts(fixture(), [strat('Command Re-roll', STRAT)]);
  expect(texts[0]).toMatchObject({ shard: 'core', name: 'Command Re-roll' });
  expect(texts.filter((t) => t.name === 'Hit Them')).toHaveLength(0); // same text, core wins
});

test('short weapon labels are not collected', () => {
  expect(collectOfficialTexts(fixture(), []).some((t) => t.text === 'Blast')).toBe(false);
});

test("a passing entry sets plain; a flagged entry doesn't and is reported", () => {
  const cats = fixture();
  const dir = store({
    library: { [textKey(REANIMATE)]: { name: 'Reanimate', kind: 'ability', plain: 'When one of these models dies, roll a D6. On a 5+ put it back within 3" of the unit.' } },
    necrons: { [textKey(RULE)]: { name: 'Command Protocols', kind: 'rule', plain: 'Your CORE units within 9" of this model get +1 to hit.' } },
  });
  const report = applyPlain(cats, [], loadPlainStore(dir));
  expect(cats[1].units[1].abilities[0].plain).toMatch(/^When one of these/);
  expect(cats[1].units[0].abilities[0].plain).toMatch(/^When one of these/);
  expect(cats[1].rules[0].plain).toBeUndefined();
  expect(report.shards.library).toMatchObject({ total: 1, written: 1, flagged: [], copied: [] });
  expect(report.shards.necrons.written).toBe(0);
  expect(report.shards.necrons.flagged).toEqual([
    { key: textKey(RULE), name: 'Command Protocols', missing: ['6"'], extra: ['9"', '+1'] },
  ]);
});

test('a weapon ability plain text lands in ProfileOut.plain', () => {
  const cats = fixture();
  const dir = store({ necrons: { [textKey(GUN)]: { name: 'Gauss blaster', kind: 'weapon', plain: 'An unmodified 6 to hit with this weapon scores 1 extra hit.' } } });
  applyPlain(cats, [], loadPlainStore(dir));
  expect(cats[1].units[1].weapons[0].plain).toEqual({ Abilities: 'An unmodified 6 to hit with this weapon scores 1 extra hit.' });
  expect(cats[1].units[1].weapons[1].plain).toBeUndefined();
});

test('a copied entry is reported, not applied', () => {
  const cats = fixture();
  const dir = store({ necrons: { [textKey(STRAT)]: { name: 'Hit Them', kind: 'stratagem', plain: STRAT } } });
  const report = applyPlain(cats, [], loadPlainStore(dir));
  expect(cats[1].stratagems[0].plain).toBeUndefined();
  expect(report.shards.necrons.copied).toEqual([{ key: textKey(STRAT), name: 'Hit Them', longestRun: expect.any(Number) }]);
});

test('changed official text hides the old plain text', () => {
  const plain = 'When one of these models dies, roll a D6. On a 5+ put it back within 3" of the unit.';
  const dir = store({ library: { [textKey(REANIMATE)]: { name: 'Reanimate', kind: 'ability', plain } } });
  const first = fixture();
  applyPlain(first, [], loadPlainStore(dir));
  expect(first[0].units[0].abilities[0].plain).toBe(plain);

  const changed = fixture();
  for (const c of changed) for (const u of c.units) for (const a of u.abilities) a.text = a.text.replace('5+', '4+');
  const report = applyPlain(changed, [], loadPlainStore(dir));
  expect(changed[0].units[0].abilities[0].plain).toBeUndefined();
  expect(changed[1].units[1].abilities[0].plain).toBeUndefined();
  expect(report.orphans).toEqual([{ shard: 'library', key: textKey(REANIMATE), name: 'Reanimate' }]);
});

test('an amended text includes the amendment in its key and its check', () => {
  const cats = fixture();
  cats[1].rules[0].amended = 'Since 2023 the range is 3" instead.';
  const official = officialFor(RULE, cats[1].rules[0].amended);
  expect(official).toBe(`${RULE}\n\nRules update: Since 2023 the range is 3" instead.`);
  const t = collectOfficialTexts(cats, []).find((x) => x.name === 'Command Protocols')!;
  expect(t.key).toBe(textKey(official));
  expect(t.text).toBe(official);
  const dir = store({ necrons: { [t.key]: { name: 'Command Protocols', kind: 'rule', plain: 'Your CORE units within 6" of this model add 1 to hit rolls. (A 2023 update cut that to 3".)' } } });
  applyPlain(cats, [], loadPlainStore(dir));
  expect(cats[1].rules[0].plain).toMatch(/^Your CORE units/);
});

test('the same key in two shard files throws', () => {
  const entry = { name: 'Reanimate', kind: 'ability' as const, plain: 'x' };
  const dir = store({ library: { [textKey(REANIMATE)]: entry }, necrons: { [textKey(REANIMATE)]: entry } });
  expect(() => loadPlainStore(dir)).toThrow(/in both library\.json and necrons\.json/);
});

test('a missing content directory is an empty store', () => {
  expect(loadPlainStore(join(tmpdir(), 'recruit-no-such-dir')).size).toBe(0);
});

test("textsInCatalogue includes library unit texts and the catalogue's stratagems", () => {
  const cats = fixture();
  const all = collectOfficialTexts(cats, []);
  const names = textsInCatalogue(cats[1], all).map((t) => t.name).sort();
  expect(names).toEqual(['Command Protocols', 'Gauss blaster', 'Hit Them', 'Reanimate']);
  expect(textsInCatalogue(cats[0], all).map((t) => t.name)).toEqual(['Reanimate']);
});

test("ruleKeys lists a catalogue's army rules even when the same text was first collected as an ability", () => {
  const cats = fixture();
  cats[1].rules.push({ id: 'r2', name: 'Reanimate (army rule)', text: REANIMATE });
  const all = collectOfficialTexts(cats, []);
  expect(all.find((t) => t.key === textKey(REANIMATE))?.kind).toBe('ability');
  expect(ruleKeys(cats[1])).toEqual([textKey(RULE), textKey(REANIMATE)]);
});

test('spotSample is deterministic and seeded', () => {
  const all = collectOfficialTexts(fixture(), []);
  expect(spotSample(all, 'necrons', 2)).toEqual(spotSample([...all].reverse(), 'necrons', 2));
  expect(spotSample(all, 'necrons', 10)).toHaveLength(all.length);
});

test("STYLE.md's worked examples pass the checks", () => {
  const style = readFileSync(join(__dirname, '..', '..', 'content', 'STYLE.md'), 'utf8');
  const pairs = [...style.matchAll(/^- Official: (.+)\n- Plain: (.+)$/gm)];
  expect(pairs).toHaveLength(3);
  for (const [, official, plain] of pairs) expect(checkPlain(official, plain), plain).toMatchObject({ ok: true });
});

const GEN = join(__dirname, '..', 'generated');

test('real data: more than 4,000 texts, every playable catalogue has some, keys never collide', () => {
  if (!existsSync(join(GEN, 'index.json'))) throw new Error('Run npm run data:build first');
  const index: DataIndex = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
  const cats: CatalogueOut[] = index.catalogues.map((c) => JSON.parse(readFileSync(join(GEN, 'catalogues', `${c.slug}.json`), 'utf8')));
  const core: StratagemOut[] = JSON.parse(readFileSync(join(GEN, 'core-stratagems.json'), 'utf8'));
  const texts = collectOfficialTexts(cats, core);
  expect(texts.length).toBeGreaterThan(4000);
  for (const c of cats.filter((x) => !x.library)) expect(textsInCatalogue(c, texts).length, c.name).toBeGreaterThan(0);
  const byKey = new Map<string, string>();
  for (const t of texts) {
    const norm = normaliseRulesText(t.text);
    expect(byKey.get(t.key) ?? norm, t.key).toBe(norm);
    byKey.set(t.key, norm);
  }
  expect(byKey.size).toBe(texts.length);
});

test('build writes plain-report.json', () => {
  if (!existsSync(join(GEN, 'plain-report.json'))) throw new Error('Run npm run data:build first');
  const report = JSON.parse(readFileSync(join(GEN, 'plain-report.json'), 'utf8'));
  expect(Object.keys(report.shards)).toContain('core');
  expect(Object.keys(report.shards)).toContain('necrons');
});

