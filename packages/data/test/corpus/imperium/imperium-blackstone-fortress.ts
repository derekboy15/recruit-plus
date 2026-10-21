/**
 * Blackstone Fortress. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost). Rules:
 * research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 (Combat Patrol), §4 (Patrol, Auxiliary
 * Support), §7.1 (Battle Brothers: a detachment's units share a Faction keyword other than IMPERIUM). Faction
 * keywords: Wahapedia Datasheets_keywords (Janus Draik and Neyam Shai Murad: IMPERIUM, ASTRA CARTOGRAPHICA; Espern Locarno: IMPERIUM,
 * NAVIS NOBILITE; Spindle Drones: BLACKSTONE CONSTRUCT, UNALIGNED).
 * The January 2022 Munitorum Field Manual dropped most Blackstone Fortress characters (05_Balance_Errata_and_Points);
 * the builder offers Legends and dropped datasheets (design spec), so these lists check army construction only.
 * The only Troops are the UNALIGNED Spindle Drones. UNALIGNED units are exempt from Army Faction (§1, Glossary), but
 * the library doesn't say whether they may share a detachment with units of another Faction (§7.1), so no legal list
 * puts them in a Patrol: the legal list is one Auxiliary Support Detachment (§4: one unit, 2 CP; §2.1: Combat Patrol
 * allows one detachment).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const PATROL = 'Patrol Detachment -2CP';
const JANUS: UnitSpec = { name: 'Janus Draik', warlord: true }; // 45 (wargear included), PL 3
const DRONES: UnitSpec = { name: 'Spindle Drones' };

export default {
  catalogue: 'Imperium - Blackstone Fortress',
  legal: [
    {
      title: 'Combat Patrol Auxiliary Support Detachment with Janus Draik',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: 'Auxiliary Support Detachment -2CP', units: [JANUS] }],
      // 45; PL 3
      expect: { points: 45, powerLevel: 3 },
    },
  ],
  illegal: [
    {
      // §7.1: Janus Draik (ASTRA CARTOGRAPHICA) and Espern Locarno (NAVIS NOBILITE) share only IMPERIUM. The Patrol
      // breaks Battle Brothers once, however the Spindle Drones are read.
      title: 'Janus Draik and Espern Locarno in one Patrol',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, units: [JANUS, { name: 'Espern Locarno' }, DRONES] }],
      expectRules: ['detachment-faction'],
    },
    {
      // §4: a Patrol needs at least one Troops unit; Janus Draik and Neyam Shai Murad share ASTRA CARTOGRAPHICA.
      title: 'Patrol without Spindle Drones',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, units: [JANUS, { name: 'Neyam Shai Murad' }] }],
      expectRules: ['slot-min'],
    },
  ],
} satisfies CatalogueCorpus;
