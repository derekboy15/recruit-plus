/**
 * Orks (Codex: Orks, 2021; 03_Codexes/Xenos/Orks.md). Points and PL: Wahapedia snapshot (Datasheets.power_points,
 * Datasheets_models.Cost × models, Datasheets_wargear.cost; default wargear costs 0). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen Detachment: 1 HQ plus 3 Troops as the compulsory
 * type; Rule of Two at Incursion; no ally is listed for an Orks army), §9 (the roster lists psychic powers); Orks.md
 * §2 (Specialist Ladz: Ghazghkull and Makari join a detachment without breaking its clan; I'm Da Boss!: one WARBOSS
 * per detachment); Wahapedia datasheets 000000008 (Ghazghkull Thraka, Grand Warlord: "If this model is included in
 * your army, it must be your WARLORD") and 000002079 (Makari: "Your army can only include one MAKARI model"; Da Boss'
 * Best Grot).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const GOFFS = { 'Clan Kultur': 'Goffs' };
const WARBOSS: UnitSpec = { name: 'Warboss' }; // 90 (big choppa, kombi-rokkit, 2 sluggas, stikkbombs: 0), PL 5
const BOYZ: UnitSpec = { name: 'Boyz' }; // 8 × 9 Ork Boyz + Boss Nob 8 = 80, PL 5
const NOBZ: UnitSpec = { name: 'Nobz' }; // 17 × 4 Nobz + Boss Nob 17 = 85, PL 6
const GHAZGHKULL: UnitSpec = { name: 'Ghazghkull Thraka' }; // 300, PL 15
const MAKARI: UnitSpec = { name: 'Makari' }; // 50, PL 3
/** Psychic powers are part of the army roster (§9): a Weirdboy knows two from Power of the Waaagh! (Orks.md §2). */
const WEIRDBOY: UnitSpec = { name: 'Weirdboy', options: ["1. 'Eadbanger", '2. Warpath'] }; // 70 (Weirdboy staff: 0), PL 4
const WAAAGH: DetachmentSpec = {
  detachment: AOO,
  army: GOFFS,
  units: [
    { ...WARBOSS, warlord: true }, // 90, PL 5
    BOYZ, // 80, PL 5
    BOYZ, // 80, PL 5
    BOYZ, // 80, PL 5
    NOBZ, // 85, PL 6
    WEIRDBOY, // 70, PL 4
  ],
};

export default {
  catalogue: 'Orks',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Goffs (Troops compulsory type)',
      battleSize: 'strike-force',
      detachments: [WAAAGH],
      // 90 + 3 × 80 + 85 + 70 = 485; PL 5 + 3 × 5 + 6 + 4 = 30
      expect: { points: 485, powerLevel: 30 },
    },
    {
      // Grand Warlord (000000008): Ghazghkull is the Warlord. Da Boss' Best Grot (000002079): beside him, Makari takes no
      // slot.
      title: 'Arks of Omen Strike Force led by Ghazghkull Thraka, with Makari',
      battleSize: 'strike-force',
      detachments: [{ ...WAAAGH, units: [{ ...GHAZGHKULL, warlord: true }, { name: 'No Force Org Slot > Makari' }, BOYZ, BOYZ, BOYZ] }],
      // 300 + 50 + 3 × 80 = 590; PL 15 + 3 + 3 × 5 = 33
      expect: { points: 590, powerLevel: 33 },
    },
  ],
  illegal: [
    {
      // Grand Warlord (000000008): "If this model is included in your army, it must be your WARLORD." The Warlord is a
      // Weirdboy, not a Warboss: Ghazghkull is a WARBOSS, and I'm Da Boss! (Orks.md §2) allows one per detachment.
      title: 'Ghazghkull Thraka beside a Weirdboy Warlord',
      battleSize: 'strike-force',
      detachments: [{ ...WAAAGH, units: [{ ...WEIRDBOY, warlord: true }, GHAZGHKULL, BOYZ, BOYZ, BOYZ] }],
      expectRules: ['warlord-missing'],
    },
    {
      // Makari (000002079): "Your army can only include one MAKARI model."
      title: 'two Makaris',
      battleSize: 'strike-force',
      detachments: [{ ...WAAAGH, units: [{ ...WARBOSS, warlord: true }, MAKARI, MAKARI, BOYZ, BOYZ, BOYZ] }],
      expectRules: ['unique'],
    },
    {
      // Rule of Two (§7.5): a datasheet other than Troops or Dedicated Transports at most twice at Incursion.
      title: 'three Nobz units at Incursion',
      battleSize: 'incursion',
      detachments: [{ ...WAAAGH, units: [{ ...WARBOSS, warlord: true }, BOYZ, BOYZ, BOYZ, NOBZ, NOBZ, NOBZ] }],
      expectRules: ['rule-of-three'],
    },
  ],
} satisfies CatalogueCorpus;
