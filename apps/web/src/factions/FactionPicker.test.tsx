import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { resetDataCache } from './dataClient';
import { FactionPicker } from './FactionPicker';
import { index } from './__fixtures__/necrons';

afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

test('a faction with one unit says "1 unit", others "N units"', async () => {
  const catalogues = [
    { ...index.catalogues[0], slug: 'legion', name: 'Imperium - Legion of the Damned', group: 'Imperium' as const, unitCount: 1 },
    { ...index.catalogues[0], unitCount: 1234 },
  ];
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...index, catalogues }))));
  render(
    <MemoryRouter>
      <FactionPicker />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('link', { name: /Legion of the Damned/ })).toHaveTextContent(/1 unit$/);
  expect(screen.getByRole('link', { name: /Necrons/ })).toHaveTextContent(/1,234 units$/);
});
