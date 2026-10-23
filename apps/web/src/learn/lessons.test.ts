/** The Learn path as a whole: the 15 lessons the spec lists, in its order, each with a drill. */
import type { LessonsData } from '@recruit/data/model';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { DRILLS } from './drills';

const GENERATED = join(__dirname, '..', '..', '..', '..', 'packages', 'data', 'generated');
const { lessons } = JSON.parse(readFileSync(join(GENERATED, 'lessons.json'), 'utf8')) as LessonsData;

describe('the Learn path', () => {
  test('there are exactly 15 lessons, in the spec order, with these ids', () => {
    expect(lessons.map((l) => [l.order, l.id])).toEqual(
      [
        'what-is-40k',
        'datasheets',
        'attacks',
        'command-phase',
        'movement',
        'psychic',
        'shooting',
        'charge',
        'fight',
        'morale',
        'objectives',
        'stratagems',
        'terrain',
        'army-building',
        'mission-setup',
      ].map((id, i) => [i + 1, id]),
    );
  });

  test('every lesson has a drill and every drill a lesson', () => {
    expect(lessons.map((l) => l.drill).sort()).toEqual(Object.keys(DRILLS).sort());
    for (const l of lessons) expect(DRILLS[l.drill].id).toBe(l.id);
  });

  test('every lesson is 2–5 minutes and has at least one rules link and one key word', () => {
    for (const l of lessons) {
      expect(l.minutes, l.id).toBeGreaterThanOrEqual(2);
      expect(l.minutes, l.id).toBeLessThanOrEqual(5);
      expect(l.rules.length, l.id).toBeGreaterThan(0);
      expect(l.glossary.length, l.id).toBeGreaterThan(0);
    }
  });
});
