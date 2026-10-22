import { newGame, stateOf, type Command, type GameRecord, type GameSetup, type Pos } from '@recruit/engine';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { must, realSheet, sampleSetup } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { PlacementPanel } from './PlacementPanel';

const at = (x: number, y: number): Pos => ({ x, y, z: 0, rot: 0 });

/** A Ghost Ark carrying the Necron Warriors is destroyed by mortal wounds: the Warriors must get out. */
function wrecked(): GameRecord {
  const base = sampleSetup({ rollWindows: false });
  const ark = { id: 'A:ark', datasheet: realSheet('necrons', 'Ghost Ark'), models: [{ profile: 'Ghost Ark', weapons: ['Gauss Flayer Array'], count: 1 }] };
  const setup: GameSetup = { ...base, armies: [{ ...base.armies[0], units: [...base.armies[0].units, ark] }, base.armies[1]] };
  let g = newGame(setup);
  const ints = stateOf(g).units['B:int'].modelIds;
  g = must(g, { type: 'deploy', by: 'B', unitId: 'B:int', positions: Object.fromEntries(ints.map((id, i) => [id, at(18 + i * 1.5, 26)])) } as Command);
  g = must(g, { type: 'deploy', by: 'A', unitId: 'A:ark', positions: { 'A:ark.m1': at(22, 5) }, embarked: ['A:war'] } as Command);
  g = must(g, { type: 'beginBattle', by: 'A' } as Command);
  g = must(g, { type: 'inflictMortalWounds', by: 'B', unitId: 'A:ark', count: 20 } as Command);
  expect(stateOf(g).placements).toHaveLength(1);
  return g;
}

test('set up the passengers of a destroyed transport near where it was', async () => {
  const h = renderPanel(PlacementPanel, wrecked());
  expect(screen.getByRole('heading', { name: /Ghost Ark was destroyed/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Necron Warriors/ }));
  h.tap({ x: 22, y: 5 });
  const keep = screen.getByRole('button', { name: 'Keep Necron Warriors here' });
  await waitFor(() => expect(keep).toBeEnabled());
  await userEvent.click(keep);
  await userEvent.click(screen.getByRole('button', { name: 'Set them up' }));
  const s = stateOf(h.record());
  expect(s.placements).toEqual([]);
  expect(s.units['A:war'].location).toBe('battlefield');
});
