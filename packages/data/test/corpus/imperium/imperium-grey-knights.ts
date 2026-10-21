/**
 * Grey Knights. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 (Combat
 * Patrol: 3 CP, one detachment), §4 (Auxiliary Support: 2 CP, no refund), §5 (Warlord Trait), §7.5 (Arks of Omen
 * Detachment); Codex: Grey Knights (03_Codexes/Imperium/Grey_Knights.md) and Wahapedia Stratagems.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const CAPTAIN: UnitSpec = { name: 'Brother-Captain', warlord: true }; // 100 (Nemesis force halberd, master-crafted storm bolter: 0), PL 6
const STRIKE: UnitSpec = { name: 'Strike Squad' }; // 20 × 5 = 100 (4 Grey Knights, Justicar; wargear 0), PL 6
const THREE_STRIKE: UnitSpec[] = [STRIKE, STRIKE, STRIKE];

export default {
  catalogue: 'Imperium - Grey Knights',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Troops compulsory',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          CAPTAIN,
          { name: 'Paladin Ancient' }, // 100, PL 6
          ...THREE_STRIKE,
          { name: 'Interceptor Squad' }, // 24 × 5 = 120 (4 Interceptors, Interceptor Justicar; wargear 0), PL 8
        ],
      }],
      // 100 + 100 + 3 × 100 + 120 = 620; PL 6 + 6 + 3 × 6 + 8 = 38
      expect: { points: 620, powerLevel: 38 },
    },
  ],
  illegal: [
    {
      // Combat Patrol: 3 CP and one detachment (§2.1). An Auxiliary Support Detachment costs 2 CP and gives nothing
      // back (§4). The Warlord's free trait plus Exemplar of the Silvered Host (1 CP, a second trait) and Armoury of
      // Titan (1 CP, a Relic), each once (Wahapedia Stratagems), leave -1 CP.
      title: 'Exemplar of the Silvered Host and Armoury of Titan in a Combat Patrol Auxiliary Support Detachment',
      battleSize: 'combat-patrol',
      detachments: [{
        detachment: 'Auxiliary Support Detachment -2CP',
        units: [{
          ...CAPTAIN,
          options: ['4: First to the Fray', 'Stratagem: Exemplar of the Silver Host', '5: Nemesis Lord', 'Stratagem: Armoury of Titan', 'Cuirass of Sacrifice'],
        }],
      }],
      expectRules: ['cp-negative'],
    },
    {
      // Paladin Ancient: "Your army can only include one PALADIN ANCIENT" (Wahapedia datasheet 000000385;
      // overrides/add-constraints.json). Two Elites units are within the optional slots.
      title: 'two Paladin Ancients',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [CAPTAIN, { name: 'Paladin Ancient' }, { name: 'Paladin Ancient' }, ...THREE_STRIKE] }],
      expectRules: ['unique'],
    },
  ],
} satisfies CatalogueCorpus;
