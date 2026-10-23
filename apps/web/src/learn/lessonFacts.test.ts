/**
 * Every number a lesson states, pinned three ways: it is in the lesson, it is in the Rules Reference section the lesson
 * leans on, and it is what the engine (or the real data) does.
 */
import type { LessonsData, RulesData } from '@recruit/data/model';
import { bestSave, BOARD_SIZES, capMod, hitSucceeds, inRangeOfObjective, MARKER_RADIUS, missionRulesFor, saveSucceeds, stateOf, woundNeeded, type GameState } from '@recruit/engine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { deployedGame, realSheet, ULTRAMARINES } from '../play/__fixtures__/game';

const GENERATED = join(__dirname, '..', '..', '..', '..', 'packages', 'data', 'generated');
const lessons = (JSON.parse(readFileSync(join(GENERATED, 'lessons.json'), 'utf8')) as LessonsData).lessons;
const rules = JSON.parse(readFileSync(join(GENERATED, 'rules.json'), 'utf8')) as RulesData;

/** Backticks around numbers and doubled spaces don't matter. */
const norm = (t: string) => t.replace(/`/g, '').replace(/\s+/g, ' ');
export const lessonText = (id: string) => {
  const l = lessons.find((x) => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return norm([...l.sections.map((s) => s.text), JSON.stringify(l.intro)].join(' '));
};
const sectionText = (ref: string) => {
  const [a, s] = ref.split('#');
  const sec = rules.articles.find((x) => x.id === a)?.sections.find((x) => x.id === s);
  if (!sec) throw new Error(`no section ${ref}`);
  return norm(sec.text);
};

export interface Fact {
  lesson: string;
  /** Exact text that must appear in the lesson. */
  says: string;
  /** Text that must appear in that Rules Reference section. */
  article?: [articleIdAndSection: string, text: string];
  /** expect(...) against the engine or the real data. */
  engine?: () => void;
}

const M = (slug: string, unit: string, profile: string) => {
  const c = realSheet(slug, unit).models.find((p) => p.name === profile)!.chars;
  return c;
};
const moveInches = (c: { M: { kind: string; inches?: number } }) => (c.M.kind === 'fixed' ? c.M.inches : null);

export const FACTS: Fact[] = [
  // ---------- 1. What 40k is ----------
  {
    lesson: 'what-is-40k',
    says: 'A game lasts 5 battle rounds',
    article: ['basics#the-battle-round', 'Most matched play missions last 5 battle rounds'],
    engine: () => expect(missionRulesFor('combat-patrol').battleRounds).toBe(5),
  },
  { lesson: 'what-is-40k', says: 'Each turn has 7 phases, always in this order', article: ['basics#the-battle-round', 'Each turn has seven phases, always in this order'] },
  {
    lesson: 'what-is-40k',
    says: '500 points of models each, on a battlefield 44" by 30"',
    article: ['matched-play#battle-sizes', 'Combat Patrol 500 3 not covered 44" x 30"'],
    engine: () => expect(BOARD_SIZES['combat-patrol']).toEqual({ w: 44, h: 30 }),
  },
  { lesson: 'what-is-40k', says: 'An Intercessor has a Move of 6"', engine: () => expect(moveInches(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor'))).toBe(6) },
  {
    lesson: 'what-is-40k',
    says: 'A model is in range of a marker if it is within 3" of it',
    article: ['matched-play#objective-markers', 'A model is in range of a marker if it is within 3" horizontally'],
    engine: () => {
      // The Lesson 1 drill pins this on the board; here, the engine's measure: base edge to marker edge.
      expect(engineInRange(3.0)).toBe(true);
      expect(engineInRange(3.1)).toBe(false);
    },
  },

  // ---------- 2. Reading a datasheet ----------
  {
    lesson: 'datasheets',
    says: 'Sv 6" 3+ 3+ 4 4 2 2 7 3+',
    engine: () => {
      const c = M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor');
      expect([moveInches(c), c.WS, c.BS, c.S, c.T, c.W, c.A.plus, c.Ld, c.Sv]).toEqual([6, 3, 3, 4, 4, 2, 2, 7, 3]);
    },
  },
  { lesson: 'datasheets', says: 'an Intercessor has a Move of 6"', engine: () => expect(moveInches(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor'))).toBe(6) },
  { lesson: 'datasheets', says: 'an Intercessor has 2 Wounds', engine: () => expect(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor').W).toBe(2) },
  {
    lesson: 'datasheets',
    says: 'An Intercessor saves on 3+; a Necron Warrior saves on 4+',
    engine: () => {
      expect(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor').Sv).toBe(3);
      expect(M('necrons', 'Necron Warriors', 'Necron Warrior').Sv).toBe(4);
    },
  },
  {
    lesson: 'datasheets',
    says: 'D 30" Rapid Fire 1 4 -1 1',
    engine: () => {
      const w = realSheet(ULTRAMARINES, 'Intercessor Squad').weapons.find((x) => x.name === 'Bolt rifle')!;
      expect([w.range, w.type, w.shots.plus, w.s, w.ap, w.d.plus]).toEqual([30, 'Rapid Fire', 1, { kind: 'fixed', v: 4 }, -1, 1]);
    },
  },
  {
    lesson: 'datasheets',
    says: 'Rapid Fire 1 means 1 shot, doubled when the target is within half range (15" for a bolt rifle)',
    article: ['shooting-phase#weapon-types', "Rapid Fire If the target is within half the weapon's range, the weapon makes double its normal number of attacks."],
  },

  // ---------- 3. The attack sequence and wound table ----------
  {
    lesson: 'attacks',
    says: 'S is double T or more 2+ S is higher than T 3+ S equals T 4+ S is lower than T 5+ S is half T or less 6+',
    article: ['shooting-phase#making-attacks', 'S is double T or more 2+ S is higher than T 3+ S equals T 4+ S is lower than T 5+ S is half T or less 6+'],
    engine: () => expect([woundNeeded(8, 4), woundNeeded(5, 4), woundNeeded(4, 4), woundNeeded(3, 4), woundNeeded(2, 4)]).toEqual([2, 3, 4, 5, 6]),
  },
  {
    lesson: 'attacks',
    says: 'An unmodified 6 always hits and always wounds. An unmodified 1 always fails, for hits, wounds and saves alike.',
    article: ['basics#re-rolls-and-modifiers', 'An unmodified hit roll or wound roll of 6 always succeeds, and an unmodified 1 always fails. An unmodified saving throw of 1 always fails.'],
    engine: () => {
      expect(hitSucceeds(6, 7, -1)).toBe(true);
      expect(hitSucceeds(1, 2, 1)).toBe(false);
      expect(saveSucceeds(1, 2, 3)).toBe(false);
    },
  },
  {
    lesson: 'attacks',
    says: 'A hit roll or wound roll can never be changed by more than +1 or -1 in total',
    article: ['basics#re-rolls-and-modifiers', 'A hit roll or a wound roll can never be modified by more than +1 or -1 in total'],
    engine: () => expect([capMod(3), capMod(-2), capMod(0)]).toEqual([1, -1, 0]),
  },
  {
    lesson: 'attacks',
    says: 'a bolt rifle (S 4) against a Necron Warrior (T 4) wounds on 4+',
    engine: () => expect(woundNeeded(4, M('necrons', 'Necron Warriors', 'Necron Warrior').T)).toBe(4),
  },
  {
    lesson: 'attacks',
    says: "Against the Warriors' 4+ save, AP -1 means they need 5+",
    engine: () => {
      const save = bestSave(M('necrons', 'Necron Warriors', 'Necron Warrior'), null, -1, 0, 0, false)!;
      expect(save.needed - save.mod).toBe(5);
    },
  },
  { lesson: 'attacks', says: 'so Rapid Fire doubles their bolt rifles: 10 shots', article: ['shooting-phase#weapon-types', 'the weapon makes double its normal number of attacks'] },
];

/** Is a Necron Warrior (32mm base) whose base edge is `gap` inches from a marker's edge in range of it? */
function engineInRange(gap: number): boolean {
  const s: GameState = stateOf(deployedGame());
  const m = s.models[s.units['A:war'].modelIds[0]];
  return inRangeOfObjective(s, m, { x: m.pos!.x + gap + MARKER_RADIUS + 32 / 25.4 / 2, y: m.pos!.y });
}

describe('lesson facts', () => {
  for (const f of FACTS) {
    test(`${f.lesson}: "${f.says}"`, () => {
      expect(f.article || f.engine, 'a fact needs an article or an engine check').toBeTruthy();
      expect(lessonText(f.lesson)).toContain(norm(f.says));
      if (f.article) expect(sectionText(f.article[0])).toContain(norm(f.article[1]));
      f.engine?.();
    });
  }
});
