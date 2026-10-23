/** Where the player plans to put a unit's models before the engine is asked (a move, a deployment, an arrival). */
import type { MoveSpec, Pos, Pt } from '@recruit/engine';

export interface Plan {
  unitId: string;
  positions: Record<string, Pos>;
  origin: Record<string, Pos | null>;
  together: boolean;
  /** How far each model may end from where it started (the ring): a drag past it stops exactly on it. */
  limits?: Record<string, number>;
}

export type PlanAction =
  | { type: 'start'; unitId: string; origin: Record<string, Pos | null>; together?: boolean; limits?: Record<string, number> }
  /** The model's new centre; with `together` every planned model moves by the same amount. */
  | { type: 'drag'; modelId: string; to: Pt }
  | { type: 'place'; positions: Record<string, Pos> }
  | { type: 'rotate'; modelId: string; radians: number }
  | { type: 'together'; value: boolean }
  | { type: 'reset' }
  | { type: 'clear' };

const placedOrigin = (origin: Record<string, Pos | null>): Record<string, Pos> =>
  Object.fromEntries(Object.entries(origin).filter((e): e is [string, Pos] => e[1] !== null).map(([id, p]) => [id, { ...p }]));

/**
 * Keeps a dragged model within its limit of where it started, along the same line: a finger is never precise enough
 * to land exactly on the edge of a ring, and a charge roll of 5 must be able to move exactly 5".
 */
function clamp(p: Plan, id: string, q: Pos): Pos {
  const limit = p.limits?.[id];
  const o = p.origin[id];
  if (limit === undefined || !o) return q;
  const d = Math.hypot(q.x - o.x, q.y - o.y);
  return d <= limit ? q : { ...q, x: o.x + ((q.x - o.x) * limit) / d, y: o.y + ((q.y - o.y) * limit) / d };
}

export function planReducer(p: Plan | null, a: PlanAction): Plan | null {
  if (a.type === 'start')
    return { unitId: a.unitId, origin: a.origin, positions: placedOrigin(a.origin), together: a.together ?? true, ...(a.limits ? { limits: a.limits } : {}) };
  if (!p || a.type === 'clear') return null;
  switch (a.type) {
    case 'drag': {
      const from = p.positions[a.modelId];
      if (!from) return p;
      if (!p.together) return { ...p, positions: { ...p.positions, [a.modelId]: clamp(p, a.modelId, { ...from, x: a.to.x, y: a.to.y }) } };
      // Moving together: the dragged model's (clamped) move is the move for every model.
      const to = clamp(p, a.modelId, { ...from, x: a.to.x, y: a.to.y });
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      return { ...p, positions: Object.fromEntries(Object.entries(p.positions).map(([id, q]) => [id, clamp(p, id, { ...q, x: q.x + dx, y: q.y + dy })])) };
    }
    case 'place':
      return { ...p, positions: { ...p.positions, ...a.positions } };
    case 'rotate': {
      const q = p.positions[a.modelId];
      return q ? { ...p, positions: { ...p.positions, [a.modelId]: { ...q, rot: q.rot + a.radians } } } : p;
    }
    case 'together':
      return { ...p, together: a.value };
    case 'reset':
      return { ...p, positions: placedOrigin(p.origin) };
  }
}

const same = (a: Pos, b: Pos) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && a.z === b.z && Math.abs(a.rot - b.rot) < 1e-9;

/** Only models that were on the battlefield and whose planned position differs from where they started. */
export function toMoves(p: Plan): Record<string, MoveSpec> {
  const out: Record<string, MoveSpec> = {};
  for (const [id, to] of Object.entries(p.positions)) {
    const from = p.origin[id];
    if (from && !same(from, to)) out[id] = { to };
  }
  return out;
}

/** Every planned model (deploying, arriving or getting out). */
export const toPositions = (p: Plan): Record<string, Pos> => ({ ...p.positions });
