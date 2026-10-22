import { describe, expect, test } from 'vitest';
import { testSetup } from './__fixtures__/setup';
import { generatedMissions, mission } from './__fixtures__/missions';
import { cpDecisionsNeeded, dueScoring, scoredAt } from './flow';
import { makeEvent, type EventBody, type Pos, type TableGameData, type TableSetup } from './game';

const game = (s: TableSetup, events: [EventBody, Pos][]): TableGameData => ({
  mode: 'table', schema: 1, setup: s, events: [makeEvent({ t: 'start' }, null), ...events.map(([e, p]) => makeEvent(e, p))],
});
const at = (round: number, turn: 1 | 2, phase: Pos['phase']): Pos => ({ round, turn, phase });

describe('dueScoring', () => {
  test('nothing to score at the end of the Command phase in round 1', () => {
    expect(dueScoring(mission('aoo-cleanse-the-land'), testSetup(), at(1, 1, 'command'), 'end-of-command-phase')).toEqual([]);
  });
  test('round 2: the active player scores the hold at the end of their Command phase', () => {
    const due = dueScoring(mission('aoo-cleanse-the-land'), testSetup({ firstTurn: 'B' }), at(2, 1, 'command'), 'end-of-command-phase');
    expect(due.map((d) => [d.player, d.component.id, d.category])).toEqual([['B', 'hold', 'primary']]);
  });
  test('round 5: the second player scores the hold at the end of their turn', () => {
    const m = mission('aoo-cleanse-the-land');
    expect(dueScoring(m, testSetup(), at(5, 2, 'command'), 'end-of-command-phase')).toEqual([]);
    expect(dueScoring(m, testSetup(), at(5, 2, 'morale'), 'end-of-turn').map((d) => d.component.id)).toEqual(['hold', 'direct-assault']);
    expect(dueScoring(m, testSetup(), at(5, 1, 'command'), 'end-of-command-phase').map((d) => d.component.id)).toEqual(['hold']);
  });
  test("end of round: 'each' components are due for both players, first player first", () => {
    const due = dueScoring(mission('aoo-recover-the-relics'), testSetup({ firstTurn: 'B' }), at(1, 2, 'morale'), 'end-of-round');
    expect(due.map((d) => [d.player, d.component.id])).toEqual([['B', 'break-them'], ['A', 'break-them']]);
  });
  test('end of battle components for both players', () => {
    const due = dueScoring(mission('aoo-ascension'), testSetup(), at(5, 2, 'morale'), 'end-of-battle');
    expect(due.map((d) => [d.player, d.component.id])).toEqual([['A', 'ascend-end'], ['B', 'ascend-end']]);
  });
  test("a chosen mission secondary is due for its player only", () => {
    const s = testSetup({ pack: 'core-book', battleSize: 'combat-patrol', missionId: 'cb-incisive-attack' });
    s.players.A.secondaries = ['cb-incisive-attack-surgical-assault', 'cb-assassinate', 'cb-attrition'];
    s.players.B.secondaries = ['cb-assassinate', 'cb-attrition', 'cb-linebreaker'];
    const m = mission('cb-incisive-attack');
    const a = dueScoring(m, s, at(1, 1, 'morale'), 'end-of-turn');
    expect(a.map((d) => [d.player, d.component.id, d.category, d.sourceId])).toEqual([['A', 'surgical-assault', 'secondary', 'cb-incisive-attack-surgical-assault']]);
    expect(dueScoring(m, s, at(1, 2, 'morale'), 'end-of-turn')).toEqual([]);
  });
  test('on-action components are listed for the active player', () => {
    const due = dueScoring(mission('aoo-surge-of-faith'), testSetup(), at(2, 2, 'movement'), 'on-action');
    expect(due.map((d) => [d.player, d.component.id])).toEqual([['B', 'surge-of-faith']]);
  });
  test('a component already scored at this position is not due again', () => {
    const s = testSetup();
    const m = mission('aoo-cleanse-the-land');
    const pos = at(2, 1, 'command');
    const g = game(s, [[{ t: 'vp', player: 'A', category: 'primary', sourceId: 'hold', vp: 8, detail: '' }, pos]]);
    expect(scoredAt(g, pos, 'A', 'hold')).toBe(true);
    expect(dueScoring(m, s, pos, 'end-of-command-phase', g)).toEqual([]);
  });
});

describe('cpDecisionsNeeded', () => {
  test('Arks of Omen: both players need a CP decision in each Command phase', () => {
    const g = game(testSetup(), []);
    expect(cpDecisionsNeeded(g, mission('aoo-cleanse-the-land'), at(1, 1, 'command'))).toEqual(['A', 'B']);
  });
  test('Core Book: only the active player', () => {
    const g = game(testSetup({ pack: 'core-book', firstTurn: 'B' }), []);
    expect(cpDecisionsNeeded(g, mission('cb-incisive-attack'), at(1, 1, 'command'))).toEqual(['B']);
  });
  test('a bonus event at this position settles it; outside the Command phase there is nothing', () => {
    const pos = at(2, 1, 'command');
    const g = game(testSetup(), [[{ t: 'cp', player: 'A', delta: 1, reason: 'bonus' }, pos]]);
    expect(cpDecisionsNeeded(g, mission('aoo-cleanse-the-land'), pos)).toEqual(['B']);
    expect(cpDecisionsNeeded(g, mission('aoo-cleanse-the-land'), at(2, 1, 'movement'))).toEqual([]);
  });
  test('every mission has data for the flow', () => {
    for (const m of generatedMissions().missions) expect(m.primary.components.length, m.id).toBeGreaterThan(0);
  });
});
