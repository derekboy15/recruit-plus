import type { LogLine } from '@recruit/engine';
import { expect, test } from 'vitest';
import { logGroups, sentenceCase } from './logGroups';

const line = (seq: number, round: number, text: string): LogLine => ({ seq, round, phase: 'movement', text });

test('groups by phase start, newest first, sentence case, headings dropped', () => {
  const groups = logGroups([
    line(1, 0, 'first turn: rolled 4.'),
    line(2, 1, "Battle round 1: Necrons' Command phase."),
    line(3, 1, 'Necrons gained 1 CP (Command phase): now 4.'),
    line(4, 1, "Battle round 1: Necrons' Movement phase."),
    line(5, 1, 'Necron Warriors made a Normal Move.'),
    line(6, 1, 'Necron Warriors Remained Stationary.'),
  ]);
  expect(groups.map((g) => g.title)).toEqual(["Round 1 · Necrons' Movement phase", "Round 1 · Necrons' Command phase", 'Before the battle']);
  expect(groups[0].lines.map((l) => l.text)).toEqual(['Necron Warriors Remained Stationary.', 'Necron Warriors made a Normal Move.']);
  expect(groups[2].lines[0].text).toBe('First turn: rolled 4.');
  expect(groups.flatMap((g) => g.lines.map((l) => l.text))).not.toContain("Battle round 1: Necrons' Movement phase.");
});

test('keys are unique even when one command logs several lines with the same seq', () => {
  const groups = logGroups([line(1, 0, 'a.'), line(1, 0, 'b.'), line(2, 1, 'Battle round 1: X’s Command phase.'), line(2, 1, 'c.')]);
  const keys = [...groups.map((g) => g.key), ...groups.flatMap((g) => g.lines.map((l) => l.key))];
  expect(new Set(keys).size).toBe(keys.length);
});

test('a phase that has only just started shows with no lines; an empty log has no groups', () => {
  expect(logGroups([line(1, 1, "Battle round 1: Necrons' Command phase.")])).toEqual([{ key: expect.any(String), title: "Round 1 · Necrons' Command phase", lines: [] }]);
  expect(logGroups([])).toEqual([]);
});

test('sentenceCase capitalises the first letter only', () => {
  expect(sentenceCase('first turn: rolled 4.')).toBe('First turn: rolled 4.');
  expect(sentenceCase('')).toBe('');
});
