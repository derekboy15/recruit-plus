import 'fake-indexeddb/auto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../factions/dataClient';
import { AppRoutes } from '../routes';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { necronsListData } from './__fixtures__/necronsList';
import { ShareSheet } from './ExportSheet';
import { ListEditorPage } from './ListEditorPage';
import { createList, saveList, type ListData } from './listStore';
import { createLocalPublicSource, PublicSourceContext } from './publicSource';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`export-sheet-test-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetDataCache();
  db.close();
});

async function renderEditor(linksWorkAnywhere = false) {
  const id = await createList(createRepository(db), 'user-1', await necronsListData((r, add) => add(r, 'Necron Warriors')));
  render(
    <StorageProvider db={db}>
      <PublicSourceContext.Provider value={{ source: createLocalPublicSource(db), linksWorkAnywhere }}>
        <MemoryRouter initialEntries={[`/build/${id}`]}>
          <Routes>
            <Route path="/build/:id" element={<ListEditorPage />} />
          </Routes>
        </MemoryRouter>
      </PublicSourceContext.Provider>
    </StorageProvider>,
  );
  await screen.findByRole('textbox', { name: 'List name' }, { timeout: 5000 });
  return id;
}

test('Export shows the list as read-only text, copies it and says Copied', async () => {
  const u = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await renderEditor();
  await u.click(screen.getByRole('button', { name: 'Export' }));
  const sheet = await screen.findByRole('dialog', { name: 'Export list' });
  const box = within(sheet).getByRole('textbox', { name: 'List text' });
  expect(box).toHaveAttribute('readonly');
  expect((box as HTMLTextAreaElement).value).toMatch(/^Necrons Strike Force\nNecrons · Strike Force · 110 \/ 2,000 pts/);
  expect((box as HTMLTextAreaElement).value).toContain('Necron Warriors');

  await u.click(within(sheet).getByRole('button', { name: 'Copy' }));
  expect(writeText).toHaveBeenCalledWith((box as HTMLTextAreaElement).value);
  expect(within(sheet).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  expect(within(sheet).getByRole('button', { name: 'Download .txt' })).toBeInTheDocument();

  await u.click(within(sheet).getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog', { name: 'Export list' })).not.toBeInTheDocument();
});

test('"Copied" goes back to "Copy" after two seconds', async () => {
  const u = userEvent.setup({ delay: null });
  vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await renderEditor();
  await u.click(screen.getByRole('button', { name: 'Export' }));
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    await u.click(await screen.findByRole('button', { name: 'Copy' }));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('turning sharing on saves the list as public and shows the link; turning it off saves it as private', async () => {
  const u = userEvent.setup();
  const id = await renderEditor(true);
  const repo = createRepository(db);
  await u.click(screen.getByRole('button', { name: 'Share' }));
  const sheet = await screen.findByRole('dialog', { name: 'Share list' });
  const toggle = within(sheet).getByRole('checkbox', { name: 'Anyone with the link can view' });
  expect(toggle).not.toBeChecked();
  expect(within(sheet).queryByRole('textbox', { name: 'Share link' })).not.toBeInTheDocument();

  await u.click(toggle);
  const link = await within(sheet).findByRole('textbox', { name: 'Share link' });
  expect(link).toHaveValue(`${window.location.origin}/share/${id}`);
  expect(toggle).toBeChecked();
  const on = await repo.getDoc<ListData>(id);
  expect(on).toMatchObject({ isPublic: true, dirty: true });
  expect(within(sheet).queryByText(/work on other devices once accounts/)).not.toBeInTheDocument();
  expect(within(sheet).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();

  await u.click(toggle);
  await waitFor(async () => expect((await repo.getDoc<ListData>(id))!.isPublic).toBe(false));
  await waitFor(() => expect(within(sheet).queryByRole('textbox', { name: 'Share link' })).not.toBeInTheDocument());
});

test('the switch stays on while the list is being saved, even when the save shows the old setting first', async () => {
  const u = userEvent.setup();
  const repo = createRepository(db);
  const id = await createList(repo, 'user-1', await necronsListData((r, add) => add(r, 'Necron Warriors')));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  // Like the editor's flush: the pending edit is written (still private), and the save takes a moment to finish.
  const flush = async () => {
    const doc = (await repo.getDoc<ListData>(id))!;
    await saveList(repo, doc, { ...doc.data, roster: { ...doc.data.roster, name: 'Edited' } });
    await gate;
  };
  render(
    <StorageProvider db={db}>
      <PublicSourceContext.Provider value={{ source: createLocalPublicSource(db), linksWorkAnywhere: true }}>
        <ShareSheet listId={id} flush={flush} onClose={() => {}} />
      </PublicSourceContext.Provider>
    </StorageProvider>,
  );
  const toggle = await screen.findByRole('checkbox', { name: 'Anyone with the link can view' });
  await waitFor(() => expect(toggle).toBeEnabled());
  await u.click(toggle);
  await waitFor(async () => expect((await repo.getDoc<ListData>(id))!.data.roster.name).toBe('Edited'));
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(toggle).toBeChecked();
  act(() => release());
  await waitFor(async () => expect((await repo.getDoc<ListData>(id))!.isPublic).toBe(true));
  expect(toggle).toBeChecked();
  expect(screen.getByRole('textbox', { name: 'Share link' })).toBeInTheDocument();
});

test('in local development the link comes with a note that it only works on this device', async () => {
  const u = userEvent.setup();
  await renderEditor(false);
  await u.click(screen.getByRole('button', { name: 'Share' }));
  const sheet = await screen.findByRole('dialog', { name: 'Share list' });
  await u.click(within(sheet).getByRole('checkbox', { name: 'Anyone with the link can view' }));
  expect(await within(sheet).findByText('Share links work on other devices once accounts are switched on.')).toBeInTheDocument();
});

test('turning sharing on keeps edits that were still waiting to be saved', async () => {
  const u = userEvent.setup();
  const id = await renderEditor(true);
  const name = screen.getByRole('textbox', { name: 'List name' });
  await u.clear(name);
  await u.type(name, 'Renamed just now');
  await u.click(screen.getByRole('button', { name: 'Share' }));
  await u.click(await screen.findByRole('checkbox', { name: 'Anyone with the link can view' }));
  await waitFor(async () => {
    const doc = await createRepository(db).getDoc<ListData>(id);
    expect(doc).toMatchObject({ isPublic: true });
    expect(doc!.data.roster.name).toBe('Renamed just now');
  });
});

test('the share page route is open to signed-out visitors while the builder is behind the guard', async () => {
  const guard = () => <p>Sign in first</p>;
  const at = (path: string) =>
    render(
      <StorageProvider db={db}>
        <PublicSourceContext.Provider value={{ source: createLocalPublicSource(db), linksWorkAnywhere: false }}>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes guard={guard} />
          </MemoryRouter>
        </PublicSourceContext.Provider>
      </StorageProvider>,
    );
  const share = at('/share/not-a-list');
  expect(await screen.findByText("This list isn't shared, or the link is wrong.")).toBeInTheDocument();
  share.unmount();
  at('/build/some-list');
  expect(await screen.findByText('Sign in first')).toBeInTheDocument();
});

test('when the clipboard is blocked the Export sheet points to Download', async () => {
  const u = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  await renderEditor();
  await u.click(screen.getByRole('button', { name: 'Export' }));
  await u.click(await screen.findByRole('button', { name: 'Copy' }));
  expect(await screen.findByRole('button', { name: 'Couldn’t copy. Use Download instead.' })).toBeInTheDocument();
});
