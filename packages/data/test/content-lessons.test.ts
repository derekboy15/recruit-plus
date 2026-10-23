import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRules } from '../src/content/build';
import { buildLessons } from '../src/content/lessons';

const CONTENT = join(__dirname, '..', '..', 'content');
const rules = buildRules(join(CONTENT, 'rules'));

interface Front { id: string; order: number; minutes: number; rules: string; glossary: string }
const front = (o: Partial<Front> = {}) => {
  const f: Front = { id: 'charge', order: 8, minutes: 4, rules: 'charge-phase#charging, charge-phase#overwatch', glossary: 'overwatch', ...o };
  return `---
id: ${f.id}
title: Charge
order: ${f.order}
minutes: ${f.minutes}
summary: Get into combat.
drill: ${f.id}
rules: [${f.rules}]
glossary: [${f.glossary}]
sources: [01_Core_Rules/Core_Rules_Turn_Sequence.md §6]
---
`;
};
const BODY = `A charge gets your unit into combat.

## Declaring a charge

Pick a unit within 12" of the enemy. See [charging](/rules/charge-phase#charging).

## Overwatch

The target may fire [Overwatch](/rules/glossary#overwatch).
`;

function dir(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'recruit-lessons-'));
  for (const [name, src] of Object.entries(files)) writeFileSync(join(d, name), src);
  return d;
}

test('builds a lesson with its sections, rules links and key words', () => {
  const { lessons } = buildLessons(dir({ '08-charge.md': front() + BODY }), rules);
  expect(lessons).toHaveLength(1);
  const l = lessons[0];
  expect(l).toMatchObject({ id: 'charge', title: 'Charge', order: 8, minutes: 4, drill: 'charge', summary: 'Get into combat.', glossary: ['overwatch'] });
  expect(l.sections.map((s) => s.title)).toEqual(['Declaring a charge', 'Overwatch']);
  expect(l.rules).toEqual([
    { article: 'charge-phase', section: 'charging', title: 'Charging' },
    { article: 'charge-phase', section: 'overwatch', title: 'Overwatch' },
  ]);
});

test('rejects a rules reference to a missing article or section', () => {
  expect(() => buildLessons(dir({ 'x.md': front({ rules: 'charge-phase#nope' }) + BODY }), rules)).toThrow(/x\.md: .*charge-phase#nope/);
  expect(() => buildLessons(dir({ 'x.md': front({ rules: 'no-article#charging' }) + BODY }), rules)).toThrow(/no-article#charging/);
});

test('rejects an unknown glossary id', () => {
  expect(() => buildLessons(dir({ 'x.md': front({ glossary: 'not-a-term' }) + BODY }), rules)).toThrow(/x\.md: .*not-a-term/);
});

test('rejects an inline /rules/ link that points nowhere', () => {
  const bad = (href: string) => buildLessons(dir({ 'x.md': front() + BODY + `\nAlso [this](${href}).\n` }), rules);
  expect(() => bad('/rules/charge-phase#nope')).toThrow(/x\.md: .*\/rules\/charge-phase#nope/);
  expect(() => bad('/rules/glossary#nope')).toThrow(/\/rules\/glossary#nope/);
  expect(() => bad('/rules/stratagems#strat-nope')).toThrow(/strat-nope/);
  expect(() => bad('/rules/nowhere')).toThrow(/\/rules\/nowhere/);
  expect(() => buildLessons(dir({ 'x.md': front() + BODY + '\nSee [the glossary](/rules/glossary).\n' }), rules)).not.toThrow();
  expect(() => buildLessons(dir({ 'x.md': front() + BODY + '\n[Re-roll](/rules/stratagems#strat-1).\n' }), rules, new Set(['strat-1']))).not.toThrow();
});

test('rejects minutes outside 2–5 and text over 600 words', () => {
  expect(() => buildLessons(dir({ 'x.md': front({ minutes: 1 }) + BODY }), rules)).toThrow(/minutes/);
  expect(() => buildLessons(dir({ 'x.md': front({ minutes: 6 }) + BODY }), rules)).toThrow(/minutes/);
  const long = `${BODY}\n${'word '.repeat(600)}\n`;
  expect(() => buildLessons(dir({ 'x.md': front() + long }), rules)).toThrow(/600 words/);
});

test('rejects duplicate ids or orders', () => {
  expect(() => buildLessons(dir({ 'a.md': front(), 'b.md': front({ order: 9 }) }), rules)).toThrow(/duplicate lesson id "charge"/);
  expect(() => buildLessons(dir({ 'a.md': front(), 'b.md': front({ id: 'fight' }) }), rules)).toThrow(/order 8/);
});

test('the real lessons build', () => {
  const { lessons } = buildLessons(join(CONTENT, 'lessons'), rules);
  expect(lessons.length).toBeGreaterThan(0);
  expect(lessons.map((l) => l.order)).toEqual([...lessons.map((l) => l.order)].sort((a, b) => a - b));
});
