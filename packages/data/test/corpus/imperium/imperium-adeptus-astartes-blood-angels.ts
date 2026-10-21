/**
 * Blood Angels. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §5 (Warlord),
 * §7.5 (Arks of Omen Detachment, Rule of Two); unit sizes from the Wahapedia datasheets.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const THREE_ASSAULT_INTERCESSORS: UnitSpec[] = [{ name: 'Assault Intercessor Squad' }, { name: 'Assault Intercessor Squad' }, { name: 'Assault Intercessor Squad' }];

/** The legal Incursion list's units after the Warlord. */
const INCURSION_UNITS: UnitSpec[] = [
  { name: 'Sanguinary Priest' }, // 90 (bolt pistol, chainsword 0), PL 5
  ...THREE_ASSAULT_INTERCESSORS, // each 17 × 5 = 85, PL 5
  { name: 'Death Company Intercessors', options: ['Bolt rifle'] }, // 18 × 5 = 90, PL 6
  { name: 'Sanguinary Guard' }, // 30 × 4 = 120, PL 7
  { name: 'Baal Predator' }, // 110 (twin assault cannon 0), PL 8
];

export default {
  catalogue: 'Imperium - Adeptus Astartes - Blood Angels',
  legal: [
    {
      title: 'Arks of Omen Incursion',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        units: [
          { name: 'Primaris Captain', warlord: true }, // 80, PL 5
          ...INCURSION_UNITS,
        ],
      }],
      // 80 + 90 + 3 × 85 + 90 + 120 + 110 = 745; PL 5 + 5 + 3 × 5 + 6 + 7 + 8 = 46
      expect: { points: 745, powerLevel: 46 },
    },
  ],
  illegal: [
    {
      // §5: every army nominates a Warlord (a CHARACTER when it has one).
      title: 'no Warlord',
      battleSize: 'incursion',
      detachments: [{ detachment: AOO, units: [{ name: 'Primaris Captain' }, ...INCURSION_UNITS] }],
      expectRules: ['warlord-missing'],
    },
    {
      // Rule of Two (§7.5): at Incursion, at most two of one non-Troops datasheet.
      title: 'three Baal Predators at Incursion',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        units: [{ name: 'Primaris Captain', warlord: true }, ...THREE_ASSAULT_INTERCESSORS, { name: 'Baal Predator' }, { name: 'Baal Predator' }, { name: 'Baal Predator' }],
      }],
      expectRules: ['rule-of-three'],
    },
    {
      // Sanguinary Guard: 4-10 models (Wahapedia datasheet).
      title: 'three Sanguinary Guard',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        units: [{ name: 'Primaris Captain', warlord: true }, ...THREE_ASSAULT_INTERCESSORS, { name: 'Sanguinary Guard', models: { 'Sanguinary Guard': 3 } }],
      }],
      expectRules: ['model-count'],
    },
    {
      // §7.5: exactly one Arks of Omen Detachment.
      title: 'two Arks of Omen Detachments',
      battleSize: 'incursion',
      detachments: [
        { detachment: AOO, units: [{ name: 'Primaris Captain', warlord: true }, ...THREE_ASSAULT_INTERCESSORS] },
        { detachment: AOO, units: [{ name: 'Sanguinary Priest' }, ...THREE_ASSAULT_INTERCESSORS] },
      ],
      expectRules: ['detachment-count'],
    },
  ],
} satisfies CatalogueCorpus;
