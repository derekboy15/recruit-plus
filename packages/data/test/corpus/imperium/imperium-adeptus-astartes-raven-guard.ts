/**
 * Raven Guard. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §5, §6 (Warlord
 * Trait Requisition), §7.5 (Arks of Omen Detachment); Codex: Space Marines (03_Codexes/Imperium/Space_Marines.md:
 * Company Command, Vanguard Spearhead Army of Renown).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const HEAVY_ARMY = { 'Arks of Omen Compulsory Type': 'Heavy Support' };
const SHRIKE: UnitSpec = { name: 'Kayvaan Shrike', warlord: true }; // 120, PL 7
/** The Codex Lieutenant datasheet (not the Primaris one), with its two weapons. */
const LIEUTENANT: UnitSpec = { name: 'Lieutenant', options: ['Master-crafted boltgun', 'Astartes Chainsword'] };
const THREE_ELIMINATORS: UnitSpec[] = [{ name: 'Eliminator Squad' }, { name: 'Eliminator Squad' }, { name: 'Eliminator Squad' }]; // each 25 × 3 = 75 (bolt sniper rifles 0), PL 4

export default {
  catalogue: 'Imperium - Adeptus Astartes - Raven Guard',
  legal: [
    {
      // Arks of Omen: Shrike's Warlord Trait only comes with the 1 CP Warlord Trait Requisition (§5, §6), so he may go without.
      title: 'Arks of Omen Strike Force, Heavy Support compulsory, Shrike without a Warlord Trait',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: HEAVY_ARMY,
        units: [
          SHRIKE,
          { name: 'Lieutenant in Phobos Armour' }, // 70, PL 4
          ...THREE_ELIMINATORS,
          { name: 'Infiltrator Squad' }, // 20 × 5 = 100, PL 6
        ],
      }],
      // 120 + 70 + 3 × 75 + 100 = 515; PL 7 + 4 + 3 × 4 + 6 = 29
      expect: { points: 515, powerLevel: 29 },
    },
  ],
  illegal: [
    {
      // Company Command (Codex: Space Marines): at most 2 LIEUTENANTS per detachment. BSData limits this Lieutenant
      // datasheet to 2 per detachment itself, and every LIEUTENANT to 2 per detachment.
      title: 'three Lieutenants in one detachment',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: HEAVY_ARMY,
        units: [SHRIKE, LIEUTENANT, LIEUTENANT, LIEUTENANT, ...THREE_ELIMINATORS],
      }],
      // Reported twice: by the Lieutenant datasheet limit (unit-limit) and by the LIEUTENANT keyword limit (other).
      expectRules: ['unit-limit', 'other'],
    },
    {
      // §5: every army nominates a Warlord (a CHARACTER when it has one).
      title: 'no Warlord',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: HEAVY_ARMY, units: [{ name: 'Kayvaan Shrike' }, ...THREE_ELIMINATORS] }],
      expectRules: ['warlord-missing'],
    },
    {
      // Vanguard Spearhead Army of Renown (Codex: Space Marines): an all-PHOBOS army (plus Impulsors, Invictors and
      // Suppressors), so an Intercessor Squad already in the list is no longer allowed once the army takes it.
      title: 'Vanguard Spearhead chosen after adding an Intercessor Squad',
      battleSize: 'onslaught',
      detachments: [{
        detachment: PATROL,
        units: [{ name: 'Captain in Phobos Armour', warlord: true }, { name: 'Infiltrator Squad' }, { name: 'Intercessor Squad' }],
        after: { army: { 'Army of Renown - Vanguard Spearhead': [] } },
      }],
      expectRules: ['hidden-selected'],
    },
  ],
} satisfies CatalogueCorpus;
