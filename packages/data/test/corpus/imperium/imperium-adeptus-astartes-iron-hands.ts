/**
 * Iron Hands. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §5, §6 (Warlord
 * Trait Requisition), §7.5 (Arks of Omen: one Arks of Omen Detachment plus one permitted ally); Codex: Space Marines
 * (03_Codexes/Imperium/Space_Marines.md: Company Command).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const FEIRROS: UnitSpec = { name: 'Iron Father Feirros', warlord: true }; // 130, PL 8
const THREE_INTERCESSORS: UnitSpec[] = [{ name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }]; // each 18 × 5 = 90, PL 5

export default {
  catalogue: 'Imperium - Adeptus Astartes - Iron Hands',
  legal: [
    {
      // Arks of Omen: Feirros' Warlord Trait only comes with the 1 CP Warlord Trait Requisition (§5, §6), so he may go without.
      title: 'Arks of Omen Strike Force, Feirros without a Warlord Trait',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          FEIRROS,
          { name: 'Primaris Techmarine' }, // 70, PL 4
          ...THREE_INTERCESSORS,
          { name: 'Redemptor Dreadnought' }, // 185 (default weapons 0), PL 10
          { name: 'Invictor Tactical Warsuit' }, // 140 (default weapons 0), PL 8
        ],
      }],
      // 130 + 70 + 3 × 90 + 185 + 140 = 795; PL 8 + 4 + 3 × 5 + 10 + 8 = 45
      expect: { points: 795, powerLevel: 45 },
    },
  ],
  illegal: [
    {
      // §7.5: an Arks of Omen army takes no detachments besides the Arks of Omen Detachment and one ally from the
      // permitted list; an Iron Hands Patrol isn't on it.
      title: 'Iron Hands Patrol beside the Arks of Omen Detachment',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, units: [FEIRROS, ...THREE_INTERCESSORS] },
        { detachment: PATROL, units: [{ name: 'Primaris Techmarine' }, { name: 'Intercessor Squad' }] },
      ],
      expectRules: ['detachment-not-allowed'],
    },
    {
      // Company Command (Codex: Space Marines): at most one CAPTAIN per detachment. BSData's CAPTAIN limit is not a
      // battlefield-role slot, so it is reported as `other`.
      title: 'two Captains in one detachment',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [FEIRROS, { name: 'Primaris Captain' }, { name: 'Captain in Phobos Armour' }, ...THREE_INTERCESSORS],
      }],
      expectRules: ['other'],
    },
  ],
} satisfies CatalogueCorpus;
