/**
 * The list editor's state: loads a saved list and the rules data it needs, applies edits through the roster engine,
 * validates after every edit, and saves (debounced 600 ms; at once on unmount and when the page is hidden).
 */
import type { CatalogueSummary } from '@recruit/data/model';
import {
  addChild,
  addForce,
  addUnit,
  chooseInGroup,
  duplicateSelection,
  removeForce,
  removeSelection,
  resolve,
  setBattleSize,
  setCount,
  splitSelection,
  validate,
  type BattleSizeId,
  type Fix,
  type Issue,
  type PolicyData,
  type Roster,
  type RosterView,
  type Scope,
  type Sel,
} from '@recruit/data/roster';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getIndex, getPolicy, getRosterScope } from '../factions/dataClient';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import type { ListData } from './listStore';
import { isAutoManagedEntry } from './editorView';
import { canRedo, canUndo, push, redo, start, undo, type History } from './history';
import { applyPicks, listData, type ArmyChoice } from './newListSetup';
import { dropPending, keepPending, recoverPending } from './pendingEdits';

export type EditorAction =
  | { type: 'add-unit'; forceSelId: string; entryId: string } | { type: 'add-child'; parentSelId: string; entryId: string }
  | { type: 'set-count'; selId: string; count: number } | { type: 'remove'; selId: string } | { type: 'split'; selId: string }
  | { type: 'duplicate'; selId: string } | { type: 'choose'; parentSelId: string; groupId: string; entryId: string }
  | { type: 'add-force'; forceId: string; catalogueId: string } | { type: 'remove-force'; forceSelId: string }
  | { type: 'battle-size'; size: BattleSizeId } | { type: 'rename'; name: string } | { type: 'apply-fix'; fix: Fix }
  /** An army-wide choice (Dynasty, Army of Renown…), adding its army option first when the list doesn't have it yet. */
  | { type: 'army-choice'; choice: ArmyChoice; optionId: string };

/** What the page does for fixes that need the player: open a unit, or let them pick from several units. */
export interface EditorUi {
  openUnit(selId: string): void;
  openPicker(forceSelId: string, entryIds: string[]): void;
}

export interface EditorData {
  status: 'ready';
  roster: Roster;
  view: RosterView;
  issues: Issue[];
  scope: Scope;
  policy: PolicyData;
  catalogues: CatalogueSummary[];
  /** Catalogue slugs the scope was built from: the army's first, then its allies'. */
  slugs: string[];
}
/** Undo and redo (50 steps), saved like any other edit. */
export interface EditorHistory {
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /** Goes up by one on every committed change, undo and redo included. */
  version: number;
  /** The version right now, for handlers that run after a dispatch (`version` is the one this render saw). */
  getVersion(): number;
}
export type EditorState = (EditorData & EditorHistory) | { status: 'loading' } | { status: 'missing' } | { status: 'error'; error: Error };
export type RosterEditor = EditorState & {
  /** Applies an edit. Returns the id of a unit or model it added (add-unit, split), if any. */
  dispatch(a: EditorAction): string | undefined;
  /** Saves now if anything is unsaved. */
  flush(): Promise<void>;
  /**
   * Drops anything not yet saved and saves nothing more: the list has been deleted, so the editor's save on the way
   * out (or one retried after a failure) must not bring it back.
   */
  discard(): void;
  /** Set when the last save failed (the edit is kept and saving is retried on the next edit). */
  saveError: Error | null;
  /** Set when an allied detachment couldn't be added because its faction's rules didn't load. */
  allyError: Error | null;
};

export type ReadyEditor = Extract<RosterEditor, { status: 'ready' }>;

const SAVE_DELAY_MS = 600;

interface Loaded { doc: Doc<ListData>; scope: Scope; policy: PolicyData; catalogues: CatalogueSummary[]; slugs: string[] }

/** The catalogue slugs a roster needs: its own catalogue's, then each allied detachment's. */
export function slugsFor(roster: Roster, catalogues: CatalogueSummary[], primarySlug: string): string[] {
  const slugs = [primarySlug];
  for (const f of roster.forces) {
    const slug = catalogues.find((c) => c.id === f.catalogueId)?.slug;
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

async function load(repo: ReturnType<typeof useStorage>['repo'], listId: string): Promise<Loaded | null> {
  // Edits kept from a page that closed before its save landed are saved first.
  await recoverPending(repo, [listId]);
  const doc = await repo.getDoc<ListData>(listId);
  if (!doc || doc.deleted || doc.kind !== 'list') return null;
  const [{ catalogues }, policy] = await Promise.all([getIndex(), getPolicy()]);
  const primary = catalogues.find((c) => c.id === doc.data.roster.catalogueId)?.slug ?? doc.data.summary.catalogueSlug;
  const slugs = slugsFor(doc.data.roster, catalogues, primary);
  return { doc, scope: await getRosterScope(slugs), policy, catalogues, slugs };
}

/** The list to save: the roster with fresh numbers for the lists page (the old numbers if they can't be worked out). */
function dataToSave(l: Loaded, roster: Roster): ListData {
  const catalogue = l.catalogues.find((c) => c.id === roster.catalogueId);
  try {
    if (catalogue) return listData(l.scope, l.policy, roster, catalogue);
  } catch (e) {
    console.warn('Could not work out the list summary', e);
  }
  return { roster, summary: l.doc.data.summary };
}

/** Applies one edit (everything but apply-fix, and add-force when the scope lacks its catalogue). Pure. */
export function applyAction(scope: Scope, r: Roster, a: Exclude<EditorAction, { type: 'apply-fix' }>): { roster: Roster; selId?: string } {
  switch (a.type) {
    case 'add-unit': {
      const out = addUnit(scope, r, a.forceSelId, a.entryId);
      return out.selId ? out : { roster: r };
    }
    case 'add-child': return { roster: addChild(scope, r, a.parentSelId, a.entryId) };
    case 'set-count': return { roster: setCount(scope, r, a.selId, a.count) };
    case 'remove': return { roster: removeSelection(r, a.selId) };
    case 'split': {
      const out = splitSelection(r, a.selId);
      return out.selId ? out : { roster: r };
    }
    case 'duplicate': return { roster: duplicateSelection(r, a.selId) };
    case 'choose': return { roster: chooseInGroup(scope, r, a.parentSelId, a.groupId, a.entryId) };
    case 'add-force': return { roster: addForce(scope, r, a.forceId, a.catalogueId) };
    case 'remove-force': return { roster: r.forces.length > 1 ? removeForce(scope, r, a.forceSelId) : r };
    case 'battle-size': return { roster: setBattleSize(scope, r, a.size) };
    case 'rename': return { roster: r.name === a.name ? r : { ...r, name: a.name } };
    case 'army-choice': return { roster: applyPicks(scope, r, [a.choice], { [a.choice.key]: a.optionId }) };
  }
}

export function useRosterEditor(listId: string, ui?: EditorUi): RosterEditor {
  const { repo } = useStorage();
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [allyError, setAllyError] = useState<Error | null>(null);
  const [history, setHistory] = useState<History | null>(null);

  // Refs hold the latest values so quick edits, timers and unmount handlers never act on a stale roster.
  const loadedRef = useRef<Loaded | null>(null);
  const rosterRef = useRef<Roster | null>(null);
  const historyRef = useRef<History | null>(null);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  /** Set by discard(): the list is gone, nothing more is saved. */
  const discardedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef<Promise<void>>(Promise.resolve());
  /** The last data handed to a save, when it was captured, and whether that save has landed. */
  const lastSentRef = useRef<{ listId: string; data: ListData; at: number; landed: boolean } | null>(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  /** Saves now if anything is unsaved. `leaving`: the page is closing, so a synchronous copy is kept first. */
  const flush = useCallback((leaving = false): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const l = loadedRef.current;
    const r = rosterRef.current;
    const sent = lastSentRef.current;
    if (discardedRef.current) return savingRef.current;
    if (!dirtyRef.current || !l || !r) {
      // Nothing new, but the last save may still be in flight: keep a copy of what it carries in case it is cut off.
      if (leaving && sent && !sent.landed) keepPending(sent.listId, sent.data, sent.at);
      return savingRef.current;
    }
    dirtyRef.current = false;
    const data = dataToSave(l, r);
    // The save is stamped with the moment its data was captured (strictly increasing), so a safety copy and the save
    // carrying the same data have the same time, and a later edit always has a later time.
    const at = Math.max(Date.now(), (sent?.at ?? 0) + 1);
    const current = { listId: l.doc.id, data, at, landed: false };
    lastSentRef.current = current;
    if (leaving) keepPending(l.doc.id, data, at);
    // Saves run one after another, so an older roster never lands after a newer one. isPublic is left as stored.
    savingRef.current = savingRef.current.then(() =>
      repo.saveDoc<ListData>({ id: l.doc.id, kind: 'list', ownerId: l.doc.ownerId, data, updatedAt: at }).then(
        () => {
          current.landed = true;
          dropPending(l.doc.id, at);
          setSaveError(null);
        },
        (e: unknown) => {
          dirtyRef.current = true;
          setSaveError(e instanceof Error ? e : new Error(String(e)));
        },
      ),
    );
    return savingRef.current;
  }, [repo]);

  useEffect(() => {
    let live = true;
    discardedRef.current = false;
    setStatus('loading');
    load(repo, listId).then(
      (l) => {
        if (!live) return;
        if (!l) return setStatus('missing');
        loadedRef.current = l;
        rosterRef.current = l.doc.data.roster;
        historyRef.current = start(l.doc.data.roster);
        setLoaded(l);
        setRoster(l.doc.data.roster);
        setHistory(historyRef.current);
        setStatus('ready');
      },
      (e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus('error');
      },
    );
    return () => {
      live = false;
      void flush();
      loadedRef.current = null;
    };
  }, [repo, listId, flush]);

  useEffect(() => {
    const onHide = () => void flush(true);
    const onVisibility = () => document.visibilityState === 'hidden' && onHide();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flush]);

  /** Shows the history's present roster and saves it (debounced). Every edit, undo and redo goes through here. */
  const show = useCallback(
    (h: History) => {
      historyRef.current = h;
      rosterRef.current = h.present;
      versionRef.current += 1;
      setHistory(h);
      setRoster(h.present);
      dirtyRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  /** An edit is one undo step (a run of quick renames is one). */
  const commit = useCallback(
    (next: Roster, kind: string) => {
      const h = historyRef.current;
      if (!h || next === rosterRef.current) return;
      show(push(h, next, kind, Date.now()));
    },
    [show],
  );

  const step = useCallback(
    (move: (h: History) => History) => {
      const h = historyRef.current;
      if (!h || !loadedRef.current) return;
      const next = move(h);
      if (next !== h) show(next);
    },
    [show],
  );
  const undoEdit = useCallback(() => step(undo), [step]);
  const redoEdit = useCallback(() => step(redo), [step]);
  const getVersion = useCallback(() => versionRef.current, []);
  const discard = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    dirtyRef.current = false;
    discardedRef.current = true;
  }, []);

  /** Adds a detachment from a catalogue the scope doesn't cover yet: rebuilds the scope with it, then adds. */
  const addAlliedForce = useCallback(
    (l: Loaded, forceId: string, catalogueId: string, slug: string) => {
      const slugs = [...l.slugs, slug];
      setAllyError(null);
      getRosterScope(slugs).then(
        (scope) => {
          if (loadedRef.current !== l || !rosterRef.current) return;
          const next = { ...l, scope, slugs };
          loadedRef.current = next;
          setLoaded(next);
          commit(addForce(scope, rosterRef.current, forceId, catalogueId), 'add-force');
        },
        (e: unknown) => setAllyError(e instanceof Error ? e : new Error(String(e))),
      );
    },
    [commit],
  );

  const dispatch = useCallback(
    (a: EditorAction): string | undefined => {
      const l = loadedRef.current;
      const r = rosterRef.current;
      if (!l || !r) return undefined;
      if (a.type === 'apply-fix') return applyFix(l.scope, r, a.fix, (next) => commit(next, a.type), uiRef.current);
      if (a.type === 'add-force') {
        const slug = l.catalogues.find((c) => c.id === a.catalogueId)?.slug;
        if (slug && !l.slugs.includes(slug)) {
          addAlliedForce(l, a.forceId, a.catalogueId, slug);
          return undefined;
        }
      }
      const { roster: next, selId } = applyAction(l.scope, r, a);
      commit(next, a.type);
      return selId;
    },
    [commit, addAlliedForce],
  );

  const result = useMemo(() => (loaded && roster ? validate(loaded.scope, roster, loaded.policy) : null), [loaded, roster]);

  const base = { dispatch, flush, discard, saveError, allyError };
  if (status === 'ready' && loaded && roster && result && history) {
    const { scope, policy, catalogues, slugs } = loaded;
    const edits: EditorHistory = {
      undo: undoEdit,
      redo: redoEdit,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
      version: versionRef.current,
      getVersion,
    };
    return { ...base, ...edits, status, roster, view: result.view, issues: result.issues, scope, policy, catalogues, slugs };
  }
  if (status === 'error') return { ...base, status, error: error ?? new Error('Something went wrong.') };
  return status === 'missing' ? { ...base, status } : { ...base, status: 'loading' };
}

/**
 * Turns a fix into an edit. Several candidate units open the picker; a single one is added (and opened when it is a
 * unit rather than an army choice such as Battle Size); "open" opens the unit, unless it is a choice the app sets itself
 * (Game Type, Battle Size, Detachment Command Cost).
 */
function applyFix(scope: Scope, r: Roster, fix: Fix, commit: (r: Roster) => void, ui: EditorUi | undefined): string | undefined {
  switch (fix.kind) {
    case 'add-unit': {
      if (fix.entryIds.length !== 1) {
        ui?.openPicker(fix.forceSelId, fix.entryIds);
        return undefined;
      }
      const { roster, selId } = addUnit(scope, r, fix.forceSelId, fix.entryIds[0]);
      if (!selId) return undefined;
      commit(roster);
      const node = scope.node(fix.entryIds[0]);
      if (node && resolve(scope, node).type !== 'upgrade') ui?.openUnit(selId);
      return selId;
    }
    case 'remove':
      commit(fix.selIds.reduce(removeSelection, r));
      return undefined;
    case 'set-count':
      commit(setCount(scope, r, fix.selId, fix.count));
      return undefined;
    case 'open': {
      const root = r.forces.flatMap((f) => f.selections).find((s) => s.id === fix.selId || holds(s, fix.selId));
      if (!root || !isAutoManagedEntry(scope, root.entryId)) ui?.openUnit(fix.selId);
      return undefined;
    }
  }
}

const holds = (s: Sel, id: string): boolean => s.children.some((c) => c.id === id || holds(c, id));
