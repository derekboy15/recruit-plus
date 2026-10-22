import { describe, expect, test } from 'vitest';
import { stateOf, type Command, type GameRecord, type Pos } from '../../src';
import { guardsmen, marines, rhino } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, placeAll, play, shift, teleport, unitInput, type TestGameOpts } from '../helpers/game';

const begin = (unitId: string, kind: 'normal' | 'advance' | 'fall-back') => ({ type: 'beginMove', by: 'A', unitId, kind }) as Command;
const complete = (unitId: string, moves: Record<string, { to: Pos }>, embarkInto?: string) =>
  ({ type: 'completeMove', by: 'A', unitId, moves, ...(embarkInto ? { embarkInto } : {}) }) as Command;
const disembark = (unitId: string, positions: Record<string, Pos>) => ({ type: 'disembark', by: 'A', unitId, positions }) as Command;
const toMovement = (g: GameRecord) => play(g, { type: 'endPhase', by: 'A' } as Command);

/** A Rhino at (20, 20) (3"×5" hull: x 18.5–21.5, y 17.5–22.5) and 5 marines; B far away. */
function game(o: { embarked?: boolean; marines?: number } & TestGameOpts = {}): GameRecord {
  const n = o.marines ?? 5;
  // Core-book style: an empty Rhino stays on the battlefield (Arks of Omen would remove it, GT §5).
  const g = newTestGame({ zones: FULL_ZONES(), rules: { emptyDedicatedTransportsDestroyed: false }, a: [unitInput('t', rhino()), unitInput('m', marines(), n)], b: [unitInput('b1', guardsmen(), 5)], ...o });
  return toMovement(
    placeAll(g, o.embarked ? { t: { at: { 't.m1': at(20, 20) }, embarked: ['m'] }, b1: line(5, 50, 'b1') } : { t: { 't.m1': at(20, 20) }, m: column(16.5, 'm', n), b1: line(5, 50, 'b1') }),
  );
}
/** n models of a unit in a column alongside the hull, at x. */
const column = (x: number, unitId: string, n = 5): Record<string, Pos> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${unitId}.m${i + 1}`, at(x, 17.8 + i * 1.3)]));
/** Positions for the marines in a row 1" right of the hull (wholly within 3"). */
const besideHull = (n = 5): Record<string, Pos> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`m.m${i + 1}`, at(23.2, 17.8 + i * 1.3)]));

describe('embarking and disembarking', () => {
  test('[TS §3.4] a unit embarks when every model ends within 3" of the transport', () => {
    const g = play(game(), begin('m', 'normal'), complete('m', shift(game(), 'm', 0.5, 0), 't'));
    expect(stateOf(g).units.m).toMatchObject({ location: 'embarked', embarkedIn: 't' });
    expect(stateOf(g).models['m.m1'].pos).toBeNull();
  });

  test('[TS §3.4] a model more than 3" away stops the unit embarking', () => {
    expectRejected(play(game(), begin('m', 'normal')), complete('m', shift(game(), 'm', -2.5, 0), 't'), 'too-far-to-embark');
  });

  test('[TS §3.4] nothing can embark into a transport within Engagement Range of the enemy', () => {
    const g = teleport(game(), { 'b1.m1': at(20, 23.5) });
    expectRejected(play(g, begin('m', 'normal')), complete('m', shift(g, 'm', 0.5, 0), 't'), 'transport-engaged');
  });

  test('[TS §3.4] transport capacity limits the models aboard', () => {
    const big = toMovement(
      placeAll(newTestGame({ zones: FULL_ZONES(), a: [unitInput('t', rhino()), unitInput('m', marines(), 6), unitInput('n', marines(), 5)] }), {
        t: { at: { 't.m1': at(20, 20) }, embarked: ['m'] },
        n: column(16.5, 'n', 5),
        b1: line(5, 50, 'b1'),
      }),
    );
    expectRejected(play(big, begin('n', 'normal')), complete('n', shift(big, 'n', 0.5, 0), 't'), 'transport-full');
  });

  test('[TS §3.4] a unit that starts the phase embarked disembarks wholly within 3", then can still move', () => {
    let g = play(game({ embarked: true }), disembark('m', besideHull()));
    expect(stateOf(g).units.m).toMatchObject({ location: 'battlefield', embarkedIn: null });
    g = play(g, begin('m', 'normal'), complete('m', shift(g, 'm', 5, 0)));
    expect(stateOf(g).units.m.turn.moved).toBe('normal');
  });

  test('[TS §3.4] disembarking models must be wholly within 3" of the transport', () => {
    const far = { ...besideHull(), 'm.m1': at(25, 17.8) };
    expectRejected(game({ embarked: true }), disembark('m', far), 'too-far-to-disembark');
  });

  test('[WCR] a unit can not disembark once its transport has moved', () => {
    const g = play(game({ embarked: true }), begin('t', 'normal'), complete('t', { 't.m1': { to: at(20, 24) } }));
    expectRejected(g, disembark('m', besideHull()), 'transport-moved');
  });

  test('[TS §3.4] a unit can not embark in the phase it disembarked', () => {
    const g = play(game({ embarked: true }), disembark('m', besideHull()));
    expectRejected(play(g, begin('m', 'normal')), complete('m', shift(g, 'm', -0.5, 0), 't'), 'disembarked-this-phase');
  });

  test('[TS §3.1] a unit that disembarked never counts as having Remained Stationary', () => {
    const g = play(game({ embarked: true }), disembark('m', besideHull()), { type: 'endStep', by: 'A' } as Command);
    expect(stateOf(g).units.m.turn.moved).not.toBe('stationary');
  });

  test('[TS §3.4] embarked units count as having made the move their transport made', () => {
    const g = play(game({ embarked: true }), begin('t', 'normal'), complete('t', { 't.m1': { to: at(20, 24) } }));
    expect(stateOf(g).units.m.turn.moved).toBe('normal');
  });
});

describe('destroyed transports', () => {
  const kill = { type: 'inflictMortalWounds', by: 'B', unitId: 't', count: 10 } as Command;

  test('[TS §3.4] the passengers must be set up when the transport is destroyed', () => {
    const g = play(game({ embarked: true }), kill);
    expect(stateOf(g).placements).toEqual([expect.objectContaining({ transportId: 't', player: 'A', unitIds: ['m'] })]);
    expectRejected(g, { type: 'endPhase', by: 'A' } as Command, 'pending-decision');
  });

  test('[TS §3.4] destroyed transport: wholly within 3", and each 1 on a D6 kills a passenger', () => {
    const g = play(game({ embarked: true, dice: [1, 4, 1, 6, 5] }), kill, { type: 'placePassengers', by: 'A', transportId: 't', placements: { m: besideHull() }, emergency: false } as Command);
    const s = stateOf(g);
    expect(s.units.m.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(2);
    expect(s.placements).toEqual([]);
    expect(s.units.m.turn.disembarkedFromDestroyed).toBe(true);
  });

  test('[TS §3.4] models that can not be placed are destroyed', () => {
    const four = Object.fromEntries(Object.entries(besideHull()).slice(0, 4));
    const g = play(game({ embarked: true, dice: [6, 6, 6, 6] }), kill, { type: 'placePassengers', by: 'A', transportId: 't', placements: { m: four }, emergency: false } as Command);
    expect(stateOf(g).models['m.m5'].destroyed).toBe(true);
  });

  test('[CS §2] Emergency Disembarkation: within 6", models lost on a 1 or 2, 1 CP', () => {
    const six: Record<string, Pos> = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`m.m${i + 1}`, at(26, 17.8 + i * 1.3)]));
    const g0 = play(game({ embarked: true, dice: [1, 2, 3, 4, 5] }), kill);
    expectRejected(g0, { type: 'placePassengers', by: 'A', transportId: 't', placements: { m: six }, emergency: false } as Command, 'too-far-to-disembark');
    const g = play(g0, { type: 'placePassengers', by: 'A', transportId: 't', placements: { m: six }, emergency: true } as Command);
    const s = stateOf(g);
    expect(s.units.m.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(2);
    expect(s.cp.A).toBe(stateOf(g0).cp.A - 1);
  });
});
