import { render, screen, within } from '@testing-library/react';
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
const LEGION_HOW = 'A single Legends unit, not an army. Add a squad to an Imperium army as an extra detachment in Onslaught games.';
const legion = {
  ...necrons,
  id: 'lotd',
  slug: 'imperium-legion-of-the-damned',
  name: 'Imperium - Legion of the Damned',
  group: 'Imperium' as const,
  unitCount: 1,
  addOn: { how: LEGION_HOW },
};

function renderPicker(catalogues = [necrons, ultramarines, renegades], props: Parameters<typeof FactionPicker>[0] = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...index, catalogues }))));
  return render(
    <MemoryRouter>
      <FactionPicker {...props} />
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

test('in the wizard, an add-on force is listed apart with how it’s used, and can’t start a list', async () => {
  const onPick = vi.fn();
  renderPicker([necrons, ultramarines, legion], { onPick });
  const addOns = await screen.findByRole('region', { name: 'Add-on forces' });
  expect(addOns).toHaveTextContent('These can’t be an army on their own. They join another army as allies.');
  const row = within(addOns).getByRole('listitem');
  expect(row).toHaveTextContent('Legion of the Damned');
  expect(row).toHaveTextContent(LEGION_HOW);
  expect(row.querySelector('.faction-badge')).not.toBeNull();
  expect(screen.queryByRole('button', { name: /Legion of the Damned/ })).toBeNull();
  expect(within(row).getByRole('link', { name: 'Read the guide' })).toHaveAttribute('href', '/factions/imperium-legion-of-the-damned/guide');
  expect(within(screen.getByRole('region', { name: 'Imperium' })).queryByText(/Legion of the Damned/)).toBeNull();

  await userEvent.click(within(screen.getByRole('region', { name: 'Xenos' })).getByRole('button', { name: /Necrons/ }));
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ slug: 'necrons' }));
});

test('on the Factions page, an add-on force links to its page from the Add-on forces section', async () => {
  renderPicker([necrons, ultramarines, legion]);
  const addOns = await screen.findByRole('region', { name: 'Add-on forces' });
  const link = within(addOns).getByRole('link', { name: /Legion of the Damned/ });
  expect(link).toHaveAttribute('href', '/factions/imperium-legion-of-the-damned');
  expect(link).toHaveTextContent(LEGION_HOW);
  expect(within(screen.getByRole('region', { name: 'Imperium' })).queryByText(/Legion of the Damned/)).toBeNull();
});

test('search finds an add-on force in its own section', async () => {
  renderPicker([necrons, ultramarines, legion], { onPick: vi.fn() });
  await userEvent.type(await screen.findByRole('searchbox', { name: 'Search factions' }), 'damned');
  expect(within(screen.getByRole('region', { name: 'Add-on forces' })).getByText('Legion of the Damned')).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Imperium' })).toBeNull();
});
