/**
 * Necrons (Codex: Necrons, 2020; 03_Codexes/Xenos/Necrons.md). Points and PL: Wahapedia snapshot
 * (Datasheets.power_points; Datasheets.Cost for per-unit costs, otherwise Datasheets_models.Cost × models;
 * Datasheets_wargear.cost; default wargear costs 0). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §5 (Warlord Traits under Arks of Omen: only through the 1 CP
 * Warlord Trait Requisition Stratagem), §7.5 (Arks of Omen Detachment: 1 HQ plus 3 Troops as the compulsory type; Rule
 * of Three at Strike Force; no ally is listed for a Necrons army); Necrons.md §2 (the Silent King is a Dynastic Agent
 * and joins any dynasty) and §4 (his fixed Warlord Trait is The Triarch's Will); Wahapedia datasheet 000002360 (The
 * Silent King: "Szarekh must be your army's WARLORD") and 000000532 (Trazyn the Infinite).
 *
 * BSData v9.8.0 makes five named Warlords' fixed traits compulsory outside War Zone Nephilim, stratagem or not: The
 * Silent King (The Triarch's Will), Anrakyr the Traveller (Implacable Conqueror), Illuminor Szeras and Trazyn the
 * Infinite (Enduring Will) and Orikan the Diviner (Immortal Pride). Under Arks of Omen a Warlord only has a trait if
 * the 1 CP Warlord Trait Requisition Stratagem is used (§5, §6), so overrides/constraints.json pins those minimums to
 * 0. One list pays for the Silent King's trait; Trazyn leads another without one.
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const OVERLORD: UnitSpec = { name: 'Overlord' }; // 90 (tachyon arrow, hyperphase glaive: 0), PL 6
const WARRIORS: UnitSpec = { name: 'Necron Warriors' }; // 11 × 10 = 110, PL 6
const WRAITHS: UnitSpec = { name: 'Canoptek Wraiths' }; // 35 × 3 = 105 (vicious claws: 0), PL 6
const SILENT_KING: UnitSpec = { name: 'The Silent King' }; // 400 per unit (Szarekh and 2 Triarchal Menhirs), PL 21
const TRAZYN: UnitSpec = { name: 'Trazyn the Infinite' }; // 90, PL 5
const TRIARCHS_WILL: UnitSpec = { ...SILENT_KING, warlord: true, options: ['Stratagem: Warlord Trait', "Warlord Trait (Szarekhan): The Triarch's Will"] };
const DYNASTY = (dynasty: string) => ({ 'Dynasty Choice': `Dynasty: ${dynasty}` });
const SAUTEKH: DetachmentSpec = {
  detachment: AOO,
  army: DYNASTY('Sautekh'),
  units: [
    { ...OVERLORD, warlord: true }, // 90, PL 6
    WARRIORS, // 110, PL 6
    WARRIORS, // 110, PL 6
    WARRIORS, // 110, PL 6
    WRAITHS, // 105, PL 6
    { name: 'Royal Warden' }, // 70 (relic gauss blaster: 0), PL 4
  ],
};
const SZAREKHAN = (units: UnitSpec[]): DetachmentSpec => ({ detachment: AOO, army: DYNASTY('Szarekhan'), units });

export default {
  catalogue: 'Necrons',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Sautekh (Troops compulsory type)',
      battleSize: 'strike-force',
      detachments: [SAUTEKH],
      // 90 + 3 × 110 + 105 + 70 = 595; PL 6 + 3 × 6 + 6 + 4 = 34
      expect: { points: 595, powerLevel: 34 },
    },
    {
      // A named Warlord without the Warlord Trait Requisition Stratagem has no Warlord Trait (§5, §6).
      title: 'Arks of Omen Strike Force led by Trazyn the Infinite, with no Warlord Trait',
      battleSize: 'strike-force',
      detachments: [{ ...SAUTEKH, units: [{ ...TRAZYN, warlord: true }, WARRIORS, WARRIORS, WARRIORS] }],
      // 90 + 3 × 110 = 420; PL 5 + 3 × 6 = 23
      expect: { points: 420, powerLevel: 23 },
    },
    {
      // The Silent King is the Warlord (000002360) and takes his trait through the Requisition Stratagem (§5).
      title: 'Arks of Omen Strike Force led by the Silent King',
      battleSize: 'strike-force',
      detachments: [SZAREKHAN([TRIARCHS_WILL, OVERLORD, WARRIORS, WARRIORS, WARRIORS])],
      // 400 + 90 + 3 × 110 = 820; PL 21 + 6 + 3 × 6 = 45
      expect: { points: 820, powerLevel: 45 },
    },
  ],
  illegal: [
    {
      // The Silent King (000002360): "If your army is Battle-forged, Szarekh must be your army's WARLORD." Two issues
      // for the one mistake: the policy reports that the Silent King isn't the Warlord, and BSData hides every other
      // unit's Warlord option once he is in the army, so the Overlord's Warlord is hidden-selected.
      title: 'the Silent King beside an Overlord Warlord',
      battleSize: 'strike-force',
      detachments: [SZAREKHAN([{ ...OVERLORD, warlord: true }, SILENT_KING, WARRIORS, WARRIORS, WARRIORS])],
      expectRules: ['warlord-missing', 'hidden-selected'],
    },
    {
      // Trazyn the Infinite (000000532): "Your army can only include one TRAZYN THE INFINITE model."
      title: 'two Trazyn the Infinites',
      battleSize: 'strike-force',
      detachments: [{ ...SAUTEKH, units: [{ ...OVERLORD, warlord: true }, TRAZYN, TRAZYN, WARRIORS, WARRIORS, WARRIORS] }],
      expectRules: ['unique'],
    },
    {
      // Rule of Three (§7.5): a datasheet other than Troops or Dedicated Transports at most three times at Strike Force.
      // Fast Attack is the compulsory type, so four Fast Attack units fit the detachment's slots (3 + 3).
      title: 'four Canoptek Wraiths units at Strike Force',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: { ...DYNASTY('Sautekh'), 'Arks of Omen Compulsory Type': 'Fast Attack' }, units: [{ ...OVERLORD, warlord: true }, WRAITHS, WRAITHS, WRAITHS, WRAITHS] }],
      expectRules: ['rule-of-three'],
    },
  ],
} satisfies CatalogueCorpus;
