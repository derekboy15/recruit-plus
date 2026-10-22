import { describe, expect, test } from 'vitest';
import type { PackOut } from '@recruit/data/missions';
import { activePlayer, deriveState, makeEvent, nextPos, undo, type EventBody, type Pos, type TableGameData, type TableSetup } from './game';

const pack = (concede: PackOut['concede'] = 'opponent-wins'): PackOut => ({
  id: concede === 'opponent-wins' ? 'arks-of-omen' : 'core-book', name: 'x', battleSizes: ['incursion'], startingCp: { incursion: 6 },
  caps: { primary: 45, secondaryEach: 15, secondaryTotal: 45, battleReady: 10 }, defaultSecondaries: [], maxPerCategory: 1, secondaryCount: 3,
  firstTurn: 'winner-takes-first', concede, setupSteps: [], secondaries: [], source: 't',
});
const setup = (o: Partial<TableSetup> = {}): TableSetup => ({
  battleSize: 'incursion', pack: 'arks-of-omen', missionId: 'aoo-cleanse-the-land', attacker: 'A', firstTurn: 'A',
  players: {
    A: { name: 'You', catalogueSlug: 'necrons', secondaries: ['s1', 's2', 's3'], battleReady: false, startingCp: 6 },
    B: { name: 'Opponent', catalogueSlug: 'orks', secondaries: ['t1', 't2', 't3'], battleReady: false, startingCp: 6 },
  },
  ...o,
});
const START: Pos = { round: 1, turn: 1, phase: 'command' };
const game = (events: EventBody[], s = setup()): TableGameData => ({
  mode: 'table', schema: 1, setup: s, events: [makeEvent({ t: 'start' }, null), ...events.map((e) => makeEvent(e, START))],
});
const vp = (player: 'A' | 'B', n: number, category: 'primary' | 'secondary' = 'primary', sourceId = 'hold') => ({ t: 'vp' as const, player, category, sourceId, vp: n, detail: '' });

describe('positions', () => {
  test('nextPos walks command → morale, then turn 2, then round +1; null after the last', () => {
    expect(nextPos({ round: 1, turn: 1, phase: 'command' })).toEqual({ round: 1, turn: 1, phase: 'movement' });
    expect(nextPos({ round: 1, turn: 1, phase: 'morale' })).toEqual({ round: 1, turn: 2, phase: 'command' });
    expect(nextPos({ round: 1, turn: 2, phase: 'morale' })).toEqual({ round: 2, turn: 1, phase: 'command' });
    expect(nextPos({ round: 5, turn: 2, phase: 'morale' })).toBeNull();
    const all: Pos[] = [];
    for (let p: Pos | null = START; p; p = nextPos(p)) all.push(p);
    expect(all).toHaveLength(5 * 2 * 7);
  });
  test('activePlayer follows firstTurn', () => {
    expect(activePlayer(setup({ firstTurn: 'B' }), { round: 1, turn: 1, phase: 'command' })).toBe('B');
    expect(activePlayer(setup({ firstTurn: 'B' }), { round: 3, turn: 2, phase: 'fight' })).toBe('A');
  });
  test('the start event puts the game at round 1, turn 1, Command phase', () => {
    const s = deriveState(game([]), pack());
    expect(s.started).toBe(true);
    expect(s.pos).toEqual(START);
    expect(s.active).toBe('A');
    expect(s.ended).toBeNull();
  });
  test('advance moves the position', () => {
    const to: Pos = { round: 1, turn: 1, phase: 'movement' };
    expect(deriveState(game([{ t: 'advance', to }]), pack()).pos).toEqual(to);
  });
});

describe('CP', () => {
  test('startingCp then stratagem spends', () => {
    const g = game([{ t: 'cp', player: 'A', delta: 1, reason: 'bonus' }, { t: 'stratagem', player: 'A', stratagemId: 'x', name: 'Fire Overwatch', cp: 1 }, { t: 'cp', player: 'A', delta: -1, reason: 'stratagem' }]);
    expect(deriveState(g, pack()).players.A.cp).toBe(6);
    expect(deriveState(g, pack()).players.B.cp).toBe(6);
  });
  test('cp never below 0', () => {
    const g = game([{ t: 'cp', player: 'B', delta: -9, reason: 'manual' }, { t: 'cp', player: 'B', delta: 2, reason: 'manual' }]);
    expect(deriveState(g, pack()).players.B.cp).toBe(2);
  });
});

describe('VP', () => {
  test('a loss never takes the total below 0', () => {
    const g = game([vp('A', 1), vp('A', -1), vp('A', -1)]);
    expect(deriveState(g, pack()).players.A.total).toBe(0);
    expect(deriveState(game([vp('A', 2, 'secondary', 's1'), vp('A', -1)]), pack()).players.A.total).toBe(1);
  });
  test('undo of a clamped loss restores the total', () => {
    const g = game([vp('A', 3), vp('A', -1), vp('A', -1), vp('A', -1), vp('A', -1)]);
    expect(deriveState(g, pack()).players.A.total).toBe(0);
    expect(deriveState(undo(g), pack()).players.A.total).toBe(0);
    expect(deriveState(undo(undo(g)), pack()).players.A.total).toBe(1);
  });
  test('primary over 45 is capped in the total', () => {
    const g = game(Array.from({ length: 5 }, () => vp('A', 12)));
    const s = deriveState(g, pack());
    expect(s.players.A.primary).toBe(45);
    expect(s.players.A.total).toBe(45);
  });
  test('a loss after the primary cap comes off the capped 45', () => {
    const s = deriveState(game([vp('A', 12), vp('A', 12), vp('A', 12), vp('A', 12), vp('A', -1)]), pack());
    expect(s.players.A.primary).toBe(44);
    expect(s.players.A.total).toBe(44);
  });
  test('a loss after a secondary cap comes off the capped 15', () => {
    const sec = (n: number) => vp('A', n, 'secondary', 's1');
    const s = deriveState(game([sec(5), sec(5), sec(5), sec(5), sec(-1)]), pack());
    expect(s.players.A.secondary.s1).toBe(14);
  });
  test('secondary capped at 15 each', () => {
    const g = game([vp('B', 10, 'secondary', 't1'), vp('B', 8, 'secondary', 't1'), vp('B', 4, 'secondary', 't2')]);
    const s = deriveState(g, pack());
    expect(s.players.B.secondary).toEqual({ t1: 15, t2: 4 });
    expect(s.players.B.total).toBe(19);
  });
  test('battle ready adds 10', () => {
    const s = setup();
    s.players.A.battleReady = true;
    const st = deriveState(game([vp('A', 4)], s), pack());
    expect(st.players.A.battleReady).toBe(10);
    expect(st.players.A.total).toBe(14);
  });
  test('concede under core-book shows 0 for the conceder', () => {
    const g = game([vp('A', 8), vp('B', 4), { t: 'end', reason: 'concede', concededBy: 'A' }], setup({ pack: 'core-book' }));
    const s = deriveState(g, pack('conceder-scores-0'));
    expect(s.players.A.total).toBe(0);
    expect(s.players.B.total).toBe(4);
    expect(s.ended?.t).toBe('end');
    expect(deriveState(g, pack('opponent-wins')).players.A.total).toBe(8);
  });
});

describe('stratagems and undo', () => {
  test('stratagemsThisPhase resets on advance', () => {
    const used = { t: 'stratagem' as const, player: 'A' as const, stratagemId: 'x', name: 'Command Re-roll', cp: 1 };
    expect(deriveState(game([used]), pack()).stratagemsThisPhase).toEqual([{ player: 'A', name: 'Command Re-roll' }]);
    expect(deriveState(game([used, { t: 'advance', to: { round: 1, turn: 1, phase: 'movement' } }]), pack()).stratagemsThisPhase).toEqual([]);
  });
  test('undo of an automatic Command phase CP bonus also undoes entering the phase', () => {
    const morale: Pos = { round: 1, turn: 1, phase: 'morale' };
    const command: Pos = { round: 1, turn: 2, phase: 'command' };
    const g: TableGameData = {
      mode: 'table', schema: 1, setup: setup(),
      events: [
        makeEvent({ t: 'start' }, null),
        makeEvent({ t: 'advance', to: morale }, START),
        makeEvent({ t: 'vp', player: 'A', category: 'primary', sourceId: 'x', vp: 2, detail: '' }, morale),
        makeEvent({ t: 'advance', to: command }, morale),
        makeEvent({ t: 'roll', label: 'Supply Lines (You)', sides: 6, dice: [2], auto: true }, command),
        makeEvent({ t: 'cp', player: 'A', delta: 0, reason: 'bonus', auto: true }, command),
        makeEvent({ t: 'cp', player: 'B', delta: 1, reason: 'bonus', auto: true }, command),
      ],
    };
    const u = undo(g);
    expect(u.events.map((e) => e.t)).toEqual(['start', 'advance', 'vp']);
    expect(deriveState(u, pack()).pos).toEqual(morale);
    expect(deriveState(undo(u), pack()).players.A.total).toBe(0);
  });
  test('undo of a dice roll in the Command phase only removes the roll', () => {
    const g = game([{ t: 'roll', label: 'Dice', sides: 6, dice: [3] }]);
    expect(undo(g).events.map((e) => e.t)).toEqual(['start']);
    const g2 = game([{ t: 'cp', player: 'A', delta: 1, reason: 'bonus', auto: true }, { t: 'roll', label: 'Dice', sides: 6, dice: [3] }]);
    expect(undo(g2).events.map((e) => e.t)).toEqual(['start', 'cp']);
  });
  test('undo never removes start', () => {
    const g = game([]);
    expect(undo(g).events).toHaveLength(1);
    expect(undo(game([vp('A', 1)])).events.map((e) => e.t)).toEqual(['start']);
  });
  test('makeEvent stamps an id, a time and the position', () => {
    const e = makeEvent({ t: 'note', text: 'hi' }, START);
    expect(e.id).toMatch(/\S{8,}/);
    expect(new Date(e.at).getTime()).not.toBeNaN();
    expect(e.pos).toEqual(START);
  });
});
