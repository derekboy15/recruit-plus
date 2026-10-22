/**
 * The board camera. World units are inches with y up (north, y = board.h, at the top of the screen); the screen is in
 * CSS pixels with y down. `x`/`y` are the screen position of the board's north-west corner, world (0, board.h).
 */
import type { Pt } from '@recruit/engine';

export interface Camera { scale: number; x: number; y: number }
export interface Size { w: number; h: number }

export function fitCamera(board: Size, view: Size, margin = 8): Camera {
  const scale = Math.max(0.01, Math.min((view.w - 2 * margin) / board.w, (view.h - 2 * margin) / board.h));
  return { scale, x: (view.w - board.w * scale) / 2, y: (view.h - board.h * scale) / 2 };
}

export const worldToScreen = (cam: Camera, board: Size, p: Pt): Pt => ({ x: cam.x + p.x * cam.scale, y: cam.y + (board.h - p.y) * cam.scale });
export const screenToWorld = (cam: Camera, board: Size, s: Pt): Pt => ({ x: (s.x - cam.x) / cam.scale, y: board.h - (s.y - cam.y) / cam.scale });

/** Zooms by `factor` keeping the screen point `at` over the same spot of the board. */
export function zoomAt(cam: Camera, factor: number, at: Pt, limits: { min: number; max: number }): Camera {
  const scale = Math.min(limits.max, Math.max(limits.min, cam.scale * factor));
  const k = scale / cam.scale;
  return { scale, x: at.x - (at.x - cam.x) * k, y: at.y - (at.y - cam.y) * k };
}

export const panBy = (cam: Camera, dx: number, dy: number): Camera => ({ ...cam, x: cam.x + dx, y: cam.y + dy });

/** Keeps at least a quarter of the board's shorter side in view. */
export function clampCamera(cam: Camera, board: Size, view: Size): Camera {
  const keep = Math.min(board.w, board.h) * cam.scale * 0.25;
  const x = Math.min(view.w - keep, Math.max(keep - board.w * cam.scale, cam.x));
  const y = Math.min(view.h - keep, Math.max(keep - board.h * cam.scale, cam.y));
  return x === cam.x && y === cam.y ? cam : { ...cam, x, y };
}

export const zoomLimits = (fit: Camera) => ({ min: fit.scale * 0.8, max: Math.max(fit.scale * 8, 40) });
