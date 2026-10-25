/**
 * Forces that aren't armies on their own (overrides/add-on-forces.json): the index marks them with how they're used, and
 * the roster engine agrees with each text. Combat Patrol allows one detachment, Incursion and Strike Force allow only the
 * Arks of Omen allies (library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1, §7), so Onslaught is the one
 * size where an army adds them. Reads generated/ (npm run data:build).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { DataIndex } from '../src/model/types';
import { availableUnits, createRoster, detachmentChoices, validate, type Roster } from '../src/roster';
import { buildFromSpec, type DetachmentSpec, type ListSpec } from './corpus/spec';
import { realCatalogueId, realCatalogues, realPolicy, realScope } from './helpers/realScope';

const index: DataIndex = JSON.parse(readFileSync(join(__dirname, '..', 'generated', 'index.json'), 'utf8'));
const policy = realPolicy();
const catalogues = realCatalogues();

const HOW: Record<string, string> = {
  'imperium-legion-of-the-damned':
    'A single Legends unit, not an army. Add a squad to an Imperium army as an extra detachment in Onslaught games. Combat Patrol allows only one detachment, and Incursion and Strike Force (Arks of Omen) don’t allow it as an ally.',
  'imperium-adeptus-astra-telepathica': 'Two psyker characters, not an army. Add one to an Imperium army as an extra detachment in Onslaught games.',
  'imperium-titan-legions':
    'Titans join big Imperium armies: add one as a Super-heavy Auxiliary Detachment in Onslaught games. They don’t fit Combat Patrol, Incursion or Strike Force.',
  'chaos-chaos-titan-legions':
    'Titans join big Chaos armies: add one as a Super-heavy Auxiliary Detachment in Onslaught games. They don’t fit Combat Patrol, Incursion or Strike Force.',
  'unaligned-monsters-and-gribblies': 'Wild creatures, not an army. Add one to any army as an extra detachment in Onslaught games.',
};
const ADD_ONS = Object.keys(HOW);

const PATROL = 'Patrol Detachment -2CP';
const AUXILIARY = 'Auxiliary Support Detachment -2CP';
const SUPER_HEAVY_AUXILIARY = 'Super-Heavy Auxiliary Detachment -3CP';
const ULTRAMARINES: DetachmentSpec = { detachment: PATROL, units: [{ name: 'Primaris Captain', warlord: true }, { name: 'Intercessor Squad' }] };

/** For each add-on: an army of the group its text names, with one of its own detachments and the add-on's. */
const WITH_ARMY: Record<string, { army: string; detachments: DetachmentSpec[] }> = {
  'imperium-legion-of-the-damned': {
    army: 'imperium-adeptus-astartes-ultramarines',
    detachments: [ULTRAMARINES, { detachment: AUXILIARY, catalogue: 'Imperium - Legion of the Damned', units: [{ name: 'Damned Legionnaires', models: { Legionnaire: 4 } }] }],
  },
  'imperium-adeptus-astra-telepathica': {
    army: 'imperium-adeptus-astartes-ultramarines',
    detachments: [
      ULTRAMARINES,
      { detachment: AUXILIARY, catalogue: 'Imperium - Adeptus Astra Telepathica', units: [{ name: 'Primaris Psyker', options: ['1. Terrifying Visions', '3. Psychic Barrier'] }] },
    ],
  },
  'imperium-titan-legions': {
    army: 'imperium-adeptus-astartes-ultramarines',
    detachments: [ULTRAMARINES, { detachment: SUPER_HEAVY_AUXILIARY, catalogue: 'Imperium - Titan Legions', units: [{ name: 'Warhound Titan' }] }],
  },
  'chaos-chaos-titan-legions': {
    army: 'chaos-chaos-space-marines',
    detachments: [
      { detachment: PATROL, army: { Legion: 'Black Legion' }, units: [{ name: 'Chaos Lord', warlord: true }, { name: 'Legionaries' }] },
      { detachment: SUPER_HEAVY_AUXILIARY, catalogue: 'Chaos - Chaos Titan Legions', units: [{ name: 'Chaos Warhound Titan' }] },
    ],
  },
  // "Any army": a Xenos one. UNALIGNED units are exempt from Army Faction (§1).
  'unaligned-monsters-and-gribblies': {
    army: 'necrons',
    detachments: [
      { detachment: PATROL, army: { 'Dynasty Choice': 'Dynasty: Sautekh' }, units: [{ name: 'Overlord', warlord: true }, { name: 'Necron Warriors' }] },
      { detachment: AUXILIARY, catalogue: 'Unaligned - Monsters and Gribblies', units: [{ name: 'Ambull' }] },
    ],
  },
};

function issuesWith(addOn: string, battleSize: Roster['battleSize']) {
  const { army, detachments } = WITH_ARMY[addOn];
  const scope = realScope(army, addOn);
  const spec: ListSpec = { title: `${army} with ${addOn}`, battleSize, detachments, expect: { points: 0, powerLevel: 0 } };
  return validate(scope, buildFromSpec(scope, realCatalogueId(army), spec), policy).issues;
}

/** The catalogues offered as allies to `army`'s first own detachment at the size. */
function alliesOffered(army: string, battleSize: Roster['battleSize']): Set<string> {
  const scope = realScope(army);
  const id = realCatalogueId(army);
  const empty: Roster = { schema: 1, name: '', catalogueId: id, battleSize, forces: [] };
  const own = detachmentChoices(scope, empty, policy, catalogues).find((d) => !d.allied);
  if (!own) return new Set();
  const r = createRoster(scope, { name: army, catalogueId: id, battleSize, forceId: own.forceId });
  return new Set(detachmentChoices(scope, r, policy, catalogues).filter((d) => d.allied).map((d) => catalogues.find((c) => c.id === d.catalogueId)!.slug));
}

const ARMIES = index.catalogues.filter((c) => !c.library && !ADD_ONS.includes(c.slug));

test('the five add-on forces are marked with how they’re used, and no other catalogue is', () => {
  expect(Object.fromEntries(index.catalogues.filter((c) => c.addOn).map((c) => [c.slug, c.addOn!.how]))).toEqual(HOW);
});

describe.each(ADD_ONS)('%s', (addOn) => {
  test('Onslaught: an army of its group adds it, and the list validates', () => {
    expect(alliesOffered(WITH_ARMY[addOn].army, 'onslaught')).toContain(addOn);
    expect(issuesWith(addOn, 'onslaught')).toEqual([]);
  });

  test('Combat Patrol: the same list is one detachment too many', () => {
    expect(issuesWith(addOn, 'combat-patrol').map((i) => i.rule)).toContain('detachment-count');
  });

  test('Incursion and Strike Force: no army is offered it', () => {
    for (const size of ['incursion', 'strike-force'] as const) {
      expect(ARMIES.filter((a) => alliesOffered(a.slug, size).has(addOn)).map((a) => a.slug)).toEqual([]);
    }
  });

  test('on its own it can’t fill an Arks of Omen Detachment: that needs an HQ and Troops, and it has no units for both', () => {
    const scope = realScope(addOn);
    const id = realCatalogueId(addOn);
    for (const size of ['incursion', 'strike-force'] as const) {
      const empty: Roster = { schema: 1, name: '', catalogueId: id, battleSize: size, forces: [] };
      const choices = detachmentChoices(scope, empty, policy, catalogues);
      expect(choices.map((c) => c.name)).toEqual(['Arks of Omen Detachment']);
      const r = createRoster(scope, { name: addOn, catalogueId: id, battleSize: size, forceId: choices[0].forceId });
      const slots = validate(scope, r, policy).issues.filter((i) => i.rule === 'slot-min').map((i) => i.subject?.name);
      expect(slots).toEqual(expect.arrayContaining(['HQ', 'Troops']));
      const roles = new Set(availableUnits(scope, r, r.forces[0].id).map((o) => o.role));
      expect(roles.has('HQ') && roles.has('Troops')).toBe(false);
    }
  });
});

test('Monsters and Gribblies join any army at Onslaught: Imperium, Chaos and Xenos', () => {
  for (const army of ['imperium-adeptus-astartes-ultramarines', 'chaos-chaos-space-marines', 'necrons', 'orks']) {
    expect(alliesOffered(army, 'onslaught')).toContain('unaligned-monsters-and-gribblies');
  }
});
