import { describe, expect, test } from 'vitest';
import { stateOf, type Command, type GameRecord, type Pos } from '../../src';
import { guardsmen, marines, psyker } from '../fixtures/units';
import { at, expectRejected, FULL_ZONES, line, newTestGame, placeAll, play, setTurnFlag, unitInput, type TestGameOpts } from '../helpers/game';

const manifest = (unitId: string, power: string, extra: object = {}) => ({ type: 'manifest', by: 'A', unitId, power, ...extra }) as Command;
const events = (g: GameRecord, type: string) => g.batches.flatMap((b) => b.events).filter((e) => e.type === type) as unknown as Record<string, unknown>[];

/** A: two Librarians (p1, p2) and marines; B: guardsmen 15" from p1 and a Librarian (bp) about 21" away. Skips to A's Psychic phase. */
function game(o: TestGameOpts & { bpAt?: Pos } = {}): GameRecord {
  let g = newTestGame({
    zones: FULL_ZONES(),
    a: [unitInput('p1', psyker()), unitInput('p2', psyker()), unitInput('a1', marines(), 5)],
    b: [unitInput('b1', guardsmen(), 5), unitInput('bp', psyker())],
    ...o,
  });
  g = placeAll(g, { p1: { 'p1.m1': at(20, 10) }, p2: { 'p2.m1': at(25, 10) }, a1: line(10, 5, 'a1'), b1: line(15, 25, 'b1'), bp: { 'bp.m1': o.bpAt ?? at(30, 30) } });
  return play(g, { type: 'endPhase', by: 'A' } as Command, { type: 'endPhase', by: 'A' } as Command);
}
const hurt = (g: GameRecord, unit: string) => {
  const s = stateOf(g);
  return s.units[unit].modelIds.reduce((a, id) => a + (s.models[id].destroyed ? 1000 : 0) + (s.models[id].woundsLeft < 5 && unit.startsWith('p') ? 5 - s.models[id].woundsLeft : 0), 0);
};

describe('manifesting powers', () => {
  test('[PP §4] a power is manifested on 2D6 at least its warp charge', () => {
    expect(events(play(game({ dice: [3, 3] }), manifest('p1', 'Veil of Time')), 'powerManifested')).toHaveLength(1);
    expect(events(play(game({ dice: [2, 3] }), manifest('p1', 'Veil of Time')), 'powerManifested')).toHaveLength(0);
  });

  test('[PP §5] Smite\'s warp charge goes up by 1 for each other Smite attempt by your army this phase', () => {
    const g = play(game({ dice: [2, 3, 4, 2, 3] }), manifest('p1', 'Smite'), manifest('p2', 'Smite'));
    expect(events(g, 'psychicAttempt').map((e) => e.wc)).toEqual([5, 6]);
    expect(events(g, 'powerManifested')).toHaveLength(1);
  });

  test('[PP §5] each psyker attempts Smite once per battle round', () => {
    expectRejected(play(game({ dice: [1, 2] }), manifest('p1', 'Smite')), manifest('p1', 'Smite'), 'smite-once');
  });

  test('[PP §4] the army attempts each other power once per battle round', () => {
    expectRejected(play(game({ dice: [1, 2] }), manifest('p1', 'Veil of Time')), manifest('p2', 'Veil of Time'), 'power-once-per-round');
  });

  test('[PP §2] a psyker that Fell Back can not manifest powers', () => {
    expectRejected(setTurnFlag(game(), 'p1', 'moved', 'fall-back'), manifest('p1', 'Smite'), 'fell-back');
  });

  test('[PP §2] all of one psyker\'s attempts are made before the next psyker', () => {
    const g = play(game({ dice: [1, 2, 1, 2] }), manifest('p1', 'Smite'), manifest('p2', 'Smite'));
    expectRejected(g, manifest('p1', 'Veil of Time'), 'psyker-done');
  });

  test('[PP §2] a psyker attempts as many powers as its datasheet allows', () => {
    const g = play(game({ dice: [1, 2, 1, 2] }), manifest('p1', 'Smite'), manifest('p1', 'Veil of Time'));
    expectRejected(g, manifest('p1', 'Quickening', { wc: 6 }), 'no-attempts-left');
  });

  test('[PP §4] a power the profile doesn\'t list needs its warp charge', () => {
    expectRejected(game(), manifest('p1', 'Quickening'), 'unknown-power');
    play(game({ dice: [1, 2] }), manifest('p1', 'Quickening', { wc: 6 }));
  });
});

describe('Deny the Witch', () => {
  test('[PP §4] Deny the Witch must beat the Psychic test: a tie fails', () => {
    let g = play(game({ reactions: true, dice: [3, 4, 3, 4] }), manifest('p1', 'Veil of Time'));
    expect(stateOf(g).pending).toMatchObject({ kind: 'reaction', reaction: 'deny', player: 'B' });
    g = play(g, { type: 'respond', by: 'B', choice: 'deny:bp' } as Command);
    expect(events(g, 'powerManifested')).toHaveLength(1);
    const g2 = play(play(game({ reactions: true, dice: [3, 4, 4, 4] }), manifest('p1', 'Veil of Time')), { type: 'respond', by: 'B', choice: 'deny:bp' } as Command);
    expect(events(g2, 'powerManifested')).toHaveLength(0);
    expect(events(g2, 'powerDenied')).toHaveLength(1);
  });

  test('[PP §4] only a psyker within 24" can deny', () => {
    const g = play(game({ reactions: true, dice: [3, 4], bpAt: at(40, 55) }), manifest('p1', 'Veil of Time'));
    expect(stateOf(g).pending).toBeNull();
    expect(events(g, 'powerManifested')).toHaveLength(1);
  });

  test('[CS §2] Command Re-roll on a Psychic test re-rolls both dice', () => {
    let g = play(game({ windows: true, dice: [1, 2, 3, 4] }), manifest('p1', 'Veil of Time'));
    g = play(g, { type: 'reroll', by: 'A', dice: [0], source: 'command-reroll' } as Command, { type: 'confirmRoll', by: 'A' } as Command);
    expect(events(g, 'powerManifested')).toHaveLength(1);
  });

  test('[PP §7] a psychic action can be denied', () => {
    let g = play(game({ reactions: true, dice: [2, 2, 5, 5] }), { type: 'psychicAction', by: 'A', unitId: 'p1', action: 'Warp Ritual', wc: 4 } as Command);
    g = play(g, { type: 'respond', by: 'B', choice: 'deny:bp' } as Command);
    expect(events(g, 'psychicActionCompleted')).toHaveLength(0);
    expect(events(g, 'powerDenied')).toHaveLength(1);
  });
});

describe('Perils of the Warp and Smite', () => {
  test('[PP §6] a double 1 is Perils of the Warp: D3 mortal wounds, and the power fails', () => {
    const g = play(game({ dice: [1, 1, 6] }), manifest('p1', 'Veil of Time'));
    expect(stateOf(g).models['p1.m1'].woundsLeft).toBe(2);
    expect(events(g, 'powerManifested')).toHaveLength(0);
  });

  test('[PP §6] a double 6 is also Perils, but the power still works if the psyker survives', () => {
    const g = play(game({ dice: [6, 6, 1] }), manifest('p1', 'Veil of Time'));
    expect(stateOf(g).models['p1.m1'].woundsLeft).toBe(4);
    expect(events(g, 'powerManifested')).toHaveLength(1);
  });

  test('[PP §6] a psyker killed by Perils fails the power and every unit within 6" suffers D3 mortal wounds', () => {
    let g = play(game({ dice: [1, 1, 2, 4, 2] }), { type: 'inflictMortalWounds', by: 'B', unitId: 'p1', count: 4 } as Command);
    g = play(g, manifest('p1', 'Veil of Time'));
    const s = stateOf(g);
    expect(s.units.p1.location).toBe('destroyed');
    expect(s.models['p2.m1'].woundsLeft).toBe(3); // p2 is 5" away: D3 (4 → 2)
    expect(events(g, 'powerManifested')).toHaveLength(0);
    expect(hurt(g, 'b1')).toBe(0); // the guardsmen are 15" away
  });

  test('[PP §5] Smite: D3 mortal wounds to the closest visible enemy unit within 18"; D6 on a test of 11+', () => {
    const g = play(game({ dice: [5, 6, 5] }), manifest('p1', 'Smite'));
    const s = stateOf(g);
    expect(s.units.b1.modelIds.filter((id) => s.models[id].destroyed)).toHaveLength(5);
    expect(s.models['bp.m1'].woundsLeft).toBe(5);
  });
});
