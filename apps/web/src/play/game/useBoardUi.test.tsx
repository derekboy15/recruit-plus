import { currentStep, dispatch, gameLog, stateOf, type Command, type GameRecord } from '@recruit/engine';
import { act, render } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { describe, expect, test } from 'vitest';
import { deployedGame } from '../__fixtures__/game';
import { META } from '../__fixtures__/panel';
import type { ReadySandbox } from '../panels/types';
import { useBoardUi, type BoardUi } from './useBoardUi';

/** Renders the hook over an in-memory game; `send` dispatches as a panel would. */
function setup(start: GameRecord) {
  const out = {} as { board: BoardUi; send(cmd: Command): void };
  function Host() {
    const [record, setRecord] = useState(start);
    const sb = useMemo((): ReadySandbox => {
      const state = stateOf(record);
      return {
        status: 'ready',
        doc: { id: 'g1', kind: 'game', ownerId: 'u', updatedAt: 1, deleted: false, isPublic: false, dirty: false, data: { record, meta: META, summary: { round: 1, phase: 'command', ended: false, winner: null, vp: { A: 0, B: 0 } } } },
        record,
        state,
        step: currentStep(state),
        get log() {
          return gameLog(record);
        },
        act(cmd) {
          const r = dispatch(record, cmd);
          if (!r.ok) return r.problems;
          setRecord(r.game);
          return null;
        },
        check: () => [],
        undo: () => null,
        setMeta() {},
        flush: async () => {},
        saveError: null,
      };
    }, [record]);
    out.board = useBoardUi(sb);
    out.send = (cmd) => {
      const p = sb.act(cmd);
      if (p) throw new Error(p.map((x) => x.message).join(' '));
    };
    return null;
  }
  render(<Host />);
  return out;
}

describe('useBoardUi', () => {
  test('a tap on a model selects its unit when no panel took the taps', () => {
    const g = deployedGame();
    const h = setup(g);
    const modelId = stateOf(g).units['A:war'].modelIds[0];
    act(() => h.board.onTap({ x: 14, y: 4 }, modelId));
    expect(h.board.ui.selectedUnitId).toBe('A:war');
    act(() => h.board.onTap({ x: 1, y: 1 }, null));
    expect(h.board.ui.selectedUnitId).toBeNull();
  });

  test('a finished drag moves the planned model by the drag, keeping the grab offset', () => {
    const g = deployedGame();
    const h = setup(g);
    const s = stateOf(g);
    const id = s.units['A:war'].modelIds[0];
    const origin = Object.fromEntries(s.units['A:war'].modelIds.map((m) => [m, s.models[m].pos]));
    act(() => h.board.ui.planDispatch({ type: 'start', unitId: 'A:war', origin, together: false }));
    const start = s.models[id].pos!;
    act(() => h.board.onDrag(id, { x: start.x + 0.5, y: start.y }, 'start'));
    act(() => h.board.onDrag(id, { x: start.x + 2.5, y: start.y + 1 }, 'end'));
    const moved = h.board.ui.plan!.positions[id];
    expect(moved.x).toBeCloseTo(start.x + 2);
    expect(moved.y).toBeCloseTo(start.y + 1);
    expect(h.board.ui.dragging).toBe(false);
  });

  test('a new phase clears the selection and the plan', () => {
    const g = deployedGame();
    const h = setup(g);
    const s = stateOf(g);
    act(() => h.board.ui.select('A:war'));
    act(() => h.board.ui.planDispatch({ type: 'start', unitId: 'A:war', origin: Object.fromEntries(s.units['A:war'].modelIds.map((m) => [m, s.models[m].pos])) }));
    act(() => h.send({ type: 'endPhase', by: 'A' } as Command));
    expect(h.board.ui.selectedUnitId).toBeNull();
    expect(h.board.ui.plan).toBeNull();
  });
});
