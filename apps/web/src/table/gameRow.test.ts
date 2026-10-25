import { expect, test } from 'vitest';
import { testSetup } from './__fixtures__/setup';
import { makeEvent, type Pos, type PlayerTotals, type TableState } from './game';
import { gameStatus, scoreLine } from './gameRow';

const totals: PlayerTotals = { cp: 0, primary: 0, secondary: {}, battleReady: 0, total: 0 };
const stateAt = (pos: Pos | null): TableState => ({
  pos, started: true, ended: null, active: pos ? 'A' : null, players: { A: totals, B: totals }, stratagemsThisPhase: [],
});
const endEvent = makeEvent({ t: 'end', reason: 'agreed' }, null);

test('scoreLine puts A then B around an en dash', () => {
  expect(scoreLine(testSetup(), { A: { total: 13 }, B: { total: 0 } })).toBe('You 13 – 0 Opponent');
});

test('scoreLine follows setup order, not who went first', () => {
  const s = testSetup({ firstTurn: 'B' });
  s.players.B.name = 'Sam';
  expect(scoreLine(s, { A: { total: 2 }, B: { total: 9 } })).toBe('You 2 – 9 Sam');
});

test('gameStatus', () => {
  expect(gameStatus(null)).toBe('');
  expect(gameStatus({ ...stateAt({ round: 2, turn: 1, phase: 'movement' }), ended: null })).toBe('Round 2');
  expect(gameStatus({ ...stateAt(null), ended: endEvent })).toBe('Finished');
  expect(gameStatus({ ...stateAt({ round: 3, turn: 2, phase: 'fight' }), ended: endEvent })).toBe('Finished');
  expect(gameStatus(stateAt(null))).toBe('Finished');
});
