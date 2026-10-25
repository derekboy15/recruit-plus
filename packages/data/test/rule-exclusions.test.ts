import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import { excludeRules, excludeUnitAbilities, type RuleExclusion } from '../src/build';
import type { CatalogueOut } from '../src/model/types';

const rules = [
  { id: 'r1', name: 'Synapse', text: 'Old 8th-edition text.' },
  { id: 'r2', name: 'Hive Fleet Adaptations', text: 'Current text.' },
];
const x = (name: string, catalogueName = 'Tyranids'): RuleExclusion => ({ catalogueName, name, reason: 'stale', source: 'test' });

test('excluded army rules are dropped from that catalogue only', () => {
  expect(excludeRules('Tyranids', rules, [x('Synapse')]).map((r) => r.name)).toEqual(['Hive Fleet Adaptations']);
  expect(excludeRules('Necrons', rules, [x('Synapse')]).map((r) => r.name)).toEqual(['Synapse', 'Hive Fleet Adaptations']);
});

test('an exclusion that matches no rule throws', () => {
  expect(() => excludeRules('Tyranids', rules, [x('No Such Rule')])).toThrow(/rule-exclusions\.json: Tyranids has no army rule "No Such Rule"/);
});

test('an exclusion with an id drops only that row of a duplicated name', () => {
  const dup = [...rules, { id: 'r3', name: 'Synapse', text: '' }];
  expect(excludeRules('Tyranids', dup, [{ ...x('Synapse'), id: 'r3' }]).map((r) => r.id)).toEqual(['r1', 'r2']);
  expect(() => excludeRules('Tyranids', dup, [{ ...x('Synapse'), id: 'r9' }])).toThrow(/has no army rule "Synapse" with id r9/);
});

test('an exclusion needs a reason and a source', () => {
  expect(() => excludeRules('Tyranids', rules, [{ ...x('Synapse'), reason: '' }])).toThrow(/reason and a source/);
});

const units = [
  { name: 'Warriors', abilities: [{ name: 'Synapse' }, { name: 'Reanimation' }] },
  { name: 'Lords', abilities: [{ name: 'Synapse' }] },
];

test("an exclusion with a unit drops that ability from that unit's datasheet only", () => {
  const out = excludeUnitAbilities('Tyranids', units, [{ ...x('Synapse'), unit: 'Warriors' }]);
  expect(out.map((u) => [u.name, u.abilities.map((a) => a.name)])).toEqual([['Warriors', ['Reanimation']], ['Lords', ['Synapse']]]);
  expect(excludeUnitAbilities('Necrons', units, [{ ...x('Synapse'), unit: 'Warriors' }])).toEqual(units);
  expect(excludeUnitAbilities('Tyranids', units, [x('Synapse')])).toEqual(units); // no unit: the army rule only
});

test('an exclusion naming a unit that lacks the ability throws', () => {
  expect(() => excludeUnitAbilities('Tyranids', units, [{ ...x('Reanimation'), unit: 'Lords' }])).toThrow(/rule-exclusions\.json: Tyranids unit "Lords" has no ability "Reanimation"/);
  expect(() => excludeUnitAbilities('Tyranids', units, [{ ...x('Synapse'), unit: 'Nobody' }])).toThrow(/Tyranids unit "Nobody"/);
});

test('the Damned Legionnaires have no "Saviours From Beyond" (not on the 9th-edition datasheet), nor does the army', () => {
  const cat: CatalogueOut = JSON.parse(readFileSync(join(__dirname, '..', 'generated', 'catalogues', 'imperium-legion-of-the-damned.json'), 'utf8'));
  const unit = cat.units.find((u) => u.name === 'Damned Legionnaires')!;
  expect(unit.abilities.map((a) => a.name)).toEqual(expect.arrayContaining(['Aid Unlooked For', 'Flaming Projectiles', 'Unyielding Spectres']));
  expect(unit.abilities.map((a) => a.name)).not.toContain('Saviours From Beyond');
  expect(cat.rules.map((r) => r.name)).not.toContain('Saviours From Beyond');
});
