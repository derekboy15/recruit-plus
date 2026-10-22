import { describe, expect, test } from 'vitest';
import { areaContains, objectiveArea, shapeContains, validateMap } from '../src/missions/geometry';
import type { MissionMap } from '../src/missions/types';

/** A 44x30 Incisive Attack-like map: deployment zones 10" deep from the short edges, 4 objectives. */
const fixture = (): MissionMap => ({
  board: { width: 44, height: 30 },
  edges: { A: 'left', B: 'right' },
  zones: { A: { include: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 30 }] }, B: { include: [{ kind: 'rect', x: 34, y: 0, w: 10, h: 30 }] } },
  objectives: [
    { id: 'a', x: 6, y: 15, in: 'A' },
    { id: 'b', x: 38, y: 15, in: 'B' },
    { id: 'n1', x: 22, y: 6, in: 'nml' },
    { id: 'n2', x: 22, y: 24, in: 'nml' },
  ],
  symmetry: 'rotate180',
  verified: true,
  notes: [],
  image: 'fixture',
});

describe('shapes and areas', () => {
  test('rect contains its corner', () => {
    expect(shapeContains({ kind: 'rect', x: 0, y: 0, w: 10, h: 30 }, { x: 10, y: 30 })).toBe(true);
    expect(shapeContains({ kind: 'rect', x: 0, y: 0, w: 10, h: 30 }, { x: 10.1, y: 30 })).toBe(false);
  });
  test("polygon contains a diagonal-zone point and not its mirror", () => {
    const tri = { kind: 'polygon' as const, points: [[0, 0], [30, 0], [0, 22]] as [number, number][] };
    expect(shapeContains(tri, { x: 5, y: 5 })).toBe(true);
    expect(shapeContains(tri, { x: 25, y: 18 })).toBe(false);
  });
  test('circle exclude removes the centre', () => {
    const quarter = { include: [{ kind: 'rect' as const, x: 0, y: 0, w: 22, h: 15 }], exclude: [{ kind: 'circle' as const, cx: 22, cy: 15, r: 9 }] };
    expect(areaContains(quarter, { x: 20, y: 14 })).toBe(false);
    expect(areaContains(quarter, { x: 2, y: 2 })).toBe(true);
    expect(areaContains({ include: [{ kind: 'rect', x: 22, y: 0, w: 22, h: 15 }], exclude: [{ kind: 'circle', cx: 22, cy: 15, r: 9 }] }, { x: 40, y: 2 })).toBe(true);
  });
  test('objectiveArea names the zone or no man’s land', () => {
    expect(objectiveArea(fixture(), { x: 3, y: 3 })).toBe('A');
    expect(objectiveArea(fixture(), { x: 22, y: 3 })).toBe('nml');
  });
});

describe('validateMap', () => {
  test('valid fixture map returns []', () => {
    expect(validateMap(fixture())).toEqual([]);
  });
  test("flags an objective declared in A that lies in no man's land", () => {
    const m = fixture();
    m.objectives[2].in = 'A';
    expect(validateMap(m).join('\n')).toMatch(/n1/);
  });
  test('an objective exactly on a zone edge may be declared in that zone or in no man’s land', () => {
    const m = fixture();
    m.objectives.push({ id: 'edgeA', x: 10, y: 15, in: 'nml' }, { id: 'edgeB', x: 34, y: 15, in: 'nml' });
    expect(validateMap(m)).toEqual([]);
    m.objectives[4].in = 'A';
    m.objectives[5].in = 'B';
    expect(validateMap(m)).toEqual([]);
    m.objectives[4].in = 'B';
    expect(validateMap(m).join('\n')).toMatch(/edgeA/);
  });
  test('flags an objective off the board', () => {
    const m = fixture();
    m.objectives[2].y = 31;
    expect(validateMap(m).join('\n')).toMatch(/n1/);
  });
  test('flags overlapping zones', () => {
    const m = fixture();
    m.zones.B = { include: [{ kind: 'rect', x: 8, y: 0, w: 36, h: 30 }] };
    m.objectives = [];
    expect(validateMap(m).join('\n')).toMatch(/overlap/);
  });
  test('flags broken rotate180 symmetry', () => {
    const m = fixture();
    m.objectives[2].x = 20;
    expect(validateMap(m).join('\n')).toMatch(/symmetry/);
  });
  test('mirror symmetry across the line between the edges', () => {
    const m = fixture();
    m.symmetry = 'mirror';
    m.objectives[2].y = 5; // mirror (left-right) keeps y, so this is fine for a mirror map
    m.objectives[3].y = 20;
    expect(validateMap(m)).toEqual([]);
    m.objectives[1].y = 12;
    expect(validateMap(m).join('\n')).toMatch(/symmetry/);
  });
});
