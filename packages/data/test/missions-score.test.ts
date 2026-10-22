import { describe, expect, test } from 'vitest';
import { cpBonusPlan, dueComponents, holdConditions, scoreComponent } from '../src/missions/score';
import type { CpRule, ScoringComponent } from '../src/missions/types';

const EVERY = [1, 2, 3, 4, 5];
const H4: ScoringComponent = { id: 'hold', kind: 'hold', mode: 'take-and-hold', vpPerCondition: 4, max: 12, when: 'end-of-command-phase', rounds: [2, 3, 4, 5], who: 'active', round5SecondPlayer: 'end-of-turn', source: 'test' };
const H5: ScoringComponent = { id: 'hold', kind: 'hold', mode: 'take-and-hold', vpPerCondition: 5, max: 15, when: 'end-of-command-phase', rounds: [2, 3, 4, 5], who: 'active', source: 'test' };
const at = { round: 3, player: 'A' as const };

describe('holdConditions', () => {
  test('take and hold: 1+, 2+, more than the opponent', () => {
    expect(holdConditions('take-and-hold', 2, 1)).toBe(3);
    expect(holdConditions('take-and-hold', 1, 1)).toBe(1);
    expect(holdConditions('take-and-hold', 0, 0)).toBe(0);
  });
  test('domination: 2+, 3+, more than the opponent', () => {
    expect(holdConditions('domination', 2, 2)).toBe(1);
    expect(holdConditions('domination', 3, 1)).toBe(3);
  });
});

describe('scoreComponent', () => {
  test('H4 scores 4 per condition, max 12', () => {
    expect(scoreComponent(H4, { controlled: 3, opponentControlled: 1 }, at)).toBe(12);
    expect(scoreComponent(H4, { controlled: 1, opponentControlled: 2 }, at)).toBe(4);
  });
  test('H5 scores 5 per condition', () => {
    expect(scoreComponent(H5, { controlled: 2, opponentControlled: 1 }, at)).toBe(15);
  });
  test('byCount [0,2,3]', () => {
    const c: ScoringComponent = { id: 'da', kind: 'lines', combine: { byCount: [0, 2, 3] }, when: 'end-of-turn', rounds: EVERY, who: 'active', source: 't',
      lines: [{ kind: 'flag', id: 'a', label: 'a', vp: 0 }, { kind: 'flag', id: 'b', label: 'b', vp: 0 }] };
    expect(scoreComponent(c, { flags: { a: true } }, at)).toBe(2);
    expect(scoreComponent(c, { flags: { a: true, b: true } }, at)).toBe(3);
    expect(scoreComponent(c, {}, at)).toBe(0);
  });
  test('gate flag zero unless set', () => {
    const c: ScoringComponent = { id: 'inload', kind: 'lines', combine: 'sum', max: 3, when: 'end-of-turn', rounds: EVERY, who: 'active', source: 't',
      lines: [{ kind: 'flag', id: 'done', label: 'done', vp: 0, gate: true }, { kind: 'count', id: 'held', label: 'held', vpEach: 1 }] };
    expect(scoreComponent(c, { counts: { held: 3 } }, at)).toBe(0);
    expect(scoreComponent(c, { flags: { done: true }, counts: { held: 3 } }, at)).toBe(3);
    expect(scoreComponent(c, { flags: { done: true }, counts: { held: 5 } }, at)).toBe(3);
  });
  test('count vpEach by round', () => {
    const c: ScoringComponent = { id: 'sls', kind: 'lines', combine: 'sum', when: 'end-of-turn', rounds: [3, 4, 5], who: 'active', source: 't',
      lines: [{ kind: 'count', id: 'nml', label: 'nml', vpEach: { '3': 2, '4': 3, '5': 4 } }] };
    expect(scoreComponent(c, { counts: { nml: 2 } }, { round: 3, player: 'A' })).toBe(4);
    expect(scoreComponent(c, { counts: { nml: 2 } }, { round: 4, player: 'A' })).toBe(6);
    expect(scoreComponent(c, { counts: { nml: 2 } }, { round: 5, player: 'A' })).toBe(8);
  });
  test('table lookup clamps to the last entry', () => {
    const c: ScoringComponent = { id: 'recon', kind: 'lines', combine: 'sum', when: 'end-of-battle', rounds: [5], who: 'each', source: 't',
      lines: [{ kind: 'table', id: 'n', label: 'n', vpByCount: [0, 3, 6, 10, 15] }] };
    expect(scoreComponent(c, { counts: { n: 4 } }, at)).toBe(15);
    expect(scoreComponent(c, { counts: { n: 6 } }, at)).toBe(15);
    expect(scoreComponent(c, { counts: { n: 2 } }, at)).toBe(6);
  });
  test('pick per player', () => {
    const c: ScoringComponent = { id: 'surge', kind: 'lines', combine: 'sum', when: 'on-action', rounds: EVERY, who: 'active', source: 't',
      lines: [{ kind: 'pick', id: 'obj', label: 'obj', options: [
        { id: 'A', label: 'A', vp: { A: null, B: 4 } }, { id: 'B', label: 'B', vp: { A: 2, B: 3 } },
        { id: 'C', label: 'C', vp: { A: 3, B: 2 } }, { id: 'D', label: 'D', vp: { A: 4, B: null } }] }] };
    expect(scoreComponent(c, { pick: 'C' }, { round: 2, player: 'A' })).toBe(3);
    expect(scoreComponent(c, { pick: 'C' }, { round: 2, player: 'B' })).toBe(2);
    expect(scoreComponent(c, { pick: 'A' }, { round: 2, player: 'A' })).toBe(0);
  });
  test('negative flag', () => {
    const c: ScoringComponent = { id: 'cg', kind: 'lines', combine: 'sum', when: 'end-of-turn', rounds: EVERY, who: 'active', source: 't',
      lines: [{ kind: 'flag', id: 'enemy', label: 'e', vp: 4 }, { kind: 'flag', id: 'nml', label: 'n', vp: 2 }, { kind: 'flag', id: 'lose', label: 'l', vp: -1 }] };
    expect(scoreComponent(c, { flags: { lose: true } }, at)).toBe(-1);
    expect(scoreComponent(c, { flags: { enemy: true, nml: true, lose: true } }, at)).toBe(5);
  });
  test('combine max', () => {
    const c: ScoringComponent = { id: 'st', kind: 'lines', combine: 'max', when: 'end-of-battle', rounds: [5], who: 'active', source: 't',
      lines: [{ kind: 'flag', id: 'a', label: 'a', vp: 4 }, { kind: 'flag', id: 'b', label: 'b', vp: 8 }] };
    expect(scoreComponent(c, { flags: { a: true, b: true } }, at)).toBe(8);
    expect(scoreComponent(c, { flags: { a: true } }, at)).toBe(4);
  });
});

describe('dueComponents', () => {
  test("round 5: second player's hold is due at end of turn, not end of Command phase", () => {
    expect(dueComponents([H4], { at: 'end-of-command-phase', round: 5, activeIsFirst: false })).toEqual([]);
    expect(dueComponents([H4], { at: 'end-of-turn', round: 5, activeIsFirst: false })).toEqual([H4]);
    expect(dueComponents([H4], { at: 'end-of-command-phase', round: 5, activeIsFirst: true })).toEqual([H4]);
    expect(dueComponents([H4], { at: 'end-of-turn', round: 5, activeIsFirst: true })).toEqual([]);
  });
  test('H5 has no round-5 exception', () => {
    expect(dueComponents([H5], { at: 'end-of-command-phase', round: 5, activeIsFirst: false })).toEqual([H5]);
    expect(dueComponents([H5], { at: 'end-of-turn', round: 5, activeIsFirst: false })).toEqual([]);
  });
  test('round 1 hold is never due', () => {
    expect(dueComponents([H4, H5], { at: 'end-of-command-phase', round: 1, activeIsFirst: true })).toEqual([]);
  });
  test('only components for the moment are due', () => {
    const eot: ScoringComponent = { id: 'x', kind: 'lines', combine: 'sum', lines: [], when: 'end-of-turn', rounds: [1, 2, 3, 4], who: 'active', source: 't' };
    expect(dueComponents([H4, eot], { at: 'end-of-turn', round: 2, activeIsFirst: true })).toEqual([eot]);
    expect(dueComponents([eot], { at: 'end-of-turn', round: 5, activeIsFirst: true })).toEqual([]);
  });
});

describe('cpBonusPlan', () => {
  const both: CpRule = { who: 'both', gates: [], extras: [], source: 't' };
  const active: CpRule = { who: 'active', gates: [], extras: [], source: 't' };
  const secretIntel: CpRule = { who: 'both', gates: [{ id: 'si', rounds: [1, 2], onNo: 'lose' }], extras: [{ id: 'si-extra', rounds: [4, 5], cp: 1 }], source: 't' };
  test('both: the non-active player gains 1 too', () => {
    expect(cpBonusPlan(both, { round: 2, player: 'B', active: 'A' }).base).toBe(1);
  });
  test('active: the non-active player gains nothing', () => {
    expect(cpBonusPlan(active, { round: 2, player: 'B', active: 'A' }).base).toBe(0);
    expect(cpBonusPlan(active, { round: 2, player: 'A', active: 'A' }).base).toBe(1);
  });
  test('Secret Intel Inbound', () => {
    expect(cpBonusPlan(secretIntel, { round: 1, player: 'A', active: 'A' }).base).toBe(0);
    expect(cpBonusPlan(secretIntel, { round: 4, player: 'A', active: 'A' }).extras.map((e) => e.cp)).toEqual([1]);
    expect(cpBonusPlan(secretIntel, { round: 4, player: 'B', active: 'A' }).extras).toEqual([]);
    expect(cpBonusPlan(secretIntel, { round: 3, player: 'A', active: 'A' })).toEqual({ base: 1, gates: [], extras: [] });
  });
  test('gates with a question are passed on for this round', () => {
    const gated: CpRule = { who: 'both', gates: [{ id: 'g', question: 'Q?', onNo: 'roll-1-3-lose' }], extras: [], source: 't' };
    const plan = cpBonusPlan(gated, { round: 2, player: 'B', active: 'A' });
    expect(plan.base).toBe(1);
    expect(plan.gates.map((g) => g.id)).toEqual(['g']);
  });
});
