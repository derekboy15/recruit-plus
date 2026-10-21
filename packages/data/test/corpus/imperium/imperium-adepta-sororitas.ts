/**
 * Adepta Sororitas. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2 (battle
 * sizes), §4 (Patrol Detachment); global constraints (Combat Patrol: one Core Book detachment); unit options from the
 * Wahapedia datasheets.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const PATROL = 'Patrol Detachment -2CP';
const VALOROUS_HEART = { 'Order Convictions': 'Order: Valorous Heart' };

const CANONESS: UnitSpec = { name: 'Canoness', warlord: true }; // 50 + plasma pistol 5 + power sword 5 = 60, PL 3
const PATROL_UNITS: UnitSpec[] = [
  CANONESS,
  { name: 'Battle Sister Squad', models: { 'Battle Sister': 9 } }, // 11 × 10 = 110, PL 6 (6-10 models)
  {
    name: 'Retributor Squad',
    models: { 'Retributor w/ Heavy Weapon': 4, Retributor: 0 },
    options: ['Retributor w/ Heavy Weapon > Heavy bolter'],
  }, // 12 × 5 + 4 heavy bolters × 10 = 100, PL 6
  { name: 'Penitent Engines' }, // 50, PL 3
  { name: 'Dogmata', options: ['3. Psalm of Righteous Smiting'] }, // 65 (hymns cost no pts), PL 4
  { name: 'Arco-Flagellants' }, // 13 × 3 = 39, PL 2
  { name: 'Dominion Squad' }, // 14 × 5 = 70, PL 5
];

export default {
  catalogue: 'Imperium - Adepta Sororitas',
  legal: [
    {
      title: 'Valorous Heart Combat Patrol',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, army: VALOROUS_HEART, units: PATROL_UNITS }],
      // 60 + 110 + 100 + 50 + 65 + 39 + 70 = 494; PL 3 + 6 + 6 + 3 + 4 + 2 + 5 = 29
      expect: { points: 494, powerLevel: 29 },
    },
    {
      // Arks of Omen allies (§7.5): an IMPERIUM army may take one Imperial Knights Super-Heavy Auxiliary (a single
      // Freeblade unit). BSData asks the ally for the Knights' army-wide choices (Questor Allegiance, household, two
      // Oaths) even though a lone Freeblade doesn't use them; they are filled in so the builder accepts the list.
      title: 'Arks of Omen Strike Force with a Freeblade Armiger Helverin',
      battleSize: 'strike-force',
      detachments: [
        {
          detachment: 'Arks of Omen Detachment',
          army: VALOROUS_HEART,
          units: [
            CANONESS, // 60, PL 3
            { name: 'Battle Sister Squad' }, // 11 × 5 = 55, PL 3
            { name: 'Battle Sister Squad' }, // 55, PL 3
            { name: 'Battle Sister Squad' }, // 55, PL 3
          ],
        },
        {
          detachment: 'Super-Heavy Auxiliary Detachment -3CP',
          catalogue: 'Imperium - Imperial Knights',
          army: {
            'Questor Allegiance': ['Questor Imperialis', 'Custom', 'Custom Household: Hunter of Beasts'],
            'Chivalric Oath': ['Oath: Defend the Realm', 'Oath: Lay Low The Tyrants'],
          },
          units: [
            // A Freeblade picks its own Questor Allegiance and Martial Tradition.
            { name: 'Armiger Helverins', options: ['Freeblade', 'Questor Imperialis', 'Martial Tradition: Hunters of Beasts'] }, // 155 + meltagun 5 = 160, PL 8
          ],
        },
      ],
      // 60 + 3 × 55 + 160 = 385; PL 3 + 3 × 3 + 8 = 20
      expect: { points: 385, powerLevel: 20 },
    },
  ],
  illegal: [
    {
      // Combat Patrol: 500 pts. A second Battle Sister Squad (11 × 5 = 55) takes the legal list to 549.
      title: '549 pts at Combat Patrol',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, army: VALOROUS_HEART, units: [...PATROL_UNITS, { name: 'Battle Sister Squad' }] }],
      expectRules: ['points-over'],
    },
    {
      // Combat Patrol allows one detachment.
      title: 'two Patrols at Combat Patrol',
      battleSize: 'combat-patrol',
      detachments: [
        { detachment: PATROL, army: VALOROUS_HEART, units: [CANONESS, { name: 'Battle Sister Squad' }] },
        { detachment: PATROL, army: VALOROUS_HEART, units: [{ name: 'Palatine' }, { name: 'Battle Sister Squad' }] },
      ],
      expectRules: ['detachment-count'],
    },
    {
      // Patrol Detachment: 1-3 Troops.
      title: 'Patrol without Troops',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, army: VALOROUS_HEART, units: [CANONESS, { name: 'Dominion Squad' }] }],
      expectRules: ['slot-min'],
    },
    {
      // Retributor Squad: up to 2 Armourium Cherubs (Wahapedia datasheet).
      title: 'three Armourium Cherubs',
      battleSize: 'combat-patrol',
      detachments: [{
        detachment: PATROL,
        army: VALOROUS_HEART,
        units: [CANONESS, { name: 'Battle Sister Squad' }, { name: 'Retributor Squad', options: ['Armourium Cherub', 'Armourium Cherub', 'Armourium Cherub'] }],
      }],
      expectRules: ['wargear-max'],
    },
  ],
} satisfies CatalogueCorpus;
