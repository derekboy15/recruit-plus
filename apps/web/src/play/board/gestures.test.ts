import { describe, expect, test } from 'vitest';
import { reduceGesture, type GestureEnv, type GestureOut, type GestureState, type PointerEv } from './gestures';

const env: GestureEnv = {
  hit: (pt) => (pt.x < 50 ? 'm1' : pt.x < 100 ? 'locked' : null),
  canDrag: (id) => id === 'm1',
};

function run(events: PointerEv[], start: GestureState = { kind: 'idle' }): { state: GestureState; out: GestureOut[] } {
  let state = start;
  const out: GestureOut[] = [];
  for (const e of events) {
    const r = reduceGesture(state, e, env);
    state = r.state;
    out.push(...r.out);
  }
  return { state, out };
}
const ev = (type: PointerEv['type'], id: number, x: number, y: number): PointerEv => ({ type, id, pt: { x, y } });

describe('gestures', () => {
  test('a short press on a model is a tap on it', () => {
    const { out, state } = run([ev('down', 1, 10, 10), ev('move', 1, 13, 12), ev('up', 1, 13, 12)]);
    expect(out).toEqual([{ type: 'tap', at: { x: 13, y: 12 }, modelId: 'm1' }]);
    expect(state).toEqual({ kind: 'idle' });
  });

  test('down on empty board then move pans', () => {
    const { out } = run([ev('down', 1, 200, 10), ev('move', 1, 220, 10), ev('move', 1, 230, 15), ev('up', 1, 230, 15)]);
    expect(out).toEqual([
      { type: 'pan', dx: 20, dy: 0 },
      { type: 'pan', dx: 10, dy: 5 },
    ]);
  });

  test('down on a draggable model then move drags it', () => {
    const { out } = run([ev('down', 1, 10, 10), ev('move', 1, 30, 10), ev('move', 1, 40, 12), ev('up', 1, 41, 12)]);
    expect(out).toEqual([
      { type: 'drag-start', modelId: 'm1', at: { x: 10, y: 10 } },
      { type: 'drag-move', modelId: 'm1', at: { x: 30, y: 10 } },
      { type: 'drag-move', modelId: 'm1', at: { x: 40, y: 12 } },
      { type: 'drag-end', modelId: 'm1', at: { x: 41, y: 12 } },
    ]);
  });

  test("down on a model that can't be dragged then move pans", () => {
    const { out } = run([ev('down', 1, 60, 10), ev('move', 1, 80, 10)]);
    expect(out).toEqual([{ type: 'pan', dx: 20, dy: 0 }]);
  });

  test('a second finger turns a drag into a pinch and cancels the drag', () => {
    const { out, state } = run([ev('down', 1, 10, 10), ev('move', 1, 30, 10), ev('down', 2, 130, 10)]);
    expect(out.at(-1)).toEqual({ type: 'drag-cancel', modelId: 'm1' });
    expect(state.kind).toBe('pinch');
  });

  test('pinching apart zooms in about the midpoint', () => {
    const { out } = run([ev('down', 1, 100, 100), ev('down', 2, 200, 100), ev('move', 2, 300, 100)]);
    const zoom = out.find((o) => o.type === 'zoom');
    expect(zoom).toEqual({ type: 'zoom', factor: 2, at: { x: 200, y: 100 } });
    expect(out).toContainEqual({ type: 'pan', dx: 50, dy: 0 });
  });

  test('lifting a finger ends the pinch and the other finger does nothing', () => {
    const { out, state } = run([ev('down', 1, 100, 100), ev('down', 2, 200, 100), ev('up', 2, 200, 100), ev('move', 1, 160, 100), ev('up', 1, 160, 100)]);
    expect(out).toEqual([]);
    expect(state).toEqual({ kind: 'idle' });
  });

  test('a press that ends far away with no moves in between drags the model, not a tap', () => {
    const { out } = run([ev('down', 1, 10, 10), ev('up', 1, 40, 10)]);
    expect(out).toEqual([
      { type: 'drag-start', modelId: 'm1', at: { x: 10, y: 10 } },
      { type: 'drag-move', modelId: 'm1', at: { x: 40, y: 10 } },
      { type: 'drag-end', modelId: 'm1', at: { x: 40, y: 10 } },
    ]);
  });

  test('on empty board such a press pans instead', () => {
    const { out } = run([ev('down', 1, 200, 10), ev('up', 1, 230, 10)]);
    expect(out).toEqual([{ type: 'pan', dx: 30, dy: 0 }]);
  });

  test('cancel during a drag cancels it', () => {
    const { out, state } = run([ev('down', 1, 10, 10), ev('move', 1, 30, 10), ev('cancel', 1, 30, 10)]);
    expect(out.at(-1)).toEqual({ type: 'drag-cancel', modelId: 'm1' });
    expect(state).toEqual({ kind: 'idle' });
  });
});
