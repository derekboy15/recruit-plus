import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { WordingProvider } from '../../rules/wording';
import { openDb, type RecruitDb } from '../../storage/db';
import { createRepository } from '../../storage/repository';
import { StorageProvider } from '../../storage/StorageContext';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import type { ListData } from '../listStore';
import { novokhIncursionData } from './__fixtures__/playList';
import { ArmyDrawer } from './ArmyDrawer';

let db: RecruitDb;
let n = 0;
let saved: ListData;
beforeAll(async () => {
  stubGeneratedData();
  saved = await novokhIncursionData();
  vi.unstubAllGlobals();
});
beforeEach(async () => {
  stubGeneratedData();
  db = openDb(`army-drawer-test-${++n}`);
  await createRepository(db).saveDoc({ id: 'l1', kind: 'list', ownerId: 'u', data: saved });
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
  db.close();
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <StorageProvider db={db}>
      <WordingProvider initial="plain">
        <MemoryRouter>{children}</MemoryRouter>
      </WordingProvider>
    </StorageProvider>
  );
}

/** A button inside the open sheet (its backdrop carries the same name). */
const inSheet = (name: string) => within(screen.getByRole('dialog')).getByRole('button', { name });

test('the army in one full sheet; a unit replaces it, and "Back to army" returns', async () => {
  const u = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Providers>
      <ArmyDrawer listId="l1" onClose={onClose} />
    </Providers>,
  );
  const army = await screen.findByRole('dialog', { name: 'Novokh Incursion' }, { timeout: 5000 });
  expect(within(army).getByRole('button', { name: /^Army rules/ })).toBeInTheDocument();
  await u.click(within(army).getByRole('button', { name: /^Necron Warriors/ }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'Necron Warriors' })).toBeInTheDocument();
  await u.click(inSheet('Back to army'));
  expect(screen.getByRole('dialog', { name: 'Novokh Incursion' })).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  await u.click(inSheet('Close'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Escape on a unit goes back to the army; Escape on the army closes the drawer', async () => {
  const u = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Providers>
      <ArmyDrawer listId="l1" onClose={onClose} />
    </Providers>,
  );
  await u.click(within(await screen.findByRole('dialog', { name: 'Novokh Incursion' }, { timeout: 5000 })).getByRole('button', { name: /^Immortals/ }));
  await u.keyboard('{Escape}');
  expect(screen.getByRole('dialog', { name: 'Novokh Incursion' })).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  await u.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('focus goes back to what opened the drawer, after stepping into a unit and back', async () => {
  const u = userEvent.setup();
  function Opener() {
    return (
      <>
        <button type="button">Open army</button>
      </>
    );
  }
  const { rerender } = render(
    <Providers>
      <Opener />
    </Providers>,
  );
  screen.getByRole('button', { name: 'Open army' }).focus();
  const onClose = vi.fn();
  rerender(
    <Providers>
      <Opener />
      <ArmyDrawer listId="l1" onClose={onClose} />
    </Providers>,
  );
  await u.click(within(await screen.findByRole('dialog', { name: 'Novokh Incursion' }, { timeout: 5000 })).getByRole('button', { name: /^Immortals/ }));
  await u.click(inSheet('Back to army'));
  rerender(
    <Providers>
      <Opener />
    </Providers>,
  );
  expect(screen.getByRole('button', { name: 'Open army' })).toHaveFocus();
});

test('a list this device no longer has', async () => {
  render(
    <Providers>
      <ArmyDrawer listId="gone" onClose={() => {}} />
    </Providers>,
  );
  expect(await screen.findByText('This list isn’t on this device any more.')).toBeInTheDocument();
  const sheet = screen.getByRole('dialog');
  expect(within(sheet).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Close']);
});
