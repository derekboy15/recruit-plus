import { objectiveName, stateOf } from '@recruit/engine';
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

test('compass codes made from ids on a turned map are numbered too, so a mission reads the same at every size', () => {
  expect([...objectiveLabels([{ id: 'a' }, { id: 'b' }, { id: 'nw', label: 'ne' }, { id: 'se', label: 'sw' }, { id: 'n1', label: 'e1' }]).values()]).toEqual(['1', '2', '3', '4', '5']);
  expect([...objectiveLabels([{ id: 'a1', label: 'A' }, { id: 'c', label: 'C' }, { id: 'x', label: 'Relic' }]).values()]).toEqual(['A', 'C', 'Relic']);
});

test('labels are keyed by objective id', () => {
  const labels = objectiveLabels([{ id: 'n1' }, { id: 'c', label: 'Centre' }]);
  expect(labels.get('n1')).toBe('1');
  expect(labels.get('c')).toBe('Centre');
});

test("the engine's log names objectives the same way (objectiveName)", () => {
  const objectives = [{ id: 'a' }, { id: 'nw', label: 'ne' }, { id: 'c', label: 'Centre' }, { id: 'n1', label: 'e1' }, { id: 'x', label: 'Relic' }];
  const labels = objectiveLabels(objectives);
  expect(objectives.map((o) => objectiveName(objectives, o.id))).toEqual(objectives.map((o) => labels.get(o.id)));
});

test('boardNames names objectives the same way, for the board description and the Learn drills', () => {
  const s = stateOf(deployedGame());
  const state = { ...s, setup: { ...s.setup, objectives: s.setup.objectives.map((o, i) => ({ ...o, id: `n${i}` })) } };
  expect(boardNames(state).objective?.('n2')).toBe('3');
});
