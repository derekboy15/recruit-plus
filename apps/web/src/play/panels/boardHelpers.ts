/** Board helpers the phase panels share: where a unit's models stand, move rings and enemy Engagement Range rings. */
import { onBoard, other, outerRadius, sheetOf, unitsOf, type GameState, type PlayerId, type Pos } from '@recruit/engine';
import type { Ring } from '../board/scene';
import type { Plan } from '../game/plan';

/** The unit's models on the battlefield, by id, where they stand now. */
export const originOf = (s: GameState, unitId: string): Record<string, Pos | null> => Object.fromEntries(onBoard(s, unitId).map((m) => [m.id, m.pos]));

/** Models not yet on the battlefield (deploying, arriving, getting out): no origin. */
export const unplacedOrigin = (ids: string[]): Record<string, Pos | null> => Object.fromEntries(ids.map((id) => [id, null]));

const inches = (n: number) => `${Math.round(n * 10) / 10}"`;

/** A ring of `r` inches around each planned model's starting point (how far its centre can go); the first one labelled. */
export function rangeRings(plan: Plan, r: (modelId: string) => number, kind: Ring['kind']): Ring[] {
  return Object.entries(plan.origin)
    .filter((e): e is [string, Pos] => !!e[1])
    .map(([id, p], i) => ({ center: { x: p.x, y: p.y }, r: r(id), kind, ...(i === 0 ? { label: inches(r(id)) } : {}) }));
}

/** 1" Engagement Range around every enemy model of `player` (measured from the base edge). */
export function engagementRings(s: GameState, player: PlayerId): Ring[] {
  return unitsOf(s, other(player))
    .filter((u) => u.location === 'battlefield')
    .flatMap((u) => onBoard(s, u.id).map((m) => ({ center: { x: m.pos!.x, y: m.pos!.y }, r: 1 + outerRadius(sheetOf(s, u.id).base), kind: 'engagement' as const })));
}
