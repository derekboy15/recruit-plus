/**
 * Salamanders. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction),
 * §2.1 (Onslaught: at most 4 detachments), §4 (Battalion and Patrol slots), §5 (Warlord and Warlord Traits); Codex: Space
 * Marines (03_Codexes/Imperium/Space_Marines.md: Company Command).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const BATTALION = 'Battalion Detachment -3CP';
const PATROL = 'Patrol Detachment -2CP';
/**
 * A Core Book CHARACTER Warlord gets one Warlord Trait, and a named character's is fixed (§5): He'stan's is Anvil of
 * Strength (03_Codexes/Imperium/Space_Marine_Supplements.md, Salamanders Warlord Traits).
 */
const HESTAN: UnitSpec = { name: "Vulkan He'stan", warlord: true, options: ['Anvil of Strength'] }; // 110, PL 7
const THREE_INTERCESSORS: UnitSpec[] = [{ name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }]; // each 18 × 5 = 90, PL 5
/** The Codex Lieutenant datasheet (not the Primaris one), with its two weapons. */
const LIEUTENANT: UnitSpec = { name: 'Lieutenant', options: ['Master-crafted boltgun', 'Astartes Chainsword'] };
const smallPatrol = (hq: string): DetachmentSpec => ({ detachment: PATROL, units: [{ name: hq }, { name: 'Intercessor Squad' }] });

export default {
  catalogue: 'Imperium - Adeptus Astartes - Salamanders',
  legal: [
    {
      title: 'Onslaught Battalion',
      battleSize: 'onslaught',
      detachments: [{
        detachment: BATTALION,
        units: [
          HESTAN,
          // He'stan is a CAPTAIN, so the second HQ is a Lieutenant (Company Command: 1 CAPTAIN per detachment).
          { name: 'Primaris Lieutenant' }, // 65, PL 4
          ...THREE_INTERCESSORS,
          { name: 'Aggressor Squad' }, // 30 × 3 = 90 (default wargear 0), PL 6
          { name: 'Hellblaster Squad' }, // 30 × 5 = 150 (plasma incinerators 0), PL 8
        ],
      }],
      // 110 + 65 + 3 × 90 + 90 + 150 = 685; PL 7 + 4 + 3 × 5 + 6 + 8 = 40
      expect: { points: 685, powerLevel: 40 },
    },
  ],
  illegal: [
    {
      // Company Command (Codex: Space Marines): at most 2 LIEUTENANTS per detachment. BSData limits this Lieutenant
      // datasheet to 2 per detachment itself, and every LIEUTENANT to 2 per detachment.
      title: 'three Lieutenants in a Battalion',
      battleSize: 'onslaught',
      detachments: [{ detachment: BATTALION, units: [{ ...LIEUTENANT, warlord: true }, LIEUTENANT, LIEUTENANT, ...THREE_INTERCESSORS] }],
      // Reported twice: by the Lieutenant datasheet limit (unit-limit) and by the LIEUTENANT keyword limit (other).
      expectRules: ['unit-limit', 'other'],
    },
    {
      // §2.1: Onslaught allows at most 4 detachments.
      title: 'five detachments at Onslaught',
      battleSize: 'onslaught',
      detachments: [
        // A different HQ datasheet in each, so the Rule of Three isn't broken.
        { detachment: PATROL, units: [{ name: 'Primaris Lieutenant', warlord: true }, { name: 'Intercessor Squad' }] },
        smallPatrol('Primaris Captain'),
        smallPatrol('Primaris Chaplain'),
        smallPatrol('Primaris Librarian'),
        smallPatrol('Primaris Techmarine'),
      ],
      expectRules: ['detachment-count'],
    },
    {
      // Army Faction (§1): every unit must share a Faction keyword; ADEPTUS ASTARTES and NECRONS share none.
      title: 'Necrons Patrol in a Salamanders army',
      battleSize: 'onslaught',
      detachments: [
        { detachment: BATTALION, units: [HESTAN, { name: 'Primaris Lieutenant' }, ...THREE_INTERCESSORS] },
        { detachment: PATROL, catalogue: 'Necrons', army: { 'Dynasty Choice': 'Dynasty: Sautekh' }, units: [{ name: 'Overlord' }, { name: 'Necron Warriors' }] },
      ],
      expectRules: ['army-faction'],
    },
    {
      // §5: a Core Book CHARACTER Warlord gets one Warlord Trait; He'stan's is fixed (Anvil of Strength).
      title: "He'stan as Warlord without his Warlord Trait",
      battleSize: 'onslaught',
      detachments: [{ detachment: BATTALION, units: [{ name: "Vulkan He'stan", warlord: true }, { name: 'Primaris Lieutenant' }, ...THREE_INTERCESSORS] }],
      expectRules: ['option-required'],
    },
  ],
} satisfies CatalogueCorpus;
