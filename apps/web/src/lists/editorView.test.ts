import { armyOptions, createRoster, FORCE, type BattleSizeId } from '@recruit/data/roster';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getIndex, getRosterScope, resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { isAutoManagedEntry, isHelperOption, offeredAtSize } from './editorView';
import { armyChoices } from './newListSetup';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

/** Every on/off army option the editor could show, across every army in the data: option name → armies hiding / showing it. */
async function armyToggles(): Promise<{ hidden: Map<string, Set<string>>; shown: Map<string, Set<string>> }> {
  const hidden = new Map<string, Set<string>>();
  const shown = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, name: string, army: string) => map.set(name, (map.get(name) ?? new Set()).add(army));
  const index = await getIndex();
  for (const c of index.catalogues.filter((c) => !c.library)) {
    const scope = await getRosterScope([c.slug]);
    const sizes: [BattleSizeId, string][] = [['strike-force', FORCE.arksOfOmen], ['onslaught', FORCE.patrol]];
    for (const [battleSize, forceId] of sizes) {
      const roster = createRoster(scope, { name: 'x', catalogueId: c.id, battleSize, forceId });
      const choices = new Set(armyChoices(scope, roster).map((x) => x.entryId));
      for (const o of armyOptions(scope, roster, roster.forces[0].id)) {
        if (choices.has(o.entryId) || isAutoManagedEntry(scope, o.entryId)) continue;
        add(isHelperOption(scope, o.entryId) ? hidden : shown, o.name, c.name);
      }
    }
  }
  return { hidden, shown };
}

test('BattleScribe helpers among the army options are recognised; real choices are not', async () => {
  const { hidden, shown } = await armyToggles();
  const armies = (await getIndex()).catalogues.filter((c) => !c.library).map((c) => c.name);
  expect([...hidden.keys()].sort()).toEqual([
    'Deeds and Sagas [Reference]',
    'Detachment Bonuses',
    'Hide Imperial Agents',
    'Show Vows',
    'Unit Filter',
    'Use Beta Rules',
    'Warlord Traits (Reference)',
  ]);
  for (const name of ['Stratagem: Heroic Support', 'Army of Renown - Vanguard Spearhead', 'Daemonic Pact', 'List Stratagems', 'Legends/Index Options']) {
    expect(shown.has(name), name).toBe(true);
  }
  // "Use Beta Rules" reveals Chaos Space Marines units and wargear (Chaos Deimos Predator [LEGENDS], the Sorcerer in
  // Terminator Armour's power maul), so it is a real choice there; everywhere else it changes nothing.
  expect([...(shown.get('Use Beta Rules') ?? [])]).toEqual(['Chaos - Chaos Space Marines']);
  expect([...(hidden.get('Use Beta Rules') ?? [])].sort()).toEqual(armies.filter((a) => a !== 'Chaos - Chaos Space Marines').sort());
  expect(hidden.get('Use Beta Rules')!.size).toBe(41);
  for (const name of ['Show Vows', 'Detachment Bonuses', 'Deeds and Sagas [Reference]', 'Warlord Traits (Reference)']) {
    expect(shown.has(name), name).toBe(false);
  }
});

test('Specialist Detachments are not offered at Arks of Omen sizes, only in Core Book games', async () => {
  const index = await getIndex();
  const offered = async (slug: string, battleSize: BattleSizeId, forceId: string) => {
    const c = index.catalogues.find((x) => x.slug === slug)!;
    const scope = await getRosterScope([slug]);
    const roster = createRoster(scope, { name: 'x', catalogueId: c.id, battleSize, forceId });
    const choices = armyChoices(scope, roster).map((x) => x.title);
    const toggles = armyOptions(scope, roster, roster.forces[0].id).filter((o) => offeredAtSize(scope, roster, o.entryId)).map((o) => o.name);
    return [...choices, ...toggles].filter((name) => /Specialist Detachment/.test(name));
  };
  expect(await offered('aeldari-craftworlds', 'strike-force', FORCE.arksOfOmen)).toEqual([]);
  expect(await offered('aeldari-craftworlds', 'onslaught', FORCE.patrol)).toContain('Specialist Detachment');
});
