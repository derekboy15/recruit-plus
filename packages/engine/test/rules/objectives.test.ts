import { describe, expect, test } from 'vitest';
import { objectiveControl, stateOf } from '../../src';
import { flyer, guardsmen, knight, marines } from '../fixtures/units';
import { toDatasheet } from '../../src/data/adapter';
import { at, FULL_ZONES, line, newTestGame, placeAll, unitInput } from '../helpers/game';
import { realUnit } from '../helpers/realData';

const realSheet = (catalogue: string, name: string) => {
  const { unit, catalogueName } = realUnit(catalogue, name);
  return toDatasheet(unit, catalogueName).datasheet;
};

const objectives = [{ id: 'o1', pos: { x: 20, y: 30 } }, { id: 'o2', pos: { x: 30, y: 30 } }];
const marker = 20 / 25.4;
/** Distance from the marker centre that puts a 32mm base exactly `gap` inches from the marker's edge. */
const off32 = (gap: number) => marker + gap + 16 / 25.4;

function game(a: Parameters<typeof unitInput>[], b: Parameters<typeof unitInput>[], positions: Parameters<typeof placeAll>[1]) {
  return placeAll(newTestGame({ zones: FULL_ZONES(), objectives, a: a.map((x) => unitInput(...x)), b: b.map((x) => unitInput(...x)) }), positions);
}

describe('objective control', () => {
  test('[TS §9] the player with more models in range controls', () => {
    const g = game([['a1', guardsmen(), 3]], [['b1', guardsmen(), 2]], { a1: line(19, 31, 'a1', 3), b1: line(19, 29, 'b1', 2) });
    expect(objectiveControl(stateOf(g)).o1).toBe('A');
  });

  test('[TS §9] equal numbers: nobody controls', () => {
    const g = game([['a1', guardsmen(), 2]], [['b1', guardsmen(), 2]], { a1: line(19, 31, 'a1', 2), b1: line(19, 29, 'b1', 2) });
    expect(objectiveControl(stateOf(g)).o1).toBeNull();
  });

  test('[TS §9] range is 3" horizontally from the marker\'s edge', () => {
    const inside = game([['a1', marines(), 1]], [['b1', guardsmen(), 1]], { a1: { 'a1.m1': at(20 + off32(3), 30) }, b1: { 'b1.m1': at(5, 50) } });
    expect(objectiveControl(stateOf(inside)).o1).toBe('A');
    const outside = game([['a1', marines(), 1]], [['b1', guardsmen(), 1]], { a1: { 'a1.m1': at(20 - off32(3.05), 30) }, b1: { 'b1.m1': at(5, 50) } });
    expect(objectiveControl(stateOf(outside)).o1).toBeNull();
  });

  test('[TS §9] and 5" vertically', () => {
    const low = game([['a1', marines(), 1]], [['b1', guardsmen(), 1]], { a1: { 'a1.m1': at(20, 30.5) }, b1: { 'b1.m1': at(5, 50) } });
    expect(objectiveControl(stateOf(low)).o1).toBe('A');
  });

  test('[TS §9] Aircraft never control objectives', () => {
    const g = placeAll(newTestGame({ zones: FULL_ZONES(), objectives, a: [unitInput('f', flyer()), unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1)] }), {
      a1: { 'a1.m1': at(5, 5) },
      b1: { 'b1.m1': at(5, 50) },
    });
    // Put the flyer on the marker by hand (as the toolkit would): it still doesn't count.
    const s = structuredClone(stateOf(g));
    s.units.f.location = 'battlefield';
    s.models['f.m1'].pos = at(20, 30);
    expect(objectiveControl(s).o1).toBeNull();
  });

  test('[TS §9] both sides have Objective Secured: count models', () => {
    const g = game([['a1', marines(), 1]], [['b1', guardsmen(), 3]], { a1: { 'a1.m1': at(20, 31.5) }, b1: line(19, 28.5, 'b1', 3) });
    expect(objectiveControl(stateOf(g)).o1).toBe('B'); // both sides have ObSec (guardsmen too): count models
  });

  test('[TS §9] Objective Secured beats more models when the enemy has none', () => {
    const g = game([['a1', marines(), 1]], [['k', knight(), 1]], { a1: { 'a1.m1': at(20, 31.8) }, k: { 'k.m1': at(20, 25) } });
    expect(objectiveControl(stateOf(g)).o1).toBe('A');
  });

  test('[BD §2] a Knight counts as 10 models', () => {
    const g = game([['a1', guardsmen(), 5]], [['k', { ...knight(), objectiveSecured: false }, 1]], { a1: line(17, 31.5, 'a1', 5), k: { 'k.m1': at(20, 25.5) } });
    expect(objectiveControl(stateOf(g)).o1).toBe('A'); // the guardsmen have Objective Secured
    const g2 = game([['a1', { ...guardsmen(), objectiveSecured: false }, 5]], [['k', knight(), 1]], { a1: line(17, 31.5, 'a1', 5), k: { 'k.m1': at(20, 25.5) } });
    expect(objectiveControl(stateOf(g2)).o1).toBe('B');
  });

  test('[R-28] an Intercessor Squad (Troops, ADEPTUS ASTARTES) holds a marker against more models without Objective Secured', () => {
    const intercessors = realSheet('Imperium - Adeptus Astartes - Ultramarines', 'Intercessor Squad');
    const g = game([['a1', intercessors, 3]], [['b1', { ...guardsmen(), objectiveSecured: false }, 6]], { a1: line(19, 31.5, 'a1', 3), b1: line(17, 28, 'b1', 6) });
    expect(objectiveControl(stateOf(g)).o1).toBe('A');
  });

  test('[R-28] Necron Warriors (Troops, NECRONS) hold a marker against more models without Objective Secured', () => {
    const warriors = realSheet('Necrons', 'Necron Warriors');
    const g = game([['a1', { ...guardsmen(), objectiveSecured: false }, 6]], [['b1', warriors, 2]], { a1: line(17, 31.5, 'a1', 6), b1: line(19, 28.5, 'b1', 2) });
    expect(objectiveControl(stateOf(g)).o1).toBe('B');
  });

  test('[R-13] a model counts toward only its nearest marker', () => {
    // One A model between two markers 10" apart... placed within range of both: it counts for the nearer (o1).
    const close = [{ id: 'o1', pos: { x: 20, y: 30 } }, { id: 'o2', pos: { x: 25, y: 30 } }];
    const g = placeAll(newTestGame({ zones: FULL_ZONES(), objectives: close, a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1)] }), {
      a1: { 'a1.m1': at(22, 30) },
      b1: { 'b1.m1': at(5, 50) },
    });
    expect(objectiveControl(stateOf(g))).toEqual({ o1: 'A', o2: null });
  });
});
