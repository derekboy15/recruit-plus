/** The game log for reading on a phone: grouped by phase, newest phase and newest line first. */
import type { LogLine } from '@recruit/engine';

export interface LogGroup { key: string; title: string; lines: { key: string; text: string }[] }

export const sentenceCase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The engine's phase-start line, "Battle round 2: Necrons' Movement phase.": it becomes a group's title. */
const PHASE_START = /^Battle round (\d+): (.+) phase\.$/;

export function logGroups(lines: LogLine[]): LogGroup[] {
  const groups: LogGroup[] = [];
  let current: LogGroup | null = null;
  lines.forEach((l, i) => {
    const start = PHASE_START.exec(l.text);
    if (start) {
      current = { key: `${l.seq}-${i}`, title: `Round ${start[1]} · ${start[2]} phase`, lines: [] };
      groups.push(current);
      return;
    }
    if (!current) {
      current = { key: 'before', title: 'Before the battle', lines: [] };
      groups.push(current);
    }
    current.lines.push({ key: `${l.seq}-${i}`, text: sentenceCase(l.text) });
  });
  return groups.reverse().map((g) => ({ ...g, lines: g.lines.reverse() }));
}
