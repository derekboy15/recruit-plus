import type { Roster } from '@recruit/data/roster';
import { expect, test } from 'vitest';
import { canRedo, canUndo, push, redo, start, undo } from './history';

const roster = (name: string): Roster => ({ schema: 1, name, catalogueId: 'c', battleSize: 'strike-force', forces: [] });

test('push, then undo, then redo returns to the pushed roster', () => {
  const a = roster('A');
  const b = roster('B');
  let h = push(start(a), b, 'add-unit', 1000);
  expect(h.present).toBe(b);
  expect(canUndo(h)).toBe(true);
  expect(canRedo(h)).toBe(false);
  h = undo(h);
  expect(h.present).toBe(a);
  expect(canUndo(h)).toBe(false);
  expect(canRedo(h)).toBe(true);
  h = redo(h);
  expect(h.present).toBe(b);
  expect(canRedo(h)).toBe(false);
});

test('undo and redo with nothing to do leave the history as it is', () => {
  const h = start(roster('A'));
  expect(undo(h)).toBe(h);
  expect(redo(h)).toBe(h);
});

test('past is capped at 50 steps', () => {
  let h = start(roster('0'));
  for (let i = 1; i <= 60; i++) h = push(h, roster(String(i)), 'add-unit', i * 2000);
  expect(h.past).toHaveLength(50);
  expect(h.past[0].name).toBe('10');
  let steps = 0;
  while (canUndo(h)) {
    h = undo(h);
    steps++;
  }
  expect(steps).toBe(50);
  expect(h.present.name).toBe('10');
});

test('three renames 200 ms apart make one undo step', () => {
  const a = roster('A');
  let h = push(start(a), roster('N'), 'rename', 1000);
  h = push(h, roster('No'), 'rename', 1200);
  h = push(h, roster('Nov'), 'rename', 1400);
  expect(h.present.name).toBe('Nov');
  expect(h.past).toEqual([a]);
  expect(undo(h).present).toBe(a);
});

test('a rename more than a second after the last is a new step', () => {
  let h = push(start(roster('A')), roster('B'), 'rename', 1000);
  h = push(h, roster('C'), 'rename', 2200);
  expect(h.past.map((r) => r.name)).toEqual(['A', 'B']);
});

test('a remove after a rename is a new step, and a rename after it is too', () => {
  let h = push(start(roster('A')), roster('B'), 'rename', 1000);
  h = push(h, roster('C'), 'remove', 1100);
  h = push(h, roster('D'), 'rename', 1200);
  expect(h.past.map((r) => r.name)).toEqual(['A', 'B', 'C']);
});

test('a rename right after an undo is a new step, not merged into the undone one', () => {
  let h = push(start(roster('A')), roster('B'), 'rename', 1000);
  h = undo(h);
  h = push(h, roster('C'), 'rename', 1100);
  expect(h.past.map((r) => r.name)).toEqual(['A']);
  expect(undo(h).present.name).toBe('A');
});

test('pushing after an undo clears the redo steps', () => {
  let h = push(start(roster('A')), roster('B'), 'add-unit', 1000);
  h = undo(h);
  h = push(h, roster('C'), 'add-unit', 3000);
  expect(canRedo(h)).toBe(false);
  expect(h.future).toEqual([]);
  expect(h.past.map((r) => r.name)).toEqual(['A']);
});
