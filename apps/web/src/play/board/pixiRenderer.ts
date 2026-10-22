/**
 * The PixiJS renderer for the board. Shapes are drawn in inches inside one world container whose transform is the
 * camera (y flipped so north is up); the geometry is rebuilt only when the scene or the zoom changes, so panning just
 * moves the container. Labels (rulers, ring sizes, wounds) are drawn in screen space so they stay upright and readable.
 */
import { MARKER_RADIUS, type Pt } from '@recruit/engine';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { worldToScreen, type Camera, type Size } from './camera';
import type { RendererFactory } from './BoardCanvas';
import type { BoardScene } from './scene';

function cssColours() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    A: v('--brass', '#b08d57'),
    B: v('--red-strong', '#c1373c'),
    focus: v('--focus', '#e9c46a'),
    bad: v('--bad', '#ff9b9b'),
    ok: v('--ok', '#7bd09a'),
    text: v('--text', '#ece6dc'),
    board: v('--surface', '#1c1b1a'),
    edge: v('--border', '#3a3631'),
  };
}

const TERRAIN = { ruin: 0x77736b, woods: 0x3e6b3a, crater: 0x6b4f35, other: 0x5b5b5b } as const;
const flat = (pts: Pt[]) => pts.flatMap((p) => [p.x, p.y]);

export const createPixiRenderer: RendererFactory = async (host, view) => {
  const app = new Application();
  await app.init({ width: Math.max(1, view.w), height: Math.max(1, view.h), antialias: true, backgroundAlpha: 0, autoDensity: true, resolution: window.devicePixelRatio || 1 });
  const canvas = app.canvas as HTMLCanvasElement;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  host.appendChild(canvas);
  const c = cssColours();
  const world = new Container();
  const shapes = new Graphics();
  world.addChild(shapes);
  const labels = new Container();
  app.stage.addChild(world, labels);
  let drawnScene: BoardScene | null = null;
  let drawnScale = 0;

  function rebuild(scene: BoardScene, scale: number) {
    const line = (w: number) => w / scale;
    const g = shapes.clear();
    g.rect(0, 0, scene.board.w, scene.board.h).fill({ color: c.board }).stroke({ width: line(2), color: c.edge });
    for (const z of scene.zones) g.poly(flat(z.poly)).fill({ color: c[z.player], alpha: 0.12 }).stroke({ width: line(1), color: c[z.player], alpha: 0.6 });
    for (const t of scene.terrain) g.poly(flat(t.poly)).fill({ color: TERRAIN[t.look], alpha: 0.55 }).stroke({ width: line(1), color: TERRAIN[t.look] });
    for (const o of scene.objectives) {
      const colour = o.owner ? c[o.owner] : c.text;
      g.circle(o.pos.x, o.pos.y, o.r).fill({ color: colour, alpha: 0.06 }).stroke({ width: line(1), color: colour, alpha: 0.5 });
      g.circle(o.pos.x, o.pos.y, MARKER_RADIUS).fill({ color: colour, alpha: 0.85 });
    }
    for (const r of scene.rings) {
      const colour = r.kind === 'engagement' ? c.bad : r.kind === 'weapon' ? c.focus : c.ok;
      g.circle(r.center.x, r.center.y, r.r).stroke({ width: line(r.kind === 'engagement' ? 1 : 1.5), color: colour, alpha: r.kind === 'engagement' ? 0.45 : 0.8 });
    }
    for (const gh of scene.ghosts) g.poly(flat(gh.poly)).stroke({ width: line(1), color: c.text, alpha: 0.35 });
    for (const l of scene.links) g.moveTo(l.a.x, l.a.y).lineTo(l.b.x, l.b.y).stroke({ width: line(l.ok ? 1 : 2), color: l.ok ? c.ok : c.bad, alpha: 0.8 });
    for (const r of scene.rulers) g.moveTo(r.from.x, r.from.y).lineTo(r.to.x, r.to.y).stroke({ width: line(1.5), color: c.focus });
    for (const m of scene.models) {
      const outline = m.invalid ? c.bad : m.selected ? c.focus : m.target ? c.bad : c.text;
      g.poly(flat(m.poly))
        .fill({ color: c[m.player], alpha: m.planned ? 0.75 : 0.95 })
        .stroke({ width: line(m.invalid || m.selected || m.target ? 2.5 : 1), color: outline, alpha: m.invalid || m.selected || m.target ? 1 : 0.5 });
    }
    drawnScene = scene;
    drawnScale = scale;
  }

  function relabel(scene: BoardScene, cam: Camera) {
    for (const child of labels.removeChildren()) child.destroy();
    const add = (text: string, at: Pt, colour: string) => {
      const p = worldToScreen(cam, scene.board, at);
      const t = new Text({ text, style: { fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: '600', fill: colour, stroke: { color: '#000000', width: 3 } } });
      t.anchor.set(0.5);
      t.position.set(p.x, p.y);
      labels.addChild(t);
    };
    for (const r of scene.rulers) if (r.text) add(r.text, { x: (r.from.x + r.to.x) / 2, y: (r.from.y + r.to.y) / 2 }, c.focus);
    for (const r of scene.rings) if (r.label) add(r.label, { x: r.center.x, y: r.center.y + r.r }, c.text);
    for (const m of scene.models) if (m.W > 1 && m.woundsLeft < m.W) add(`${m.woundsLeft}/${m.W}`, m.center, c.text);
    for (const o of scene.objectives) add(o.id, { x: o.pos.x, y: o.pos.y - o.r - 0.6 }, c.text);
  }

  return {
    draw(scene, cam) {
      if (scene !== drawnScene || cam.scale !== drawnScale) rebuild(scene, cam.scale);
      world.position.set(cam.x, cam.y + scene.board.h * cam.scale);
      world.scale.set(cam.scale, -cam.scale);
      relabel(scene, cam);
    },
    resize(next: Size) {
      app.renderer.resize(Math.max(1, next.w), Math.max(1, next.h));
    },
    destroy() {
      app.destroy({ removeView: true }, { children: true });
    },
  };
};
