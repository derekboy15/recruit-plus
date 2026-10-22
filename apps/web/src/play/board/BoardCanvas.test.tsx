import { stateOf } from '@recruit/engine';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { deployedGame } from '../__fixtures__/game';
import { BoardCanvas, type RendererFactory, type SceneRenderer } from './BoardCanvas';
import type { Camera } from './camera';
import { buildScene, type BoardScene } from './scene';

const VIEW = { w: 440, h: 300 };
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: VIEW.w, bottom: VIEW.h, width: VIEW.w, height: VIEW.h, toJSON: () => ({}) });
});
afterEach(() => vi.restoreAllMocks());

function fake() {
  const draws: { scene: BoardScene; cam: Camera }[] = [];
  const renderer: SceneRenderer = { draw: (scene, cam) => draws.push({ scene, cam: { ...cam } }), resize: () => {}, destroy: vi.fn() };
  const factory: RendererFactory = async () => renderer;
  return { draws, factory, renderer };
}

const scene = () => buildScene(stateOf(deployedGame()), { selectedUnitId: null, plan: null, invalidModelIds: [], rings: [], targetUnitIds: [] });
// The 44"×30" board fitted to 440×300 with an 8px margin: 9.47 px per inch, the board 284 px tall from y = 8.
const fitScale = (300 - 16) / 30;
const toScreen = (x: number, y: number) => ({ clientX: (440 - 44 * fitScale) / 2 + x * fitScale, clientY: 8 + (30 - y) * fitScale });

function setup(props: Partial<Parameters<typeof BoardCanvas>[0]> = {}) {
  const f = fake();
  const onTap = vi.fn();
  const onDrag = vi.fn();
  const utils = render(<BoardCanvas scene={scene()} canDrag={(id) => id.startsWith('A:')} onTap={onTap} onDrag={onDrag} renderer={f.factory} label="Battlefield, 44 by 30 inches" {...props} />);
  const host = screen.getByRole('application', { name: 'Battlefield, 44 by 30 inches' });
  return { ...f, onTap, onDrag, host, ...utils };
}
const pointer = (host: HTMLElement, type: 'pointerDown' | 'pointerMove' | 'pointerUp', at: { clientX: number; clientY: number }, pointerId = 1) =>
  fireEvent[type](host, { pointerId, ...at });

test('draws the scene through the renderer when it mounts and when the scene changes', async () => {
  const { draws, rerender, factory } = setup();
  await waitFor(() => expect(draws.length).toBeGreaterThan(0));
  expect(draws[0].cam.scale).toBeCloseTo(fitScale);
  const next = { ...scene(), rings: [{ center: { x: 1, y: 1 }, r: 3, kind: 'move' as const }] };
  rerender(<BoardCanvas scene={next} canDrag={() => false} onTap={() => {}} onDrag={() => {}} renderer={factory} label="Battlefield, 44 by 30 inches" />);
  await waitFor(() => expect(draws.at(-1)!.scene.rings).toHaveLength(1));
});

test('a tap on a model calls onTap with its id and world position', async () => {
  const { host, onTap, draws } = setup();
  await waitFor(() => expect(draws.length).toBeGreaterThan(0));
  // A:war.m1 stands at (14, 4).
  pointer(host, 'pointerDown', toScreen(14, 4));
  pointer(host, 'pointerUp', toScreen(14, 4));
  expect(onTap).toHaveBeenCalledTimes(1);
  const [at, id] = onTap.mock.calls[0];
  expect(id).toBe('A:war.m1');
  expect(at.x).toBeCloseTo(14);
  expect(at.y).toBeCloseTo(4);
});

test('dragging a draggable model reports start, move and end in world inches', async () => {
  const { host, onDrag, draws } = setup();
  await waitFor(() => expect(draws.length).toBeGreaterThan(0));
  pointer(host, 'pointerDown', toScreen(14, 4));
  pointer(host, 'pointerMove', toScreen(14, 6));
  pointer(host, 'pointerUp', toScreen(14, 7));
  expect(onDrag.mock.calls.map((c) => [c[0], c[2]])).toEqual([
    ['A:war.m1', 'start'],
    ['A:war.m1', 'move'],
    ['A:war.m1', 'end'],
  ]);
  expect(onDrag.mock.calls[2][1].y).toBeCloseTo(7);
});

test('dragging on empty board pans: the next draw gets a moved camera', async () => {
  const { host, onDrag, draws } = setup();
  await waitFor(() => expect(draws.length).toBeGreaterThan(0));
  const before = draws.at(-1)!.cam;
  pointer(host, 'pointerDown', toScreen(30, 15));
  pointer(host, 'pointerMove', { clientX: toScreen(30, 15).clientX + 40, clientY: toScreen(30, 15).clientY });
  pointer(host, 'pointerUp', { clientX: toScreen(30, 15).clientX + 40, clientY: toScreen(30, 15).clientY });
  expect(onDrag).not.toHaveBeenCalled();
  expect(draws.at(-1)!.cam.x).toBeCloseTo(before.x + 40);
});

test('Zoom in, Zoom out and Fit board change the camera and are 44px buttons', async () => {
  const { draws } = setup();
  await waitFor(() => expect(draws.length).toBeGreaterThan(0));
  const fit = draws.at(-1)!.cam.scale;
  for (const name of ['Zoom in', 'Zoom out', 'Fit board']) expect(screen.getByRole('button', { name })).toHaveClass('btn', 'btn--small');
  act(() => screen.getByRole('button', { name: 'Zoom in' }).click());
  expect(draws.at(-1)!.cam.scale).toBeGreaterThan(fit);
  act(() => screen.getByRole('button', { name: 'Zoom out' }).click());
  act(() => screen.getByRole('button', { name: 'Zoom out' }).click());
  expect(draws.at(-1)!.cam.scale).toBeLessThan(fit);
  act(() => screen.getByRole('button', { name: 'Fit board' }).click());
  expect(draws.at(-1)!.cam.scale).toBeCloseTo(fit);
});

test('the renderer is destroyed on unmount', async () => {
  const { draws, unmount, renderer } = setup();
  await waitFor(() => expect(draws.length).toBeGreaterThan(0));
  unmount();
  expect(renderer.destroy).toHaveBeenCalled();
});
