/**
 * Aeldari - Craftworlds (Codex: Aeldari, 2022; 03_Codexes/Xenos/Aeldari.md). Points and PL: Wahapedia snapshot
 * (Datasheets.power_points, Datasheets_models.Cost × models, Datasheets_wargear.cost; default wargear costs 0). Rules:
 * research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction), §7.5 (Arks of Omen
 * Detachment: 1 HQ plus 3 Troops as the compulsory type; an Asuryani or Drukhari army may ally one Harlequins Patrol,
 * and nothing else); Wahapedia datasheets 000000571 (Asurmen) and 000000592 (Rangers).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const ULTHWE = { 'Craftworld Selection': 'Ulthwe: Foresight of the Damned' };
const FARSEER: UnitSpec = { name: 'Farseer', warlord: true }; // 105 (shuriken pistol, witchblade: 0), PL 5
const RANGERS: UnitSpec = { name: 'Rangers' }; // 13 × 5 = 65, PL 4
const ASURMEN: UnitSpec = { name: 'Asurmen' }; // 160, PL 8
/** Farseer and three Rangers units: the smallest Troops-compulsory detachment. */
const CORE: UnitSpec[] = [FARSEER, RANGERS, RANGERS, RANGERS]; // 105 + 3 × 65 = 300, PL 5 + 3 × 4 = 17
const WARHOST: DetachmentSpec = {
  detachment: AOO,
  army: ULTHWE,
  units: [
    ...CORE, // 300, PL 17
    { name: 'Guardian Defenders' }, // 9 × 10 = 90 (no Heavy Weapon Platform), PL 4
    { name: 'Dire Avengers' }, // 13 × 4 + Exarch 13 = 65, PL 3
  ],
};
/**
 * §7.5: an Asuryani army may take one Harlequins Patrol. Its HQ is a Shadowseer, not a Troupe Master: the Harlequins'
 * Lead Role (a Troupe Master must be the Warlord; Aeldari.md §3) may or may not reach into an Asuryani army, and the
 * sources don't settle it.
 */
const HARLEQUINS: DetachmentSpec = {
  detachment: PATROL,
  catalogue: 'Aeldari - Harlequins',
  units: [
    { name: 'Shadowseer' }, // 100 (shuriken pistol, miststave, hallucinogen grenade launcher: 0), PL 5
    { name: 'Troupe' }, // 13 × 4 Players + Lead Player 13 = 65, PL 4
  ],
};

export default {
  catalogue: 'Aeldari - Craftworlds',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Ulthwé (Troops compulsory type)',
      battleSize: 'strike-force',
      detachments: [WARHOST],
      // 300 + 90 + 65 = 455; PL 17 + 4 + 3 = 24
      expect: { points: 455, powerLevel: 24 },
    },
    {
      title: 'the same warhost with a Harlequins Patrol ally',
      battleSize: 'strike-force',
      detachments: [WARHOST, HARLEQUINS],
      // 455 + 100 + 65 = 620; PL 24 + 5 + 4 = 33
      expect: { points: 620, powerLevel: 33 },
    },
  ],
  illegal: [
    {
      // §7.5: the only allied detachment an Asuryani army may take is a Harlequins Patrol. Not being a permitted ally,
      // the Orks Patrol also counts towards Army Faction (§1), and Orks share no Faction keyword with the Aeldari.
      title: 'an Orks Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        WARHOST,
        { detachment: PATROL, catalogue: 'Orks', army: { 'Clan Kultur': 'Goffs' }, units: [{ name: 'Warboss' }, { name: 'Boyz' }] },
      ],
      expectRules: ['detachment-not-allowed', 'army-faction'],
    },
    {
      // Asurmen (000000571): "Your army can only include one ASURMEN model."
      title: 'two Asurmen',
      battleSize: 'strike-force',
      detachments: [{ ...WARHOST, units: [...CORE, ASURMEN, ASURMEN] }],
      expectRules: ['unique'],
    },
    {
      // Rangers (000000592): 5-10 models.
      title: 'a Rangers unit of 11 models',
      battleSize: 'strike-force',
      detachments: [{ ...WARHOST, units: [FARSEER, RANGERS, RANGERS, { name: 'Rangers', models: { Ranger: 11 } }] }],
      expectRules: ['model-count'],
    },
  ],
} satisfies CatalogueCorpus;
