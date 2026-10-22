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
      // "a number of VP equal to the number of …" is 1 VP each without printing a 1.
      if (/VP equal to the number of/.test(text)) nums.add(1);
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

describe('Arks of Omen Incursion missions', () => {
  const inc = () => missions.filter((m) => m.pack === 'arks-of-omen' && m.battleSize === 'incursion');
  test('nine missions on a 44x30 board, rolled on a D33', () => {
    expect(inc().map((m) => m.roll).sort()).toEqual(['11', '12', '13', '21', '22', '23', '31', '32', '33']);
    for (const m of inc()) expect(m.map.board, m.id).toEqual({ width: 44, height: 30 });
  });
  test('the hold part: 4 VP per condition, max 12, round 5 second player at end of turn', () => {
    for (const m of inc()) {
      const h = m.primary.components.find((c) => c.kind === 'hold')!;
      expect(h, m.id).toMatchObject({ vpPerCondition: 4, max: 12, rounds: [2, 3, 4, 5], round5SecondPlayer: 'end-of-turn' });
    }
  });
  test('Cleanse the Land: Direct Assault', () => {
    expect(score('aoo-cleanse-the-land', 'direct-assault', { flags: { objectives: true, kill: true } })).toBe(3);
    expect(score('aoo-cleanse-the-land', 'direct-assault', { flags: { kill: true } })).toBe(2);
    expect(score('aoo-cleanse-the-land', 'hold', { controlled: 2, opponentControlled: 1 })).toBe(12);
  });
  test('Deliverance: VP per no-man’s-land objective rises by round', () => {
    expect(score('aoo-deliverance', 'secure-landing-sites', { counts: { nml: 2 } }, 4)).toBe(6);
    expect(score('aoo-deliverance', 'secure-landing-sites', { counts: { nml: 1 } }, 3)).toBe(2);
    expect(comp('aoo-deliverance', 'secure-landing-sites').rounds).toEqual([3, 4, 5]);
  });
  test('Desperate Raid: Domination and Raid Supply Lines', () => {
    expect(score('aoo-desperate-raid', 'hold', { controlled: 3, opponentControlled: 0 })).toBe(12);
    expect(score('aoo-desperate-raid', 'hold', { controlled: 2, opponentControlled: 3 })).toBe(4);
    expect(score('aoo-desperate-raid', 'raid-supply-lines', { flags: { raid: true } }, 1)).toBe(3);
    expect(cpBonusPlan(byId('aoo-desperate-raid').cp, { round: 2, player: 'A', active: 'A' }).extras.map((e) => e.cp)).toEqual([1]);
  });
  test('Sacred Ground: Wisdom is the Cornerstone of Faith', () => {
    expect(score('aoo-sacred-ground', 'wisdom', { flags: { 'enemy-home': true }, counts: { others: 2 } })).toBe(4);
    expect(score('aoo-sacred-ground', 'wisdom', { flags: { 'lose-home': true } })).toBe(-1);
    expect(byId('aoo-sacred-ground').cp.gates.map((g) => g.onNo)).toEqual(['roll-1-3-lose']);
  });
  test('Ascension: Ascend each turn and at the end', () => {
    expect(score('aoo-ascension', 'ascend', { flags: { centre: true, kill: true } })).toBe(2);
    expect(score('aoo-ascension', 'ascend-end', { flags: { warlord: true, 'enemy-warlord': true } }, 5)).toBe(6);
    expect(byId('aoo-ascension').cp.gates.map((g) => g.id)).toEqual(['leading-from-the-front']);
  });
  test('Surge of Faith: VP by objective and player', () => {
    expect(score('aoo-surge-of-faith', 'surge-of-faith', { pick: 'A' }, 2, 'B')).toBe(4);
    expect(score('aoo-surge-of-faith', 'surge-of-faith', { pick: 'A' }, 2, 'A')).toBe(0);
    expect(score('aoo-surge-of-faith', 'surge-of-faith', { pick: 'C' }, 2, 'A')).toBe(3);
  });
  test('Rise of the Machine Spirit: Inload Data-psalm', () => {
    expect(score('aoo-rise-of-the-machine-spirit', 'inload-data-psalm', { flags: { done: true }, counts: { held: 4 } })).toBe(3);
    expect(score('aoo-rise-of-the-machine-spirit', 'inload-data-psalm', { counts: { held: 4 } })).toBe(0);
  });
  test('Display of Spiritual Might: Break Them, and Secret Intel Inbound', () => {
    expect(score('aoo-display-of-spiritual-might', 'break-them', { counts: { destroyed: 5 } })).toBe(3);
    const rule = byId('aoo-display-of-spiritual-might').cp;
    expect(cpBonusPlan(rule, { round: 2, player: 'B', active: 'A' }).base).toBe(0);
    expect(cpBonusPlan(rule, { round: 3, player: 'B', active: 'A' }).base).toBe(1);
    expect(cpBonusPlan(rule, { round: 4, player: 'A', active: 'A' }).extras.map((e) => e.cp)).toEqual([1]);
  });
  test('Reconnaissance Mission: Recon Sweep table', () => {
    expect(score('aoo-reconnaissance-mission', 'recon-sweep', { counts: { reconnoitred: 3 } }, 5)).toBe(10);
    expect(score('aoo-reconnaissance-mission', 'recon-sweep', { counts: { reconnoitred: 4 } }, 5)).toBe(15);
  });
  test('objective counts', () => {
    expect(Object.fromEntries(inc().map((m) => [m.id, m.map.objectives.length]))).toEqual({
      'aoo-cleanse-the-land': 5, 'aoo-deliverance': 5, 'aoo-desperate-raid': 6, 'aoo-sacred-ground': 4, 'aoo-ascension': 5,
      'aoo-surge-of-faith': 4, 'aoo-rise-of-the-machine-spirit': 5, 'aoo-display-of-spiritual-might': 4, 'aoo-reconnaissance-mission': 4,
    });
  });
});

describe('Arks of Omen Strike Force missions', () => {
  const sf = () => missions.filter((m) => m.pack === 'arks-of-omen' && m.battleSize === 'strike-force');
  test('nine missions on a 60x44 board', () => {
    expect(sf().map((m) => m.roll).sort()).toEqual(['11', '12', '13', '21', '22', '23', '31', '32', '33']);
    for (const m of sf()) expect(m.map.board, m.id).toEqual({ width: 60, height: 44 });
  });
  test('Recover the Relics: Break Them, and the Recover Relics CP rule', () => {
    expect(score('aoo-recover-the-relics', 'break-them', { counts: { destroyed: 2 } })).toBe(2);
    const rule = byId('aoo-recover-the-relics').cp;
    expect(rule.gates).toMatchObject([{ onNo: 'lose' }]);
    expect(rule.gates[0].question).toBeTruthy();
    expect(rule.extras.map((e) => e.cp)).toEqual([1]);
  });
  test('Tear Down Their Icons: Detonation max 15', () => {
    expect(score('aoo-tear-down-their-icons', 'detonation', { counts: { primed: 4 } }, 5)).toBe(15);
    expect(score('aoo-tear-down-their-icons', 'detonation', { counts: { primed: 2 } }, 5)).toBe(8);
  });
  test('Data Scry-salvage: Domination and Data Intercept', () => {
    expect(score('aoo-data-scry-salvage', 'data-intercept', { counts: { nml: 2 } })).toBe(2);
    expect(score('aoo-data-scry-salvage', 'data-intercept', { counts: { nml: 4 } })).toBe(3);
    expect(score('aoo-data-scry-salvage', 'hold', { controlled: 2, opponentControlled: 1 })).toBe(8);
    expect(byId('aoo-data-scry-salvage').map.zones.A.include[0].kind).toBe('polygon');
    expect(byId('aoo-data-scry-salvage').map.notes.join(' ')).toMatch(/approximately 44" x 60"/);
  });
  test('Abandoned Sanctuaries: one condition 2, both 3', () => {
    expect(score('aoo-abandoned-sanctuaries', 'secure-the-sanctuaries', { flags: { kill: true } })).toBe(2);
    expect(score('aoo-abandoned-sanctuaries', 'secure-the-sanctuaries', { flags: { kill: true, centre: true } })).toBe(3);
  });
  test('Conversion: Corrupted Ground 4 + 2 - 1', () => {
    expect(score('aoo-conversion', 'corrupted-ground', { flags: { 'enemy-home': true, nml: true, 'lose-home': true } })).toBe(5);
  });
  test('The Scouring: 3 VP per scanned objective', () => {
    expect(score('aoo-the-scouring', 'strategic-scan', { counts: { scanned: 5 } }, 5)).toBe(15);
  });
  test('Tide of Conviction: Overrun turns 1-4 and at the end', () => {
    const due = dueComponents(byId('aoo-tide-of-conviction').primary.components, { at: 'end-of-turn', round: 5, activeIsFirst: true });
    expect(due.map((c) => c.id)).toEqual([]);
    expect(score('aoo-tide-of-conviction', 'overrun', { flags: { held: true } }, 4)).toBe(2);
    expect(score('aoo-tide-of-conviction', 'overrun-end', { counts: { held: 2 } }, 5)).toBe(6);
  });
  test('Death and Zeal: the same scoring as Cleanse the Land', () => {
    const strip = (m: MissionOut) => m.primary.components.map(({ source: _s, ...c }) => c);
    expect(strip(byId('aoo-death-and-zeal'))).toEqual(strip(byId('aoo-cleanse-the-land')));
  });
  test('Secure Missing Artefacts: Precious Artefacts', () => {
    expect(score('aoo-secure-missing-artefacts', 'precious-artefacts', { flags: { priority: true } })).toBe(3);
  });
  test('objective counts', () => {
    expect(Object.fromEntries(sf().map((m) => [m.id, m.map.objectives.length]))).toEqual({
      'aoo-recover-the-relics': 6, 'aoo-tear-down-their-icons': 5, 'aoo-data-scry-salvage': 6, 'aoo-abandoned-sanctuaries': 5, 'aoo-conversion': 5,
      'aoo-the-scouring': 5, 'aoo-tide-of-conviction': 6, 'aoo-death-and-zeal': 5, 'aoo-secure-missing-artefacts': 5,
    });
  });
});
