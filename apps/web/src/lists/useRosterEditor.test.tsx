import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { availableUnits, COST_PTS, FORCE, type Fix, type Roster } from '@recruit/data/roster';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getIndex, getPolicy, getRosterScope, resetDataCache } from '../factions/dataClient';
import { openDb, type RecruitDb } from '../storage/db';
import { createRepository } from '../storage/repository';
import { StorageProvider } from '../storage/StorageContext';
import { createList, type ListData } from './listStore';
import { listData, startingRoster } from './newListSetup';
import { useEditorShortcuts } from './history';
import { useRosterEditor, type EditorUi } from './useRosterEditor';
import { stubGeneratedData } from './__fixtures__/generatedData';

const NECRONS = '61c6-c8c5-a304-ff5f';

let db: RecruitDb;
let n = 0;
beforeEach(() => {
  db = openDb(`editor-hook-test-${++n}`);
  stubGeneratedData();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetDataCache();
  db.close();
});

/** Saves a fresh Necrons Strike Force list (Arks of Omen Detachment) and returns its id. */
async function necronsList(): Promise<string> {
  const [scope, policy, index] = await Promise.all([getRosterScope(['necrons']), getPolicy(), getIndex()]);
  const roster = startingRoster(scope, { name: 'Necrons Strike Force', catalogueId: NECRONS, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  return createList(createRepository(db), 'user-1', listData(scope, policy, roster, index.catalogues.find((c) => c.id === NECRONS)!));
}

const wrapper = ({ children }: { children: ReactNode }) => <StorageProvider db={db}>{children}</StorageProvider>;

async function openEditor(id: string, ui?: EditorUi) {
  const hook = renderHook(() => useRosterEditor(id, ui), { wrapper });
  await waitFor(() => expect(hook.result.current.status).toBe('ready'), { timeout: 5000 });
  return hook;
}

function ready(r: ReturnType<typeof useRosterEditor>) {
  if (r.status !== 'ready') throw new Error(`editor is ${r.status}`);
  return r;
}

async function unitId(name: string, r: ReturnType<typeof useRosterEditor>) {
  const { scope, roster } = ready(r);
  return availableUnits(scope, roster, roster.forces[0].id).find((u) => u.name === name)!.entryId;
}

const saved = async (id: string) => (await createRepository(db).getDoc<ListData>(id))!;
const unitNames = (r: ReturnType<typeof useRosterEditor>) => ready(r).view.forces[0].selections.map((v) => v.name);

test('add-unit updates the totals right away; several quick edits are saved once, within 600 ms of the last', async () => {
  const id = await necronsList();
  const { result } = await openEditor(id);
  const put = vi.spyOn(db.docs, 'put');
  const warriors = await unitId('Necron Warriors', result.current);
  const lord = await unitId('Lord', result.current);
  const forceSelId = ready(result.current).roster.forces[0].id;

  act(() => result.current.dispatch({ type: 'add-unit', forceSelId, entryId: warriors }));
  expect(ready(result.current).view.total[COST_PTS]).toBe(110);
  act(() => result.current.dispatch({ type: 'add-unit', forceSelId, entryId: lord }));
  act(() => result.current.dispatch({ type: 'rename', name: 'Tomb World' }));
  expect(put).not.toHaveBeenCalled();

  await waitFor(() => expect(put).toHaveBeenCalledTimes(1), { timeout: 2000 }); // room for a busy test run
  const doc = await saved(id);
  expect(doc.data.roster.name).toBe('Tomb World');
  expect(doc.data.summary.points).toBe(110 + 65);
  expect(doc.data.roster.forces[0].selections).toHaveLength(ready(result.current).roster.forces[0].selections.length);
  await new Promise((r) => setTimeout(r, 700));
  expect(put).toHaveBeenCalledTimes(1);
});

test('unmounting straight after an edit still saves the latest roster', async () => {
  const id = await necronsList();
  const { result, unmount } = await openEditor(id);
  const warriors = await unitId('Necron Warriors', result.current);
  const forceSelId = ready(result.current).roster.forces[0].id;
  act(() => result.current.dispatch({ type: 'add-unit', forceSelId, entryId: warriors }));
  const latest: Roster = ready(result.current).roster;
  unmount();
  await waitFor(async () => expect((await saved(id)).data.roster).toEqual(latest));
  expect((await saved(id)).data.summary.points).toBe(110);
});

test('leaving the page (pagehide) saves without waiting for the debounce', async () => {
  const id = await necronsList();
  const { result } = await openEditor(id);
  act(() => result.current.dispatch({ type: 'rename', name: 'Saved on the way out' }));
  window.dispatchEvent(new Event('pagehide'));
  await waitFor(async () => expect((await saved(id)).data.roster.name).toBe('Saved on the way out'), { timeout: 300 });
});

test('edits kept when the page closed before its save landed are used (and saved) the next time the list opens', async () => {
  const id = await necronsList();
  const first = await openEditor(id);
  // The browser cuts the save off: it never lands.
  const put = vi.spyOn(db.docs, 'put').mockImplementation(() => new Promise<string>(() => {}) as ReturnType<typeof db.docs.put>);
  act(() => first.result.current.dispatch({ type: 'rename', name: 'Kept on close' }));
  window.dispatchEvent(new Event('pagehide'));
  first.unmount();
  put.mockRestore();
  expect((await saved(id)).data.roster.name).toBe('Necrons Strike Force');

  const second = await openEditor(id);
  expect(ready(second.result.current).roster.name).toBe('Kept on close');
  await waitFor(async () => expect((await saved(id)).data.roster.name).toBe('Kept on close'));
  second.unmount();
  localStorage.clear();
});

test('a save still under way when the page closes is kept aside too', async () => {
  const id = await necronsList();
  const first = await openEditor(id);
  const put = vi.spyOn(db.docs, 'put').mockImplementation(() => new Promise<string>(() => {}) as ReturnType<typeof db.docs.put>);
  act(() => first.result.current.dispatch({ type: 'rename', name: 'In flight' }));
  await waitFor(() => expect(put).toHaveBeenCalled(), { timeout: 1000 }); // the debounced save started and hangs
  expect(localStorage.length).toBe(0);
  window.dispatchEvent(new Event('pagehide'));
  expect(localStorage.length).toBe(1);
  first.unmount();
  put.mockRestore();

  const second = await openEditor(id);
  expect(ready(second.result.current).roster.name).toBe('In flight');
  second.unmount();
});

test('saves are stamped with the time the edit was captured, strictly increasing', async () => {
  const id = await necronsList();
  const before = (await saved(id)).updatedAt;
  const { result } = await openEditor(id);
  act(() => result.current.dispatch({ type: 'rename', name: 'One' }));
  await act(() => result.current.flush());
  const one = (await saved(id)).updatedAt;
  act(() => result.current.dispatch({ type: 'rename', name: 'Two' }));
  await act(() => result.current.flush());
  const two = (await saved(id)).updatedAt;
  expect(one).toBeGreaterThanOrEqual(before);
  expect(two).toBeGreaterThan(one);
});

test('a kept copy older than the saved list is ignored', async () => {
  const id = await necronsList();
  const { keepPending } = await import('./pendingEdits');
  const old = (await saved(id)).data;
  keepPending(id, { ...old, roster: { ...old.roster, name: 'Stale' } }, 1);
  const { result } = await openEditor(id);
  expect(ready(result.current).roster.name).toBe('Necrons Strike Force');
  expect(localStorage.length).toBe(0);
});

test('a list that does not exist is "missing"', async () => {
  const { result } = renderHook(() => useRosterEditor('00000000-0000-4000-8000-000000000001'), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('missing'));
});

test('model stacks: set-count, split and remove act on one stack at a time', async () => {
  const id = await necronsList();
  const { result } = await openEditor(id);
  const forceSelId = ready(result.current).roster.forces[0].id;
  let unit = '';
  act(() => {
    unit = result.current.dispatch({ type: 'add-unit', forceSelId, entryId: '' }) ?? 'none';
  });
  expect(unit).toBe('none'); // an unknown entry adds nothing
  const warriors = await unitId('Necron Warriors', result.current);
  act(() => {
    unit = result.current.dispatch({ type: 'add-unit', forceSelId, entryId: warriors })!;
  });
  const stack = () => ready(result.current).roster.forces[0].selections.find((s) => s.id === unit)!.children;
  act(() => result.current.dispatch({ type: 'set-count', selId: stack()[0].id, count: 12 }));
  expect(ready(result.current).view.total[COST_PTS]).toBe(132);
  act(() => result.current.dispatch({ type: 'split', selId: stack()[0].id }));
  expect(stack().map((s) => s.count)).toEqual([11, 1]);
  act(() => result.current.dispatch({ type: 'remove', selId: stack()[1].id }));
  expect(stack().map((s) => s.count)).toEqual([11]);
  act(() => result.current.dispatch({ type: 'duplicate', selId: unit }));
  expect(unitNames(result.current).filter((n) => n === 'Necron Warriors')).toHaveLength(2);
});

test('apply-fix: several candidates open the picker, one unit is added and opened, "open" opens the unit', async () => {
  const id = await necronsList();
  const ui = { openUnit: vi.fn(), openPicker: vi.fn() };
  const { result } = await openEditor(id, ui);
  const forceSelId = ready(result.current).roster.forces[0].id;
  const hq = ready(result.current).issues.find((i) => i.rule === 'slot-min' && i.subject.name === 'HQ')!;
  act(() => result.current.dispatch({ type: 'apply-fix', fix: hq.fix! }));
  const fix = hq.fix as Extract<Fix, { kind: 'add-unit' }>;
  expect(ui.openPicker).toHaveBeenCalledWith(forceSelId, fix.entryIds);

  act(() => result.current.dispatch({ type: 'apply-fix', fix: { ...fix, entryIds: [fix.entryIds[0]] } }));
  const added = ready(result.current).roster.forces[0].selections.at(-1)!;
  expect(added.entryId).toBe(fix.entryIds[0]);
  expect(ui.openUnit).toHaveBeenCalledWith(added.id);

  const dynasty = ready(result.current).issues.find((i) => i.fix?.kind === 'open')!;
  act(() => result.current.dispatch({ type: 'apply-fix', fix: dynasty.fix! }));
  expect(ui.openUnit).toHaveBeenLastCalledWith((dynasty.fix as { selId: string }).selId);
});

test('battle size and detachments: switching size keeps the units; an allied detachment from another faction loads its rules first', async () => {
  const id = await necronsList();
  const { result } = await openEditor(id);
  act(() => result.current.dispatch({ type: 'battle-size', size: 'onslaught' }));
  expect(ready(result.current).roster.battleSize).toBe('onslaught');
  const index = await getIndex();
  const orks = index.catalogues.find((c) => c.slug === 'orks')!;
  act(() => result.current.dispatch({ type: 'add-force', forceId: FORCE.patrol, catalogueId: orks.id }));
  await waitFor(() => expect(ready(result.current).roster.forces).toHaveLength(2));
  const allied = ready(result.current).roster.forces[1];
  expect(allied.catalogueId).toBe(orks.id);
  expect(availableUnits(ready(result.current).scope, ready(result.current).roster, allied.id).some((u) => u.name === 'Boyz')).toBe(true);
  act(() => result.current.dispatch({ type: 'remove-force', forceSelId: allied.id }));
  expect(ready(result.current).roster.forces).toHaveLength(1);
});

test('Arks of Omen → Combat Patrol: the detachment is the problem, and the Game Type the app sets never opens for editing', async () => {
  const id = await necronsList();
  const ui = { openUnit: vi.fn(), openPicker: vi.fn() };
  const { result } = await openEditor(id, ui);
  act(() => result.current.dispatch({ type: 'battle-size', size: 'combat-patrol' }));
  const { view, issues } = ready(result.current);
  expect(issues.filter((i) => i.rule === 'detachment-not-allowed')).toHaveLength(1);
  const gameType = view.forces[0].selections.find((v) => v.name === 'Game Type')!;
  expect(issues.filter((i) => i.selId === gameType.sel.id || (i.fix?.kind === 'open' && i.fix.selId === gameType.sel.id))).toEqual([]);
  act(() => result.current.dispatch({ type: 'apply-fix', fix: { kind: 'open', selId: gameType.sel.id } }));
  expect(ui.openUnit).not.toHaveBeenCalled();
});

test('undo takes back the last edit and is saved after the debounce; redo puts it back', async () => {
  const id = await necronsList();
  const { result } = await openEditor(id);
  const original = ready(result.current).roster;
  expect(ready(result.current).canUndo).toBe(false);
  expect(ready(result.current).canRedo).toBe(false);
  const warriors = await unitId('Necron Warriors', result.current);
  const forceSelId = original.forces[0].id;
  act(() => result.current.dispatch({ type: 'add-unit', forceSelId, entryId: warriors }));
  expect(ready(result.current).canUndo).toBe(true);
  await act(() => result.current.flush());
  expect((await saved(id)).data.summary.points).toBe(110);

  const put = vi.spyOn(db.docs, 'put');
  act(() => ready(result.current).undo());
  expect(ready(result.current).roster).toEqual(original);
  expect(ready(result.current).canUndo).toBe(false);
  expect(ready(result.current).canRedo).toBe(true);
  expect(put).not.toHaveBeenCalled();
  // Saved like any edit: after the debounce (the timeout leaves room for a busy test run).
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1), { timeout: 2000 });
  expect((await saved(id)).data.roster).toEqual(original);
  expect((await saved(id)).data.summary.points).toBe(0);

  act(() => ready(result.current).redo());
  expect(ready(result.current).view.total[COST_PTS]).toBe(110);
  expect(ready(result.current).canRedo).toBe(false);
});

test('version goes up by one on every committed edit, undo and redo; an edit that changes nothing leaves it', async () => {
  const id = await necronsList();
  const { result } = await openEditor(id);
  const v0 = ready(result.current).version;
  act(() => result.current.dispatch({ type: 'rename', name: 'One' }));
  expect(ready(result.current).version).toBe(v0 + 1);
  act(() => result.current.dispatch({ type: 'rename', name: 'One' }));
  expect(ready(result.current).version).toBe(v0 + 1);
  act(() => ready(result.current).undo());
  expect(ready(result.current).version).toBe(v0 + 2);
  act(() => ready(result.current).redo());
  expect(ready(result.current).version).toBe(v0 + 3);
  act(() => ready(result.current).redo()); // nothing to redo
  expect(ready(result.current).version).toBe(v0 + 3);
});

test('Ctrl+Z undoes and Ctrl+Shift+Z or Ctrl+Y redoes, except while typing in a text box', async () => {
  const id = await necronsList();
  const { result } = renderHook(
    () => {
      const editor = useRosterEditor(id);
      useEditorShortcuts(editor.status === 'ready' ? editor : null);
      return editor;
    },
    { wrapper },
  );
  await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 5000 });
  act(() => result.current.dispatch({ type: 'rename', name: 'Renamed' }));
  const key = (init: KeyboardEventInit, target: EventTarget = document.body) =>
    act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })));

  const input = document.body.appendChild(document.createElement('input'));
  key({ key: 'z', ctrlKey: true }, input);
  expect(ready(result.current).roster.name).toBe('Renamed');
  input.remove();

  // A ticked checkbox or radio has no undo of its own: Ctrl+Z still undoes the list edit.
  const box = document.body.appendChild(Object.assign(document.createElement('input'), { type: 'checkbox' }));
  key({ key: 'z', ctrlKey: true }, box);
  expect(ready(result.current).roster.name).toBe('Necrons Strike Force');
  key({ key: 'y', ctrlKey: true }, box);
  expect(ready(result.current).roster.name).toBe('Renamed');
  box.remove();

  key({ key: 'z', ctrlKey: true });
  expect(ready(result.current).roster.name).toBe('Necrons Strike Force');
  key({ key: 'Z', ctrlKey: true, shiftKey: true });
  expect(ready(result.current).roster.name).toBe('Renamed');
  key({ key: 'z', metaKey: true });
  expect(ready(result.current).roster.name).toBe('Necrons Strike Force');
  key({ key: 'y', ctrlKey: true });
  expect(ready(result.current).roster.name).toBe('Renamed');
});
