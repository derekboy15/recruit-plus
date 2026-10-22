import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogueOut } from '@recruit/data/model';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { WordingProvider } from '../rules/wording';
import { resetDataCache } from './dataClient';
import { DatasheetPage } from './DatasheetPage';
import { necronWarriors, necrons } from './__fixtures__/necrons';

afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
  localStorage.clear();
});

function renderDatasheet(cat: CatalogueOut) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(cat))));
  render(
    <WordingProvider>
      <MemoryRouter initialEntries={['/factions/necrons/units/necron-warriors']}>
        <Routes>
          <Route path="/factions/:slug/units/:unitSlug" element={<DatasheetPage />} />
        </Routes>
      </MemoryRouter>
    </WordingProvider>,
  );
}

const withPlain: CatalogueOut = {
  ...necrons,
  units: [
    {
      ...necronWarriors,
      weapons: [
        {
          name: 'Gauss Flayer',
          chars: { Range: '24"', Type: 'Rapid Fire 1', S: '4', AP: '-1', D: '1', Abilities: 'Each time an attack is made with this weapon, an unmodified hit roll of 6 scores 1 additional hit.' },
          plain: { Abilities: 'An unmodified 6 to hit with this weapon scores 1 extra hit.' },
        },
      ],
      abilities: [
        { name: 'Reanimation Protocols', text: 'Models may stand back up.', source: 'bsdata', plain: 'Destroyed models can come back.' },
        { name: 'Their Number Is Legion', text: 'Re-roll Reanimation Protocol rolls of 1.', source: 'bsdata' },
      ],
    },
  ],
};

test('renders the Necron Warriors datasheet', async () => {
  renderDatasheet(necrons);
  expect(await screen.findByRole('heading', { name: 'Necron Warriors' })).toBeInTheDocument();
  const statRow = screen.getByRole('row', { name: /Necron Warrior 5"/ });
  expect(statRow).toHaveTextContent('4+');
  expect(screen.getByRole('columnheader', { name: 'T' })).toBeInTheDocument();
  expect(screen.getByText('Gauss Flayer')).toBeInTheDocument();
  expect(screen.getByText(/110 pts/)).toBeInTheDocument();
  expect(screen.queryByText(/arrive in Milestone 3/)).not.toBeInTheDocument();
});

test('abilities and weapon abilities show plain English by default', async () => {
  renderDatasheet(withPlain);
  expect(await screen.findByText('Destroyed models can come back.')).toBeInTheDocument();
  expect(screen.getByText('An unmodified 6 to hit with this weapon scores 1 extra hit.')).toBeInTheDocument();
  expect(screen.queryByText('Models may stand back up.')).not.toBeInTheDocument();
});

test('the official wording switch shows the official texts', async () => {
  renderDatasheet(withPlain);
  await userEvent.click(await screen.findByRole('button', { name: 'Official wording' }));
  expect(screen.getByRole('button', { name: 'Official wording' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Models may stand back up.')).toBeInTheDocument();
  expect(screen.getByText(/an unmodified hit roll of 6 scores 1 additional hit/)).toBeInTheDocument();
  expect(screen.queryByText('Destroyed models can come back.')).not.toBeInTheDocument();
});

test('an ability without plain English shows the official wording with a label', async () => {
  renderDatasheet(withPlain);
  expect(await screen.findByText('Re-roll Reanimation Protocol rolls of 1.')).toBeInTheDocument();
  expect(screen.getByText('Official wording (plain-English version not ready yet)')).toBeInTheDocument();
});

test("a unit's rules update is shown under its title", async () => {
  renderDatasheet({ ...necrons, units: [{ ...necronWarriors, amended: 'This unit no longer has the CORE keyword.' }] });
  expect(await screen.findByText('Rules update: This unit no longer has the CORE keyword.')).toBeInTheDocument();
});
