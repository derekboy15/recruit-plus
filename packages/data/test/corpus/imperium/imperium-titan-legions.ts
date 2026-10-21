/**
 * Titan Legions: four Titans, all Lords of War (Wahapedia datasheets 000000867-000000869, 000002077). The cheapest is
 * 2000 pts, so only Onslaught (3000 pts) can hold one, and an Arks of Omen Detachment can't be filled (3 Lords of War
 * plus an HQ, §7.5). A Super-Heavy Auxiliary Detachment holds one Lord of War of any faction.
 * Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost; default weapons cost 0).
 * Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction), §2.1 (Onslaught:
 * 3000 pts, 18 CP), §4 (Super-heavy: 3-5 Lords of War; Super-heavy Auxiliary: 1 Lord of War, 3 CP), §5 (with no
 * CHARACTER, any model may be the Warlord).
 */
import type { CatalogueCorpus } from '../spec';

const AUXILIARY = 'Super-Heavy Auxiliary Detachment -3CP';

export default {
  catalogue: 'Imperium - Titan Legions',
  legal: [
    {
      title: 'Onslaught Super-Heavy Auxiliary Detachment with a Warhound Titan',
      battleSize: 'onslaught',
      detachments: [{ detachment: AUXILIARY, units: [{ name: 'Warhound Titan' }] }], // 2000 (two Vulcan mega-bolters: 0), PL 100
      // 2000; PL 100
      expect: { points: 2000, powerLevel: 100 },
    },
    {
      // Exactly the Onslaught limit: §2.1 allows up to 3000 pts.
      title: 'Onslaught Super-Heavy Auxiliary Detachment with a Reaver Titan, at exactly 3000 pts',
      battleSize: 'onslaught',
      detachments: [{ detachment: AUXILIARY, units: [{ name: 'Reaver Titan' }] }], // 3000 (default weapons: 0), PL 150
      // 3000; PL 150
      expect: { points: 3000, powerLevel: 150 },
    },
  ],
  illegal: [
    {
      // §2.1: Onslaught is up to 3000 pts; a Warbringer Nemesis Titan is 3800.
      title: 'Warbringer Nemesis Titan at Onslaught',
      battleSize: 'onslaught',
      detachments: [{ detachment: AUXILIARY, units: [{ name: 'Warbringer Nemesis Titan' }] }],
      expectRules: ['points-over'],
    },
    {
      // §4: a Super-heavy Detachment needs 3-5 Lords of War.
      title: 'Super-Heavy Detachment with one Warhound Titan',
      battleSize: 'onslaught',
      detachments: [{ detachment: 'Super-Heavy Detachment -3CP', units: [{ name: 'Warhound Titan' }] }],
      expectRules: ['slot-min'],
    },
    {
      // §1 Army Faction: the Titans (IMPERIUM, ADEPTUS TITANICUS, <TITAN LEGION>) and NECRONS share no Faction
      // keyword. The Overlord is the army's only CHARACTER, so it is the Warlord (§5).
      title: 'Necrons Patrol beside a Warhound Titan at Onslaught',
      battleSize: 'onslaught',
      detachments: [
        { detachment: AUXILIARY, units: [{ name: 'Warhound Titan' }] },
        {
          detachment: 'Patrol Detachment -2CP',
          catalogue: 'Necrons',
          army: { 'Dynasty Choice': 'Dynasty: Sautekh' },
          units: [{ name: 'Overlord', warlord: true }, { name: 'Necron Warriors' }],
        },
      ],
      expectRules: ['army-faction'],
    },
  ],
} satisfies CatalogueCorpus;
