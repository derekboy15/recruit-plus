/**
 * Aeldari - Harlequins (Codex: Aeldari, 2022; 03_Codexes/Xenos/Aeldari.md §3 Harlequins). Points and PL: Wahapedia
 * snapshot (Datasheets.power_points, Datasheets_models.Cost × models, Datasheets_wargear.cost; default wargear costs 0).
 * Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen Detachment: 1 HQ plus
 * 3 Troops as the compulsory type; Rule of Two at Incursion; the permitted allies: an Asuryani or Drukhari army may
 * take a Harlequins Patrol, but no ally is listed for a Harlequins army). The Troupe Master is the Warlord in every
 * list (Lead Role, Aeldari.md §3).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const TROOPS = { 'Arks of Omen Compulsory Type': 'Troops' };
const TROUPE_MASTER: UnitSpec = { name: 'Troupe Master', warlord: true }; // 75 (shuriken pistol, Harlequin's blade: 0), PL 4
const TROUPE: UnitSpec = { name: 'Troupe' }; // 13 × 4 Players + Lead Player 13 = 65, PL 4
const DEATH_JESTER: UnitSpec = { name: 'Death Jester' }; // 70, PL 3
const MASQUE: DetachmentSpec = {
  detachment: AOO,
  army: { ...TROOPS, 'Saedath Characterisation': 'Light: Blaze of Light' },
  units: [
    TROUPE_MASTER, // 75, PL 4
    TROUPE, // 65, PL 4
    TROUPE, // 65, PL 4
    TROUPE, // 65, PL 4
    DEATH_JESTER, // 70, PL 3
    { name: 'Shadowseer' }, // 100 (shuriken pistol, miststave, hallucinogen grenade launcher: 0), PL 5
  ],
};

export default {
  catalogue: 'Aeldari - Harlequins',
  legal: [
    {
      title: 'Arks of Omen Strike Force masque (Troops compulsory type)',
      battleSize: 'strike-force',
      detachments: [MASQUE],
      // 75 + 3 × 65 + 70 + 100 = 440; PL 4 + 3 × 4 + 3 + 5 = 24
      expect: { points: 440, powerLevel: 24 },
    },
  ],
  illegal: [
    {
      // §7.5: Troops as the compulsory type needs 3 Troops units.
      title: 'Troops compulsory type with two Troupes',
      battleSize: 'strike-force',
      detachments: [{ ...MASQUE, units: [TROUPE_MASTER, TROUPE, TROUPE] }],
      expectRules: ['slot-min'],
    },
    {
      // §7.5 lists a Harlequins Patrol as an ally of an Asuryani army, not the other way round: a Harlequins army
      // may take no allied detachment.
      title: 'a Craftworlds Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        MASQUE,
        { detachment: 'Patrol Detachment -2CP', catalogue: 'Aeldari - Craftworlds', units: [{ name: 'Farseer' }, { name: 'Rangers' }] },
      ],
      expectRules: ['detachment-not-allowed'],
    },
    {
      // Rule of Two (§7.5): a datasheet other than Troops or Dedicated Transports at most twice at Incursion.
      title: 'three Death Jesters at Incursion',
      battleSize: 'incursion',
      detachments: [{ ...MASQUE, units: [TROUPE_MASTER, TROUPE, TROUPE, TROUPE, DEATH_JESTER, DEATH_JESTER, DEATH_JESTER] }],
      expectRules: ['rule-of-three'],
    },
  ],
} satisfies CatalogueCorpus;
