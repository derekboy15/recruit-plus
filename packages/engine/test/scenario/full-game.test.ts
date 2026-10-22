import { describe, expect, test } from 'vitest';
import {
  dispatch,
  gameLog,
  loadGame,
  missionRulesFor,
  newGame,
  saveGame,
  stateOf,
  TERRAIN_PRESETS,
  type Command,
  type GameRecord,
  type GameSetup,
  type UnitInput,
} from '../../src';
import { toDatasheet } from '../../src/data/adapter';
import { autoPlayUntil } from '../helpers/driver';
import { line, placeAll, play } from '../helpers/game';
import { realUnit } from '../helpers/realData';

const sheet = (cat: string, name: string) => {
  const { unit, catalogueName } = realUnit(cat, name);
  return toDatasheet(unit, catalogueName).datasheet;
};
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** Necron Warriors (one unit in Strategic Reserves) against Ultramarines Intercessors and a Librarian, two ruins, four objectives. */
function setup(seed: number): GameSetup {
  const warriors = sheet('Necrons', 'Necron Warriors');
  const intercessors = sheet('Imperium - Adeptus Astartes - Ultramarines', 'Intercessor Squad');
  const librarian = sheet('Imperium - Adeptus Astartes - Ultramarines', 'Librarian');
  const necrons = (id: string): UnitInput => ({ id, datasheet: warriors, models: [{ profile: 'Necron Warrior', weapons: ['Gauss Flayer'], count: 10 }] });
  return {
    seed,
    battleSize: 'strike-force',
    rules: missionRulesFor('strike-force'),
    board: { w: 44, h: 60 },
    armies: [
      { player: 'A', name: 'Szarekhan Dynasty', units: [necrons('w1'), necrons('w2'), necrons('w3')], cpSpentPreBattle: 0 },
      {
        player: 'B',
        name: 'Ultramarines',
        units: [
          { id: 'i1', datasheet: intercessors, models: [{ profile: 'Intercessor Sergeant', weapons: ['Bolt rifle', 'Bolt pistol'], count: 1 }, { profile: 'Intercessor', weapons: ['Bolt rifle', 'Bolt pistol'], count: 4 }] },
          { id: 'i2', datasheet: intercessors, models: [{ profile: 'Intercessor Sergeant', weapons: ['Bolt rifle', 'Bolt pistol'], count: 1 }, { profile: 'Intercessor', weapons: ['Bolt rifle', 'Bolt pistol'], count: 4 }] },
          { id: 'lib', datasheet: librarian, models: [{ profile: 'Librarian', weapons: ['Bolt pistol', 'Force sword'], count: 1 }] },
        ],
        cpSpentPreBattle: 0,
      },
    ],
    terrain: [
      { id: 'r1', name: 'Ruin', ...TERRAIN_PRESETS.ruins, footprint: rect(8, 26, 14, 32), height: 6 },
      { id: 'r2', name: 'Ruin', ...TERRAIN_PRESETS.ruins, footprint: rect(30, 28, 36, 34), height: 6 },
    ],
    objectives: [
      { id: 'o1', pos: { x: 22, y: 6 } },
      { id: 'o2', pos: { x: 6, y: 30 } },
      { id: 'o3', pos: { x: 38, y: 30 } },
      { id: 'o4', pos: { x: 22, y: 54 } },
    ],
    zones: { A: rect(0, 0, 44, 12), B: rect(0, 48, 44, 60) },
    edges: { A: 'south', B: 'north' },
    attacker: 'A',
    firstTurn: 'A',
    settings: { rollWindows: false, reactions: true },
  };
}

function deployed(seed: number): GameRecord {
  const g = play(newGame(setup(seed)), { type: 'declareReserves', by: 'A', unitIds: ['w3'], kind: 'strategic' } as Command);
  return placeAll(g, { w1: line(6, 10, 'w1', 10), w2: line(26, 10, 'w2', 10), i1: line(10, 49, 'i1'), i2: line(26, 49, 'i2'), lib: { 'lib.m1': { x: 20, y: 50, z: 0, rot: 0 } } });
}

const events = (g: GameRecord) => g.batches.flatMap((b) => b.events.map((e) => e.type));

describe('a full game', () => {
  const game = autoPlayUntil(deployed(7), 3);

  test('[TS §1.9] two battle rounds go through every phase with real units', () => {
    const s = stateOf(game);
    expect(s).toMatchObject({ round: 3, turn: 'first', phase: 'command' });
    const seen = new Set(events(game));
    for (const t of ['unitDeployed', 'cpChanged', 'unitMoved', 'unitArrived', 'unitShot', 'psychicAttempt', 'woundsLost', 'phaseChanged']) expect(seen, t).toContain(t);
    expect(s.units.w3.location).toBe('battlefield'); // arrived from Strategic Reserves in round 2
  });

  test('[R-19] a saved game replays to exactly the same state', () => {
    const loaded = loadGame(saveGame(game));
    expect(stateOf({ ...loaded })).toEqual(stateOf(game));
  });

  test('[R-19] taking back the last five commands and making them again gives the same record', () => {
    const cut: GameRecord = { ...game, batches: game.batches.slice(0, -5) };
    let again = cut;
    for (const b of game.batches.slice(-5)) {
      const r = dispatch(again, b.command);
      if (!r.ok) throw new Error(r.problems[0].message);
      again = r.game;
    }
    expect(again.batches).toEqual(game.batches);
  });

  test('[TS §1.6] the same seed and the same commands give the same game', () => {
    expect(saveGame(autoPlayUntil(deployed(7), 3))).toEqual(saveGame(game));
    expect(saveGame(autoPlayUntil(deployed(8), 3))).not.toEqual(saveGame(game));
  });

  test('[TS §1.9] the game log of battle round 2 reads as plain English', () => {
    const lines = gameLog(game).filter((l) => l.round === 2).map((l) => l.text);
    expect(lines[0]).toBe("Battle round 2: Szarekhan Dynasty's Command phase.");
    expect(lines.some((l) => /arrived on the battlefield/.test(l))).toBe(true);
    expect(lines).toMatchSnapshot();
  });

  test('[MP §4] five battle rounds play to the end quickly', () => {
    const start = performance.now();
    const g = autoPlayUntil(deployed(11), 99);
    const ms = performance.now() - start;
    expect(stateOf(g).phase).toBe('ended');
    expect(stateOf(g).ended?.reason).toBe('battle-rounds');
    expect(ms).toBeLessThan(2_000);
    // Every phase did real work: charges with Overwatch, fights with Counter-offensive, Morale, scoring.
    const seen = new Set(events(g));
    for (const t of ['unitMoved', 'unitArrived', 'psychicAttempt', 'unitShot', 'chargeDeclared', 'chargeReaction', 'stratagemUsed', 'unitCharged', 'unitFought', 'counterOffensive', 'moraleTested', 'vpScored', 'gameEnded'])
      expect(seen, t).toContain(t);
    const s = stateOf(g);
    const survivors = Object.fromEntries(Object.values(s.units).map((u) => [u.id, u.modelIds.filter((id) => !s.models[id].destroyed).length]));
    expect({ cp: s.cp, vp: s.vp, survivors, winner: s.ended?.winner }).toMatchSnapshot();
    console.log(`5-round game: ${g.batches.length} commands in ${Math.round(ms)} ms`);
  });
});
