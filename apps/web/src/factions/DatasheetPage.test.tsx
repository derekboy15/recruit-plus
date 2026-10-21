import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { resetDataCache } from './dataClient';
import { DatasheetPage } from './DatasheetPage';
import { necrons } from './__fixtures__/necrons';

afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

test('renders the Necron Warriors datasheet', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(necrons))));
  render(
    <MemoryRouter initialEntries={['/factions/necrons/units/necron-warriors']}>
      <Routes>
        <Route path="/factions/:slug/units/:unitSlug" element={<DatasheetPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Necron Warriors' })).toBeInTheDocument();
  const statRow = screen.getByRole('row', { name: /Necron Warrior 5"/ });
  expect(statRow).toHaveTextContent('4+');
  expect(screen.getByRole('columnheader', { name: 'T' })).toBeInTheDocument();
  expect(screen.getByText('Gauss Flayer')).toBeInTheDocument();
  expect(screen.getByText(/110 pts/)).toBeInTheDocument();
  expect(screen.getByText(/Official wording/)).toBeInTheDocument();
});
