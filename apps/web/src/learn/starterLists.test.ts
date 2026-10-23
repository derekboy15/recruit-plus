import 'fake-indexeddb/auto';
import { evaluate, validate } from '@recruit/data/roster';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getPolicy, getRosterScope, resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { slugsFor } from '../lists/useRosterEditor';
import { getIndex } from '../factions/dataClient';
import { loadArmy } from '../play/setup/loadArmy';
import { starterList, STARTERS, type StarterId } from './starterLists';

beforeEach(() => {
  resetDataCache();
  stubGeneratedData();
});
afterEach(() => vi.unstubAllGlobals());

async function check(id: StarterId) {
  const doc = await starterList(id);
  const { roster } = doc.data;
  const index = await getIndex();
  const cat = index.catalogues.find((c) => c.id === roster.catalogueId)!;
  const [scope, policy] = await Promise.all([getRosterScope(slugsFor(roster, index.catalogues, cat.slug)), getPolicy()]);
  return { doc, scope, policy, roster };
}

describe('starter lists', () => {
  for (const id of Object.keys(STARTERS) as StarterId[]) {
    test(`${id}: a legal Combat Patrol list (Patrol Detachment, one Warlord, 450–500 points)`, async () => {
      const { doc, scope, policy, roster } = await check(id);
      expect(roster.battleSize).toBe('combat-patrol');
      expect(roster.forces).toHaveLength(1);
      const { issues } = validate(scope, roster, policy);
      expect(issues).toEqual([]);
      expect(doc.data.summary.points).toBeGreaterThanOrEqual(450);
      expect(doc.data.summary.points).toBeLessThanOrEqual(500);
      expect(doc.data.summary.points).toBe(490);
      const view = evaluate(scope, roster);
      expect(view.forces[0].name).toMatch(/^Patrol Detachment/);
      expect(view.forces[0].selections.filter((s) => !s.hidden && s.type !== 'upgrade').map((s) => s.name)).toEqual(STARTERS[id].units);
    });

    test(`${id}: musters with no problems`, async () => {
      const army = await loadArmy(await starterList(id), 'A');
      expect(army.problems).toEqual([]);
      expect(army.army.units).toHaveLength(STARTERS[id].units.length);
      expect(army.army.units.filter((u) => u.warlord)).toHaveLength(1);
    });
  }
});
