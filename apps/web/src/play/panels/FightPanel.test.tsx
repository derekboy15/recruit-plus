import { dispatch, stateOf, type Command, type GameRecord, type Pos } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { chargePhase, must } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { FightPanel } from './FightPanel';

/** The Warriors charged the Intercessors (all of them moved 4.4" closer); now the Fight phase. */
function fightPhase(): GameRecord {
  let g = chargePhase([6, 5]);
  g = must(g, { type: 'declareCharge', by: 'A', unitId: 'A:war', targetIds: ['B:int'] } as Command);
  g = must(g, { type: 'respond', by: 'B', choice: 'decline' } as Command);
  const moves = Object.fromEntries(
    stateOf(g).units['A:war'].modelIds.map((id): [string, { to: Pos }] => {
      const p = stateOf(g).models[id].pos!;
      return [id, { to: { ...p, y: p.y + 4.4 } }];
    }),
  );
  g = must(g, { type: 'chargeMove', by: 'A', unitId: 'A:war', moves } as Command);
  g = must(g, { type: 'endStep', by: 'A' } as Command);
  g = must(g, { type: 'endStep', by: 'A' } as Command);
  expect(stateOf(g).phase).toBe('fight');
  return g;
}

test('the fight panel picks the unit the engine says must fight and makes its attacks', async () => {
  const h = renderPanel(FightPanel, fightPhase());
  expect(screen.getByRole('heading', { name: 'Necrons picks a unit to fight' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Intercessor Squad/ })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /Necron Warriors/ }));
  await userEvent.click(screen.getByRole('button', { name: "Don't pile in" }));
  expect(screen.getByText(/Necron Warrior ×\d+/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Fight' }));
  await userEvent.click(screen.getByRole('button', { name: "Don't consolidate" }));
  expect(h.record().batches.flatMap((b) => b.events.map((e) => e.type))).toContain('unitFought');
});

test("attack steppers must add up to the model's Attacks", async () => {
  const h = renderPanel(FightPanel, fightPhase());
  await userEvent.click(screen.getByRole('button', { name: /Necron Warriors/ }));
  await userEvent.click(screen.getByRole('button', { name: "Don't pile in" }));
  await userEvent.click(screen.getAllByRole('button', { name: /^More attacks/ })[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Fight' }));
  expect(h.problems()[0].message).toMatch(/That model makes 1 attack/);
  expect(dispatch(h.record(), { type: 'consolidate', by: 'A', unitId: 'A:war', moves: {} } as Command).ok).toBe(false);
});
