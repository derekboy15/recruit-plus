import { stateOf } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { diskCtx } from '../__fixtures__/drills';
import { advanceTo, gapBetween, intercessors, NECRONS, scenario, ULTRA, warriors, type UnitSpec } from './scenario';

const marines = (at: { x: number; y: number }, id = 'A:int'): UnitSpec => ({ id, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at });
const necrons = (at: { x: number; y: number }, id = 'B:war'): UnitSpec => ({ id, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at });

describe('scenario', () => {
  test('places a unit\'s front row centred on its point, 1.5" apart, rows behind it away from the enemy', () => {
    const g = scenario({ units: [marines({ x: 22, y: 8 }), necrons({ x: 22, y: 22 })] }, diskCtx());
    const s = stateOf(g);
    const a = s.units['A:int'].modelIds.map((id) => s.models[id].pos!);
    expect(a.map((p) => p.x)).toEqual([19, 20.5, 22, 23.5, 25]);
    expect(a.every((p) => p.y === 8)).toBe(true);
    const b = s.units['B:war'].modelIds.map((id) => s.models[id].pos!);
    expect(b.slice(0, 5).every((p) => p.y === 22)).toBe(true);
    expect(b.slice(5).every((p) => p.y === 23.5)).toBe(true);
    expect(s.phase).toBe('command');
    expect(s.round).toBe(1);
    expect(s.active).toBe('A');
  });

  test('units 6" apart measure 6.0" between their closest bases', () => {
    // 32mm bases: 1.26" across, so centres 7.26" apart leave a 6" gap.
    const g = scenario({ units: [marines({ x: 22, y: 10 }), necrons({ x: 22, y: 10 + 6 + 32 / 25.4 })] }, diskCtx());
    expect(gapBetween(stateOf(g), 'A:int', 'B:war')).toBeCloseTo(6, 5);
  });

  test('a two-row unit inside the enemy half is placed there after deploying', () => {
    const g = scenario({ units: [marines({ x: 22, y: 6 }), necrons({ x: 32, y: 13 })] }, diskCtx());
    const s = stateOf(g);
    expect(s.units['B:war'].modelIds.map((id) => s.models[id].pos!.y)).toEqual([13, 13, 13, 13, 13, 14.5, 14.5, 14.5, 14.5, 14.5]);
  });

  test('a unit inside the enemy half is placed there after deploying', () => {
    const g = scenario({ units: [marines({ x: 22, y: 20 }), necrons({ x: 22, y: 27 })] }, diskCtx());
    const s = stateOf(g);
    expect(s.units['A:int'].modelIds.every((id) => s.models[id].pos!.y === 20)).toBe(true);
  });

  test("advanceTo reaches the Charge phase of A's turn and the Morale phase of B's turn", () => {
    const g = scenario({ units: [marines({ x: 22, y: 6 }), necrons({ x: 22, y: 24 })] }, diskCtx());
    const charge = advanceTo(g, { phase: 'charge' });
    expect(stateOf(charge)).toMatchObject({ phase: 'charge', active: 'A', round: 1 });
    const morale = advanceTo(g, { active: 'B', phase: 'morale' });
    expect(stateOf(morale)).toMatchObject({ phase: 'morale', active: 'B', round: 1 });
    const round2 = advanceTo(g, { round: 2, active: 'A', phase: 'command' });
    expect(stateOf(round2)).toMatchObject({ phase: 'command', active: 'A', round: 2 });
  });

  test('scripted dice run before ctx.dice, then the seed takes over', () => {
    const g = scenario({ units: [marines({ x: 22, y: 6 }), necrons({ x: 22, y: 24 })], setupDice: [6, 5] }, diskCtx({ dice: [2, 3] }));
    expect(g.setup.scriptedDice).toEqual([6, 5, 2, 3]);
    expect(g.setup.seed).toBe(7);
  });

  test('two seeds give different dice', () => {
    const a = scenario({ units: [marines({ x: 22, y: 6 }), necrons({ x: 22, y: 24 })] }, diskCtx({ seed: 1 }));
    const b = scenario({ units: [marines({ x: 22, y: 6 }), necrons({ x: 22, y: 24 })] }, diskCtx({ seed: 2 }));
    expect(stateOf(a).dice.s).not.toEqual(stateOf(b).dice.s);
  });

  test('starting CP can be set', () => {
    const g = scenario({ units: [marines({ x: 22, y: 6 }), necrons({ x: 22, y: 24 })], cp: { A: 1 } }, diskCtx());
    // Starting CP plus the Battle-forged bonus at the start of A's first Command phase.
    expect(stateOf(g).cp).toEqual({ A: 2, B: 3 });
  });
});
