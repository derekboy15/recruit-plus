/** What the board shows, as plain data: the renderer draws it, tests read it. Built from the engine state and the UI. */
import {
  dist,
  hasTrait,
  horizontalGap,
  MARKER_RADIUS,
  objectiveControl,
  polygonOf,
  profileOf,
  sheetOf,
  type GameState,
  type PlayerId,
  type Pos,
  type Pt,
} from '@recruit/engine';
import type { Plan } from '../game/plan';

export type Ring = { center: Pt; r: number; kind: 'move' | 'charge' | 'weapon' | 'engagement'; label?: string };
export interface BoardUi { selectedUnitId: string | null; plan: Plan | null; invalidModelIds: string[]; rings: Ring[]; targetUnitIds: string[] }

export interface SceneModel {
  id: string;
  unitId: string;
  player: PlayerId;
  poly: Pt[];
  center: Pt;
  selected: boolean;
  planned: boolean;
  invalid: boolean;
  target: boolean;
  /** In keyboard focus on the board (set by BoardCanvas, not by buildScene). */
  focused?: boolean;
  woundsLeft: number;
  W: number;
}
export interface BoardScene {
  board: { w: number; h: number };
  zones: { player: PlayerId; poly: Pt[] }[];
  terrain: { id: string; poly: Pt[]; look: 'ruin' | 'woods' | 'crater' | 'other'; name: string }[];
  objectives: { id: string; pos: Pt; r: number; owner: PlayerId | null }[];
  models: SceneModel[];
  ghosts: { id: string; poly: Pt[] }[];
  /** One per moved model; `text` is '' when another ruler already shows the same distance. */
  rulers: { from: Pt; to: Pt; text: string }[];
  rings: Ring[];
  links: { a: Pt; b: Pt; ok: boolean }[];
}

/** The objective marker plus the 3" within which models control it. */
export const OBJECTIVE_RANGE = MARKER_RADIUS + 3;
const COHERENCY = 2;

const sameSpot = (a: Pos, b: Pos) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.rot - b.rot) < 1e-9;

export function buildScene(s: GameState, ui: BoardUi): BoardScene {
  const plan = ui.plan;
  const models: SceneModel[] = [];
  const ghosts: BoardScene['ghosts'] = [];
  const rulers: BoardScene['rulers'] = [];
  for (const m of Object.values(s.models)) {
    const planned = plan?.positions[m.id];
    const pos = planned ?? m.pos;
    if (m.destroyed || !pos) continue;
    const u = s.units[m.unitId];
    if (!planned && u.location !== 'battlefield') continue;
    const base = sheetOf(s, m.unitId).base;
    models.push({
      id: m.id,
      unitId: m.unitId,
      player: u.player,
      poly: polygonOf(base, pos),
      center: { x: pos.x, y: pos.y },
      selected: ui.selectedUnitId === m.unitId,
      planned: !!planned,
      invalid: ui.invalidModelIds.includes(m.id),
      target: ui.targetUnitIds.includes(m.unitId),
      woundsLeft: m.woundsLeft,
      W: profileOf(s, m).chars.W,
    });
    const from = plan?.origin[m.id];
    if (planned && from) {
      ghosts.push({ id: m.id, poly: polygonOf(base, from) });
      if (!sameSpot(from, planned)) rulers.push({ from: { x: from.x, y: from.y }, to: { x: planned.x, y: planned.y }, text: `${dist(from, planned).toFixed(1)}"` });
    }
  }

  // Models that moved the same distance (a unit moving together) share one label; the others' rulers stay unlabelled.
  const labelled = new Set<string>();
  for (const r of rulers) {
    if (labelled.has(r.text)) r.text = '';
    else labelled.add(r.text);
  }

  // Coherency links for the planned unit: each model to its nearest unit-mate, red when they're more than 2" apart.
  const links: BoardScene['links'] = [];
  if (plan) {
    const base = sheetOf(s, plan.unitId).base;
    const ps = Object.entries(plan.positions).map(([id, pos]) => ({ id, base, pos }));
    const seen = new Set<string>();
    for (const a of ps) {
      let best: { b: (typeof ps)[number]; gap: number } | null = null;
      for (const b of ps) if (b !== a && (!best || horizontalGap(a, b) < best.gap)) best = { b, gap: horizontalGap(a, b) };
      if (!best) continue;
      const key = [a.id, best.b.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ a: { x: a.pos.x, y: a.pos.y }, b: { x: best.b.pos.x, y: best.b.pos.y }, ok: best.gap <= COHERENCY + 1e-6 });
    }
  }

  const showZones = s.phase === 'pre-battle' || s.step === 'reinforcements';
  const control = objectiveControl(s);
  return {
    board: { ...s.setup.board },
    zones: showZones ? (['A', 'B'] as PlayerId[]).map((player) => ({ player, poly: s.setup.zones[player] })) : [],
    terrain: s.setup.terrain.map((f) => ({
      id: f.id,
      poly: f.footprint,
      name: f.name,
      look: hasTrait(f, 'obscuring') ? 'ruin' : hasTrait(f, 'dense-cover') ? 'woods' : hasTrait(f, 'difficult-ground') ? 'crater' : 'other',
    })),
    objectives: s.setup.objectives.map((o) => ({ id: o.id, pos: o.pos, r: OBJECTIVE_RANGE, owner: control[o.id] ?? null })),
    models,
    ghosts,
    rulers,
    rings: ui.rings,
    links,
  };
}
