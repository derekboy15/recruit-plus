import { test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPlain, copyCheck, crossCheck, extractTokens, normaliseRulesText } from '../src/plain/check';
import type { CatalogueOut } from '../src/model/types';

const values = (text: string) => extractTokens(text).map((t) => `${t.kind}:${t.value}`);

test('extracts dice, rolls, modifiers, distances, numbers and keywords', () => {
  expect(values('Roll 2D6; on a 4+ add 1 to hit rolls (+1) for CORE INFANTRY units within 6".')).toEqual([
    'dice:2D6',
    'roll:4+',
    'num:1',
    'mod:+1',
    'kw:CORE INFANTRY',
    'dist:6"',
  ]);
});

test('normalises quotes, dashes and inches', () => {
  expect(normaliseRulesText('within 6 inches – “near”   it’s')).toBe('within 6" - "near" it\'s');
});

test('curly inch marks', () => {
  expect(values('within 6″ of this model')).toEqual(['dist:6"']);
});

test('dice with modifiers', () => {
  expect(values('inflicts D3+3 mortal wounds')).toEqual(['dice:D3+3']);
  expect(values('suffers D6 + 1 mortal wounds')).toEqual(['dice:D6+1']);
  expect(values('roll a D3')).toEqual(['dice:D3']);
  expect(values('roll 1D3')).toEqual(['dice:D3']);
});

test('angle-bracket keywords', () => {
  expect(values('a friendly <DYNASTY> CORE unit')).toEqual(['kw:<DYNASTY> CORE']);
});

test('4++ is a 4+ roll', () => {
  expect(values('has a 4++ save')).toEqual(['roll:4+']);
});

test('1CP is a number and the CP keyword', () => {
  expect(values('Use this Stratagem (1CP)')).toEqual(['num:1', 'kw:CP']);
});

test('punctuation ends a keyword run; possessive s is dropped', () => {
  expect(values("CORE, INFANTRY or the WARLORD's unit")).toEqual(['kw:CORE', 'kw:INFANTRY', 'kw:WARLORD']);
});

test('tokens are deduplicated in first-seen order', () => {
  expect(values('6" then 6" then a 5+ and 5+')).toEqual(['dist:6"', 'roll:5+']);
});

test('number words in plain text count', () => {
  expect(crossCheck('select 3 units', 'pick three units')).toEqual({ missing: [], extra: [] });
  expect(crossCheck('in the 1st battle round', 'in the first battle round').missing).toEqual([]);
});

test('a number is satisfied by any token with the same value', () => {
  expect(crossCheck('add 2 to the roll', 'the roll gets +2').missing).toEqual([]);
});

test('a changed distance in plain text is flagged', () => {
  expect(crossCheck('enemy units within 6" of this model', 'enemy units within 9" of this model')).toEqual({
    missing: [{ kind: 'dist', value: '6"' }],
    extra: [{ kind: 'dist', value: '9"' }],
  });
});

test('a missing roll and an invented modifier are flagged', () => {
  expect(crossCheck('on a 5+ it is destroyed', 'it is destroyed, with +1 to the roll')).toEqual({
    missing: [{ kind: 'roll', value: '5+' }],
    extra: [{ kind: 'mod', value: '+1' }],
  });
});

test('keywords match case-insensitively with a plural s', () => {
  expect(crossCheck('a friendly CHARACTER unit', 'one of your characters').missing).toEqual([]);
  expect(crossCheck('a <DYNASTY> CORE unit', 'a <Dynasty> Core unit').missing).toEqual([]);
  expect(crossCheck('a CORE INFANTRY unit', 'a CORE unit that is INFANTRY').missing).toEqual([{ kind: 'kw', value: 'CORE INFANTRY' }]);
});

test('keyword edge cases from real data: 2CP, GREAT UNCLEAN ONE, AP-1', () => {
  expect(crossCheck('this Stratagem costs 2CP', 'it costs 2CP').missing).toEqual([]);
  expect(values('select a GREAT UNCLEAN ONE unit')).toEqual(['kw:GREAT UNCLEAN ONE']);
  expect(crossCheck('select a GREAT UNCLEAN ONE unit', 'pick a GREAT UNCLEAN ONE unit').missing).toEqual([]);
  expect(values('improve AP-1')).toEqual(['kw:AP', 'num:1']);
});

test('a number at the end of a sentence still counts', () => {
  expect(values('Each time this unit is hit, subtract 1.')).toEqual(['num:1']);
  expect(checkPlain('Each time this unit is hit, subtract 1.', 'When this unit is hit, take away 2 from it.').ok).toBe(false);
});

test('number words in the official text count, except one and first', () => {
  expect(values('select up to three units')).toEqual(['num:3']);
  expect(values('in the second battle round')).toEqual(['num:2']);
  expect(values('select one unit in the first battle round')).toEqual([]);
  expect(crossCheck('select up to three units', 'pick up to 2 units').missing).toEqual([{ kind: 'num', value: '3' }]);
  expect(crossCheck('in the second battle round', 'in the 2nd battle round').missing).toEqual([]);
});

test('multipliers are strict tokens', () => {
  expect(values('Strength x2')).toEqual(['mult:x2']);
  expect(crossCheck('Strength x2', 'Strength x3')).toEqual({ missing: [{ kind: 'mult', value: 'x2' }], extra: [{ kind: 'mult', value: 'x3' }] });
  expect(crossCheck('Strength ×2', 'double Strength (x2)')).toEqual({ missing: [], extra: [] });
});

test('halves and decimals are read as one number', () => {
  expect(values('within 2½" of it')).toEqual(['dist:2.5"']);
  expect(values('a 1.5 metre gap')).toEqual(['num:1.5']);
  expect(crossCheck('within 2½"', 'within 2"').missing).toEqual([{ kind: 'dist', value: '2.5"' }]);
});

test('lower-case dice count in plain text', () => {
  expect(crossCheck('roll a D6', 'roll a d6')).toEqual({ missing: [], extra: [] });
});

test("waived tokens don't fail", () => {
  const v = checkPlain('see the Warhammer 40,000 Core Book: within 6"', 'within 6"', { '40000': 'book title, not a rule value' });
  expect(v.ok).toBe(true);
  expect(checkPlain('see the Warhammer 40,000 Core Book: within 6"', 'within 6"').missing).toEqual([{ kind: 'num', value: '40000' }]);
});

const words = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `w${from + i}`).join(' ');

test("copying can't be waived", () => {
  const official = words(30);
  const v = checkPlain(official, official, { w1: 'no' });
  expect(v.copy.copied).toBe(true);
  expect(v.ok).toBe(false);
});

test("a 12-word shared run is copied, an 11-word run isn't", () => {
  const official = words(14);
  expect(copyCheck(official, `alpha ${words(12)} omega`)).toMatchObject({ longestRun: 12, copied: true });
  expect(copyCheck(official, `alpha ${words(11)} omega`)).toMatchObject({ longestRun: 11, copied: false });
});

test('a short official text may be close', () => {
  const official = 'This model has a 4+ invulnerable save here.';
  expect(copyCheck(official, official)).toMatchObject({ longestRun: 8, copied: false });
});

test('half the 4-grams shared fails for long texts', () => {
  const official = words(40);
  // Plain text: 10 words copied in two 5-word runs (4 shared 4-grams of 14), then 10 fresh words.
  const plain = `${words(5, 0)} x1 ${words(5, 20)} ${words(8, 100)}`;
  const low = copyCheck(official, plain);
  expect(low.copied).toBe(false);
  const high = copyCheck(official, `${words(9, 0)} x ${words(9, 20)}`);
  expect(high.shared4).toBeGreaterThanOrEqual(0.5);
  expect(high.longestRun).toBe(9);
  expect(high.copied).toBe(true);
});

test('real data smoke: every Necrons official text checks clean against itself', () => {
  const file = join(__dirname, '..', 'generated', 'catalogues', 'necrons.json');
  if (!existsSync(file)) throw new Error('Run npm run data:build first');
  const cat: CatalogueOut = JSON.parse(readFileSync(file, 'utf8'));
  const texts = [
    ...cat.rules.map((r) => r.text),
    ...cat.stratagems.map((s) => s.text),
    ...cat.units.flatMap((u) => [
      ...u.abilities.map((a) => a.text),
      ...[...u.weapons, ...u.psychic].flatMap((p) => Object.values(p.chars)),
    ]),
  ].filter(Boolean);
  expect(texts.length).toBeGreaterThan(500);
  for (const t of texts) {
    expect(() => extractTokens(t)).not.toThrow();
    expect(crossCheck(t, t), t.slice(0, 80)).toEqual({ missing: [], extra: [] });
  }
});
