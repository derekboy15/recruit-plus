/**
 * Adeptus Astra Telepathica: two datasheets, a Primaris Psyker (HQ) and an Astropath (Elites), and no Troops, so no
 * Patrol, Battalion or Arks of Omen Detachment can be filled. A Core Book battle size allows one Auxiliary Support
 * Detachment of exactly one unit on its own (research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1
 * Combat Patrol: one detachment, 3 CP; §4 Auxiliary Support: 2 CP, one unit of any role; §5 Warlord).
 * Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost; Astra Militarum Primaris Psyker
 * 000000889). Wahapedia has no Astropath datasheet (the 2023 codex made it a Command Squad attaché), so no legal list
 * uses one.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AUXILIARY = 'Auxiliary Support Detachment -2CP';
/** It knows Smite and two Psykana powers (Wahapedia datasheet). */
const PSYKER: UnitSpec = { name: 'Primaris Psyker', warlord: true, options: ['1. Terrifying Visions', '3. Psychic Barrier'] }; // 60, PL 3

export default {
  catalogue: 'Imperium - Adeptus Astra Telepathica',
  legal: [
    {
      title: 'Combat Patrol Auxiliary Support Detachment with a Primaris Psyker',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: AUXILIARY, units: [PSYKER] }],
      // 60; PL 3
      expect: { points: 60, powerLevel: 3 },
    },
  ],
  illegal: [
    {
      // §4: an Auxiliary Support Detachment holds exactly one unit.
      title: 'Primaris Psyker and Astropath in one Auxiliary Support Detachment',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: AUXILIARY, units: [PSYKER, { name: 'Astropath' }] }],
      expectRules: ['slot-max'],
    },
    {
      // §4: a Patrol needs 1-3 Troops, and the Astra Telepathica have none.
      title: 'Patrol with a Primaris Psyker and no Troops',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: 'Patrol Detachment -2CP', units: [PSYKER] }],
      expectRules: ['slot-min'],
    },
  ],
} satisfies CatalogueCorpus;
