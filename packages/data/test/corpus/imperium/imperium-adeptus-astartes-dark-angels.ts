/**
 * Dark Angels. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §5 (Warlord),
 * §7.5 (Arks of Omen Detachment: compulsory stack, slots); Codex: Dark Angels (03_Codexes/Imperium/Dark_Angels.md).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
/** Elites as the Arks of Omen compulsory stack: three Elites units. */
const ELITES_ARMY = { 'Arks of Omen Compulsory Type': 'Elites' };
const AZRAEL: UnitSpec = { name: 'Azrael', warlord: true }; // 170, PL 9
/** The Elites stack of the legal list. */
const WING_UNITS: UnitSpec[] = [
  { name: 'Deathwing Knights' }, // 43 × 5 = 215 (mace of absolution, storm shield 0), PL 11
  { name: 'Deathwing Terminator Squad' }, // 33 × 5 = 165 (default wargear 0), PL 9
  { name: 'Ravenwing Black Knights' }, // 30 × 3 = 90 (default wargear 0), PL 6
];

export default {
  catalogue: 'Imperium - Adeptus Astartes - Dark Angels',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Elites compulsory',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: ELITES_ARMY,
        units: [
          AZRAEL,
          { name: 'Belial' }, // 125, PL 7
          ...WING_UNITS,
        ],
      }],
      // 170 + 125 + 215 + 165 + 90 = 765; PL 9 + 7 + 11 + 9 + 6 = 42
      expect: { points: 765, powerLevel: 42 },
    },
  ],
  illegal: [
    {
      // Belial: "Your army can only include one BELIAL model" (Wahapedia datasheet).
      title: 'two Belials',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: ELITES_ARMY, units: [AZRAEL, { name: 'Belial' }, { name: 'Belial' }, ...WING_UNITS] }],
      expectRules: ['unique'],
    },
    {
      // §5: one Warlord per army.
      title: 'Azrael and Belial both Warlord',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: ELITES_ARMY, units: [AZRAEL, { name: 'Belial', warlord: true }, ...WING_UNITS] }],
      expectRules: ['warlord-extra'],
    },
    {
      // §7.5: Elites as the compulsory stack needs three Elites units.
      title: 'two Elites units with Elites compulsory',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: ELITES_ARMY, units: [AZRAEL, { name: 'Deathwing Knights' }, { name: 'Ravenwing Black Knights' }] }],
      expectRules: ['slot-min'],
    },
  ],
} satisfies CatalogueCorpus;
