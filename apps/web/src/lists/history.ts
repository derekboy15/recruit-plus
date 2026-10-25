/** The list editor's undo and redo: a pure history of rosters, and the keyboard shortcuts for it. */
import type { Roster } from '@recruit/data/roster';
import { useEffect, useRef } from 'react';

export interface History {
  past: Roster[];
  present: Roster;
  future: Roster[];
  /** The kind of the last edit pushed (null after an undo or redo, so nothing merges into it). */
  lastKind: string | null;
  /** When the last edit was pushed (ms). */
  lastAt: number;
}

const LIMIT = 50;
/** Renames within this long of the previous rename are one step, so typing a name is not an undo step per key. */
const MERGE_MS = 1000;

export const start = (present: Roster): History => ({ past: [], present, future: [], lastKind: null, lastAt: 0 });

/** Records an edit. A rename within a second of the last rename replaces it instead of adding a step. */
export function push(h: History, next: Roster, kind: string, at: number): History {
  if (kind === 'rename' && h.lastKind === 'rename' && at - h.lastAt <= MERGE_MS) return { ...h, present: next, future: [], lastAt: at };
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [], lastKind: kind, lastAt: at };
}

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

export function undo(h: History): History {
  if (!canUndo(h)) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastKind: null, lastAt: 0 };
}

export function redo(h: History): History {
  if (!canRedo(h)) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), lastKind: null, lastAt: 0 };
}

/** Inputs with no text of their own to undo: Ctrl+Z on a ticked box still undoes the list edit. */
const NOT_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** Whether a key press belongs to a text field (or a select), which has its own undo. */
function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return false;
  if (t.closest('textarea, select, [contenteditable]:not([contenteditable="false"])')) return true;
  const input = t.closest('input');
  return input !== null && !NOT_TEXT.has(input.type);
}

/** Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Not while typing in a field. Pass null while there is no editor. */
export function useEditorShortcuts(editor: { undo(): void; redo(): void } | null): void {
  const ref = useRef(editor);
  ref.current = editor;
  const on = editor !== null;
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      const ed = ref.current;
      if (!ed || e.defaultPrevented || e.altKey || !(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) ed.undo();
      else if ((key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.shiftKey)) ed.redo();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [on]);
}
