/**
 * The battlefield: pointer input goes through the gesture machine (tap, drag a model, pan, pinch-zoom), and the scene is
 * drawn by a renderer (PixiJS in the app, loaded on first use; a fake one in tests).
 */
import type { Pt } from '@recruit/engine';
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { clampCamera, fitCamera, screenToWorld, worldToScreen, zoomAt, zoomLimits, panBy, type Camera, type Size } from './camera';
import { reduceGesture, type GestureOut, type GestureState } from './gestures';
import { hitTest } from './hitTest';
import type { BoardScene } from './scene';

export interface SceneRenderer { draw(scene: BoardScene, cam: Camera): void; resize(view: Size): void; destroy(): void }
export type RendererFactory = (host: HTMLElement, view: Size) => Promise<SceneRenderer>;

export interface BoardCanvasProps {
  scene: BoardScene;
  canDrag(modelId: string): boolean;
  /** World inches. */
  onTap(at: Pt, modelId: string | null): void;
  onDrag(modelId: string, at: Pt, phase: 'start' | 'move' | 'end' | 'cancel'): void;
  renderer?: RendererFactory;
  /** e.g. "Battlefield, 44 by 60 inches". */
  label: string;
}

/** Touch slop around bases, so small bases on a phone can still be picked (spec: 44 px touch targets). */
const HIT_SLOP_PX = 22;
const ZOOM_STEP = 1.4;

const pixi: RendererFactory = async (host, view) => (await import('./pixiRenderer')).createPixiRenderer(host, view);

declare global {
  interface Window {
    /** DEV only: lets end-to-end tests find models on the canvas. */
    __sandbox?: { screenOf?(modelId: string): Pt | null; state?(): unknown };
  }
}

export function BoardCanvas({ scene, canDrag, onTap, onDrag, renderer = pixi, label }: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const camRef = useRef<Camera | null>(null);
  const viewRef = useRef<Size>({ w: 0, h: 0 });
  const fittedFor = useRef('');
  const gesture = useRef<GestureState>({ kind: 'idle' });
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const handlers = useRef({ canDrag, onTap, onDrag });
  handlers.current = { canDrag, onTap, onDrag };

  const draw = useCallback(() => {
    const r = rendererRef.current;
    const cam = camRef.current;
    if (r && cam) r.draw(sceneRef.current, cam);
  }, []);

  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    viewRef.current = { w: rect.width, h: rect.height };
    const board = sceneRef.current.board;
    const key = `${board.w}x${board.h}`;
    if (!camRef.current || fittedFor.current !== key) {
      camRef.current = fitCamera(board, viewRef.current);
      fittedFor.current = key;
    }
    rendererRef.current?.resize(viewRef.current);
  }, []);

  useEffect(() => {
    const host = hostRef.current!;
    let live = true;
    measure();
    void renderer(host, viewRef.current).then((r) => {
      if (!live) return r.destroy();
      rendererRef.current = r;
      draw();
    });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => (measure(), draw()));
    ro?.observe(host);
    return () => {
      live = false;
      ro?.disconnect();
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [renderer, measure, draw]);

  useEffect(() => {
    measure();
    draw();
  }, [scene, measure, draw]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__sandbox = {
      ...window.__sandbox,
      screenOf(modelId) {
        const m = sceneRef.current.models.find((x) => x.id === modelId);
        const cam = camRef.current;
        const host = hostRef.current;
        if (!m || !cam || !host) return null;
        const rect = host.getBoundingClientRect();
        const p = worldToScreen(cam, sceneRef.current.board, m.center);
        return { x: rect.left + p.x, y: rect.top + p.y };
      },
    };
  }, []);

  const setCam = (next: Camera) => {
    camRef.current = clampCamera(next, sceneRef.current.board, viewRef.current);
    draw();
  };
  const fitNow = () => fitCamera(sceneRef.current.board, viewRef.current);
  const zoom = (factor: number, at: Pt) => camRef.current && setCam(zoomAt(camRef.current, factor, at, zoomLimits(fitNow())));

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const rect = hostRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const world = (pt: Pt) => screenToWorld(camRef.current!, sceneRef.current.board, pt);

  const run = (out: GestureOut[]) => {
    for (const o of out) {
      if (o.type === 'tap') handlers.current.onTap(world(o.at), o.modelId);
      else if (o.type === 'drag-cancel') handlers.current.onDrag(o.modelId, { x: 0, y: 0 }, 'cancel');
      else if (o.type === 'pan') camRef.current && setCam(panBy(camRef.current, o.dx, o.dy));
      else if (o.type === 'zoom') zoom(o.factor, o.at);
      else handlers.current.onDrag(o.modelId, world(o.at), o.type === 'drag-start' ? 'start' : o.type === 'drag-move' ? 'move' : 'end');
    }
  };

  const onPointer = (type: 'down' | 'move' | 'up' | 'cancel') => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!camRef.current) return;
    if (type === 'down') {
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // The pointer is already gone (released, or synthetic): the gesture still works without capture.
      }
    }
    const env = {
      hit: (pt: Pt) => hitTest(sceneRef.current.models, world(pt), HIT_SLOP_PX / camRef.current!.scale),
      canDrag: (id: string) => handlers.current.canDrag(id),
    };
    const r = reduceGesture(gesture.current, { type, id: e.pointerId, pt: local(e) }, env);
    gesture.current = r.state;
    run(r.out);
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => zoom(1.1 ** (-e.deltaY / 100), local(e));
  const centre = () => ({ x: viewRef.current.w / 2, y: viewRef.current.h / 2 });

  return (
    <div className="board">
      <div
        ref={hostRef}
        className="board__canvas"
        role="application"
        aria-label={label}
        onPointerDown={onPointer('down')}
        onPointerMove={onPointer('move')}
        onPointerUp={onPointer('up')}
        onPointerCancel={onPointer('cancel')}
        onWheel={onWheel}
      />
      <div className="board__zoom">
        <button type="button" className="btn btn--small" aria-label="Zoom in" onClick={() => zoom(ZOOM_STEP, centre())}>
          +
        </button>
        <button type="button" className="btn btn--small" aria-label="Zoom out" onClick={() => zoom(1 / ZOOM_STEP, centre())}>
          −
        </button>
        <button type="button" className="btn btn--small" aria-label="Fit board" onClick={() => setCam(fitNow())}>
          ⤢
        </button>
      </div>
    </div>
  );
}
