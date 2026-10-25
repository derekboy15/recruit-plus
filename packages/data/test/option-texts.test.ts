import { describe, expect, test } from 'vitest';
import { collectOptionTexts, infoTextKeys, optionCounts, optionSample, optionShard, type OptionText } from '../src/info';
import { optionTierOf } from '../src/info/tiers';
import type { InfoFile } from '../src/model/types';
import { textKey } from '../src/plain/collect';
import type { PlainStore } from '../src/plain/store';
import type { RNode, RosterFile } from '../src/roster/types';

const file = (slug: string, rootEntries: RNode[], shared: RNode[] = []): RosterFile =>
  ({ schema: 1, id: slug, name: slug, slug, library: false, links: [], rootEntries, shared, categories: [], forces: [] });
const necrons = file('necrons', [
  { id: 'dyn', kind: 'entry', type: 'upgrade', name: 'Dynasty Choice', children: [{ id: 'novokh', kind: 'entry', type: 'upgrade', name: 'Dynasty: Novokh' }] },
  { id: 'army-wt', kind: 'group', name: 'Warlord Traits', children: [{ id: 'army-trait', kind: 'entry', type: 'upgrade', name: 'Enduring Will', extraKind: 'trait' }] },
  { id: 'ref', kind: 'entry', type: 'upgrade', name: '[Reference] Warlord Traits (All)', children: [{ id: 'ref-fury', kind: 'entry', type: 'upgrade', name: 'Blood-Fuelled Fury' }] },
  { id: 'overlord', kind: 'entry', type: 'unit', name: 'Overlord', children: [
    { id: 'fury', kind: 'entry', type: 'upgrade', name: 'Warlord Trait (Novokh): Blood-Fuelled Fury', extraKind: 'trait' },
    { id: 'rod-link', kind: 'link', name: 'The Burning Rod', targetId: 'rod', targetKind: 'entry', extraKind: 'relic' },
    { id: 'coronal', kind: 'entry', type: 'upgrade', name: 'Relic (Szarekhan): The Sovereign Coronal' },
    { id: 'orb', kind: 'entry', type: 'upgrade', name: 'Resurrection Orb' }] }]);
const library = file('necrons-library', [], [{ id: 'rod', kind: 'entry', type: 'upgrade', name: 'The Burning Rod' }, { id: 'lost', kind: 'entry', type: 'upgrade', name: 'Unused' }]);
const tierOf = optionTierOf([necrons, library]);

const info = (slug: string, entries: InfoFile['entries']): InfoFile => ({ schema: 1, slug, entries });
const store = (entries: [string, string][]): PlainStore =>
  new Map(entries.map(([key, shard]) => [key, { name: 'x', kind: 'rule' as const, plain: 'x', shard }]));

describe('optionTierOf', () => {
  test('a dynasty under a root entry is an army choice', () => {
    expect(tierOf('necrons', 'novokh')).toBe(1);
  });

  test('a trait is tier 2 under a unit or at army level', () => {
    expect(tierOf('necrons', 'fury')).toBe(2);
    expect(tierOf('necrons', 'army-trait')).toBe(2);
  });

  test('a relic is tier 3 by its marker or its heading', () => {
    expect(tierOf('necrons', 'rod-link')).toBe(3);
    expect(tierOf('necrons', 'coronal')).toBe(3);
  });

  test('wargear under a unit is tier 4', () => {
    expect(tierOf('necrons', 'orb')).toBe(4);
  });

  test('a shared library entry takes its tier from the links that reach it', () => {
    expect(tierOf('necrons-library', 'rod')).toBe(3);
  });

  test('a [Reference] entry the builder never shows gives no tier: its options are tier 4 on their own', () => {
    expect(tierOf('necrons', 'ref-fury')).toBe(4);
    expect(tierOf('necrons', 'ref')).toBe(4);
  });

  test('a shared entry no link reaches, or an unknown id, is tier 4', () => {
    expect(tierOf('necrons-library', 'lost')).toBe(4);
    expect(tierOf('necrons', 'nope')).toBe(4);
  });
});

describe('collectOptionTexts', () => {
  const T = 'Add 1 to charge rolls made for units with this code.';
  const sysInfo = info('system', { s: { rules: [{ name: 'Shared', text: T }] } });
  const necInfo = info('necrons', { orb: { rules: [{ name: 'Code', text: T }] }, novokh: { rules: [{ name: 'Code', text: T }] } });

  test('a text in two files is listed once, owned by the first file in slug order, with system last', () => {
    expect(collectOptionTexts([sysInfo, necInfo], new Map(), tierOf)).toEqual([{ key: textKey(T), shard: 'necrons', kind: 'rule', name: 'Code', text: T, tier: 1 }]);
  });

  test('its tier is the most visible of its uses', () => {
    const orbOnly = info('necrons', { orb: { rules: [{ name: 'Code', text: T }] } });
    expect(collectOptionTexts([orbOnly], new Map(), tierOf)[0].tier).toBe(4);
    expect(collectOptionTexts([necInfo], new Map(), tierOf)[0].tier).toBe(1);
  });

  test('a text a [Reference] entry repeats keeps the tier of the option the builder shows', () => {
    const F = 'Each time this WARLORD makes a melee attack, an unmodified wound roll of 6 inflicts 1 mortal wound.';
    const files = [info('necrons', { 'ref-fury': { rules: [{ name: 'Fury', text: F }] }, fury: { rules: [{ name: 'Fury', text: F }] } })];
    expect(collectOptionTexts(files, new Map(), tierOf)[0].tier).toBe(2);
  });

  test('a text only in system is owned by core', () => {
    expect(optionShard('system')).toBe('core');
    expect(optionShard('necrons')).toBe('necrons');
    expect(collectOptionTexts([sysInfo], new Map(), tierOf)[0].shard).toBe('core');
  });

  test('a text with an entry is owned by the shard holding it', () => {
    expect(collectOptionTexts([sysInfo, necInfo], store([[textKey(T), 'imperium-space-marines']]), tierOf)[0].shard).toBe('imperium-space-marines');
  });

  test('exactly the texts attachInfoPlain looks up', () => {
    const files = [
      info('necrons', {
        gun: { profiles: [{ name: 'Gauss Blaster', type: 'Weapon', chars: { Range: '24"', S: '5', Abilities: 'Each time an attack is made with this weapon, add 1 to the hit roll.' } }] },
        orb: { profiles: [{ name: 'Orb', type: 'Abilities', chars: { Description: 'Three words only', Effect: 'Once per battle, this unit can reanimate one extra model.' } }] },
        bolt: { profiles: [{ name: 'Bolt', type: 'Psychic Power', chars: { 'Warp Charge': '6', Details: 'If manifested, the closest enemy unit suffers D3 mortal wounds.' } }] },
        rule: { rules: [{ name: 'Rule', text: 'Re-roll hit rolls of 1.' }] },
      }),
    ];
    const texts = collectOptionTexts(files, new Map(), tierOf);
    expect(new Set(texts.map((t) => t.key))).toEqual(infoTextKeys(files));
    expect(texts.map((t) => [t.name, t.kind])).toEqual([['Gauss Blaster', 'weapon'], ['Orb', 'ability'], ['Bolt', 'psychic'], ['Rule', 'rule']]);
  });
});

describe('optionSample', () => {
  const text = (i: number, tier: OptionText['tier'], shard = 'necrons'): OptionText =>
    ({ key: `k${String(i).padStart(11, '0')}`, shard, kind: 'rule', name: `Text ${i}`, text: `Text ${i}`, tier });
  const many = [...Array.from({ length: 8 }, (_, i) => text(i, 1)), ...Array.from({ length: 8 }, (_, i) => text(100 + i, (2 + (i % 3)) as 2 | 3 | 4)), text(200, 1, 'orks')];

  test('takes 5 army choices and 5 others, from the shard only, the same every run', () => {
    const sample = optionSample(many, 'necrons');
    expect(sample).toHaveLength(10);
    expect(sample.filter((t) => t.tier === 1)).toHaveLength(5);
    expect(sample.every((t) => t.shard === 'necrons')).toBe(true);
    expect(optionSample([...many].reverse(), 'necrons')).toEqual(sample);
  });

  test('tops up from the other half when one half is short', () => {
    const fewArmy = [...many.filter((t) => t.tier !== 1), text(0, 1), text(1, 1)];
    const sample = optionSample(fewArmy, 'necrons');
    expect(sample).toHaveLength(10);
    expect(sample.filter((t) => t.tier === 1)).toHaveLength(2);
    expect(optionSample([text(0, 1), text(100, 4)], 'necrons')).toHaveLength(2);
  });
});

describe('optionCounts', () => {
  const text = (i: number, tier: OptionText['tier'], shard = 'necrons'): OptionText =>
    ({ key: `k${String(i).padStart(11, '0')}`, shard, kind: 'rule', name: `Text ${i}`, text: `Text ${i}`, tier });
  const texts = [text(1, 1), text(2, 2), text(3, 4), text(4, 1, 'orks')];

  test('a shard that owns option texts but has none open still shows them', () => {
    expect(optionCounts(texts, 'necrons', () => true)).toEqual({ total: 3, written: 3, open: { 1: 0, 2: 0, 3: 0, 4: 0 } });
  });

  test('open texts are counted by tier', () => {
    expect(optionCounts(texts, 'necrons', (t) => t.tier !== 1)).toEqual({ total: 3, written: 2, open: { 1: 1, 2: 0, 3: 0, 4: 0 } });
    expect(optionCounts(texts, 'tau-empire', () => false)).toEqual({ total: 0, written: 0, open: { 1: 0, 2: 0, 3: 0, 4: 0 } });
  });
});
