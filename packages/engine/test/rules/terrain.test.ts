import { describe, expect, test } from 'vitest';
import type { BaseShape } from '../../src/datasheet/types';
import { coverFor, defenceLineBetween } from '../../src/terrain/cover';
import { inspiringBonus } from '../../src/terrain/ld';
import { canEndOn, climbCost, difficultGroundOnPath } from '../../src/terrain/movement';
import { TERRAIN_PRESETS, type TerrainFeature, type TerrainPreset } from '../../src/terrain/types';
import { canSee, denseCoverPenalty, type ModelView, type UnitView } from '../../src/terrain/visibility';

const mm = (v: number) => v / 25.4;
const c32: BaseShape = { kind: 'circle', d: mm(32) };
function mv(id: string, x: number, y: number, o: { z?: number; keywords?: string[]; wounds?: number; base?: BaseShape } = {}): ModelView {
  return { id, base: o.base ?? c32, pos: { x, y, z: o.z ?? 0, rot: 0 }, keywords: o.keywords ?? ['INFANTRY'], wounds: o.wounds ?? 2 };
}
const unit = (id: string, models: ModelView[], keywords = models[0].keywords): UnitView => ({ id, keywords, models });
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];
function feature(id: string, preset: TerrainPreset, footprint: { x: number; y: number }[], height: number, extra: Partial<TerrainFeature> = {}): TerrainFeature {
  return { id, name: id, ...TERRAIN_PRESETS[preset], footprint, height, ...extra };
}
const ruin = (height = 6) => feature('ruin', 'ruins', rect(8, -10, 12, 10), height);
const INF = ['INFANTRY'];
const KNIGHT = { keywords: ['VEHICLE', 'TITANIC'], wounds: 24, base: { kind: 'circle', d: mm(130) } as BaseShape };

describe('visibility', () => {
  test('[TR §3.3] a 5"-tall obscuring ruin between two models blocks sight', () => {
    expect(canSee(mv('a', 0, 0), mv('b', 20, 0), [ruin(5)])).toBe(false);
  });
  test('[TR §3.3] an obscuring feature under 5" tall does not block sight', () => {
    expect(canSee(mv('a', 0, 0), mv('b', 20, 0), [ruin(4)])).toBe(true);
  });
  test('[TR §3.4] a model within the ruin can be seen, and can see out', () => {
    expect(canSee(mv('a', 0, 0), mv('b', 11, 0), [ruin()])).toBe(true);
    expect(canSee(mv('a', 9, 0), mv('b', 20, 0), [ruin()])).toBe(true);
  });
  test('[TR §3.3] a W18+ model is visible through obscuring terrain, but can not see through it', () => {
    expect(canSee(mv('a', 0, 0), mv('k', 22, 0, KNIGHT), [ruin()])).toBe(true);
    expect(canSee(mv('k', 22, 0, KNIGHT), mv('a', 0, 0), [ruin()])).toBe(false);
  });
  test('[TR §3.3] an AIRCRAFT is visible through obscuring terrain', () => {
    expect(canSee(mv('a', 0, 0), mv('f', 20, 0, { keywords: ['VEHICLE', 'AIRCRAFT', 'FLY'], wounds: 10 }), [ruin()])).toBe(true);
  });
  test('[TR §3.3] a line past the edge of the ruin is not blocked', () => {
    expect(canSee(mv('a', 0, 12), mv('b', 20, 12), [ruin()])).toBe(true);
  });
});

describe('Dense Cover', () => {
  const woods = (h = 4) => feature('woods', 'woods', rect(8, -10, 12, 10), h);
  test('[TR §3.1] dense cover between firer and target gives -1 to hit', () => {
    expect(denseCoverPenalty(mv('a', 0, 0), unit('t', [mv('b', 20, 0)]), [woods()])).toBe(true);
  });
  test('[TR §3.1] dense cover under 3" tall gives no penalty', () => {
    expect(denseCoverPenalty(mv('a', 0, 0), unit('t', [mv('b', 20, 0)]), [woods(2.5)])).toBe(false);
  });
  test('[TR §3.1] no penalty when the firer is inside the woods', () => {
    expect(denseCoverPenalty(mv('a', 9, 0), unit('t', [mv('b', 20, 0)]), [woods()])).toBe(false);
  });
  test('[TR §3.1] no penalty when one target model is fully in the clear', () => {
    expect(denseCoverPenalty(mv('a', 0, 0), unit('t', [mv('b', 20, 0), mv('c', 3, 15)]), [woods()])).toBe(false);
  });
  test('[TR §3.1] no penalty against a W18+ model or an AIRCRAFT', () => {
    expect(denseCoverPenalty(mv('a', 0, 0), unit('k', [mv('k', 22, 0, KNIGHT)]), [woods()])).toBe(false);
    const flyer = mv('f', 20, 0, { keywords: ['AIRCRAFT', 'FLY', 'VEHICLE'], wounds: 10 });
    expect(denseCoverPenalty(mv('a', 0, 0), unit('f', [flyer]), [woods()])).toBe(false);
  });
  test('[TR §3.1] a firer within 3" of a Dense obstacle ignores it', () => {
    const wall = feature('wall', 'ruined-walls', rect(8, -10, 8.5, 10), 4);
    expect(denseCoverPenalty(mv('a', 0, 0), unit('t', [mv('b', 20, 0)]), [wall])).toBe(true);
    expect(denseCoverPenalty(mv('a', 6, 0), unit('t', [mv('b', 20, 0)]), [wall])).toBe(false);
  });
});

describe('cover', () => {
  test('[TR §2] infantry within a ruin get Light Cover; a tank within it does not', () => {
    const firer = mv('f', 0, 0);
    expect(coverFor(mv('i', 10, 0), firer, 'ranged', [ruin()])).toEqual({ light: true, heavy: false });
    expect(coverFor(mv('t', 10, 0, { keywords: ['VEHICLE'], wounds: 11 }), firer, 'ranged', [ruin()])).toEqual({ light: false, heavy: false });
  });
  test('[TR §2] infantry 2" behind a barricade get its cover', () => {
    const barricade = feature('bar', 'barricades', rect(9, -5, 9.5, 5), 1.5);
    expect(coverFor(mv('i', 11, 0), mv('f', 0, 0), 'ranged', [barricade])).toEqual({ light: true, heavy: true });
  });
  test('[TR §2] an attacker with a clear line to the whole base denies obstacle cover', () => {
    const barricade = feature('bar', 'barricades', rect(9, -5, 9.5, 5), 1.5);
    expect(coverFor(mv('i', 11, 0), mv('f', 11, 20), 'ranged', [barricade])).toEqual({ light: false, heavy: false });
  });
  test('[TR §2] infantry more than 3" from an obstacle get no cover from it', () => {
    const barricade = feature('bar', 'barricades', rect(9, -5, 9.5, 5), 1.5);
    expect(coverFor(mv('i', 14, 0), mv('f', 0, 0), 'ranged', [barricade]).light).toBe(false);
  });
  test('[TR §3.1] Exposed Position: on top of containers, no cover from anything', () => {
    const containers = feature('box', 'containers', rect(9, -2, 13, 2), 2.5);
    expect(coverFor(mv('i', 11, 0, { z: 2.5 }), mv('f', 0, 0), 'ranged', [containers, ruin()]).light).toBe(false);
    expect(coverFor(mv('i', 14, 0), mv('f', 0, 0), 'ranged', [containers]).light).toBe(true);
  });
  test('[TR §2] hills give no cover', () => {
    const hill = { id: 'hill', name: 'hill', category: 'hill' as const, traits: ['light-cover' as const], footprint: rect(8, -10, 12, 10), height: 2 };
    expect(coverFor(mv('i', 10, 0), mv('f', 0, 0), 'ranged', [hill]).light).toBe(false);
  });
  test('[R-6] models within 2" across a Defence Line count as engaged', () => {
    const barricade = feature('bar', 'barricades', rect(9, -5, 9.5, 5), 1.5);
    expect(defenceLineBetween(mv('a', 8.2, 0), mv('b', 10.3, 0), [barricade])).toBe(true);
    expect(defenceLineBetween(mv('a', 7.5, 0), mv('b', 11.5, 0), [barricade])).toBe(false);
    expect(defenceLineBetween(mv('a', 8.2, 8), mv('b', 10.3, 8), [barricade])).toBe(false);
  });
});

describe('moving over terrain', () => {
  const craters = (h = 0.5) => feature('crater', 'craters', rect(8, -5, 12, 5), h);
  test('[TR §3.2] a path over craters crosses Difficult Ground, even under 1" tall', () => {
    expect(difficultGroundOnPath([{ x: 0, y: 0 }, { x: 20, y: 0 }], c32, [craters()]).map((f) => f.id)).toEqual(['crater']);
    expect(difficultGroundOnPath([{ x: 0, y: 10 }, { x: 20, y: 10 }], c32, [craters()])).toEqual([]);
  });
  test('[TR §3.2] a base brushing the edge of Difficult Ground counts', () => {
    expect(difficultGroundOnPath([{ x: 0, y: 5.5 }, { x: 20, y: 5.5 }], c32, [craters()])).toHaveLength(1);
  });
  test('[R-5] climbing counts vertical distance: 6" over a 3" wall for a tank, 0 for infantry through a breachable ruin, 0 for FLY', () => {
    const r = ruin(3);
    const path = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
    expect(climbCost(path, 0, 0, [r], { canBreach: false, fliesOverTerrain: false })).toBeCloseTo(6);
    expect(climbCost(path, 0, 0, [r], { canBreach: true, fliesOverTerrain: false })).toBe(0);
    expect(climbCost(path, 0, 0, [r], { canBreach: false, fliesOverTerrain: true })).toBe(0);
  });
  test('[TR §1] features 1" or less tall are ignored for movement', () => {
    expect(climbCost([{ x: 0, y: 0 }, { x: 20, y: 0 }], 0, 0, [craters(1)], { canBreach: false, fliesOverTerrain: false })).toBe(0);
  });
  test('[R-5] ending on an upper floor counts the climb', () => {
    expect(climbCost([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0, 3, [ruin(6)], { canBreach: true, fliesOverTerrain: false })).toBeCloseTo(3);
  });
  test('[TR §3.2] Unstable Position: models can not end on top', () => {
    const statuary = feature('statue', 'statuary', rect(9, -2, 11, 2), 3);
    expect(canEndOn(statuary, INF, 2)).toBe(false);
    expect(canEndOn(statuary, INF, 0)).toBe(true);
  });
  test('[TR §3.2] only INFANTRY, BEAST, SWARM and FLY can end on an upper floor of Scaleable ruins', () => {
    expect(canEndOn(ruin(), INF, 3)).toBe(true);
    expect(canEndOn(ruin(), ['VEHICLE', 'FLY'], 3)).toBe(true);
    expect(canEndOn(ruin(), ['VEHICLE'], 3)).toBe(false);
    expect(canEndOn(ruin(), ['VEHICLE'], 0)).toBe(true);
    expect(canEndOn(ruin(6), INF, 7)).toBe(false);
  });
});

describe('Inspiring', () => {
  const statue = feature('statue', 'statuary', rect(9, -1, 11, 1), 3, { inspiringKeywords: ['IMPERIUM'] });
  test('[TR §3.3] Inspiring (IMPERIUM): +1 Ld wholly within 6", nothing for a CHAOS unit', () => {
    const imperial = unit('u', [mv('a', 13, 0), mv('b', 14, 0)], ['INFANTRY', 'IMPERIUM']);
    expect(inspiringBonus(imperial, [statue])).toBe(1);
    expect(inspiringBonus(unit('c', [mv('a', 13, 0)], ['INFANTRY', 'CHAOS']), [statue])).toBe(0);
  });
  test('[TR §3.3] Inspiring needs the whole unit wholly within 6"', () => {
    expect(inspiringBonus(unit('u', [mv('a', 13, 0), mv('b', 17, 0)], ['INFANTRY', 'IMPERIUM']), [statue])).toBe(0);
  });
});

describe('presets', () => {
  test('[TR §4] presets match the Core Book table', () => {
    expect(TERRAIN_PRESETS.ruins).toEqual({ category: 'area', traits: ['scaleable', 'breachable', 'light-cover', 'defensible', 'obscuring'] });
    expect(TERRAIN_PRESETS.craters).toEqual({ category: 'area', traits: ['light-cover', 'difficult-ground'] });
    expect(TERRAIN_PRESETS.woods).toEqual({ category: 'area', traits: ['dense-cover', 'breachable', 'defensible', 'difficult-ground'] });
    expect(TERRAIN_PRESETS.industrial).toEqual({ category: 'area', traits: ['scaleable', 'breachable', 'dense-cover', 'defensible'] });
    expect(TERRAIN_PRESETS.containers).toEqual({ category: 'obstacle', traits: ['light-cover', 'scaleable', 'exposed-position'] });
    expect(TERRAIN_PRESETS.barricades).toEqual({
      category: 'obstacle',
      traits: ['defence-line', 'light-cover', 'heavy-cover', 'defensible', 'unstable-position', 'difficult-ground'],
    });
    expect(TERRAIN_PRESETS.debris).toEqual({ category: 'obstacle', traits: ['exposed-position'] });
    expect(TERRAIN_PRESETS.statuary).toEqual({ category: 'obstacle', traits: ['light-cover', 'unstable-position', 'inspiring'] });
    expect(TERRAIN_PRESETS['ruined-walls']).toEqual({
      category: 'obstacle',
      traits: ['defence-line', 'breachable', 'dense-cover', 'defensible', 'unstable-position'],
    });
  });
});
