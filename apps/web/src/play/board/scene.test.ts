import { newGame, stateOf, type Command } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { deployedGame, must, sampleSetup } from '../__fixtures__/game';
import { planReducer } from '../game/plan';
import { buildScene, type BoardUi } from './scene';

const ui = (o: Partial<BoardUi> = {}): BoardUi => ({ selectedUnitId: null, plan: null, invalidModelIds: [], rings: [], targetUnitIds: [], ...o });

describe('buildScene', () => {
  test('draws every model on the battlefield and none in reserve or destroyed', () => {
    let g = newGame(sampleSetup({ librarian: true }));
    g = must(g, { type: 'declareReserves', by: 'B', unitIds: ['B:lib'], kind: 'strategic' } as Command);
    expect(buildScene(stateOf(g), ui()).models).toEqual([]);
    const game = must(deployedGame(), { type: 'removeModel', by: 'A', modelId: 'A:war.m1', destroyed: true } as Command);
    const scene = buildScene(stateOf(game), ui());
    expect(scene.models.map((m) => m.id)).not.toContain('A:war.m1');
    expect(scene.models).toHaveLength(14);
    expect(scene.models.find((m) => m.id === 'B:int.m1')).toMatchObject({ unitId: 'B:int', player: 'B', woundsLeft: 2, W: 2, planned: false });
    expect(scene.board).toEqual({ w: 44, h: 30 });
  });

  test('a planned move adds a ghost, a ruler with inches and coherency links', () => {
    const s = stateOf(deployedGame());
    const origin = Object.fromEntries(s.units['A:war'].modelIds.map((id) => [id, s.models[id].pos]));
    const plan = planReducer(planReducer(null, { type: 'start', unitId: 'A:war', origin }), { type: 'drag', modelId: 'A:war.m1', to: { x: 14, y: 4 + 3.04 } });
    const scene = buildScene(s, ui({ plan, selectedUnitId: 'A:war' }));
    expect(scene.ghosts).toHaveLength(10);
    expect(scene.rulers[0].text).toBe('3.0"');
    expect(scene.models.find((m) => m.id === 'A:war.m1')).toMatchObject({ planned: true, selected: true, center: { x: 14, y: 7.04 } });
    expect(scene.links.length).toBeGreaterThanOrEqual(9);
    expect(scene.links.every((l) => l.ok)).toBe(true);
  });

  test('a unit moving together gets one ruler label, not one per model', () => {
    const s = stateOf(deployedGame());
    const origin = Object.fromEntries(s.units['A:war'].modelIds.map((id) => [id, s.models[id].pos]));
    let plan = planReducer(null, { type: 'start', unitId: 'A:war', origin });
    plan = planReducer(plan, { type: 'drag', modelId: 'A:war.m1', to: { x: 14, y: 8 } });
    const rulers = buildScene(s, ui({ plan })).rulers;
    expect(rulers).toHaveLength(10);
    expect(rulers.filter((r) => r.text)).toEqual([expect.objectContaining({ text: '4.0"' })]);
    plan = planReducer(planReducer(plan, { type: 'together', value: false }), { type: 'drag', modelId: 'A:war.m2', to: { x: 15.5, y: 6 } });
    expect(buildScene(s, ui({ plan })).rulers.filter((r) => r.text).map((r) => r.text)).toEqual(['4.0"', '2.0"']);
  });

  test('a model too far from its unit gets a red link', () => {
    const s = stateOf(deployedGame());
    const origin = Object.fromEntries(s.units['A:war'].modelIds.map((id) => [id, s.models[id].pos]));
    let plan = planReducer(null, { type: 'start', unitId: 'A:war', origin, together: false });
    plan = planReducer(plan, { type: 'drag', modelId: 'A:war.m10', to: { x: 40, y: 8 } });
    const scene = buildScene(s, ui({ plan, invalidModelIds: ['A:war.m10'] }));
    expect(scene.links.some((l) => !l.ok)).toBe(true);
    expect(scene.models.find((m) => m.id === 'A:war.m10')?.invalid).toBe(true);
  });

  test('objectives show their controller', () => {
    const g = deployedGame();
    // Objective 1 sits in A's zone at (22, 4.5): the Warriors' row at y = 4 covers it.
    const scene = buildScene(stateOf(g), ui());
    expect(scene.objectives).toHaveLength(4);
    expect(scene.objectives.find((o) => o.id === '1')?.owner).toBe('A');
    expect(scene.objectives.find((o) => o.id === '2')?.owner).toBeNull();
    expect(scene.objectives[0].r).toBeCloseTo(20 / 25.4 + 3);
  });

  test('zones show before the battle and not during the Shooting phase', () => {
    expect(buildScene(stateOf(newGame(sampleSetup())), ui()).zones.map((z) => z.player)).toEqual(['A', 'B']);
    let g = deployedGame();
    for (let i = 0; i < 3; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
    expect(stateOf(g).phase).toBe('shooting');
    expect(buildScene(stateOf(g), ui()).zones).toEqual([]);
  });

  test('terrain gets a look from its traits', () => {
    const scene = buildScene(stateOf(deployedGame()), ui());
    expect(scene.terrain.map((t) => t.look)).toEqual(['crater', 'crater']);
  });

  test('rings and targets pass through', () => {
    const ring = { center: { x: 1, y: 1 }, r: 6, kind: 'move' as const, label: '6"' };
    const scene = buildScene(stateOf(deployedGame()), ui({ rings: [ring], targetUnitIds: ['B:int'] }));
    expect(scene.rings).toEqual([ring]);
    expect(scene.models.filter((m) => m.target)).toHaveLength(5);
  });
});


describe('objective names', () => {
  const ui: BoardUi = { selectedUnitId: null, plan: null, invalidModelIds: [], rings: [], targetUnitIds: [] };
  const withObjectives = (objectives: { id: string; label?: string }[]) => {
    const s = stateOf(deployedGame());
    return { ...s, setup: { ...s.setup, objectives: objectives.map((o, i) => ({ ...o, pos: { x: 5 + i, y: 5 } })) } };
  };

  test('objectives without a label show their id', () => {
    expect(buildScene(withObjectives([{ id: 'nw' }]), ui).objectives.map((o) => o.name)).toEqual(['nw']);
  });

  test('a labelled objective shows its label', () => {
    expect(buildScene(withObjectives([{ id: 'nw', label: 'ne' }]), ui).objectives.map((o) => o.name)).toEqual(['ne']);
  });
});
