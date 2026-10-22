import { dispatch, stateOf, totalVp, type Command, type GameRecord } from '@recruit/engine';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { deployedGame } from '../__fixtures__/game';
import { ScoreSheet } from './ScoreSheet';

function Harness({ start, out }: { start: GameRecord; out: { g: GameRecord } }) {
  const [g, setG] = useState(start);
  out.g = g;
  return (
    <ScoreSheet
      state={stateOf(g)}
      act={(cmd: Command) => {
        const r = dispatch(g, cmd);
        if (!r.ok) return r.problems;
        setG(r.game);
        return null;
      }}
      onClose={() => {}}
    />
  );
}

test('the score sheet shows each army\'s VP and objective control, and adds secondary and painted VP', async () => {
  const out = { g: deployedGame() };
  render(<Harness start={out.g} out={out} />);
  const sheet = screen.getByRole('dialog', { name: 'Score' });
  expect(within(sheet).getByText('Objective 1: Necrons')).toBeInTheDocument();
  const necrons = within(sheet).getByRole('group', { name: 'Necrons' });
  await userEvent.type(within(necrons).getByRole('textbox', { name: 'Secondary objective' }), 'Engage on All Fronts');
  await userEvent.click(within(necrons).getByRole('button', { name: 'More VP' }));
  await userEvent.click(within(necrons).getByRole('button', { name: 'More VP' }));
  await userEvent.click(within(necrons).getByRole('button', { name: 'Add 3 VP' }));
  expect(stateOf(out.g).vp.A.secondary).toEqual({ 'Engage on All Fronts': 3 });
  await userEvent.click(within(necrons).getByRole('button', { name: 'Painted army (10 VP)' }));
  expect(totalVp(stateOf(out.g), 'A')).toBe(13);
  expect(within(necrons).getByText(/Primary 0 · Secondary 3 · Painted 10/)).toBeInTheDocument();
});
