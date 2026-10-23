import { stateOf } from '@recruit/engine';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { deployedGame } from '../__fixtures__/game';
import { BoardSummary, describeModel } from './BoardSummary';
import { buildScene } from './scene';

const scene = () => {
  const s = buildScene(stateOf(deployedGame()), { selectedUnitId: 'A:war', plan: null, invalidModelIds: [], rings: [], targetUnitIds: [] });
  return { ...s, objectives: s.objectives.map((o, i) => ({ ...o, owner: i === 0 ? ('A' as const) : null })) };
};
const names = { unit: (id: string) => (id === 'A:war' ? 'Necron Warriors' : 'Intercessor Squad'), army: (p: string) => (p === 'A' ? 'Necrons' : 'Ultramarines') };

test('lists units with model counts and objectives with controller', () => {
  render(<BoardSummary id="board-summary" scene={scene()} names={names} live="" />);
  const summary = document.getElementById('board-summary')!;
  expect(summary).toHaveClass('sr-only');
  const text = summary.textContent!;
  expect(text).toContain('44 by 30 inches');
  expect(text).toContain('Necron Warriors (Necrons): 10 models, selected');
  expect(text).toContain('Intercessor Squad (Ultramarines): 5 models');
  expect(text).toMatch(/Objective \S+: held by Necrons/);
  expect(text).toMatch(/Objective \S+: no one holds it/);
});

test('announces the grabbed model position', () => {
  const s = scene();
  const m = s.models.find((x) => x.unitId === 'A:war')!;
  const line = describeModel(s, m.id, names, { grabbed: true });
  expect(line).toMatch(/^Necron Warriors, model 1, picked up: [\d.]+ inches from the left, [\d.]+ inches from the bottom$/);
  render(<BoardSummary id="b" scene={s} names={names} live={line} />);
  expect(screen.getByRole('status')).toHaveTextContent(line);
});
