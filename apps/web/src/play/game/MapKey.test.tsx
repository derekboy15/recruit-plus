import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { BoardNames } from '../board/BoardSummary';
import type { BoardScene } from '../board/scene';
import { MapKey } from './MapKey';

const names: BoardNames = { unit: (id) => id, army: (p) => (p === 'A' ? 'Necrons' : 'Ultramarines') };
const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
function sceneWith(o: { zones: ('A' | 'B')[]; terrain: BoardScene['terrain'][number]['look'][]; objectives: string[] }): BoardScene {
  return {
    board: { w: 44, h: 30 },
    zones: o.zones.map((player) => ({ player, poly: square })),
    terrain: o.terrain.map((look, i) => ({ id: `t${i}`, poly: square, look, name: look })),
    objectives: o.objectives.map((name, i) => ({ id: `o${i}`, name, pos: { x: i, y: i }, r: 3.8, owner: null })),
    models: [],
    ghosts: [],
    rulers: [],
    rings: [],
    links: [],
  };
}

test('the key lists zones, the terrain kinds on the board and the objectives', async () => {
  render(<MapKey scene={sceneWith({ zones: ['A', 'B'], terrain: ['ruin', 'ruin', 'woods'], objectives: ['1', '2', '3', '4'] })} names={names} />);
  const toggle = screen.getByRole('button', { name: 'Map key' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('region', { name: 'Map key' })).toBeNull();
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const key = screen.getByRole('region', { name: 'Map key' });
  expect(within(key).getByText('Necrons deployment zone')).toBeInTheDocument();
  expect(within(key).getByText('Ultramarines deployment zone')).toBeInTheDocument();
  expect(within(key).getAllByText('Ruins: block sight')).toHaveLength(1);
  expect(within(key).getByText('Woods: dense cover')).toBeInTheDocument();
  expect(within(key).queryByText('Craters: difficult ground')).toBeNull();
  expect(within(key).getByText('Objectives 1–4: hold within 3"')).toBeInTheDocument();
});

test('after deployment no zones are listed', async () => {
  render(<MapKey scene={sceneWith({ zones: [], terrain: [], objectives: ['1'] })} names={names} />);
  await userEvent.click(screen.getByRole('button', { name: 'Map key' }));
  expect(screen.queryByText(/deployment zone/)).toBeNull();
  expect(screen.getByText('Objective 1: hold within 3"')).toBeInTheDocument();
});

test('objectives with real labels are listed by name', async () => {
  render(<MapKey scene={sceneWith({ zones: [], terrain: ['crater'], objectives: ['North', 'Centre', 'South'] })} names={names} />);
  await userEvent.click(screen.getByRole('button', { name: 'Map key' }));
  expect(screen.getByText('Objectives North, Centre, South: hold within 3"')).toBeInTheDocument();
  expect(screen.getByText('Craters: difficult ground')).toBeInTheDocument();
});

test('Escape and a second tap close the key', async () => {
  render(<MapKey scene={sceneWith({ zones: ['A'], terrain: [], objectives: [] })} names={names} />);
  const toggle = screen.getByRole('button', { name: 'Map key' });
  await userEvent.click(toggle);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('region', { name: 'Map key' })).toBeNull();
  expect(toggle).toHaveFocus();
  await userEvent.click(toggle);
  await userEvent.click(toggle);
  expect(screen.queryByRole('region', { name: 'Map key' })).toBeNull();
});
