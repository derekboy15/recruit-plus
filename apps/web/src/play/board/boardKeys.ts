/**
 * Keyboard control of the board. Distances are world inches with y up (ArrowUp is north):
 * - browsing: arrows move the view 2" (8" with Shift), + / = and - zoom, 0 fits the board, ] and [ step through the
 *   models, Enter selects the model in focus (a tap), Space picks it up to move it;
 * - with a model picked up: arrows nudge it 0.5" (2" with Shift), Space or Enter puts it down, Escape cancels.
 * Tab is never taken, so focus can always leave the board.
 */
export type BoardKeyAction =
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'zoom'; factor: number }
  | { kind: 'fit' }
  | { kind: 'cycle'; step: 1 | -1 }
  | { kind: 'select' }
  | { kind: 'grab' }
  | { kind: 'nudge'; dx: number; dy: number }
  | { kind: 'drop' }
  | { kind: 'cancel' };

export const ZOOM_STEP = 1.4;

const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export function boardKey(e: { key: string; shiftKey: boolean }, mode: 'browse' | 'grabbed'): BoardKeyAction | null {
  const arrow = ARROWS[e.key];
  if (mode === 'grabbed') {
    if (arrow) {
      const d = e.shiftKey ? 2 : 0.5;
      return { kind: 'nudge', dx: arrow[0] * d, dy: arrow[1] * d };
    }
    if (e.key === ' ' || e.key === 'Enter') return { kind: 'drop' };
    if (e.key === 'Escape') return { kind: 'cancel' };
    return null;
  }
  if (arrow) {
    const d = e.shiftKey ? 8 : 2;
    return { kind: 'pan', dx: arrow[0] * d, dy: arrow[1] * d };
  }
  switch (e.key) {
    case '+':
    case '=':
      return { kind: 'zoom', factor: ZOOM_STEP };
    case '-':
      return { kind: 'zoom', factor: 1 / ZOOM_STEP };
    case '0':
      return { kind: 'fit' };
    case ']':
      return { kind: 'cycle', step: 1 };
    case '[':
      return { kind: 'cycle', step: -1 };
    case 'Enter':
      return { kind: 'select' };
    case ' ':
      return { kind: 'grab' };
    default:
      return null;
  }
}
