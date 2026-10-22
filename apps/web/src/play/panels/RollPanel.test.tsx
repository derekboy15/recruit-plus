import { stateOf, type Command, type GameRecord } from '@recruit/engine';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { deployedGame, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { RollPanel } from './RollPanel';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
});

/** The Necron Warriors shoot the Intercessors 16" away: the hit roll window is open. */
function hitRoll(): GameRecord {
  let g = deployedGame({ rollWindows: true, bY: 20 });
  for (let i = 0; i < 3; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  const s = stateOf(g);
  const assignments = s.units['A:war'].modelIds.map((modelId) => ({ modelId, weapon: 'Gauss Flayer', targetUnitId: 'B:int' }));
  g = must(g, { type: 'shoot', by: 'A', unitId: 'A:war', assignments } as Command);
  expect(stateOf(g).pending?.kind).toBe('roll');
  return g;
}
const rollOf = (g: GameRecord) => {
  const s = stateOf(g);
  return s.pending?.kind === 'roll' ? s.rolls[s.pending.rollId] : null;
};
const tray = () => screen.getByRole('group', { name: 'Dice' });

test('shows what is being rolled, the attack so far and the target number', () => {
  renderPanel(RollPanel, hitRoll());
  expect(screen.getByRole('heading', { name: 'Gauss Flayer: hit rolls (3+)' })).toBeInTheDocument();
  expect(screen.getByText('Gauss Flayer vs Intercessor Squad: 10 attacks')).toBeInTheDocument();
  expect(screen.getByText('3+ needed')).toBeInTheDocument();
});

test('a hit roll highlights hits from the weapon\'s Ballistic Skill', () => {
  const g = hitRoll();
  renderPanel(RollPanel, g);
  rollOf(g)!.dice.forEach((d, i) => expect(within(tray()).getByRole('button', { name: `Die ${i + 1}: ${d.value}, ${d.value >= 3 ? 'success' : 'fail'}` })).toBeInTheDocument());
});

test('Accept closes the roll window', async () => {
  const g = hitRoll();
  const h = renderPanel(RollPanel, g);
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
  expect(rollOf(h.record())?.id).not.toBe(rollOf(g)!.id);
});

test('Command Re-roll spends 1 CP and re-rolls the chosen die', async () => {
  const g = hitRoll();
  const h = renderPanel(RollPanel, g);
  await userEvent.click(within(tray()).getAllByRole('button')[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Command Re-roll (1 CP)' }));
  expect(stateOf(h.record()).cp.A).toBe(stateOf(g).cp.A - 1);
  expect(rollOf(h.record())!.dice[0].rerolled).toBe(true);
});

test("re-rolling a die twice shows the engine's refusal", async () => {
  const h = renderPanel(RollPanel, hitRoll());
  await userEvent.click(within(tray()).getAllByRole('button')[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Re-roll selected (ability)' }));
  await userEvent.click(within(tray()).getAllByRole('button')[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Re-roll selected (ability)' }));
  expect(h.problems()[0].message).toBe('A die can never be re-rolled more than once.');
});

test('Change a die sets its value', async () => {
  const h = renderPanel(RollPanel, hitRoll());
  await userEvent.click(within(tray()).getAllByRole('button')[1]);
  await userEvent.click(screen.getByRole('button', { name: 'Change a die…' }));
  await userEvent.click(screen.getByRole('button', { name: 'Make it a 6' }));
  expect(rollOf(h.record())!.dice[1]).toMatchObject({ value: 6, replaced: true });
});
