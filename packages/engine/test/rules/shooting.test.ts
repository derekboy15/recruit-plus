import { describe, expect, test } from 'vitest';
import { saveFor, stateOf, TERRAIN_PRESETS, type Command, type GameRecord, type Pos, type TerrainFeature } from '../../src';
import { boltPistol, boltRifle, captain, guardsmen, heavyTeam, knight, marines, model, rhino, sheet, tank, weapon } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, placeAll, play, setTurnFlag, teleport, unitInput, type TestGameOpts } from '../helpers/game';

type Assign = { modelId: string; weapon: string; targetUnitId: string };
const shoot = (unitId: string, assignments: Assign[], by: 'A' | 'B' = 'A') => ({ type: 'shoot', by, unitId, assignments }) as Command;
const all = (g: GameRecord, unitId: string, w: string, target: string): Assign[] =>
  stateOf(g).units[unitId].modelIds.filter((id) => !stateOf(g).models[id].destroyed).map((modelId) => ({ modelId, weapon: w, targetUnitId: target }));
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

const assaulters = () =>
  sheet({ id: 'dev', name: 'Assault Squad', keywords: ['INFANTRY'], models: [model('Marine', { W: 2 })], weapons: [weapon('Assault cannon', { type: 'Assault', range: 24, shots: '2', s: 6 }), boltRifle] });
const plasma = () =>
  sheet({
    id: 'pl', name: 'Plasma Squad', keywords: ['INFANTRY'], models: [model('Marine', { W: 2 })],
    weapons: [weapon('Plasma gun - standard', { type: 'Rapid Fire', range: 24, s: 7, ap: -3 }), weapon('Plasma gun - supercharge', { type: 'Rapid Fire', range: 24, s: 8, ap: -3, d: '2' })],
  });

/** Units anywhere; skips to A's Shooting phase. */
function game(o: TestGameOpts & { at: Record<string, Record<string, Pos>> }): GameRecord {
  let g = placeAll(newTestGame({ zones: FULL_ZONES(), ...o }), o.at);
  for (let i = 0; i < 3; i++) g = play(g, { type: 'endPhase', by: 'A' } as Command);
  return g;
}
/** 5 marines (a1) at y 17 facing 10 guardsmen (b1) at y 30–31 (just within half range of a bolt rifle). */
const basic = (o: Partial<TestGameOpts> = {}) =>
  game({ a: [unitInput('a1', marines(), 5)], b: [unitInput('b1', guardsmen(), 10)], at: { a1: line(15, 17, 'a1'), b1: line(15, 30, 'b1', 10) }, ...o });
const groups = (g: GameRecord) => stateOf(g).attack!.groups;

describe('who can shoot', () => {
  test('[TS §5.1] after Advancing a unit can only shoot Assault weapons, at -1 to hit', () => {
    const g = setTurnFlag(game({ a: [unitInput('a1', assaulters(), 2)], at: { a1: line(15, 10, 'a1', 2), b1: line(15, 30, 'b1') }, windows: true }), 'a1', 'moved', 'advance');
    expectRejected(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1')), 'advanced');
    const s = play(g, shoot('a1', all(g, 'a1', 'Assault cannon', 'b1')));
    expect(groups(s)[0].hitMods).toContainEqual({ source: 'Assault weapon after Advancing', value: -1 });
  });

  test('[TS §3.1] a unit that Fell Back can not shoot unless it is TITANIC', () => {
    const g = setTurnFlag(basic(), 'a1', 'moved', 'fall-back');
    expectRejected(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1')), 'fell-back');
    const k = setTurnFlag(game({ a: [unitInput('k', knight())], at: { k: { 'k.m1': at(20, 8) }, b1: line(15, 30, 'b1') } }), 'k', 'moved', 'fall-back');
    play(k, shoot('k', [{ modelId: 'k.m1', weapon: 'Thermal cannon', targetUnitId: 'b1' }]));
  });

  test('[TS §5.1] each unit shoots once per phase', () => {
    const g = play(basic(), shoot('a1', all(basic(), 'a1', 'Bolt rifle', 'b1')));
    expectRejected(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1')), 'already-shot');
  });

  test('[TS §5.1] units can only shoot in their own Shooting phase', () => {
    const g = placeAll(newTestGame({ zones: FULL_ZONES() }), { a1: line(15, 10, 'a1'), b1: line(15, 30, 'b1') });
    expectRejected(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1')), 'wrong-phase');
  });
});

describe('targets', () => {
  test('[TS §5.1] a target out of range is refused', () => {
    const g = game({ a: [unitInput('a1', marines(), 5)], at: { a1: line(15, 10, 'a1'), b1: line(15, 45, 'b1') } });
    expectRejected(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1')), 'out-of-range');
  });

  test('[TS §5.1] a target that is not visible is refused', () => {
    const ruin: TerrainFeature = { id: 'r', name: 'Ruin', ...TERRAIN_PRESETS.ruins, footprint: rect(0, 18, 44, 22), height: 6 };
    expectRejected(basic({ terrain: [ruin] }), shoot('a1', all(basic(), 'a1', 'Bolt rifle', 'b1')), 'not-visible');
  });

  test('[BD §3] Indirect Fire at a hidden target: BS 1 worse and +1 to the armour save, stacking with Light Cover', () => {
    const ruin: TerrainFeature = { id: 'r', name: 'Ruin', ...TERRAIN_PRESETS.ruins, footprint: rect(0, 18, 44, 22), height: 6 };
    const crater: TerrainFeature = { id: 'c', name: 'Crater', ...TERRAIN_PRESETS.craters, footprint: rect(0, 27, 44, 35), height: 0.5 };
    const mortar = sheet({ id: 'm', name: 'Mortar Team', keywords: ['INFANTRY'], models: [model('Team', { W: 2, BS: 4 })], weapons: [weapon('Mortar', { type: 'Heavy', range: 48, shots: 'D6', s: 4, indirect: true, blast: true })] });
    const g = game({ terrain: [ruin, crater], windows: true, a: [unitInput('a1', mortar, 1)], b: [unitInput('b1', marines(), 5)], at: { a1: { 'a1.m1': at(20, 10) }, b1: line(15, 30, 'b1') } });
    const s = stateOf(play(g, shoot('a1', [{ modelId: 'a1.m1', weapon: 'Mortar', targetUnitId: 'b1' }])));
    const grp = s.attack!.groups[0];
    expect(grp.indirect).toBe(true);
    expect(saveFor(s, grp, s.models['b1.m1'])).toEqual({ needed: 3, mod: 2, kind: 'armour' });
  });

  test('[TS §5.1] a unit can not target an enemy unit within Engagement Range of a friendly unit', () => {
    let g = game({ a: [unitInput('a1', marines(), 5), unitInput('a2', marines(), 1)], at: { a1: line(15, 10, 'a1'), a2: { 'a2.m1': at(30, 20) }, b1: line(15, 30, 'b1') } });
    g = teleport(g, { 'a2.m1': at(15, 31.2) });
    expectRejected(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1')), 'engaged-with-friendly');
  });

  test('[TS §1.1] a weapon with a minimum range can not target a unit wholly within it', () => {
    const big = sheet({ id: 'bg', name: 'Siege Gun', keywords: ['VEHICLE'], models: [model('Gun', { W: 12 })], weapons: [weapon('Siege cannon', { type: 'Heavy', range: 48, minRange: 24, shots: '1', s: 10 })] });
    const g = game({ a: [unitInput('a1', big)], at: { a1: { 'a1.m1': at(20, 10) }, b1: line(15, 30, 'b1') } });
    expectRejected(g, shoot('a1', [{ modelId: 'a1.m1', weapon: 'Siege cannon', targetUnitId: 'b1' }]), 'minimum-range');
  });
});

describe('weapon types', () => {
  test('[TS §5.4] Rapid Fire doubles the shots of models within half range', () => {
    // m1–m3 within 15" of the target, m4–m5 further away (24"+).
    let g = basic({ windows: true });
    g = teleport(g, { 'a1.m4': at(5, 2), 'a1.m5': at(6.5, 2) });
    const s = stateOf(play(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1'))));
    // Two groups: the three close models (2 shots each), then the two far ones (1 each).
    expect(s.attack!.groups.map((x) => [x.modelIds.length, x.closeModels?.length ?? 0])).toEqual([[3, 3], [2, 0]]);
    expect(s.attack!.attacks).toBe(6);
  });

  test('[TS §5.4] Heavy: -1 to hit for INFANTRY that moved; a VEHICLE that moved has no penalty', () => {
    const g = setTurnFlag(game({ windows: true, a: [unitInput('h', heavyTeam()), unitInput('t', tank())], at: { h: { 'h.m1': at(10, 10) }, t: { 't.m1': at(30, 10) }, b1: line(15, 30, 'b1') } }), 'h', 'moved', 'normal');
    expect(groups(play(g, shoot('h', [{ modelId: 'h.m1', weapon: 'Heavy bolter', targetUnitId: 'b1' }])))[0].hitMods).toContainEqual({ source: 'Heavy weapon after moving', value: -1 });
    const t = setTurnFlag(g, 't', 'moved', 'normal');
    expect(groups(play(t, shoot('t', [{ modelId: 't.m1', weapon: 'Lascannon', targetUnitId: 'b1' }])))[0].hitMods).toEqual([]);
  });

  test('[TS §5.4] a Pistol can shoot while engaged, at the engaged enemy; other weapons can not', () => {
    const g = teleport(basic(), { 'b1.m1': at(15, 18.2) });
    play(g, shoot('a1', all(g, 'a1', 'Bolt pistol', 'b1')));
    expectRejected(g, shoot('a1', all(g, 'a1', 'Bolt rifle', 'b1')), 'engaged');
  });

  test('[WCR] a model fires its Pistols or its other ranged weapons, not both', () => {
    expectRejected(basic(), shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt pistol', targetUnitId: 'b1' }, { modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'b1' }]), 'pistol-or-other');
  });

  test('[TS §5.4] Grenade: one model per unit, and it fires nothing else', () => {
    const g = game({ a: [unitInput('a1', { ...guardsmen(), weapons: guardsmen().weapons }, 1), unitInput('a2', guardsmen(), 1)], at: { a1: { 'a1.m1': at(20, 26) }, a2: { 'a2.m1': at(30, 26) }, b1: line(15, 30.5, 'b1') } });
    expectRejected(g, shoot('a1', [{ modelId: 'a1.m1', weapon: 'Frag grenade', targetUnitId: 'b1' }, { modelId: 'a1.m1', weapon: 'Lasgun', targetUnitId: 'b1' }]), 'grenade-only');
    const two = game({ a: [{ id: 'a1', datasheet: guardsmen(), models: [{ profile: 'Guardsman', weapons: ['Lasgun', 'Frag grenade'], count: 2 }] }], at: { a1: line(20, 26, 'a1', 2), b1: line(15, 30.5, 'b1') } });
    expectRejected(two, shoot('a1', all(two, 'a1', 'Frag grenade', 'b1')), 'one-grenade');
  });

  test('[R-16] only one profile of a weapon per shooting', () => {
    const g = game({ a: [unitInput('a1', plasma(), 1)], at: { a1: { 'a1.m1': at(20, 15) }, b1: line(15, 30, 'b1') } });
    expectRejected(g, shoot('a1', [{ modelId: 'a1.m1', weapon: 'Plasma gun - standard', targetUnitId: 'b1' }, { modelId: 'a1.m1', weapon: 'Plasma gun - supercharge', targetUnitId: 'b1' }]), 'one-profile');
  });

  test('[TS §5.5] Blast: the target\'s model count is fixed when it is targeted', () => {
    const g = game({ windows: true, a: [unitInput('t', tank())], b: [unitInput('b1', guardsmen(), 10)], at: { t: { 't.m1': at(20, 10) }, b1: line(15, 30, 'b1', 10) } });
    expect(groups(play(g, shoot('t', [{ modelId: 't.m1', weapon: 'Battle cannon', targetUnitId: 'b1' }])))[0].targetModels).toBe(10);
  });

  test('[TS §5.5] Blast weapons can never target a unit within Engagement Range of the firing unit', () => {
    const g = teleport(game({ a: [unitInput('t', tank())], at: { t: { 't.m1': at(20, 10) }, b1: line(15, 30, 'b1') } }), { 'b1.m1': at(20, 12.0) });
    expectRejected(g, shoot('t', [{ modelId: 't.m1', weapon: 'Battle cannon', targetUnitId: 'b1' }]), 'blast-engaged');
  });
});

describe('Big Guns Never Tire', () => {
  const engaged = (dice: number[] = []) =>
    teleport(
      game({ dice, windows: false, a: [unitInput('t', tank())], b: [unitInput('b1', guardsmen(), 1), unitInput('b2', guardsmen(), 5)], at: { t: { 't.m1': at(20, 10) }, b1: { 'b1.m1': at(40, 50) }, b2: line(15, 30, 'b2') } }),
      { 'b1.m1': at(20, 12.0) },
    );

  test('[TS §5.2] a VEHICLE can shoot while engaged, Heavy weapons at -1', () => {
    const g = play(teleport(engaged(), {}), shoot('t', [{ modelId: 't.m1', weapon: 'Lascannon', targetUnitId: 'b1' }]));
    expect(stateOf(g).units.t.turn.shot).toBe(true);
    const w = play(game({ windows: true, a: [unitInput('t', tank())], b: [unitInput('b1', guardsmen(), 1)], at: { t: { 't.m1': at(20, 10) }, b1: { 'b1.m1': at(40, 50) } } }), { type: 'testTeleport', by: 'A', positions: { 'b1.m1': at(20, 12.0) } } as never);
    expect(groups(play(w, shoot('t', [{ modelId: 't.m1', weapon: 'Lascannon', targetUnitId: 'b1' }])))[0].hitMods).toContainEqual({ source: 'Big Guns Never Tire (Heavy)', value: -1 });
  });

  test('[TS §5.2] targets outside the combat resolve only if the engaged enemy is destroyed first', () => {
    // The lascannon at the engaged b1 misses; the battle cannon at b2 (outside the combat) is then lost.
    const g = play(engaged([1, 6, 6, 6, 1, 6]), shoot('t', [{ modelId: 't.m1', weapon: 'Battle cannon', targetUnitId: 'b2' }, { modelId: 't.m1', weapon: 'Lascannon', targetUnitId: 'b1' }]));
    const s = stateOf(g);
    expect(s.units.b2.modelIds.every((id) => !s.models[id].destroyed)).toBe(true);
    expect(s.attack).toBeNull();
  });

  test('[TS §5.1] attacks at a target destroyed earlier in the same shooting are lost', () => {
    // Two marines shoot one guardsman: the bolt rifle kills it, then the bolt pistol's attack has no target left.
    let g = game({ dice: [6, 6, 1], a: [unitInput('a1', marines(), 2)], b: [unitInput('b1', guardsmen(), 1)], at: { a1: line(15, 25, 'a1', 2), b1: { 'b1.m1': at(15, 40) } } });
    g = teleport(g, { 'a1.m1': at(15, 19), 'a1.m2': at(15, 31) });
    const s = stateOf(play(g, shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'b1' }, { modelId: 'a1.m2', weapon: 'Bolt pistol', targetUnitId: 'b1' }])));
    expect(s.units.b1.location).toBe('destroyed');
    expect(s.attack).toBeNull();
  });
});

describe('Look Out, Sir', () => {
  /** A captain (W5 CHARACTER) at (20, 30) next to `guard`; the shooter at `shooter`. */
  const protectedCaptain = (guard: Parameters<typeof unitInput>[1], guardCount: number, shooter: Pos) =>
    game({
      a: [unitInput('a1', marines(), 1)],
      b: [unitInput('c', captain()), unitInput('g', guard, guardCount)],
      at: { a1: { 'a1.m1': shooter }, c: { 'c.m1': at(20, 30) }, g: line(17, 32.5, 'g', guardCount) },
    });

  test('[TS §5.3] a W5 character within 3" of a 3-model squad can not be shot unless it is the closest target', () => {
    expectRejected(protectedCaptain(guardsmen(), 3, at(20, 40)), shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'c' }]), 'look-out-sir');
    play(protectedCaptain(guardsmen(), 3, at(20, 20)), shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'c' }]));
  });

  test('[R-25] any non-CHARACTER unit with a VEHICLE or MONSTER protects; a CHARACTER vehicle under 10 wounds does not', () => {
    const smallVehicle = sheet({ id: 'v', name: 'Light Vehicle', keywords: ['VEHICLE'], models: [model('Buggy', { W: 6 })], weapons: [] });
    expectRejected(protectedCaptain(smallVehicle, 1, at(20, 40)), shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'c' }]), 'look-out-sir');
    const charVehicle = sheet({ id: 'cv', name: 'Command Vehicle', keywords: ['VEHICLE', 'CHARACTER'], models: [model('Chariot', { W: 9 })], weapons: [] });
    play(protectedCaptain(charVehicle, 1, at(20, 40)), shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'c' }]));
    const bigMonsterChar = sheet({ id: 'mc', name: 'Greater Daemon', keywords: ['MONSTER', 'CHARACTER'], models: [model('Daemon', { W: 16 })], weapons: [] });
    expectRejected(protectedCaptain(bigMonsterChar, 1, at(20, 40)), shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'c' }]), 'look-out-sir');
    expect(rhino().keywords).toContain('VEHICLE');
  });

  test('[TS §5.3] when judging the closest target, other protected characters are ignored', () => {
    const g = game({
      a: [unitInput('a1', marines(), 1)],
      b: [unitInput('c1', captain()), unitInput('c2', { ...captain(), id: 'captain2' }), unitInput('g', guardsmen(), 5)],
      at: { a1: { 'a1.m1': at(20, 20) }, c1: { 'c1.m1': at(20, 30) }, c2: { 'c2.m1': at(23, 28) }, g: line(17, 33.5, 'g', 5) },
    });
    play(g, shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'c1' }]));
  });

  test('[TS §5.3] an unprotected character can be shot normally', () => {
    play(game({ a: [unitInput('a1', marines(), 1)], b: [unitInput('c', captain())], at: { a1: { 'a1.m1': at(20, 10) }, c: { 'c.m1': at(20, 30) } } }), shoot('a1', [{ modelId: 'a1.m1', weapon: 'Bolt rifle', targetUnitId: 'c' }]));
  });
});

export { boltPistol };
