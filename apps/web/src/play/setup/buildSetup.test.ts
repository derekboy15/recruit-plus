import { missionRulesFor, newGame } from '@recruit/engine';
import { expect, test } from 'vitest';
import { sampleSetup } from '../__fixtures__/game';
import { buildGameSetup, setupBlockers, type SetupOptions } from './buildSetup';
import type { LoadedArmy } from './loadArmy';
import { PRACTICE } from './missions';
import { TERRAIN_LAYOUTS } from './terrainLayouts';

const sample = sampleSetup();
const loaded = (i: 0 | 1, units = sample.armies[i].units): LoadedArmy => ({
  army: { ...sample.armies[i], units },
  problems: [],
  catalogueSlugs: ['necrons'],
  faction: 'Necrons',
  battleSize: 'strike-force',
  points: 100,
});
const options = (o: Partial<SetupOptions> = {}): SetupOptions => ({
  battleSize: 'strike-force',
  mission: PRACTICE,
  layout: TERRAIN_LAYOUTS[1],
  armies: [loaded(0), loaded(1)],
  attacker: 'B',
  seed: 7,
  rollWindows: true,
  ...o,
});

test('builds a setup newGame accepts: board, rules, zones, objectives and terrain from the choices', () => {
  const s = buildGameSetup(options());
  expect(() => newGame(s)).not.toThrow();
  expect(s.board).toEqual({ w: 44, h: 60 });
  expect(s.rules).toEqual(missionRulesFor('strike-force'));
  expect(s.objectives).toHaveLength(5);
  expect(s.zones.A[2]).toEqual({ x: 44, y: 12 });
  expect(s.terrain.map((f) => f.name)).toContain('Ruins');
  expect(s.attacker).toBe('B');
  expect(s.seed).toBe(7);
  expect(s.firstTurn).toBeUndefined();
  expect(s.armies.map((a) => a.player)).toEqual(['A', 'B']);
  expect(setupBlockers(options())).toEqual([]);
});

test('an army with no units blocks the start', () => {
  expect(setupBlockers(options({ armies: [loaded(0), loaded(1, [])] }))).toEqual(['Ultramarines has no units.']);
});

test('roll windows follow the option; reactions are always on', () => {
  expect(buildGameSetup(options({ rollWindows: false })).settings).toEqual({ rollWindows: false, reactions: true });
  expect(buildGameSetup(options()).settings).toEqual({ rollWindows: true, reactions: true });
});
