/**
 * Unaligned - Monsters and Gribblies (Blackstone Fortress and Warhammer Quest creatures, Wahapedia faction
 * "Unaligned"). Points and PL: Wahapedia snapshot (Datasheets.power_points; Datasheets_models.Cost × models, or
 * Datasheets.Cost for the Spindle Drones, priced per unit; default wargear costs 0). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction ignores UNALIGNED units), §4 (Core Book
 * detachments: a Patrol needs an HQ; an Auxiliary Support Detachment holds exactly one unit), §5 (a Warlord), §7.5 (an
 * Arks of Omen Detachment needs an HQ, and these units are on no permitted ally list); Wahapedia datasheets 000002093
 * (The Archivist: "You can only include one of this model in your army") and 000001603 (Spindle Drones).
 *
 * Size: the catalogue has no HQ, so it can't fill an Arks of Omen Detachment, a Patrol or any other Core Book
 * detachment with a compulsory HQ. The smallest legal army containing it is one Auxiliary Support Detachment, at
 * Combat Patrol (one detachment), led by The Archivist, its only CHARACTER.
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AUXILIARY_SUPPORT = 'Auxiliary Support Detachment -2CP';
const ARCHIVIST: UnitSpec = { name: 'The Archivist' }; // 90 (atomic disassembler, eradicator glove: 0), PL 5
const LED_BY_THE_ARCHIVIST: DetachmentSpec = { detachment: AUXILIARY_SUPPORT, units: [{ ...ARCHIVIST, warlord: true }] };

export default {
  catalogue: 'Unaligned - Monsters and Gribblies',
  legal: [
    {
      title: 'Combat Patrol: an Auxiliary Support Detachment of The Archivist (Warlord)',
      battleSize: 'combat-patrol',
      detachments: [LED_BY_THE_ARCHIVIST],
      // 90; PL 5
      expect: { points: 90, powerLevel: 5 },
    },
  ],
  illegal: [
    {
      // The Archivist (000002093): "You can only include one of this model in your army."
      title: 'two Archivists, each in its own Auxiliary Support Detachment (Onslaught)',
      battleSize: 'onslaught',
      detachments: [LED_BY_THE_ARCHIVIST, { detachment: AUXILIARY_SUPPORT, units: [ARCHIVIST] }],
      expectRules: ['unique'],
    },
    {
      // §4: a Patrol Detachment needs 1 HQ, and the catalogue has none.
      title: 'a Patrol of Spindle Drones alone',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: 'Patrol Detachment -2CP', units: [{ name: 'Spindle Drones' }] }],
      expectRules: ['slot-min'],
    },
    {
      // §4: an Auxiliary Support Detachment holds exactly one unit.
      title: 'an Auxiliary Support Detachment of The Archivist and an Ambull',
      battleSize: 'combat-patrol',
      detachments: [{ ...LED_BY_THE_ARCHIVIST, units: [...LED_BY_THE_ARCHIVIST.units, { name: 'Ambull' }] }],
      expectRules: ['slot-max'],
    },
  ],
} satisfies CatalogueCorpus;
