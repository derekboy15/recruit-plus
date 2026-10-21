/**
 * Ultramarines. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen
 * Detachment slots, Rule of Three, permitted allies) and §8.2 (Agents of the Imperium); Codex: Space Marines
 * (03_Codexes/Imperium/Space_Marines.md).
 */
import type { CatalogueCorpus } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const THREE_INTERCESSORS = [{ name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }, { name: 'Intercessor Squad' }];

export default {
  catalogue: 'Imperium - Adeptus Astartes - Ultramarines',
  legal: [
    {
      title: 'Arks of Omen Strike Force with an Inquisitor',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          // Uriel's fixed Warlord Trait costs 1 CP under Arks of Omen (Warlord Trait Requisition Stratagem).
          { name: 'Uriel Ventris', warlord: true, options: ['Stratagem: Warlord Trait', 'Paragon of War'] }, // 100, PL 6
          { name: 'Primaris Chaplain' }, // 75, PL 5
          ...THREE_INTERCESSORS, // each 18 × 5 = 90, PL 5
          { name: 'Bladeguard Veteran Squad' }, // 35 × 3 = 105, PL 5
          { name: 'Redemptor Dreadnought' }, // 185 (default weapons 0), PL 10
          // Agents of the Imperium (April 2023, §8.2): one AGENT OF THE IMPERIUM unit per Arks of Omen Detachment, without a slot.
          { name: 'Inquisitor', options: ['Bolt pistol', 'Ordo Hereticus'] }, // 60 (bolt pistol, chainsword 0), PL 4
        ],
      }],
      // 100 + 75 + 3 × 90 + 105 + 185 + 60 = 795; PL 6 + 5 + 3 × 5 + 5 + 10 + 4 = 45
      expect: { points: 795, powerLevel: 45 },
    },
  ],
  illegal: [
    {
      // Rule of Three (§7.5): a fourth Redemptor Dreadnought. Elites as the compulsory type gives 3 + 3 Elites slots.
      title: 'four Redemptor Dreadnoughts',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: { 'Arks of Omen Compulsory Type': 'Elites' },
        units: [
          { name: 'Primaris Captain', warlord: true },
          { name: 'Redemptor Dreadnought' },
          { name: 'Redemptor Dreadnought' },
          { name: 'Redemptor Dreadnought' },
          { name: 'Redemptor Dreadnought' },
        ],
      }],
      expectRules: ['rule-of-three'],
    },
    {
      // Arks of Omen HQ slots: 1 compulsory + 0-3 optional, so a fifth HQ unit is one too many.
      title: 'five HQ units in the Arks of Omen Detachment',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          { name: 'Primaris Captain', warlord: true },
          { name: 'Primaris Lieutenant' },
          { name: 'Primaris Librarian' },
          { name: 'Primaris Chaplain' },
          { name: 'Primaris Techmarine' },
          ...THREE_INTERCESSORS,
        ],
      }],
      expectRules: ['slot-max'],
    },
    {
      // Arks of Omen allies (§7.5): an IMPERIUM army may only ally Agents of the Imperium, a single Imperial Knight or a
      // Leagues of Votann Patrol, so an Astra Militarum Patrol is not allowed.
      title: 'Astra Militarum Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, units: [{ name: 'Primaris Captain', warlord: true }, ...THREE_INTERCESSORS] },
        { detachment: PATROL, catalogue: 'Imperium - Astra Militarum', units: [{ name: 'Platoon Command Squad' }, { name: 'Infantry Squad' }] },
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
        units: [{ name: 'Primaris Captain', warlord: true }, { name: 'Captain in Gravis Armor' }, ...THREE_INTERCESSORS],
      }],
      expectRules: ['other'],
    },
  ],
} satisfies CatalogueCorpus;
