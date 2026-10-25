import { useCallback, useRef } from 'react';
import { useToast } from '../ui/toast';
import type { ReadyEditor } from './useRosterEditor';

export const STALE_UNDO = 'Can’t undo that now: the list has changed since. Use Undo at the top.';

/**
 * Call right after an edit: shows `message` with an Undo that takes back that edit, and only that edit. If the list has
 * changed since (another edit, an undo or a redo), Undo would take back the wrong thing, so it says so instead.
 */
export function useUndoToast(editor: ReadyEditor): (message: string) => void {
  const toast = useToast();
  const latest = useRef(editor);
  latest.current = editor;
  return useCallback(
    (message: string) => {
      const version = latest.current.getVersion();
      toast.show({
        message,
        action: {
          label: 'Undo',
          onAction: () => {
            const ed = latest.current;
            if (ed.getVersion() === version) ed.undo();
            else toast.show({ message: STALE_UNDO });
          },
        },
      });
    },
    [toast],
  );
}
