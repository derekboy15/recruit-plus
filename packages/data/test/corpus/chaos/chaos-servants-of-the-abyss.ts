/**
 * Servants of the Abyss (the Blackstone Fortress Chaos units; Wahapedia files them under Chaos Space Marines). Every
 * unit has the SERVANTS OF THE ABYSS faction keyword, so they fill an Arks of Omen Detachment on their own (§7.5).
 * Points and PL: Wahapedia snapshot (Datasheets.power_points; Datasheets.Cost for per-unit costs, otherwise
 * Datasheets_models.Cost × models). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5
 * (Arks of Omen Detachment: 1 HQ plus 3 Troops as the compulsory type; Rule of Two at Incursion); Wahapedia datasheets:
 * - 000001602 Black Legionnaires, "Only one of this unit can be included in your army"; Mallex's Followers: "this unit
 *   does not take up slots in a Detachment that includes OBSIDIUS MALLEX";
 * - 000001604 Chaos Beastmen, Slaves to Mallex: "this unit does not take up slots in a Detachment that includes
 *   OBSIDIUS MALLEX".
 *
 * Left out: the Traitor Commissar, Chaos Ogryn and this catalogue's Traitor Guardsmen have no Wahapedia datasheet (the
 * snapshot's Traitor Guardsmen Squad, 000002590, is the Chaos Space Marines codex unit), so their points can't be
 * checked.
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const TROOPS = { 'Arks of Omen Compulsory Type': 'Troops' };
const MALLEX: UnitSpec = { name: 'Obsidius Mallex', warlord: true }; // 130 (plasma pistol, thunder hammer: 0), PL 7
const LEGIONNAIRES: UnitSpec = { name: 'Black Legionnaires' }; // 28 per unit (2 models), PL 1
const BEASTMEN: UnitSpec = { name: 'Chaos Beastmen' }; // 25 per unit (4 models), PL 1
const CULTISTS: UnitSpec = { name: 'Cultists of the Abyss' }; // 40 per unit (7 models), PL 2
const FIREBRAND: UnitSpec = { name: 'Cultist Firebrand' }; // 35, PL 2
const ABYSS: DetachmentSpec = {
  detachment: AOO,
  army: TROOPS,
  units: [
    MALLEX, // 130, PL 7
    LEGIONNAIRES, // 28, PL 1 (no slot: Mallex is here)
    BEASTMEN, // 25, PL 1 (no slot: Mallex is here)
    CULTISTS, // 40, PL 2
    CULTISTS, // 40, PL 2
    CULTISTS, // 40, PL 2
    { name: 'Negavolt Cultists' }, // 50 per unit (4 models), PL 2
    FIREBRAND, // 35, PL 2
  ],
};

export default {
  catalogue: 'Chaos - Servants of the Abyss',
  legal: [
    {
      title: 'Arks of Omen Incursion led by Obsidius Mallex (Troops compulsory type)',
      battleSize: 'incursion',
      detachments: [ABYSS],
      // 130 + 28 + 25 + 3 × 40 + 50 + 35 = 388; PL 7 + 1 + 1 + 3 × 2 + 2 + 2 = 19
      expect: { points: 388, powerLevel: 19 },
    },
  ],
  illegal: [
    {
      // Black Legionnaires (000001602): only one unit per army.
      title: 'two Black Legionnaires units',
      battleSize: 'incursion',
      detachments: [{ ...ABYSS, units: [MALLEX, LEGIONNAIRES, LEGIONNAIRES, CULTISTS, CULTISTS, CULTISTS] }],
      expectRules: ['unique'],
    },
    {
      // §7.5: Troops as the compulsory type needs 3 Troops units. With Mallex in the detachment the Black Legionnaires
      // and the Beastmen take up no slots, so only the one Cultists of the Abyss unit counts.
      title: 'Troops compulsory filled with the Black Legionnaires and Beastmen',
      battleSize: 'incursion',
      detachments: [{ ...ABYSS, units: [MALLEX, LEGIONNAIRES, BEASTMEN, CULTISTS] }],
      expectRules: ['slot-min'],
    },
    {
      // Rule of Two (§7.5): a datasheet other than Troops or Dedicated Transports at most twice at Incursion.
      title: 'three Cultist Firebrands at Incursion',
      battleSize: 'incursion',
      detachments: [{ ...ABYSS, units: [MALLEX, CULTISTS, CULTISTS, CULTISTS, FIREBRAND, FIREBRAND, FIREBRAND] }],
      expectRules: ['rule-of-three'],
    },
  ],
} satisfies CatalogueCorpus;
