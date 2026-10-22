import type { Command, Problem } from '@recruit/engine';
import { useEffect, useMemo } from 'react';
import type { PanelProps } from './types';

/**
 * Asks the engine, without changing the game, whether a planned command would be accepted (checked when no drag is in
 * progress), and marks the models it complains about. null: nothing to check yet, or a drag is under way.
 */
export function useDryRun({ sb, ui }: PanelProps, cmd: Command | null): Problem[] | null {
  const key = cmd && !ui.dragging ? JSON.stringify(cmd) : null;
  // The key stands for the command; the record for the game it is checked against.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const problems = useMemo(() => (key && cmd ? sb.check(cmd) : null), [key, sb.record]);
  const invalidKey = (problems ?? []).flatMap((p) => p.modelIds ?? []).join('|');
  useEffect(() => {
    if (problems) ui.setInvalid(invalidKey ? invalidKey.split('|') : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidKey, problems === null]);
  return problems;
}
