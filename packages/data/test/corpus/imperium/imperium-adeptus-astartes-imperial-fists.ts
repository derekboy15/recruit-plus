/**
 * Imperial Fists. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 (Incursion:
 * 1000 pts), §5, §6 (Warlord Trait Requisition), §7.5 (Arks of Omen Detachment: compulsory stack, slots, Rule of Two).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
/** Fast Attack as the Arks of Omen compulsory stack: three Fast Attack units, three more optional. */
const FAST_ARMY = { 'Arks of Omen Compulsory Type': 'Fast Attack' };
const LYSANDER: UnitSpec = { name: 'Captain Lysander', warlord: true }; // 120, PL 7
/** The legal list's units after the Warlord. */
const INCURSION_UNITS: UnitSpec[] = [
  { name: 'Primaris Lieutenant' }, // 65, PL 4
  { name: 'Outrider Squad' }, // 35 × 3 = 105 (default wargear 0), PL 6
  { name: 'Outrider Squad' }, // 35 × 3 = 105, PL 6
  { name: 'Invader ATV Squad' }, // 70 × 1 = 70 (default wargear 0), PL 4
  { name: 'Intercessor Squad' }, // 18 × 5 = 90, PL 5
];

export default {
  catalogue: 'Imperium - Adeptus Astartes - Imperial Fists',
  legal: [
    {
      // Arks of Omen: Lysander's Warlord Trait only comes with the 1 CP Warlord Trait Requisition (§5, §6), so he may go without.
      title: 'Arks of Omen Incursion, Fast Attack compulsory, Lysander without a Warlord Trait',
      battleSize: 'incursion',
      detachments: [{ detachment: AOO, army: FAST_ARMY, units: [LYSANDER, ...INCURSION_UNITS] }],
      // 120 + 65 + 2 × 105 + 70 + 90 = 555; PL 7 + 4 + 2 × 6 + 4 + 5 = 32
      expect: { points: 555, powerLevel: 32 },
    },
  ],
  illegal: [
    {
      // §7.5: Fast Attack slots are 3 compulsory + 0-3 optional, so a seventh Fast Attack unit is one too many (two of
      // each datasheet, for the Rule of Two).
      title: 'seven Fast Attack units',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        army: FAST_ARMY,
        units: [
          LYSANDER,
          { name: 'Outrider Squad' },
          { name: 'Outrider Squad' },
          { name: 'Invader ATV Squad' },
          { name: 'Invader ATV Squad' },
          { name: 'Suppressor Squad' },
          { name: 'Suppressor Squad' },
          { name: 'Land Speeders' },
        ],
      }],
      expectRules: ['slot-max'],
    },
    {
      // §2.1: Incursion is up to 1000 pts. The legal list (555) plus a Repulsor Executioner (250) and a Repulsor (220),
      // before any wargear, is 1025.
      title: 'over 1000 pts at Incursion',
      battleSize: 'incursion',
      detachments: [{ detachment: AOO, army: FAST_ARMY, units: [LYSANDER, ...INCURSION_UNITS, { name: 'Repulsor Executioner' }, { name: 'Repulsor' }] }],
      expectRules: ['points-over'],
    },
    {
      // §5: every army nominates a Warlord (a CHARACTER when it has one).
      title: 'no Warlord',
      battleSize: 'incursion',
      detachments: [{ detachment: AOO, army: FAST_ARMY, units: [{ name: 'Captain Lysander' }, ...INCURSION_UNITS] }],
      expectRules: ['warlord-missing'],
    },
  ],
} satisfies CatalogueCorpus;
