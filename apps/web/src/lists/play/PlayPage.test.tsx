import 'fake-indexeddb/auto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { WordingProvider } from '../../rules/wording';
import { openDb, type RecruitDb } from '../../storage/db';
import { createRepository } from '../../storage/repository';
import { StorageProvider } from '../../storage/StorageContext';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { necronsListData } from '../__fixtures__/necronsList';
import { fmt } from '../editorView';
import type { ListData } from '../listStore';
import { novokhIncursionData } from './__fixtures__/playList';
import { PlayPage } from './PlayPage';

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
  db = openDb(`play-page-test-${++n}`);
  await createRepository(db).saveDoc({ id: 'l1', kind: 'list', ownerId: 'u', data: saved });
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
  db.close();
});

function renderPlay(id: string, search = '') {
  const at: { location?: Location; navigate?: NavigateFunction } = {};
  function Spy() {
    at.location = useLocation();
    at.navigate = useNavigate();
    return null;
  }
  render(
    <StorageProvider db={db}>
      <WordingProvider initial="plain">
        <MemoryRouter initialEntries={[`/build/${id}/play${search}`]}>
          <Spy />
          <Routes>
            <Route path="/build/:id/play" element={<PlayPage />} />
            <Route path="/build/:id" element={<p>Editor</p>} />
            <Route path="/build" element={<p>Your lists page</p>} />
          </Routes>
        </MemoryRouter>
      </WordingProvider>
    </StorageProvider>,
  );
  return { history: { current: () => at.location!, back: () => void at.navigate!(-1) } };
}

test('header: list name, Play mode subtitle, Back to Your lists, Edit to the editor', async () => {
  renderPlay('l1');
  expect(await screen.findByRole('heading', { level: 1, name: 'Novokh Incursion' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText(`Play mode · read only · ${fmt(saved.summary.points)} pts`)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/build/l1');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('a sheet lives in the URL: Back closes it and stays in Play mode', async () => {
  const u = userEvent.setup();
  const { history } = renderPlay('l1');
  await u.click(await screen.findByRole('button', { name: /^Immortals/ }, { timeout: 5000 }));
  expect(history.current().search).toMatch(/^\?unit=/);
  expect(screen.getByRole('dialog', { name: 'Immortals' })).toBeInTheDocument();
  act(() => history.back());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(history.current().pathname).toBe('/build/l1/play');
});

test('Next replaces the open sheet, so one Back still leaves the datasheets', async () => {
  const u = userEvent.setup();
  const { history } = renderPlay('l1');
  await u.click(await screen.findByRole('button', { name: /^Necron Warriors/ }, { timeout: 5000 }));
  await u.click(within(screen.getByRole('navigation', { name: 'Other units in this army' })).getByRole('button', { name: /^Next/ }));
  expect(screen.getByRole('dialog', { name: 'Immortals' })).toBeInTheDocument();
  act(() => history.back());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(history.current()).toMatchObject({ pathname: '/build/l1/play', search: '' });
});

test('the sheet’s own close button goes back too, leaving no sheet entry behind', async () => {
  const u = userEvent.setup();
  const { history } = renderPlay('l1');
  await u.click(await screen.findByRole('button', { name: /^Army rules/ }, { timeout: 5000 }));
  expect(history.current().search).toBe('?sheet=rules');
  await u.click(within(screen.getByRole('dialog', { name: 'Army rules' })).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(history.current().search).toBe('');
  act(() => history.back()); // the entry before Play mode: nothing (MemoryRouter's first entry), so it stays
  expect(history.current().pathname).toBe('/build/l1/play');
});

test('a link straight to a sheet opens it, and closing it stays on the page', async () => {
  const u = userEvent.setup();
  const { history } = renderPlay('l1', '?sheet=stratagems');
  const strats = await screen.findByRole('dialog', { name: 'Stratagems' }, { timeout: 5000 });
  await u.click(within(strats).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(history.current()).toMatchObject({ pathname: '/build/l1/play', search: '' });
});

test('a stale ?unit= opens nothing', async () => {
  const { history } = renderPlay('l1', '?unit=not-a-unit');
  expect(await screen.findByRole('heading', { level: 1, name: 'Novokh Incursion' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(history.current().search).toBe(''));
});

test('an empty list says so, and Edit still goes to the editor', async () => {
  stubGeneratedData();
  await createRepository(db).saveDoc({ id: 'empty', kind: 'list', ownerId: 'u', data: await necronsListData() });
  renderPlay('empty');
  expect(await screen.findByText('No units in this list yet.', {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/build/empty');
});

test('a missing list', async () => {
  renderPlay('nope');
  expect(await screen.findByRole('heading', { level: 1, name: 'List not found' })).toBeInTheDocument();
  expect(screen.getByText('We couldn’t find this list on this device. It may have been deleted.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to your lists' })).toHaveAttribute('href', '/build');
});
