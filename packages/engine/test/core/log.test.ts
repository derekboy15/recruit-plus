import { describe, expect, test } from 'vitest';
import { currentStep, describedEventTypes, describeEvent, eligibleUnits, EngineLoadError, gameLog, loadGame, registeredEventTypes, saveGame, stateOf, type Command } from '../../src';
import { guardsmen, marines } from '../fixtures/units';
import { deploy, FULL_ZONES, line, newTestGame, placeAll, play, setTurnFlag, shift, unitInput } from '../helpers/game';

const game = (o: Parameters<typeof newTestGame>[0] = {}) =>
  placeAll(newTestGame({ zones: FULL_ZONES(), a: [unitInput('a1', marines(), 5), unitInput('a2', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)], ...o }), {
    a1: line(5, 30, 'a1'),
    a2: line(20, 30, 'a2'),
    b1: line(5, 38, 'b1'),
  });

describe('game log', () => {
  test('every event type has a plain-English description (or is marked as bookkeeping)', () => {
    // test helpers register their own test-only events ('test…')
    const missing = registeredEventTypes().filter((t) => !t.startsWith('test') && !describedEventTypes().includes(t));
    expect(missing).toEqual([]);
  });

  test('the log of a short game reads in order', () => {
    let g = play(game({ dice: [4] }), { type: 'endPhase', by: 'A' } as Command, { type: 'beginMove', by: 'A', unitId: 'a1', kind: 'advance' } as Command);
    g = play(g, { type: 'completeMove', by: 'A', unitId: 'a1', moves: shift(g, 'a1', 0, -5) } as Command);
    const text = gameLog(g).map((l) => l.text);
    expect(text).toContain('Army B set up Infantry Squad.');
    expect(text).toContain('Battle round 1: Army A\'s Command phase.');
    expect(text).toContain('Army A gained 1 CP (Battle-forged CP bonus): now 7.');
    expect(text).toContain('Intercessor Squad Advanced (rolled 4: up to 10").');
    expect(text.indexOf('Battle round 1: Army A\'s Movement phase.')).toBeLessThan(text.indexOf('Intercessor Squad Advanced (rolled 4: up to 10").'));
    expect(gameLog(g).every((l) => typeof l.seq === 'number' && l.round >= 0)).toBe(true);
  });

  test('model losses are described with the unit name', () => {
    const g = play(game(), { type: 'inflictMortalWounds', by: 'B', unitId: 'a1', count: 4 } as Command);
    expect(gameLog(g).map((l) => l.text)).toContain('Intercessor Squad lost 2 models (mortal wounds).');
  });
});

/** Deploys a1 and b1 in turn, leaving the game at the first-turn step. */
function placeAllButBattle(g: ReturnType<typeof newTestGame>) {
  for (let i = 0; i < 2; i++) {
    const s = stateOf(g);
    const id = s.deploy.next === 'A' ? 'a1' : 'b1';
    g = play(g, deploy(s.deploy.next, id, line(5, s.deploy.next === 'A' ? 30 : 38, id)));
  }
  return g;
}

describe('queries for the board and lessons', () => {
  test('currentStep names the player who must act on a roll', () => {
    const g = play(game({ windows: true }), { type: 'endPhase', by: 'A' } as Command, { type: 'beginMove', by: 'A', unitId: 'a1', kind: 'advance' } as Command);
    expect(currentStep(stateOf(g))).toMatchObject({ round: 1, phase: 'movement', step: 'move-units', actingPlayer: 'A', involvedUnitIds: ['a1'] });
    expect(currentStep(stateOf(g)).pending).toMatchObject({ kind: 'roll' });
  });

  test('[MP §4] during deployment the player due to set up a unit acts; then the roll-off winner chooses', () => {
    const fresh = newTestGame({ zones: FULL_ZONES(), a: [unitInput('a1', marines(), 5), unitInput('a2', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)], firstTurn: null });
    const s0 = stateOf(fresh);
    expect(currentStep(s0).actingPlayer).toBe(s0.deploy.next);
    const g = play(fresh, deploy(s0.deploy.next, s0.deploy.next === 'A' ? 'a1' : 'b1', line(5, s0.deploy.next === 'A' ? 30 : 38, s0.deploy.next === 'A' ? 'a1' : 'b1')));
    const s1 = stateOf(g);
    expect(s1.deploy.next).not.toBe(s0.deploy.next);
    expect(currentStep(s1).actingPlayer).toBe(s1.deploy.next);
    // Core Book rules: the roll-off winner chooses who goes first.
    let core = placeAllButBattle(newTestGame({ zones: FULL_ZONES(), size: 'combat-patrol', a: [unitInput('a1', marines(), 5)], b: [unitInput('b1', guardsmen(), 5)], firstTurn: null }));
    core = play(core, { type: 'rollOffFirstTurn', by: stateOf(core).active } as Command);
    const s2 = stateOf(core);
    expect(s2.firstPlayer).toBeNull();
    expect(currentStep(s2).actingPlayer).toBe(s2.rollOffWinner);
  });

  test('[TS §8.1] with no Morale tests to take, the player whose turn it is acts (only they can end the phase)', () => {
    let g = game();
    for (let i = 0; i < 6; i++) g = play(g, { type: 'endPhase', by: 'A' } as Command);
    expect(stateOf(g)).toMatchObject({ phase: 'morale', step: 'morale-tests', active: 'A' });
    expect(currentStep(stateOf(g)).actingPlayer).toBe('A');
  });

  test('[TS §7.1] with no unit left to fight, the player whose turn it is acts', () => {
    let g = game();
    for (let i = 0; i < 5; i++) g = play(g, { type: 'endPhase', by: 'A' } as Command);
    const s = stateOf(g);
    expect(s).toMatchObject({ phase: 'fight', active: 'A' });
    for (const picker of ['A', 'B'] as const) expect(currentStep({ ...s, fight: { picker, next: null } }).actingPlayer).toBe('A');
  });

  test('eligibleUnits("charge") leaves out units that Advanced', () => {
    let g = game();
    for (let i = 0; i < 4; i++) g = play(g, { type: 'endPhase', by: 'A' } as Command);
    expect(eligibleUnits(stateOf(g), 'charge').sort()).toEqual(['a1', 'a2']);
    expect(eligibleUnits(stateOf(setTurnFlag(g, 'a1', 'moved', 'advance')), 'charge')).toEqual(['a2']);
  });

  test('eligibleUnits("move") lists the active player\'s units that can still move', () => {
    const g = play(game(), { type: 'endPhase', by: 'A' } as Command, { type: 'remainStationary', by: 'A', unitId: 'a1' } as Command);
    expect(eligibleUnits(stateOf(g), 'move')).toEqual(['a2']);
  });
});

describe('loading saved games safely', () => {
  test('loadGame refuses an unknown event type without throwing mid-replay', () => {
    const g = game();
    const raw = JSON.parse(saveGame(g));
    raw.batches[0].events.push({ type: 'somethingFromTheFuture' });
    expect(() => loadGame(JSON.stringify(raw))).toThrow(EngineLoadError);
    expect(() => loadGame(JSON.stringify(raw))).toThrow(/can't read/);
  });

  test('loadGame refuses a record without a setup', () => {
    expect(() => loadGame(JSON.stringify({ schema: 1, batches: [] }))).toThrow('The saved game has no setup.');
  });

  test('loadGame refuses text that is not JSON', () => {
    expect(() => loadGame('not a game')).toThrow(EngineLoadError);
  });
});

export { guardsmen };

describe('objective names in the log', () => {
  const base = stateOf(newTestGame({}));
  const withObjectives = (...os: { id: string; label?: string }[]) => ({ ...base, setup: { ...base.setup, objectives: os.map((o) => ({ ...o, pos: { x: 1, y: 1 } })) } });
  const event = (objectiveId: string) => ({ type: 'objectiveSet', objectiveId, owner: null, sticky: false }) as never;

  test('an objective with a real label is named by its label', () => {
    expect(describeEvent(event('x'), withObjectives({ id: 'c', label: 'Centre' }, { id: 'x', label: 'Relic' }))).toBe("Objective Relic is now nobody's.");
  });

  test('an objective with only an id is numbered in setup order, as the Practice screens show it', () => {
    expect(describeEvent(event('n1'), withObjectives({ id: 'a' }, { id: 'b' }, { id: 'n1' }))).toBe("Objective 3 is now nobody's.");
  });

  test("a turned map's compass-code label is numbered too", () => {
    expect(describeEvent(event('nw'), withObjectives({ id: 'a' }, { id: 'nw', label: 'ne' }))).toBe("Objective 2 is now nobody's.");
  });
});
