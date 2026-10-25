import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogueOut } from '@recruit/data/model';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import type { RulesReport } from '../rules/reports';
import { openDb, type RecruitDb } from '../storage/db';
import type { Doc } from '../storage/types';
import { resetDataCache } from './dataClient';
import { DatasheetPage } from './DatasheetPage';
import { necronWarriors, necrons } from './__fixtures__/necrons';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`datasheet-${++n}`);
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
  localStorage.clear();
});

function renderDatasheet(cat: CatalogueOut) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(cat))));
  render(
    <TestProviders db={db} path="/factions/necrons/units/necron-warriors">
      <Routes>
        <Route path="/factions/:slug/units/:unitSlug" element={<DatasheetPage />} />
      </Routes>
    </TestProviders>,
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
  expect(await screen.findByRole('heading', { level: 1, name: 'Necron Warriors' })).toBeInTheDocument();
  expect(within(screen.getByRole('rowgroup', { name: 'Necron Warrior characteristics' })).getByText('4+')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Necrons' })).toHaveAttribute('href', '/factions/necrons');
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

test('a datasheet has one report button for the page', async () => {
  renderDatasheet(withPlain);
  await screen.findByText('Destroyed models can come back.');
  expect(await screen.findAllByRole('button', { name: 'Report a problem' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Report a problem' }));
  const which = screen.getByRole('combobox', { name: 'Which part?' });
  expect(within(which).getAllByRole('option').map((o) => o.textContent)).toEqual(['Necron Warriors', 'Reanimation Protocols', 'Their Number Is Legion']);
});

test('a report about one of the abilities is saved as an ability report', async () => {
  renderDatasheet(withPlain);
  await userEvent.click(await screen.findByRole('button', { name: 'Report a problem' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Which part?' }), 'Reanimation Protocols');
  await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
  await screen.findByText("Thanks. We've saved your report.");
  const [saved] = (await db.docs.where('kind').equals('report').toArray()) as Doc<RulesReport>[];
  expect(saved.data.target).toMatchObject({ kind: 'ability', name: 'Reanimation Protocols' });
  expect(saved.data.text).toBe('Destroyed models can come back.');
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
