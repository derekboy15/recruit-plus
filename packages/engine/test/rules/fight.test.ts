import { describe, expect, test } from 'vitest';
import { fightOrder, stateOf, type Command, type GameRecord, type Pos } from '../../src';
import { captain, guardsmen, marines, model, sheet, weapon } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, newTestGame, placeAll, play, setTurnFlag, teleport, unitInput, type TestGameOpts } from '../helpers/game';

const select = (unitId: string, by: 'A' | 'B') => ({ type: 'selectFighter', by, unitId }) as Command;
const pileIn = (unitId: string, by: 'A' | 'B', moves: Record<string, { to: Pos }> = {}) => ({ type: 'pileIn', by, unitId, moves }) as Command;
const attacks = (unitId: string, by: 'A' | 'B', assignments: { modelId: string; weapon: string; attacks: number; targetUnitId: string }[]) =>
  ({ type: 'fightAttacks', by, unitId, assignments }) as Command;
const consolidate = (unitId: string, by: 'A' | 'B', moves: Record<string, { to: Pos }> = {}) => ({ type: 'consolidate', by, unitId, moves }) as Command;
/** Select, no pile in, the given attacks, no consolidation. */
const fight = (unitId: string, by: 'A' | 'B', a: Parameters<typeof attacks>[2] = []) => [select(unitId, by), pileIn(unitId, by), attacks(unitId, by, a), consolidate(unitId, by)];
const R32 = 16 / 25.4;
const R25 = 12.5 / 25.4;

const brawlers = () =>
  sheet({
    id: 'br', name: 'Assault Squad', keywords: ['INFANTRY'], models: [model('Marine', { W: 2, A: 3 })],
    weapons: [weapon('Chainsword', { ap: -1 }), weapon('Power fist', { s: { kind: 'mul', v: 2 }, ap: -3, d: '2' })],
  });

/** Marks a unit as having charged the targets this turn, so its player picks first. */
const charged = (g: GameRecord, unitId: string, targets: string[]) => setTurnFlag(setTurnFlag(g, unitId, 'charged', true), unitId, 'chargeTargets', targets);
/** A game where a1 charged (so A fights first). */
const cgame = (o: Parameters<typeof game>[0], targets = ['b1']) => charged(game(o), 'a1', targets);

/** Places everyone far apart, then teleports them into position; skips to A's Fight phase. */
function game(o: TestGameOpts & { at: Record<string, Pos> }): GameRecord {
  const s0 = newTestGame({ zones: FULL_ZONES(), ...o });
  const units = [...(o.a ?? []), ...(o.b ?? [])];
  const spread: Record<string, Record<string, Pos>> = {};
  units.forEach((u, i) => {
    spread[u.id] = {};
    const n = u.models.reduce((a, m) => a + m.count, 0);
    for (let k = 0; k < n; k++) spread[u.id][`${u.id}.m${k + 1}`] = at(2 + k * 1.5, 2 + i * 6);
  });
  let g = teleport(placeAll(s0, spread), o.at);
  for (let i = 0; i < 5; i++) g = play(g, { type: 'endPhase', by: 'A' } as Command);
  return g;
}
/** a1 (charged b1) is engaged with b1; a2 (didn't charge) with b2. */
const twoFights = (o: Partial<TestGameOpts> = {}) =>
  setTurnFlag(
    setTurnFlag(
      game({
        a: [unitInput('a1', marines(), 1), unitInput('a2', marines(), 1)],
        b: [unitInput('b1', guardsmen(), 1), unitInput('b2', guardsmen(), 1)],
        at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5), 'a2.m1': at(30, 30), 'b2.m1': at(30, 31.5) },
        ...o,
      }),
      'a1',
      'charged',
      true,
    ),
    'a1',
    'chargeTargets',
    ['b1'],
  );

describe('fight order', () => {
  test('[TS §7.1] charging units fight first', () => {
    const g = twoFights();
    expect(fightOrder(stateOf(g))).toMatchObject({ picker: 'A', selectable: ['a1'] });
    expectRejected(g, select('b1', 'B'), 'not-your-pick');
    expectRejected(g, select('a2', 'A'), 'fights-first-pending');
  });

  test('[WCR] after the chargers, the player whose turn it is not picks first', () => {
    const g = play(twoFights(), ...fight('a1', 'A'));
    expect(fightOrder(stateOf(g)).picker).toBe('B');
  });

  test('[TS §7.1] when one player has no eligible units left, the other fights the rest', () => {
    // a1 (charged) is engaged with both b1 and b2: after a1 and b1, A has nobody left, so B fights b2 too.
    let g = setTurnFlag(
      game({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1), unitInput('b2', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5), 'b2.m1': at(11.5, 30.6) } }),
      'a1',
      'charged',
      true,
    );
    g = play(g, ...fight('a1', 'A'), ...fight('b1', 'B'));
    expect(fightOrder(stateOf(g))).toMatchObject({ picker: 'B', selectable: ['b2'] });
    g = play(g, ...fight('b2', 'B'));
    play(g, { type: 'endPhase', by: 'A' } as Command);
  });

  test('[TS §7.2] fights first and fights last cancel out', () => {
    let g = twoFights();
    for (const kind of ['fights-first', 'fights-last'])
      g = play(g, { type: 'addEffect', by: 'B', effect: { unitId: 'b2', side: 'self', effect: { kind }, until: 'turn', note: '' } } as Command);
    expect(fightOrder(stateOf(g)).selectable).toEqual(['a1']);
  });

  test('[TS §7.2] a fights-last unit waits until its army\'s other units have fought', () => {
    let g = play(twoFights(), { type: 'addEffect', by: 'A', effect: { unitId: 'b1', side: 'self', effect: { kind: 'fights-last' }, until: 'turn', note: '' } } as Command);
    g = play(g, ...fight('a1', 'A'));
    expect(fightOrder(stateOf(g)).selectable).toEqual(['b2']);
  });

  test('[CS §2] Counter-offensive: 2 CP, and the chosen unit fights next', () => {
    let g = twoFights({ reactions: true });
    g = play(g, select('a1', 'A'), pileIn('a1', 'A'), attacks('a1', 'A', []), consolidate('a1', 'A'));
    expect(stateOf(g).pending).toMatchObject({ kind: 'reaction', reaction: 'counter-offensive', player: 'B' });
    const cp = stateOf(g).cp.B;
    g = play(g, { type: 'respond', by: 'B', choice: 'counter-offensive:b2' } as Command);
    expect(stateOf(g).cp.B).toBe(cp - 2);
    expect(fightOrder(stateOf(g))).toMatchObject({ picker: 'B', selectable: ['b2'] });
  });

  test('[TS §7.1] every eligible unit must fight before the phase ends', () => {
    expectRejected(twoFights(), { type: 'endPhase', by: 'A' } as Command, 'must-fight');
  });
});

describe('fighting with a unit', () => {
  test('[TS §7.3] pile in up to 3", each model ending closer to the closest enemy model', () => {
    const g = cgame({ a: [unitInput('a1', marines(), 2)], b: [unitInput('b1', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'a1.m2': at(11.5, 29.2), 'b1.m1': at(10, 31.5) } });
    const s = play(g, select('a1', 'A'));
    expectRejected(s, pileIn('a1', 'A', { 'a1.m2': { to: at(14, 29.2) } }), 'not-closer');
    expectRejected(s, pileIn('a1', 'A', { 'a1.m2': { to: at(11.5, 33.5) } }), 'too-far');
    play(s, pileIn('a1', 'A', { 'a1.m2': { to: at(11.2, 30.6) } }));
  });

  test('[TS §7.3] a model in base contact with an enemy can not pile in', () => {
    const g = cgame({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 30 + R32 + R25) } });
    expectRejected(play(g, select('a1', 'A')), pileIn('a1', 'A', { 'a1.m1': { to: at(10.3, 30.2) } }), 'base-contact');
  });

  test('[TS §7.3] a model within ½" of a friendly model that is within ½" of the enemy also fights', () => {
    // m1 is 0.4" from the enemy; m2 is 0.4" behind m1 (1.66" from the enemy); m3 is 0.6" behind m1.
    const y1 = 31.5 - R25 - R32 - 0.4;
    const g = cgame({
      a: [unitInput('a1', marines(), 3)],
      b: [unitInput('b1', guardsmen(), 1)],
      at: { 'a1.m1': at(10, y1), 'a1.m2': at(10, y1 - 2 * R32 - 0.4), 'a1.m3': at(10 + 2 * R32 + 0.6, y1), 'b1.m1': at(10, 31.5) },
    });
    const s = play(g, select('a1', 'A'), pileIn('a1', 'A'));
    play(s, attacks('a1', 'A', [{ modelId: 'a1.m2', weapon: 'Close combat weapon', attacks: 2, targetUnitId: 'b1' }]));
    expectRejected(s, attacks('a1', 'A', [{ modelId: 'a1.m3', weapon: 'Close combat weapon', attacks: 2, targetUnitId: 'b1' }]), 'cannot-fight');
  });

  test('[TS §7.3] a model makes attacks equal to its Attacks, split however it likes across its melee weapons', () => {
    const g = cgame({ a: [unitInput('a1', brawlers(), 1)], b: [unitInput('b1', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5) } });
    const s = play(g, select('a1', 'A'), pileIn('a1', 'A'));
    play(s, attacks('a1', 'A', [{ modelId: 'a1.m1', weapon: 'Chainsword', attacks: 2, targetUnitId: 'b1' }, { modelId: 'a1.m1', weapon: 'Power fist', attacks: 1, targetUnitId: 'b1' }]));
    expectRejected(s, attacks('a1', 'A', [{ modelId: 'a1.m1', weapon: 'Chainsword', attacks: 2, targetUnitId: 'b1' }]), 'wrong-attack-count');
    expectRejected(s, attacks('a1', 'A', [{ modelId: 'a1.m1', weapon: 'Close combat weapon', attacks: 3, targetUnitId: 'b1' }]), 'no-such-weapon');
  });

  test('[TS §7.3] a model with no melee weapon fights with a close combat weapon: S User, AP 0, D 1', () => {
    const g = cgame({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5) }, windows: true });
    const s = stateOf(play(g, select('a1', 'A'), pileIn('a1', 'A'), attacks('a1', 'A', [{ modelId: 'a1.m1', weapon: 'Close combat weapon', attacks: 3, targetUnitId: 'b1' }])));
    expect(s.attack!.groups[0].weapon).toMatchObject({ name: 'Close combat weapon', s: { kind: 'user' }, ap: 0, d: { n: 0, sides: 6, plus: 1 } });
    expect(s.attack!.attacks).toBe(3);
  });

  test('[TS §7.3] a charging unit can only attack units it charged or that Heroically Intervened', () => {
    const g = setTurnFlag(
      setTurnFlag(
        game({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1), unitInput('b2', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5), 'b2.m1': at(11.5, 30.6) } }),
        'a1',
        'charged',
        true,
      ),
      'a1',
      'chargeTargets',
      ['b1'],
    );
    const s = play(g, select('a1', 'A'), pileIn('a1', 'A'));
    expectRejected(s, attacks('a1', 'A', [{ modelId: 'a1.m1', weapon: 'Close combat weapon', attacks: 3, targetUnitId: 'b2' }]), 'not-a-charge-target');
    play(setTurnFlag(s, 'b2', 'heroic', true), attacks('a1', 'A', [{ modelId: 'a1.m1', weapon: 'Close combat weapon', attacks: 3, targetUnitId: 'b2' }]));
  });

  test('[TR §3.3] Set to Defend: +1 to hit in the next Fight phase', () => {
    let g = game({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5) }, dice: [3, 6, 1] });
    g = play(g, { type: 'addEffect', by: 'B', effect: { unitId: 'b1', side: 'attacking', effect: { kind: 'mod', roll: 'hit', value: 1 }, until: 'fight', note: 'Set to Defend' } } as Command);
    // B's guardsman (WS4+) hits on a 3 thanks to the +1, wounds on a 6 and the marine fails its save on a 1.
    g = play(g, ...fight('b1', 'B', [{ modelId: 'b1.m1', weapon: 'Close combat weapon', attacks: 1, targetUnitId: 'a1' }]));
    expect(stateOf(g).models['a1.m1'].woundsLeft).toBe(1);
  });

  test('[TS §7.3] consolidating can move a unit into a new combat, which then becomes eligible to fight', () => {
    let g = game({
      a: [unitInput('a1', marines(), 1), unitInput('a2', marines(), 1)],
      b: [unitInput('b1', guardsmen(), 1)],
      at: { 'a1.m1': at(30, 20), 'b1.m1': at(10, 31.5), 'a2.m1': at(10, 30) },
    });
    // b1 fights a2, then consolidates 3" towards a1? No: towards the closest enemy (a2). a1 isn't engaged: not eligible.
    expect(fightOrder(stateOf(g)).selectable).toEqual(['b1']);
    g = teleport(g, { 'a1.m1': at(14, 31.5) });
    g = play(g, ...fight('b1', 'B'));
    expect(fightOrder(stateOf(g)).selectable).toEqual(['a2']);
    g = play(g, select('a2', 'A'), pileIn('a2', 'A'), attacks('a2', 'A', []), consolidate('a2', 'A', {}));
    g = play(g, { type: 'testTeleport', by: 'A', positions: { 'a1.m1': at(11.6, 31.6) } } as never);
    expect(fightOrder(stateOf(g)).selectable).toEqual(['a1']);
  });

  test('[TS §7.3] a consolidation must end closer to the closest enemy model', () => {
    const g = cgame({ a: [unitInput('a1', marines(), 1)], b: [unitInput('b1', guardsmen(), 1), unitInput('b2', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5), 'b2.m1': at(14, 31.5) } }, ['b1', 'b2']);
    const s = play(g, select('a1', 'A'), pileIn('a1', 'A'), attacks('a1', 'A', []));
    expectRejected(s, consolidate('a1', 'A', { 'a1.m1': { to: at(10, 27.5) } }), 'not-closer');
  });

  test('[TS §7.3] the captain\'s power sword is S+1 AP-3', () => {
    const g = cgame({ a: [unitInput('a1', captain(), 1)], b: [unitInput('b1', guardsmen(), 1)], at: { 'a1.m1': at(10, 30), 'b1.m1': at(10, 31.5) }, windows: true });
    const s = stateOf(play(g, select('a1', 'A'), pileIn('a1', 'A'), attacks('a1', 'A', [{ modelId: 'a1.m1', weapon: 'Power sword', attacks: 4, targetUnitId: 'b1' }])));
    expect(s.attack!.groups[0].weapon.ap).toBe(-3);
  });
});
