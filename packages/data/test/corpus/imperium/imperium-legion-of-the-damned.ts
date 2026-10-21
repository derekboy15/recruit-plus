/**
 * Legion of the Damned: one datasheet, Damned Legionnaires (Elites; Warhammer Legends, December 2019, Wahapedia
 * datasheet 000000150), and no HQ or CHARACTER. Points and PL: Wahapedia snapshot (Datasheets.power_points,
 * Datasheets_models.Cost × models, Datasheets_wargear.cost).
 * Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 (Combat Patrol: one detachment,
 * 3 CP), §4 (Auxiliary Support: exactly one unit of any role, 2 CP), §5 (with no CHARACTER, any model may be the
 * Warlord).
 * BSData also has the catalogue's own Vanguard Detachment without HQ slots, from the Saviours From Beyond rule. That
 * rule isn't on the Wahapedia datasheet and no library file settles it, so no list here uses that detachment.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AUXILIARY = 'Auxiliary Support Detachment -2CP';
/** 4-9 Legionnaires and a Legionnaire Sergeant (Wahapedia datasheet). */
const LEGIONNAIRES: UnitSpec = { name: 'Damned Legionnaires', models: { Legionnaire: 4 } }; // 25 × 5 = 125 (wargear 0), PL 8

export default {
  catalogue: 'Imperium - Legion of the Damned',
  legal: [
    {
      title: 'Combat Patrol Auxiliary Support Detachment with Damned Legionnaires',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: AUXILIARY, units: [LEGIONNAIRES] }],
      // 25 × 5 = 125; PL 8
      expect: { points: 125, powerLevel: 8 },
    },
  ],
  illegal: [
    {
      // Wahapedia datasheet: at least 4 Legionnaires and a Sergeant, so a Sergeant and 3 Legionnaires are one short.
      title: 'Damned Legionnaires of four models',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: AUXILIARY, units: [{ ...LEGIONNAIRES, models: { Legionnaire: 3 } }] }],
      expectRules: ['model-count'],
    },
    {
      // §4: an Auxiliary Support Detachment holds exactly one unit.
      title: 'two Damned Legionnaires units in one Auxiliary Support Detachment',
      battleSize: 'onslaught',
      detachments: [{ detachment: AUXILIARY, units: [LEGIONNAIRES, LEGIONNAIRES] }],
      expectRules: ['slot-max'],
    },
  ],
} satisfies CatalogueCorpus;
