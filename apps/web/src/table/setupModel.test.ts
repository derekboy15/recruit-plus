import { describe, expect, test } from 'vitest';
import { generatedMissions } from './__fixtures__/missions';
import { defaultSetup, missionForRoll, missionsFor, packFor, secondaryChoices, secondaryProblems } from './setupModel';

const all = generatedMissions();
const pack = (id: 'arks-of-omen' | 'core-book') => all.packs.find((p) => p.id === id)!;
const sec = (id: string) => [...pack('arks-of-omen').secondaries, ...pack('core-book').secondaries].find((s) => s.id === id)!;

describe('missions', () => {
  test('packFor maps battle sizes to packs', () => {
    expect(packFor('incursion')).toBe('arks-of-omen');
    expect(packFor('strike-force')).toBe('arks-of-omen');
    expect(packFor('combat-patrol')).toBe('core-book');
    expect(packFor('onslaught')).toBe('core-book');
  });
  test('missionsFor lists a size sorted by roll', () => {
    expect(missionsFor(all, 'incursion').map((m) => m.roll)).toEqual(['11', '12', '13', '21', '22', '23', '31', '32', '33']);
    expect(missionsFor(all, 'onslaught').map((m) => m.id)).toEqual(['cb-lines-of-battle', 'cb-all-out-war', 'cb-pathway-to-glory']);
  });
  test('missionForRoll D33 2,3 → aoo-surge-of-faith (Incursion)', () => {
    expect(missionForRoll(all, 'incursion', 2, 3).id).toBe('aoo-surge-of-faith');
    expect(missionForRoll(all, 'strike-force', 1, 1).id).toBe('aoo-recover-the-relics');
  });
  test('D6 4 → cb-all-out-war (Onslaught)', () => {
    expect(missionForRoll(all, 'onslaught', 4).id).toBe('cb-all-out-war');
    expect(missionForRoll(all, 'combat-patrol', 1).id).toBe('cb-incisive-attack');
    expect(missionForRoll(all, 'combat-patrol', 6).id).toBe('cb-encircle');
  });
});

describe('secondaries', () => {
  test('two from Purge the Enemy is a problem', () => {
    expect(secondaryProblems(pack('arks-of-omen'), [sec('aoo-assassination'), sec('aoo-bring-it-down'), sec('aoo-grind-them-down')])).toEqual(['You can only pick one from Purge the Enemy.']);
  });
  test('three is the number', () => {
    expect(secondaryProblems(pack('arks-of-omen'), [sec('aoo-assassination')])).toEqual(['Pick exactly 3 secondary objectives.']);
    expect(secondaryProblems(pack('arks-of-omen'), [sec('aoo-assassination'), sec('aoo-grind-them-down'), sec('aoo-behind-enemy-lines')])).toEqual([]);
  });
  test("mission secondary doesn't count against categories", () => {
    const m = all.missions.find((x) => x.id === 'cb-incisive-attack')!;
    expect(secondaryProblems(pack('core-book'), [m.missionSecondary!, sec('cb-assassinate'), sec('cb-attrition')])).toEqual([]);
  });
  test('Blood Angels list sees Space Marines and Blood Angels faction secondaries', () => {
    const c = secondaryChoices(all, 'arks-of-omen', 'imperium-adeptus-astartes-blood-angels', 'aoo-cleanse-the-land');
    expect(new Set(c.faction.map((s) => s.factionId))).toEqual(new Set(['SM', 'CHBA']));
    expect(c.faction.find((s) => s.factionId === 'CHBA')!.note).toMatch(/Chapter/);
    expect(c.universal).toHaveLength(11);
    expect(c.mission).toBeUndefined();
  });
  test('Core Book choices include the mission secondary', () => {
    const c = secondaryChoices(all, 'core-book', 'necrons', 'cb-outriders');
    expect(c.mission?.name).toBe('Survey');
    expect(c.universal).toHaveLength(17);
    expect(c.faction.every((s) => s.factionId === 'NEC')).toBe(true);
  });
  test('defaults are the three Arks of Omen defaults', () => {
    expect(defaultSetup(pack('arks-of-omen'), 'strike-force')).toEqual({ secondaries: ['aoo-assassination', 'aoo-grind-them-down', 'aoo-behind-enemy-lines'], startingCp: 6 });
    expect(defaultSetup(pack('core-book'), 'onslaught')).toEqual({ secondaries: [], startingCp: 18 });
  });
});
