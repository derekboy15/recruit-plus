import { describe, expect, test } from 'vitest';
import { join } from 'node:path';
import { loadMissions } from '../src/missions/build';
import { validateMap } from '../src/missions/geometry';
import { cpBonusPlan, dueComponents, scoreComponent, type ComponentInput } from '../src/missions/score';
import type { MissionOut, PlayerKey, ScoringComponent } from '../src/missions/types';
import { extractTokens } from '../src/plain/check';

const missions = loadMissions(join(__dirname, '..', 'missions'));
const byId = (id: string): MissionOut => {
  const m = missions.find((x) => x.id === id);
  if (!m) throw new Error(`no mission ${id}`);
  return m;
};
const comp = (id: string, componentId: string): ScoringComponent => {
  const m = byId(id);
  const all = [...m.primary.components, ...(m.missionSecondary?.components ?? [])];
  const c = all.find((x) => x.id === componentId);
  if (!c) throw new Error(`no component ${componentId} in ${id}: ${all.map((x) => x.id).join(', ')}`);
  return c;
};
const score = (id: string, componentId: string, input: ComponentInput, round = 3, player: PlayerKey = 'A') =>
  scoreComponent(comp(id, componentId), input, { round, player });

/** Every VP value a component can award, for checking against the official text. */
function vpNumbers(c: ScoringComponent): number[] {
  const out: number[] = [];
  if (c.max !== undefined) out.push(c.max);
  if (c.kind === 'hold') return [...out, c.vpPerCondition];
  if (typeof c.combine === 'object') out.push(...c.combine.byCount);
  for (const l of c.lines) {
    if (l.kind === 'flag') out.push(l.vp);
    else if (l.kind === 'count') out.push(...(typeof l.vpEach === 'number' ? [l.vpEach] : Object.values(l.vpEach)));
    else if (l.kind === 'table') out.push(...l.vpByCount);
    else for (const o of l.options) out.push(...Object.values(o.vp).filter((v): v is number => v !== null));
  }
  return out.map(Math.abs).filter((n) => n !== 0);
}
const numbersIn = (text: string) => new Set(extractTokens(text).filter((t) => t.kind === 'num').map((t) => Number(t.value)));

describe.each(missions.map((m) => [m.id, m] as const))('%s', (_id, m) => {
  test('map is consistent', () => {
    expect(validateMap(m.map)).toEqual([]);
  });
  test('texts are non-empty', () => {
    for (const r of [...m.rules, m.primary, ...(m.missionSecondary ? [m.missionSecondary] : [])]) expect(r.text.trim().length, r.name).toBeGreaterThan(20);
  });
  test('every VP number in components appears in the official text', () => {
    const groups: [ScoringComponent[], string][] = [[m.primary.components, m.primary.text]];
    if (m.missionSecondary) groups.push([m.missionSecondary.components ?? [], m.missionSecondary.text]);
    for (const [components, text] of groups) {
      const nums = numbersIn(text);
      for (const c of components) for (const n of vpNumbers(c)) expect(nums.has(n), `${c.id}: ${n}`).toBe(true);
    }
  });
  test('components only use rounds 1-5 and have a source', () => {
    for (const c of [...m.primary.components, ...(m.missionSecondary?.components ?? [])]) {
      expect(c.rounds.length, c.id).toBeGreaterThan(0);
      for (const r of c.rounds) expect([1, 2, 3, 4, 5]).toContain(r);
      expect(c.source, c.id).toMatch(/\S/);
    }
  });
  test('mission secondary is categorised as a mission secondary', () => {
    if (m.missionSecondary) expect(m.missionSecondary.category).toBe('Mission');
  });
});

test('rolls are unique within each pack and battle size', () => {
  const keys = missions.map((m) => `${m.pack}/${m.battleSize}/${m.roll}`);
  expect(new Set(keys).size).toBe(keys.length);
  expect(new Set(missions.map((m) => m.id)).size).toBe(missions.length);
});

describe('Core Book missions', () => {
  test('Combat Patrol and Onslaught missions and their objectives', () => {
    const counts = Object.fromEntries(missions.filter((m) => m.pack === 'core-book').map((m) => [m.id, m.map.objectives.length]));
    expect(counts).toEqual({
      'cb-incisive-attack': 4, 'cb-outriders': 4, 'cb-encircle': 4,
      'cb-lines-of-battle': 6, 'cb-all-out-war': 8, 'cb-pathway-to-glory': 8,
    });
    for (const id of ['cb-incisive-attack', 'cb-outriders', 'cb-encircle']) expect(byId(id).map.board).toEqual({ width: 44, height: 30 });
    for (const id of ['cb-lines-of-battle', 'cb-all-out-war', 'cb-pathway-to-glory']) expect(byId(id).map.board).toEqual({ width: 90, height: 44 });
  });
  test('Incisive Attack: Take and Hold and Surgical Assault', () => {
    expect(score('cb-incisive-attack', 'take-and-hold', { controlled: 1, opponentControlled: 0 }, 2)).toBe(10);
    expect(score('cb-incisive-attack', 'take-and-hold', { controlled: 2, opponentControlled: 1 }, 2)).toBe(15);
    expect(score('cb-incisive-attack', 'surgical-assault', { flags: { enemy: true } }, 1)).toBe(5);
    expect(dueComponents(byId('cb-incisive-attack').primary.components, { at: 'end-of-command-phase', round: 1, activeIsFirst: true })).toEqual([]);
  });
  test('Outriders: Survey from round 2', () => {
    expect(score('cb-outriders', 'survey', { flags: { both: true } }, 2)).toBe(5);
    expect(comp('cb-outriders', 'survey').rounds).toEqual([2, 3, 4, 5]);
  });
  test('Encircle: 3, or 5 with a unit in the enemy zone', () => {
    expect(score('cb-encircle', 'encircle', { flags: { edges: true } })).toBe(3);
    expect(score('cb-encircle', 'encircle', { flags: { edges: true, zone: true } })).toBe(5);
    expect(score('cb-encircle', 'encircle', { flags: { zone: true } })).toBe(0);
  });
  test('Lines of Battle: Unified Advance and Hold the Centre', () => {
    expect(score('cb-lines-of-battle', 'unified-advance', { flags: { one: true, ac: true, abc: true } }, 2)).toBe(15);
    expect(score('cb-lines-of-battle', 'unified-advance', { flags: { one: true } }, 2)).toBe(5);
    expect(score('cb-lines-of-battle', 'hold-the-centre', { flags: { centre: true } }, 2)).toBe(5);
  });
  test('All-out War: Domination and Surround Them', () => {
    expect(score('cb-all-out-war', 'domination', { controlled: 3, opponentControlled: 3 }, 2)).toBe(10);
    expect(score('cb-all-out-war', 'domination', { controlled: 2, opponentControlled: 3 }, 2)).toBe(5);
    expect(score('cb-all-out-war', 'surround-them', { flags: { surround: true, all: true } })).toBe(8);
    expect(score('cb-all-out-war', 'surround-them-end', { flags: { surround: true } }, 5)).toBe(4);
  });
  test('Pathway to Glory: Search for the Portal', () => {
    expect(score('cb-pathway-to-glory', 'search-for-the-portal', { flags: { done: true }, counts: { a: 2 } })).toBe(3);
    expect(score('cb-pathway-to-glory', 'search-for-the-portal', { flags: { done: true }, counts: { a: 6 } })).toBe(5);
    expect(score('cb-pathway-to-glory', 'search-for-the-portal', { counts: { a: 2 } })).toBe(0);
  });
  test('Core Book CP: the active player only', () => {
    for (const m of missions.filter((x) => x.pack === 'core-book')) {
      expect(cpBonusPlan(m.cp, { round: 1, player: 'B', active: 'A' }).base, m.id).toBe(0);
      expect(cpBonusPlan(m.cp, { round: 1, player: 'A', active: 'A' }).base, m.id).toBe(1);
    }
  });
});
