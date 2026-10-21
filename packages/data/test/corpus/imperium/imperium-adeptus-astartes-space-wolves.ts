/**
 * Space Wolves. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 and §4
 * (Combat Patrol: one Patrol Detachment), §5 (Warlord and Warlord Traits); Codex: Space Wolves
 * (03_Codexes/Imperium/Space_Wolves.md); unit sizes from the Wahapedia datasheets.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const PATROL = 'Patrol Detachment -2CP';
/**
 * A Core Book CHARACTER Warlord gets one Warlord Trait, and a named character's is fixed (§5): Logan's is Aura of
 * Majesty (03_Codexes/Imperium/Space_Wolves.md §4).
 */
const LOGAN: UnitSpec = { name: 'Logan Grimnar', warlord: true, options: ['Aura of Majesty'] }; // 140, PL 8

export default {
  catalogue: 'Imperium - Adeptus Astartes - Space Wolves',
  legal: [
    {
      title: 'Combat Patrol',
      battleSize: 'combat-patrol',
      detachments: [{
        detachment: PATROL,
        units: [
          LOGAN,
          { name: 'Grey Hunters' }, // 18 × 5 = 90 (default wargear 0), PL 6
          { name: 'Blood Claws' }, // 17 × 5 = 85 (default wargear 0), PL 6
          { name: 'Thunderwolf Cavalry' }, // 35 × 3 = 105 (default wargear 0), PL 7
        ],
      }],
      // 140 + 90 + 85 + 105 = 420; PL 8 + 6 + 6 + 7 = 27
      expect: { points: 420, powerLevel: 27 },
    },
  ],
  illegal: [
    {
      // Grey Hunters: 4-9 Grey Hunters and a Pack Leader (Wahapedia datasheet). Three Grey Hunters break both limits:
      // the unit's 5 models and the 4 Grey Hunters.
      title: 'three Grey Hunters and a Pack Leader',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, units: [LOGAN, { name: 'Grey Hunters', models: { 'Grey Hunter w/Bolt Pistol': 3 } }] }],
      expectRules: ['model-count', 'model-count'],
    },
    {
      // §5: a Core Book CHARACTER Warlord gets one Warlord Trait, and Logan's is fixed (Aura of Majesty, Space_Wolves.md §4).
      title: 'Logan as Warlord without his Warlord Trait',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, units: [{ name: 'Logan Grimnar', warlord: true }, { name: 'Grey Hunters' }] }],
      expectRules: ['option-required'],
    },
    {
      // Arjac Rockfist: "Your army can only include one ARJAC ROCKFIST model" (Wahapedia datasheet).
      title: 'two Arjac Rockfists',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, units: [LOGAN, { name: 'Arjac Rockfist' }, { name: 'Arjac Rockfist' }, { name: 'Grey Hunters' }] }],
      expectRules: ['unique'],
    },
  ],
} satisfies CatalogueCorpus;
