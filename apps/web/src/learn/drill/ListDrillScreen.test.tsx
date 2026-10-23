import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../../lists/__fixtures__/generatedData';
import { WordingProvider } from '../../rules/wording';
import { armyBuilding } from '../drills/l14-army-building';
import { ListDrillScreen } from './ListDrillScreen';

beforeEach(() => {
  resetDataCache();
  stubGeneratedData();
});
afterEach(() => vi.unstubAllGlobals());

const show = (onDone = vi.fn()) =>
  render(
    <WordingProvider initial="plain">
      <MemoryRouter>
        <ListDrillScreen drill={armyBuilding} onDone={onDone} exitTo="/learn/army-building" />
      </MemoryRouter>
    </WordingProvider>,
  );
const card = () => screen.getByRole('region', { name: 'Drill' });

describe('ListDrillScreen', () => {
  test('shows the list, its points and the builder’s problems, and finishes when the Patrol is fixed', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    show(onDone);
    const list = await screen.findByRole('region', { name: 'Your list' });
    expect(within(within(list).getByRole('list', { name: 'Units' })).getByText(/Captain/)).toBeInTheDocument();
    expect(within(list).getByRole('meter', { name: 'Points' })).toHaveTextContent('85 / 500 pts');
    const problems = within(list).getByRole('list', { name: 'Problems with this list' });
    expect(within(problems).getByText(/needs 1 more Troops unit/)).toBeInTheDocument();

    await user.click(within(card()).getByRole('radio', { name: 'A Troops unit' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    const add = screen.getByRole('group', { name: 'Add a unit' });
    await user.click(within(add).getByRole('button', { name: /^Intercessor Squad/ }));
    expect(within(list).getByRole('meter', { name: 'Points' })).toHaveTextContent('175 / 500 pts');
    expect(within(problems).queryByText(/Troops/)).toBeNull();

    await user.click(within(card()).getByRole('radio', { name: 'No' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    await user.click(within(card()).getByRole('radio', { name: 'Yes' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    expect(within(card()).getByRole('heading', { name: 'Drill complete' })).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith(0);
  });

  test('adding a unit while a question is open says to answer first', async () => {
    const user = userEvent.setup();
    show();
    const add = await screen.findByRole('group', { name: 'Add a unit' });
    await user.click(within(add).getByRole('button', { name: /^Hellblaster Squad/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Answer the question first.');
  });
});
