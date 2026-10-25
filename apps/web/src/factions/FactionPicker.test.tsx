import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { resetDataCache } from './dataClient';
import { FactionPicker } from './FactionPicker';
import { index } from './__fixtures__/necrons';

afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

const necrons = index.catalogues[0];
const ultramarines = { ...necrons, id: 'um', slug: 'imperium-adeptus-astartes-ultramarines', name: 'Imperium - Adeptus Astartes - Ultramarines', group: 'Imperium' as const, unitCount: 87 };
const renegades = { ...necrons, id: 'rh', slug: 'chaos-renegades-heretics-legends', name: 'Chaos - Renegades & Heretics [LEGENDS]', group: 'Chaos' as const, unitCount: 40 };

function renderPicker(catalogues = [necrons, ultramarines, renegades]) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...index, catalogues }))));
  return render(
    <MemoryRouter>
      <FactionPicker />
    </MemoryRouter>,
  );
}

test('a faction with one unit says "1 unit", others "N units"', async () => {
  renderPicker([
    { ...necrons, slug: 'legion', name: 'Imperium - Legion of the Damned', group: 'Imperium' as const, unitCount: 1 },
    { ...necrons, unitCount: 1234 },
  ]);
  expect(await screen.findByRole('link', { name: /Legion of the Damned/ })).toHaveTextContent(/1 unit$/);
  expect(screen.getByRole('link', { name: /Necrons/ })).toHaveTextContent(/1,234 units$/);
});

test('each faction row shows its badge, name and unit count', async () => {
  renderPicker();
  const um = await screen.findByRole('link', { name: /Ultramarines/ });
  expect(um.querySelector('.faction-badge')).not.toBeNull();
  expect(um).toHaveTextContent('Ultramarines');
  expect(um).toHaveTextContent('Space Marines chapter · 87 units');
  for (const link of screen.getAllByRole('link')) expect(link.querySelector('.faction-badge')).not.toBeNull();
});

test('a Legends faction shows a Legends badge, not the tag', async () => {
  renderPicker();
  const row = await screen.findByRole('link', { name: /Renegades & Heretics/ });
  expect(screen.queryByText(/\[LEGENDS\]/)).toBeNull();
  expect(row).toHaveTextContent('Legends');
});

test('searching "space marines" lists the chapters', async () => {
  renderPicker();
  const box = await screen.findByRole('searchbox', { name: 'Search factions' });
  expect(box).toHaveAttribute('placeholder', 'e.g. Necrons, Space Marines');
  await userEvent.type(box, 'space marines');
  expect(screen.getByRole('link', { name: /Ultramarines/ })).toBeVisible();
  expect(screen.queryByRole('link', { name: /Necrons/ })).toBeNull();
});
