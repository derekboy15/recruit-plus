/**
 * The game screen's controller: opens a saved game, sends player actions to the engine (which decides every rule),
 * keeps the newest record, and saves it 300 ms after the last accepted action (at once when the page is hidden).
 */
import {
  currentStep,
  dispatch,
  gameLog,
  stateOf,
  undo as engineUndo,
  type Command,
  type CurrentStep,
  type GameRecord,
  type GameState,
  type LogLine,
  type Problem,
} from '@recruit/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '../../storage/StorageContext';
import type { Doc } from '../../storage/types';
import { openGameDoc, saveGameDoc, type GameData, type GameMeta } from '../store/gameStore';

export type SandboxState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'unreadable'; message: string }
  | { status: 'ready'; doc: Doc<GameData>; record: GameRecord; state: GameState; step: CurrentStep; log: LogLine[] };

export type Sandbox = SandboxState & {
  /** Dispatches; null when accepted, else the engine's problems. Accepted records are saved (300 ms debounce). */
  act(cmd: Command): Problem[] | null;
  /** A dry run: the problems the command would get, without changing anything. */
  check(cmd: Command): Problem[];
  undo(): Problem[] | null;
  setMeta(patch: Partial<GameMeta>): void;
  flush(): Promise<void>;
  saveError: Error | null;
};

const SAVE_DELAY_MS = 300;
const logs = new WeakMap<GameRecord, LogLine[]>();
const logOf = (r: GameRecord) => {
  let l = logs.get(r);
  if (!l) logs.set(r, (l = gameLog(r)));
  return l;
};

type Loaded = { status: 'loading' } | { status: 'missing' } | { status: 'unreadable'; message: string } | { status: 'ready'; doc: Doc<GameData>; record: GameRecord };

export function useSandbox(gameId: string): Sandbox {
  const { repo } = useStorage();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [saveError, setSaveError] = useState<Error | null>(null);
  const current = useRef<{ doc: Doc<GameData>; record: GameRecord } | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    setLoaded({ status: 'loading' });
    current.current = null;
    openGameDoc(repo, gameId).then(
      (o) => {
        if (!live) return;
        if (!o.ok) return setLoaded(o.reason === 'missing' ? { status: 'missing' } : { status: 'unreadable', message: o.message });
        current.current = { doc: o.doc, record: o.record };
        setLoaded({ status: 'ready', doc: o.doc, record: o.record });
      },
      (e: unknown) => live && setLoaded({ status: 'unreadable', message: `This saved game couldn't be opened: ${(e as Error).message}` }),
    );
    return () => {
      live = false;
    };
  }, [repo, gameId]);

  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const c = current.current;
    if (!c || !dirty.current) return saving.current;
    dirty.current = false;
    saving.current = saving.current
      .then(() => saveGameDoc(repo, c.doc, c.record))
      .then(
        (doc) => {
          if (current.current) current.current = { ...current.current, doc: { ...doc, data: { ...doc.data, record: current.current.record } } };
          setSaveError(null);
        },
        (e: unknown) => {
          dirty.current = true;
          setSaveError(e instanceof Error ? e : new Error(String(e)));
        },
      );
    return saving.current;
  }, [repo]);

  const schedule = useCallback(() => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [save]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void save();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void save();
    };
  }, [save]);

  const commit = useCallback(
    (record: GameRecord) => {
      const c = current.current!;
      current.current = { ...c, record };
      setLoaded({ status: 'ready', doc: c.doc, record });
      schedule();
    },
    [schedule],
  );

  const act = useCallback(
    (cmd: Command): Problem[] | null => {
      const c = current.current;
      if (!c) return [{ code: 'not-ready', message: 'The game is still loading.', rule: '[R-19]' }];
      const r = dispatch(c.record, cmd);
      if (!r.ok) return r.problems;
      if (r.game !== c.record) commit(r.game);
      return null;
    },
    [commit],
  );

  const check = useCallback((cmd: Command): Problem[] => {
    const c = current.current;
    if (!c) return [{ code: 'not-ready', message: 'The game is still loading.', rule: '[R-19]' }];
    const r = dispatch(c.record, cmd);
    return r.ok ? [] : r.problems;
  }, []);

  const undo = useCallback((): Problem[] | null => {
    const c = current.current;
    if (!c) return null;
    const r = engineUndo(c.record);
    if (!r.ok) return r.problems;
    commit(r.game);
    return null;
  }, [commit]);

  const setMeta = useCallback(
    (patch: Partial<GameMeta>) => {
      const c = current.current;
      if (!c) return;
      const doc = { ...c.doc, data: { ...c.doc.data, meta: { ...c.doc.data.meta, ...patch } } };
      current.current = { ...c, doc };
      setLoaded({ status: 'ready', doc, record: c.record });
      schedule();
    },
    [schedule],
  );

  return useMemo((): Sandbox => {
    const api = { act, check, undo, setMeta, flush: save, saveError };
    if (loaded.status !== 'ready') return { ...loaded, ...api };
    const state = stateOf(loaded.record);
    const record = loaded.record;
    return {
      status: 'ready',
      doc: loaded.doc,
      record,
      state,
      step: currentStep(state),
      get log() {
        return logOf(record);
      },
      ...api,
    };
  }, [loaded, act, check, undo, setMeta, save, saveError]);
}
