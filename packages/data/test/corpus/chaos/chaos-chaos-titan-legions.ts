/**
 * Chaos Titan Legions: four Titans, all Lords of War (Wahapedia datasheets 000002448-000002451;
 * 03_Codexes/Chaos/Other_Chaos_Content.md §2). The cheapest is 2000 pts, so only Onslaught (3000 pts) can hold
 * one, and an Arks of Omen Detachment can't be filled (3 Lords of War plus an HQ, §7.5). A Super-Heavy Auxiliary
 * Detachment holds one Lord of War of any faction, and the Titans join other Chaos armies through CHAOS.
 * Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models; default weapons cost 0).
 * Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction), §2.1 (Onslaught:
 * 3000 pts, 18 CP, 4 detachments), §4 (Patrol; Super-heavy: 3-5 Lords of War; Super-heavy Auxiliary: 1 Lord of War,
 * 3 CP), §5 (with no CHARACTER, any model may be the Warlord).
 */
import type { CatalogueCorpus } from '../spec';

const AUXILIARY = 'Super-Heavy Auxiliary Detachment -3CP';

export default {
  catalogue: 'Chaos - Chaos Titan Legions',
  legal: [
    {
      // §5 asks for a Warlord, but BSData's Chaos - Titanicus Traitoris.cat (the Titans' catalogue) has no Warlord
      // entry, so a Titan-only roster can't record one (and validation reports no warlord-missing for it).
      title: 'Onslaught Super-Heavy Auxiliary Detachment with a Chaos Warhound Titan',
      battleSize: 'onslaught',
      detachments: [{ detachment: AUXILIARY, units: [{ name: 'Chaos Warhound Titan' }] }], // 2000 (two Warhound vulcan mega-bolters: 0), PL 100
      // 2000; PL 100
      expect: { points: 2000, powerLevel: 100 },
    },
    {
      // §1: the Titan (CHAOS, TITANICUS TRAITORIS) and the Chaos Space Marines share CHAOS. The Chaos Lord is the army's
      // only CHARACTER, so he is the Warlord (§5), and his Patrol refunds its 2 CP.
      title: 'Onslaught Chaos Warhound Titan beside a Black Legion Patrol',
      battleSize: 'onslaught',
      detachments: [
        { detachment: AUXILIARY, units: [{ name: 'Chaos Warhound Titan' }] }, // 2000, PL 100
        {
          detachment: 'Patrol Detachment -2CP',
          catalogue: 'Chaos - Chaos Space Marines',
          army: { Legion: 'Black Legion' },
          units: [
            { name: 'Chaos Lord', warlord: true }, // 90 + thunder hammer 10 (plasma pistol 0) = 100, PL 5
            { name: 'Legionaries' }, // 18 × 5 = 90 (4 Legionaries, Aspiring Champion), PL 6
          ],
        },
      ],
      // 2000 + 100 + 90 = 2190; PL 100 + 5 + 6 = 111
      expect: { points: 2190, powerLevel: 111 },
    },
  ],
  illegal: [
    {
      // §2.1: Onslaught is up to 3000 pts; a Chaos Warbringer Nemesis Titan is 3800 (Wahapedia 000002450).
      title: 'Chaos Warbringer Nemesis Titan at Onslaught',
      battleSize: 'onslaught',
      detachments: [{ detachment: AUXILIARY, units: [{ name: 'Chaos Warbringer Nemesis Titan' }] }],
      expectRules: ['points-over'],
    },
    {
      // §4: a Super-heavy Detachment needs 3-5 Lords of War.
      title: 'Super-Heavy Detachment with one Chaos Warhound Titan',
      battleSize: 'onslaught',
      detachments: [{ detachment: 'Super-Heavy Detachment -3CP', units: [{ name: 'Chaos Warhound Titan' }] }],
      expectRules: ['slot-min'],
    },
    {
      // §1 Army Faction: the Titan (CHAOS, TITANICUS TRAITORIS, <HERETIC TITAN LEGION>) and NECRONS share no Faction
      // keyword. The Overlord is the army's only CHARACTER, so it is the Warlord (§5).
      title: 'Necrons Patrol beside a Chaos Warhound Titan at Onslaught',
      battleSize: 'onslaught',
      detachments: [
        { detachment: AUXILIARY, units: [{ name: 'Chaos Warhound Titan' }] },
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
