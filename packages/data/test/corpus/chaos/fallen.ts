/**
 * Fallen (Index Hereticus: The Fallen, White Dwarf May 2021; 03_Codexes/Chaos/Other_Chaos_Content.md §4). BSData's
 * Fallen.cat has Cypher and the Fallen unit (plus the Specialist Detachment's Sorcerer and Chaos Rhino). The Fallen
 * unit has no datasheet in the Wahapedia snapshot, and the research library can't confirm its 9th edition points or
 * unit size, so no list uses it. Cypher has no Troops to make a Patrol and can't fill an Arks of Omen Detachment, so the
 * legal list is the smallest legal army with him: an Auxiliary Support Detachment (exactly one unit) at Combat Patrol.
 * Points and PL: Wahapedia snapshot, datasheet 000000926 (Datasheets.power_points, Datasheets_models.Cost; BSData's
 * Fallen.cat says 85, corrected in overrides/costs.json). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction), §2.1 (Combat Patrol: 500 pts, 3 CP, one
 * detachment), §4 (Patrol: 1-3 Troops; Auxiliary Support: one unit, 2 CP), §5 (a CHARACTER is the Warlord).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AUXILIARY = 'Auxiliary Support Detachment -2CP';
const CYPHER: UnitSpec = { name: 'Cypher', warlord: true }; // 90 (bolt pistol, plasma pistol, grenades: 0), PL 5

export default {
  catalogue: 'Fallen',
  legal: [
    {
      title: 'Combat Patrol Auxiliary Support Detachment with Cypher',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: AUXILIARY, units: [CYPHER] }],
      // 90; PL 5
      expect: { points: 90, powerLevel: 5 },
    },
  ],
  illegal: [
    {
      // Wahapedia 000000926, unit composition: "Your army can only include one CYPHER model."
      title: 'two Cyphers in two Auxiliary Support Detachments at Onslaught',
      battleSize: 'onslaught',
      detachments: [{ detachment: AUXILIARY, units: [CYPHER] }, { detachment: AUXILIARY, units: [{ name: 'Cypher' }] }],
      expectRules: ['unique'],
    },
    {
      // §4: a Patrol needs 1-3 Troops.
      title: 'Patrol with Cypher and no Troops',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: 'Patrol Detachment -2CP', units: [CYPHER] }],
      expectRules: ['slot-min'],
    },
    {
      // §1 Army Faction: Cypher (IMPERIUM, CHAOS, FALLEN) and NECRONS share no Faction keyword. The Overlord is the
      // Warlord.
      title: 'Necrons Patrol beside Cypher at Onslaught',
      battleSize: 'onslaught',
      detachments: [
        { detachment: AUXILIARY, units: [{ name: 'Cypher' }] },
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
