/**
 * Touch and mouse on the board as a small state machine: a short press is a tap, a press that moves drags a model (when
 * it started on one that can be dragged) or pans, and two fingers pinch-zoom and pan. All points are screen pixels.
 */
import type { Pt } from '@recruit/engine';

export type PointerEv = { type: 'down' | 'move' | 'up' | 'cancel'; id: number; pt: Pt };
export type GestureState =
  | { kind: 'idle' }
  | { kind: 'press'; id: number; start: Pt; last: Pt; modelId: string | null }
  | { kind: 'pan'; id: number; last: Pt }
  | { kind: 'drag'; id: number; modelId: string; last: Pt }
  | { kind: 'pinch'; a: number; b: number; pts: Record<number, Pt>; lastDist: number; lastMid: Pt };
export type GestureOut =
  | { type: 'tap'; at: Pt; modelId: string | null }
  | { type: 'drag-start' | 'drag-move' | 'drag-end'; modelId: string; at: Pt }
  | { type: 'drag-cancel'; modelId: string }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'zoom'; factor: number; at: Pt };
export interface GestureEnv { hit(pt: Pt): string | null; canDrag(modelId: string): boolean }

export const TAP_SLOP_PX = 8;

const IDLE: GestureState = { kind: 'idle' };
const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const gap = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

export function reduceGesture(s: GestureState, e: PointerEv, env: GestureEnv): { state: GestureState; out: GestureOut[] } {
  const none = (state: GestureState) => ({ state, out: [] as GestureOut[] });
  if (s.kind === 'idle') return e.type === 'down' ? none({ kind: 'press', id: e.id, start: e.pt, last: e.pt, modelId: env.hit(e.pt) }) : none(s);

  if (s.kind === 'pinch') {
    if (e.id !== s.a && e.id !== s.b) return none(s);
    if (e.type === 'up' || e.type === 'cancel') return none(IDLE);
    if (e.type !== 'move') return none(s);
    const pts = { ...s.pts, [e.id]: e.pt };
    const dist = Math.max(1, gap(pts[s.a], pts[s.b]));
    const m = mid(pts[s.a], pts[s.b]);
    return {
      state: { ...s, pts, lastDist: dist, lastMid: m },
      out: [
        { type: 'pan', dx: m.x - s.lastMid.x, dy: m.y - s.lastMid.y },
        { type: 'zoom', factor: dist / s.lastDist, at: m },
      ],
    };
  }

  // One finger is down (press, pan or drag).
  if (e.type === 'down' && e.id !== s.id) {
    const pts = { [s.id]: s.last, [e.id]: e.pt };
    const pinch: GestureState = { kind: 'pinch', a: s.id, b: e.id, pts, lastDist: Math.max(1, gap(s.last, e.pt)), lastMid: mid(s.last, e.pt) };
    return { state: pinch, out: s.kind === 'drag' ? [{ type: 'drag-cancel', modelId: s.modelId }] : [] };
  }
  if (e.id !== s.id) return none(s);
  if (e.type === 'cancel') return { state: IDLE, out: s.kind === 'drag' ? [{ type: 'drag-cancel', modelId: s.modelId }] : [] };
  if (e.type === 'up') {
    if (s.kind === 'press') {
      if (gap(s.start, e.pt) <= TAP_SLOP_PX) return { state: IDLE, out: [{ type: 'tap', at: e.pt, modelId: s.modelId }] };
      // Lifted far from where it went down with no moves reported in between: still a drag (or a pan), never a tap.
      if (s.modelId && env.canDrag(s.modelId))
        return {
          state: IDLE,
          out: [
            { type: 'drag-start', modelId: s.modelId, at: s.start },
            { type: 'drag-move', modelId: s.modelId, at: e.pt },
            { type: 'drag-end', modelId: s.modelId, at: e.pt },
          ],
        };
      return { state: IDLE, out: [{ type: 'pan', dx: e.pt.x - s.start.x, dy: e.pt.y - s.start.y }] };
    }
    if (s.kind === 'drag') return { state: IDLE, out: [{ type: 'drag-end', modelId: s.modelId, at: e.pt }] };
    return none(IDLE);
  }
  if (e.type !== 'move') return none(s);
  if (s.kind === 'press') {
    if (gap(s.start, e.pt) <= TAP_SLOP_PX) return none({ ...s, last: e.pt });
    if (s.modelId && env.canDrag(s.modelId))
      return {
        state: { kind: 'drag', id: s.id, modelId: s.modelId, last: e.pt },
        out: [
          { type: 'drag-start', modelId: s.modelId, at: s.start },
          { type: 'drag-move', modelId: s.modelId, at: e.pt },
        ],
      };
    return { state: { kind: 'pan', id: s.id, last: e.pt }, out: [{ type: 'pan', dx: e.pt.x - s.start.x, dy: e.pt.y - s.start.y }] };
  }
  if (s.kind === 'pan') return { state: { ...s, last: e.pt }, out: [{ type: 'pan', dx: e.pt.x - s.last.x, dy: e.pt.y - s.last.y }] };
  return { state: { ...s, last: e.pt }, out: [{ type: 'drag-move', modelId: s.modelId, at: e.pt }] };
}
