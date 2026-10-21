import { armyOptions, createRoster, FORCE, type BattleSizeId } from '@recruit/data/roster';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getIndex, getRosterScope, resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { isAutoManagedEntry, isHelperOption } from './editorView';
import { armyChoices } from './newListSetup';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

/** Every on/off army option the editor could show, across every army in the data, by whether it is a helper. */
async function armyToggles(): Promise<{ hidden: Set<string>; shown: Set<string> }> {
  const hidden = new Set<string>();
  const shown = new Set<string>();
  const index = await getIndex();
  for (const c of index.catalogues.filter((c) => !c.library)) {
    const scope = await getRosterScope([c.slug]);
    const sizes: [BattleSizeId, string][] = [['strike-force', FORCE.arksOfOmen], ['onslaught', FORCE.patrol]];
    for (const [battleSize, forceId] of sizes) {
      const roster = createRoster(scope, { name: 'x', catalogueId: c.id, battleSize, forceId });
      const choices = new Set(armyChoices(scope, roster).map((x) => x.entryId));
      for (const o of armyOptions(scope, roster, roster.forces[0].id)) {
        if (choices.has(o.entryId) || isAutoManagedEntry(scope, o.entryId)) continue;
        (isHelperOption(scope, o.entryId) ? hidden : shown).add(o.name);
      }
    }
  }
  return { hidden, shown };
}

test('BattleScribe helpers among the army options are recognised; real choices are not', async () => {
  const { hidden, shown } = await armyToggles();
  expect([...hidden].sort()).toEqual([
    'Deeds and Sagas [Reference]',
    'Detachment Bonuses',
    'Hide Imperial Agents',
    'Show Vows',
    'Unit Filter',
    'Use Beta Rules',
    'Warlord Traits (Reference)',
  ]);
  for (const name of ['Stratagem: Heroic Support', 'Army of Renown - Vanguard Spearhead', 'Daemonic Pact', 'List Stratagems', 'Legends/Index Options']) {
    expect(shown, name).toContain(name);
  }
});
