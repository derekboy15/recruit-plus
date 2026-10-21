/**
 * Renegades & Heretics (Warhammer Legends, Index 1.0, December 2020; 03_Codexes/Chaos/Other_Chaos_Content.md §3).
 * Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army
 * Faction), §7.5 (Arks of Omen Detachment: 1 HQ plus 3 Troops as the compulsory type; Rule of Two at Incursion; any
 * CHAOS army may ally one Chaos Knights Super-heavy Auxiliary holding a single Dreadblade), §8.2 (AGENT OF THE
 * IMPERIUM units join IMPERIUM detachments only); Codex: Chaos Knights (03_Codexes/Chaos/Chaos_Knights.md §2 Fallen
 * Hero, §3 Fell Bonds).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const SUPER_HEAVY_AUX = 'Super-Heavy Auxiliary Detachment -3CP';
const KNIGHTS = 'Chaos - Chaos Knights';
const TROOPS = { 'Arks of Omen Compulsory Type': 'Troops' };
const MALEFIC_LORD: UnitSpec = { name: 'Malefic Lord', warlord: true }; // 50 (bare hands 0), PL 3
const ENFORCER: UnitSpec = { name: 'Renegade Enforcer' }; // 23 (laspistol, brutal assault weapon: 0), PL 2
/** Malefic Lord and three Troops units: the smallest Troops-compulsory detachment. */
const CORE: UnitSpec[] = [
  MALEFIC_LORD, // 50, PL 3
  { name: 'Renegade Militia Squad', options: ['Renegade Militia Champion > Autogun'] }, // 6 × 10 = 60 (autoguns 0), PL 3
  { name: 'Renegade Cultists' }, // 5 × 10 = 50 (autoguns 0), PL 2
  { name: 'Renegade Mutant Rabble' }, // 7 × 10 = 70 (laspistols 0), PL 3
];
const WARBAND: DetachmentSpec = {
  detachment: AOO,
  army: TROOPS,
  units: [
    ...CORE, // 50 + 60 + 50 + 70 = 230, PL 3 + 3 + 2 + 3 = 11
    { name: 'Renegade Commander' }, // 35 (laspistol, brutal assault weapon: 0), PL 2
    ENFORCER, // 23, PL 2
    { name: 'Renegade Chaos Spawn' }, // 23 × 1, PL 1
  ],
};
/** Chaos Knights Fallen Hero: a Dreadblade War Dog with its Fell Bond. */
const DREADBLADE: UnitSpec = { name: 'War Dog Karnivore Squadron', options: ['Infernal Dreadblade', 'Biomechanical Fusion'] }; // 140 + havoc multi-launcher 5 = 145, PL 8

export default {
  catalogue: 'Chaos - Renegades & Heretics [LEGENDS]',
  legal: [
    {
      title: 'Arks of Omen Incursion warband (Troops compulsory type)',
      battleSize: 'incursion',
      detachments: [WARBAND],
      // 230 + 35 + 23 + 23 = 311; PL 11 + 2 + 2 + 1 = 16
      expect: { points: 311, powerLevel: 16 },
    },
    {
      // §7.5: any CHAOS Arks of Omen army may ally one Chaos Knights Super-heavy Auxiliary with a single Dreadblade.
      title: 'the same warband with a Chaos Knights Dreadblade Super-Heavy Auxiliary ally',
      battleSize: 'incursion',
      detachments: [WARBAND, { detachment: SUPER_HEAVY_AUX, catalogue: KNIGHTS, units: [DREADBLADE] }],
      // 311 + 145 = 456; PL 16 + 8 = 24
      expect: { points: 456, powerLevel: 24 },
    },
  ],
  illegal: [
    {
      // §7.5: the Chaos Knights ally is a Dreadblade; a House Vextrix War Dog is not one.
      title: 'House Vextrix War Dog as the Chaos Knights ally',
      battleSize: 'incursion',
      detachments: [WARBAND, { detachment: SUPER_HEAVY_AUX, catalogue: KNIGHTS, units: [{ name: 'War Dog Karnivore Squadron', options: ['House Vextrix'] }] }],
      expectRules: ['detachment-faction'],
    },
    {
      // §1 and §8.2: an Inquisitor (IMPERIUM, INQUISITION) shares no Faction keyword with the Renegades (CHAOS,
      // RENEGADES AND HERETICS), and AGENT OF THE IMPERIUM units only join IMPERIUM detachments. BSData still offers
      // Agents of the Imperium to this catalogue.
      title: 'an Inquisitor in the warband',
      battleSize: 'incursion',
      detachments: [{ ...WARBAND, units: [...CORE, { name: 'Inquisitor', options: ['Bolt pistol', 'Ordo Xenos'] }] }],
      expectRules: ['army-faction'],
    },
    {
      // Rule of Two (§7.5): a datasheet other than Troops or Dedicated Transports at most twice at Incursion.
      title: 'three Renegade Enforcers at Incursion',
      battleSize: 'incursion',
      detachments: [{ ...WARBAND, units: [...CORE, ENFORCER, ENFORCER, ENFORCER] }],
      expectRules: ['rule-of-three'],
    },
  ],
} satisfies CatalogueCorpus;
