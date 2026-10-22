import { test, expect } from 'vitest';
import { excludeRules, type RuleExclusion } from '../src/build';

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
