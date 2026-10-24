import { stateOf } from '@recruit/engine';
import { expect, test } from 'vitest';
import { deployedGame } from '../__fixtures__/game';
import { boardNames } from './names';
import { objectiveLabels } from './objectives';

test('id-only objectives are numbered in setup order', () => {
  expect([...objectiveLabels([{ id: 'a' }, { id: 'b' }, { id: 'n1' }, { id: 'n2' }]).values()]).toEqual(['1', '2', '3', '4']);
});

test('real labels are kept; only unlabelled ones are numbered', () => {
  expect([...objectiveLabels([{ id: 'o1', label: 'North' }, { id: 'n2' }]).values()]).toEqual(['North', '2']);
});

test('labels are keyed by objective id', () => {
  const labels = objectiveLabels([{ id: 'n1' }, { id: 'c', label: 'Centre' }]);
  expect(labels.get('n1')).toBe('1');
  expect(labels.get('c')).toBe('Centre');
});

test('boardNames names objectives the same way, for the board description and the Learn drills', () => {
  const s = stateOf(deployedGame());
  const state = { ...s, setup: { ...s.setup, objectives: s.setup.objectives.map((o, i) => ({ ...o, id: `n${i}` })) } };
  expect(boardNames(state).objective?.('n2')).toBe('3');
});
