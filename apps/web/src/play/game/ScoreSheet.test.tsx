import { ARKS_OF_OMEN, dispatch, newGame, stateOf, totalVp, type Command, type GameRecord } from '@recruit/engine';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { deployedGame, sampleSetup } from '../__fixtures__/game';
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

test('objectives with only an id are numbered on the score sheet', () => {
  const s = stateOf(deployedGame());
  const ids = ['a', 'b', 'n1', 'n2'];
  const state = { ...s, setup: { ...s.setup, objectives: s.setup.objectives.map((o, i) => ({ ...o, id: ids[i] })) } };
  render(<ScoreSheet state={state} act={() => null} onClose={() => {}} />);
  expect(screen.getByText('Objective 3: nobody')).toBeInTheDocument();
  expect(screen.queryByText(/Objective n1/)).toBeNull();
});

test('the score sheet says when primary VP are scored, by mission pack', () => {
  const core = render(<ScoreSheet state={stateOf(deployedGame())} act={() => null} onClose={() => {}} />);
  expect(screen.getByText(/at the end of each player's Command phase from battle round 2\.$/)).toBeInTheDocument();
  core.unmount();
  const aoo = stateOf(newGame({ ...sampleSetup(), rules: { ...ARKS_OF_OMEN } }));
  render(<ScoreSheet state={aoo} act={() => null} onClose={() => {}} />);
  expect(screen.getByText(/in battle round 5 the player going second scores at the end of their turn instead\.$/)).toBeInTheDocument();
});
