/**
 * Terrain layout presets. Each is point-symmetric about the centre (every feature has a twin turned 180°), is given in
 * fractions of the board so it fits every battle size, and keeps clear of the 3" along each player's edge.
 */
import { TERRAIN_PRESETS, type Pt, type TerrainFeature, type TerrainPreset } from '@recruit/engine';

type Board = { w: number; h: number };

export interface TerrainLayout {
  id: 'open' | 'city' | 'mixed';
  name: string;
  description: string;
  features(board: Board): TerrainFeature[];
}

/** One half of a symmetric pair: its footprint in board fractions. */
interface Half { kind: 'ruin' | 'woods' | 'crater'; shape: (b: Board) => Pt[] }

const KINDS: Record<Half['kind'], { name: string; preset: TerrainPreset; height: number }> = {
  ruin: { name: 'Ruins', preset: 'ruins', height: 6 },
  woods: { name: 'Woods', preset: 'woods', height: 4 },
  crater: { name: 'Crater', preset: 'craters', height: 0.5 },
};

const box = (x0: number, y0: number, x1: number, y1: number) => (b: Board): Pt[] => [
  { x: x0 * b.w, y: y0 * b.h },
  { x: x1 * b.w, y: y0 * b.h },
  { x: x1 * b.w, y: y1 * b.h },
  { x: x0 * b.w, y: y1 * b.h },
];
/** A crater: an octagon of the given radius in inches (its 180° twin is again an octagon on the same vertex angles). */
const crater = (cx: number, cy: number, r = 2.5) => (b: Board): Pt[] =>
  Array.from({ length: 8 }, (_, i) => ({ x: cx * b.w + r * Math.cos((i * Math.PI) / 4), y: cy * b.h + r * Math.sin((i * Math.PI) / 4) }));

const RUIN_WEST = box(0.12, 0.3, 0.32, 0.4);
const RUIN_EAST = box(0.55, 0.42, 0.72, 0.5);
const CRATER = crater(0.2, 0.55);

function build(halves: Half[]): (b: Board) => TerrainFeature[] {
  return (b) =>
    halves.flatMap((half, i) => {
      const k = KINDS[half.kind];
      const footprint = half.shape(b);
      const base = { name: k.name, ...TERRAIN_PRESETS[k.preset], traits: [...TERRAIN_PRESETS[k.preset].traits], height: k.height };
      return [
        { id: `${half.kind}-${i + 1}a`, ...base, footprint },
        { id: `${half.kind}-${i + 1}b`, ...base, traits: [...base.traits], footprint: footprint.map((p) => ({ x: b.w - p.x, y: b.h - p.y })) },
      ];
    });
}

export const TERRAIN_LAYOUTS: TerrainLayout[] = [
  {
    id: 'open',
    name: 'Open field',
    description: 'Two craters and little else: long lines of fire, nowhere to hide.',
    features: build([{ kind: 'crater', shape: CRATER }]),
  },
  {
    id: 'city',
    name: 'Ruined city',
    description: 'Four ruins that block line of sight (Obscuring) and two craters.',
    features: build([
      { kind: 'ruin', shape: RUIN_WEST },
      { kind: 'ruin', shape: RUIN_EAST },
      { kind: 'crater', shape: CRATER },
    ]),
  },
  {
    id: 'mixed',
    name: 'Ruins and woods',
    description: 'Two ruins that block line of sight, two woods that give Dense Cover, and two craters.',
    features: build([
      { kind: 'ruin', shape: RUIN_WEST },
      { kind: 'woods', shape: RUIN_EAST },
      { kind: 'crater', shape: CRATER },
    ]),
  },
];

export const layoutById = (id: string) => TERRAIN_LAYOUTS.find((l) => l.id === id);
