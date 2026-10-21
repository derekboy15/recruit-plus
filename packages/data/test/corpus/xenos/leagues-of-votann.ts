/**
 * Leagues of Votann (Codex: Leagues of Votann, 2022; 03_Codexes/Xenos/Leagues_of_Votann.md). Points and PL: Wahapedia
 * snapshot (Datasheets.power_points; Datasheets.Cost for per-unit costs, otherwise Datasheets_models.Cost × models;
 * Datasheets_wargear.cost; default wargear costs 0 unless noted). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction), §7.5 (Arks of Omen Detachment: 1 HQ plus 3
 * Troops as the compulsory type; Rule of Three at Strike Force; no ally is listed for a Leagues of Votann army, while
 * an IMPERIUM army may take a Leagues of Votann Patrol); Leagues_of_Votann.md §2 (Hero of the Oathband: one KÂHL per
 * detachment).
 *
 * The Leagues of Votann Patrol allied to an IMPERIUM army is in imperium/imperium-adeptus-astartes-ultramarines.ts:
 * a list's first detachment comes from its own catalogue, and that army's Arks of Omen Detachment is the Ultramarines'.
 *
 * Left out of the legal lists: the Kâhl. Wahapedia's snapshot prices it at 90, BSData at 100, and the research library
 * gives only the changes (+10 in September 2022 and again in the 2023 MFM), not a final figure to settle it.
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const TRANS_HYPERIAN = { League: 'Trans-Hyperian Alliance' };
const GRIMNYR: UnitSpec = { name: 'Grimnyr' }; // 100 per unit (Grimnyr and 2 CORVs), PL 4
const HEARTHKYN: UnitSpec = { name: 'Hearthkyn Warriors w/ bolters' }; // 13 × 9 Hearthkyn Warriors + Theyn 13 = 130, PL 7
const PIONEERS: UnitSpec = { name: 'Hernkyn Pioneers' }; // 35 × 3 = 105, PL 5
const OATHBAND: DetachmentSpec = {
  detachment: AOO,
  army: TRANS_HYPERIAN,
  units: [
    { ...GRIMNYR, warlord: true }, // 100, PL 4
    HEARTHKYN, // 130, PL 7
    HEARTHKYN, // 130, PL 7
    HEARTHKYN, // 130, PL 7
    PIONEERS, // 105, PL 5
    { name: 'Brôkhyr Iron-master' }, // 90 per unit (Iron-master, Ironkin Assistant, 3 E-COGs), PL 4
    { name: 'Einhyr Champion' }, // 120 + mass hammer 10 = 130, PL 5
  ],
};

export default {
  catalogue: 'Leagues of Votann',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Trans-Hyperian Alliance (Troops compulsory type)',
      battleSize: 'strike-force',
      detachments: [OATHBAND],
      // 100 + 3 × 130 + 105 + 90 + 130 = 815; PL 4 + 3 × 7 + 5 + 4 + 5 = 39
      expect: { points: 815, powerLevel: 39 },
    },
  ],
  illegal: [
    {
      // §7.5 lists no ally for a Leagues of Votann army. Not being a permitted ally, the Astra Militarum Patrol also
      // counts towards Army Faction (§1), and VOTANN units share no Faction keyword with IMPERIUM ones.
      title: 'an Astra Militarum Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        { ...OATHBAND, units: [{ ...GRIMNYR, warlord: true }, HEARTHKYN, HEARTHKYN, HEARTHKYN] },
        { detachment: 'Patrol Detachment -2CP', catalogue: 'Imperium - Astra Militarum', units: [{ name: 'Platoon Command Squad' }, { name: 'Infantry Squad' }] },
      ],
      expectRules: ['detachment-not-allowed', 'army-faction'],
    },
    {
      // Rule of Three (§7.5): a datasheet other than Troops or Dedicated Transports at most three times at Strike Force.
      // Fast Attack is the compulsory type, so four Fast Attack units fit the detachment's slots (3 + 3).
      title: 'four Hernkyn Pioneers units at Strike Force',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: { ...TRANS_HYPERIAN, 'Arks of Omen Compulsory Type': 'Fast Attack' }, units: [{ ...GRIMNYR, warlord: true }, PIONEERS, PIONEERS, PIONEERS, PIONEERS] }],
      expectRules: ['rule-of-three'],
    },
    {
      // Hero of the Oathband (Leagues_of_Votann.md §2): one KÂHL per detachment. BSData's limit is not a battlefield-role
      // slot, so it is reported as `other`.
      title: 'two Kâhls in one detachment',
      battleSize: 'strike-force',
      detachments: [{ ...OATHBAND, units: [{ ...GRIMNYR, warlord: true }, { name: 'Kâhl' }, { name: 'Kâhl' }, HEARTHKYN, HEARTHKYN, HEARTHKYN] }],
      expectRules: ['other'],
    },
  ],
} satisfies CatalogueCorpus;
