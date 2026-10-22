import { describe, expect, test } from 'vitest';
import { clampCamera, fitCamera, panBy, screenToWorld, worldToScreen, zoomAt, zoomLimits } from './camera';

const board = { w: 44, h: 60 };
const view = { w: 375, h: 400 };

describe('camera', () => {
  test('fit centres a 44×60 board in 375×400 with an 8px margin', () => {
    const cam = fitCamera(board, view);
    expect(cam.scale).toBeCloseTo((400 - 16) / 60);
    expect(cam.y).toBeCloseTo(8);
    expect(cam.x).toBeCloseTo((375 - 44 * cam.scale) / 2);
  });

  test('worldToScreen and screenToWorld are inverses', () => {
    const cam = { scale: 7.3, x: 12, y: -40 };
    const p = { x: 13.25, y: 41.5 };
    const back = screenToWorld(cam, board, worldToScreen(cam, board, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  test('north is at the top of the screen', () => {
    const cam = fitCamera(board, view);
    expect(worldToScreen(cam, board, { x: 0, y: 60 }).y).toBeCloseTo(8);
    expect(worldToScreen(cam, board, { x: 0, y: 0 }).y).toBeCloseTo(392);
  });

  test('zoomAt keeps the point under the finger still', () => {
    const cam = fitCamera(board, view);
    const at = { x: 200, y: 150 };
    const before = screenToWorld(cam, board, at);
    const zoomed = zoomAt(cam, 2.5, at, { min: 1, max: 100 });
    expect(zoomed.scale).toBeCloseTo(cam.scale * 2.5);
    const after = screenToWorld(zoomed, board, at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  test('zoom is clamped to the limits', () => {
    const cam = fitCamera(board, view);
    const limits = zoomLimits(cam);
    expect(limits).toEqual({ min: cam.scale * 0.8, max: Math.max(cam.scale * 8, 40) });
    expect(zoomAt(cam, 1000, { x: 0, y: 0 }, limits).scale).toBe(limits.max);
    expect(zoomAt(cam, 0.001, { x: 0, y: 0 }, limits).scale).toBe(limits.min);
  });

  test('panBy moves the board with the finger', () => {
    expect(panBy({ scale: 2, x: 10, y: 20 }, 5, -3)).toEqual({ scale: 2, x: 15, y: 17 });
  });

  test('clampCamera stops the board being panned out of view', () => {
    const cam = fitCamera(board, view);
    const keep = Math.min(board.w, board.h) * cam.scale * 0.25;
    const far = clampCamera(panBy(cam, 5000, 5000), board, view);
    expect(far.x).toBeCloseTo(view.w - keep);
    expect(far.y).toBeCloseTo(view.h - keep);
    const other = clampCamera(panBy(cam, -5000, -5000), board, view);
    expect(other.x + board.w * cam.scale).toBeCloseTo(keep);
    expect(other.y + board.h * cam.scale).toBeCloseTo(keep);
    expect(clampCamera(cam, board, view)).toEqual(cam);
  });
});
