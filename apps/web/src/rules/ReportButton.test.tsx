import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { index } from '../factions/__fixtures__/necrons';
import { resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import type { Doc } from '../storage/types';
import { ReportButton } from './ReportButton';
import { ReportsPage } from './ReportsPage';
import type { RulesReport } from './reports';
import { TestProviders } from './__fixtures__/TestProviders';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`report-button-${++n}`);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(index))));
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  resetDataCache();
});

const reports = () => db.docs.where('kind').equals('report').toArray() as Promise<Doc<RulesReport>[]>;

function renderButton() {
  render(
    <TestProviders db={db} path="/factions/necrons/units/necron-warriors#abilities">
      <ReportButton target={{ kind: 'ability', name: 'Reanimation Protocols' }} text="Destroyed models can come back." />
    </TestProviders>,
  );
}

test('a report is saved with the target, problem, note and the text shown', async () => {
  renderButton();
  await userEvent.click(await screen.findByRole('button', { name: 'Report a rules error' }));
  expect(screen.getByRole('dialog', { name: 'Report a rules error' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: "It's wrong" })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: "It's unclear" }));
  await userEvent.type(screen.getByLabelText('Tell us more (optional)'), 'Which models?');
  await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
  expect(await screen.findByText("Thanks. We've saved your report.")).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const saved = await reports();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    ownerId: 'user-1',
    dirty: true,
    data: {
      target: { kind: 'ability', name: 'Reanimation Protocols', path: '/factions/necrons/units/necron-warriors#abilities' },
      problem: 'unclear',
      note: 'Which models?',
      wording: 'plain',
      text: 'Destroyed models can come back.',
      dataGeneratedAt: index.generatedAt,
    },
  });
});

test('Cancel saves nothing', async () => {
  renderButton();
  await userEvent.click(await screen.findByRole('button', { name: 'Report a rules error' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await reports()).toHaveLength(0);
});

test('the reports page shows the empty state, then a saved report', async () => {
  const { unmount } = render(
    <TestProviders db={db} path="/rules/reports">
      <Routes>
        <Route path="/rules/reports" element={<ReportsPage />} />
      </Routes>
    </TestProviders>,
  );
  expect(await screen.findByText("You haven't reported anything yet.")).toBeInTheDocument();
  unmount();
  await createRepository(db).saveDoc<RulesReport>({
    id: '9b2f3c1e-1111-4a2b-8c3d-000000000001',
    kind: 'report',
    ownerId: 'user-1',
    updatedAt: Date.UTC(2026, 9, 21, 12),
    data: {
      target: { kind: 'stratagem', name: 'Command Re-roll', path: '/rules/stratagems' },
      problem: 'typo',
      note: 'Missing word',
      wording: 'official',
      text: 'x',
      dataGeneratedAt: 'now',
    },
  });
  render(
    <TestProviders db={db} path="/rules/reports">
      <Routes>
        <Route path="/rules/reports" element={<ReportsPage />} />
      </Routes>
    </TestProviders>,
  );
  await waitFor(() => expect(screen.getByText('Command Re-roll')).toBeInTheDocument());
  expect(screen.getByText("There's a typo")).toBeInTheDocument();
  expect(screen.getByText('Missing word')).toBeInTheDocument();
  expect(screen.getByText('21/10/2026')).toBeInTheDocument();
});
