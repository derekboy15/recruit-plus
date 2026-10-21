/**
 * Adeptus Custodes. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: Codex: Adeptus Custodes (03_Codexes/Imperium/Adeptus_Custodes.md), Wahapedia
 * Stratagems, research library 01_Core_Rules/Army_Building_Detachments_and_CP.md.
 */
import type { CatalogueCorpus } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
/** Arks of Omen compulsory slots: 1 HQ and 3 Troops (Troops is the default compulsory type). */
const THREE_GUARD = [{ name: 'Custodian Guard Squad' }, { name: 'Custodian Guard Squad' }, { name: 'Custodian Guard Squad' }];

export default {
  catalogue: 'Imperium - Adeptus Custodes',
  legal: [
    {
      title: 'Emperor\'s Chosen Arks of Omen Strike Force',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          { name: 'Shield-Captain on Dawneagle Jetbike', warlord: true }, // 160 (hurricane bolter 0, interceptor lance 0), PL 9
          { name: 'Shield-Captain' }, // 105 (guardian spear 0), PL 6
          { name: 'Custodian Guard Squad', models: { 'Custodian w/ Guardian Spear': 5 } }, // 45 × 5 = 225, PL 11 (4-5 models)
          { name: 'Custodian Guard Squad' }, // 45 × 3 = 135, PL 7
          { name: 'Custodian Guard Squad' }, // 45 × 3 = 135, PL 7
          { name: '!Allarus Custodians', models: { 'Allarus w/ Guardian Spear': 3 } }, // 60 × 3 = 180, PL 3 + 3 + 3 = 9
          { name: '!Vertus Praetors' }, // 80 × 3 = 240, PL 12
        ],
      }],
      // 160 + 105 + 225 + 135 + 135 + 180 + 240 = 1180; PL 9 + 6 + 11 + 7 + 7 + 9 + 12 = 61
      expect: { points: 1180, powerLevel: 61 },
    },
    {
      title: 'Combat Patrol',
      battleSize: 'combat-patrol',
      detachments: [{
        detachment: PATROL,
        units: [
          { name: 'Shield-Captain', warlord: true }, // 105, PL 6
          { name: 'Custodian Guard Squad' }, // 45 × 3 = 135, PL 7
          { name: 'Custodian Guard Squad' }, // 45 × 3 = 135, PL 7
          { name: '!Allarus Custodians', models: { 'Allarus w/ Guardian Spear': 2 } }, // 60 × 2 = 120, PL 3 + 3 = 6
        ],
      }],
      // 105 + 135 + 135 + 120 = 495; PL 6 + 7 + 7 + 6 = 26
      expect: { points: 495, powerLevel: 26 },
    },
  ],
  illegal: [
    {
      // Combat Patrol starts with 3 CP; the Patrol's 2 CP come back with the Warlord in it. Four 1 CP Requisition
      // Stratagems, each used once on a model it allows (Wahapedia Stratagems), leave -1 CP.
      title: 'four 1 CP Stratagems at Combat Patrol',
      battleSize: 'combat-patrol',
      detachments: [{
        detachment: PATROL,
        units: [
          {
            name: 'Shield-Captain',
            warlord: true,
            options: ['2. Champion of the Imperium', 'Stratagem: Victor of the Blood Games', '3. Superior Creation', 'Stratagem: Open the Vaults', "Eagle's Eye"],
          },
          { name: '!Vexilus Praetor', options: ["Stratagem: The Emperor's Heroes", '4. Impregnable Mind'] },
          { name: 'Custodian Guard Squad' },
          { name: 'Venerable Contemptor Dreadnought', options: ['Stratagem: Eternal Penitent'] },
        ],
      }],
      expectRules: ['cp-negative'],
    },
    {
      // Valerian: "Your army can only include one VALERIAN model" (Wahapedia datasheet).
      title: 'two Valerians',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [{ name: 'Shield-Captain in Allarus Terminator Armor', warlord: true, options: ['Guardian Spear'] }, { name: 'Shield-Captain on Dawneagle Jetbike' }, { name: 'Valerian' }, { name: 'Valerian' }, ...THREE_GUARD],
      }],
      expectRules: ['unique'],
    },
    {
      // Core Book: one Warlord per army.
      title: 'two Warlords',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [{ name: 'Shield-Captain', warlord: true }, { name: 'Shield-Captain on Dawneagle Jetbike', warlord: true }, ...THREE_GUARD],
      }],
      expectRules: ['warlord-extra'],
    },
    {
      // Army Faction (§1): every unit must share a Faction keyword; ADEPTUS CUSTODES and NECRONS share none.
      title: 'Necrons Patrol in a Custodes Onslaught army',
      battleSize: 'onslaught',
      detachments: [
        { detachment: PATROL, units: [{ name: 'Shield-Captain', warlord: true }, { name: 'Custodian Guard Squad' }] },
        { detachment: PATROL, catalogue: 'Necrons', army: { 'Dynasty Choice': 'Dynasty: Sautekh' }, units: [{ name: 'Overlord' }, { name: 'Necron Warriors' }] },
      ],
      expectRules: ['army-faction'],
    },
  ],
} satisfies CatalogueCorpus;
