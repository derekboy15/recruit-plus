/**
 * Aeldari - Drukhari (Codex: Drukhari, 2021; 03_Codexes/Xenos/Drukhari.md). Points and PL: Wahapedia snapshot
 * (Datasheets.power_points, Datasheets_models.Cost × models, Datasheets_wargear.cost; default wargear costs 0; the
 * Drukhari datasheets, not their Ynnari copies). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md
 * §5 (one Warlord), §7.5 (Arks of Omen Detachment: 1 HQ plus 3 Troops as the compulsory type; a Drukhari army may ally
 * one Harlequins Patrol, or a Kabal, Wych Cult or Haemonculus Coven Patrol of a different type from its Arks of Omen
 * Detachment, and nothing else); Drukhari.md §2 (Obsessions; Blades for Hire such as Incubi join any Obsession; Combat Drugs for Wych Cult units);
 * Wahapedia datasheet 000000643 (Drazhar).
 *
 * The "different type" condition on the Drukhari ally is recorded in overrides/aoo-allies.json but not checked, so no
 * list here depends on it: the legal ally is a Wych Cult Patrol beside a Kabal, and no list allies a second Kabal.
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const BLACK_HEART = { Obsession: 'Kabal of the Black Heart: Thirst for Power' };
const ARCHON: UnitSpec = { name: 'Archon', warlord: true }; // 70 (splinter pistol, power sword: 0), PL 4
const WARRIORS: UnitSpec = { name: 'Kabalite Warriors' }; // 8 × 4 + Sybarite 8 = 40, PL 3
const DRAZHAR: UnitSpec = { name: 'Drazhar' }; // 145, PL 8
/** Combat Drugs (Wahapedia ability 000001105): each unit with the ability is given a drug before the battle. */
const GRAVE_LOTUS = '2 - Grave Lotus (Combat Drug)';
/** Archon and three Kabalite Warriors units: the smallest Troops-compulsory detachment. */
const CORE: UnitSpec[] = [ARCHON, WARRIORS, WARRIORS, WARRIORS]; // 70 + 3 × 40 = 190, PL 4 + 3 × 3 = 13
const KABAL: DetachmentSpec = {
  detachment: AOO,
  army: BLACK_HEART,
  units: [
    ...CORE, // 190, PL 13
    { name: 'Incubi' }, // 18 × 4 + Klaivex 18 = 90, PL 4
  ],
};
/** §7.5: a Wych Cult Patrol, a different type from the Kabal. */
const WYCH_CULT: DetachmentSpec = {
  detachment: PATROL,
  army: { Obsession: 'Cult of Strife: The Spectacle of Murder' },
  units: [
    { name: 'Succubus', options: [GRAVE_LOTUS] }, // 80 (agoniser, archite glaive: 0), PL 4
    { name: 'Wyches', options: [GRAVE_LOTUS] }, // 10 × 4 + Hekatrix 10 = 50, PL 3
  ],
};

export default {
  catalogue: 'Aeldari - Drukhari',
  legal: [
    {
      title: 'Arks of Omen Strike Force Kabal with a Wych Cult Patrol ally',
      battleSize: 'strike-force',
      detachments: [KABAL, WYCH_CULT],
      // 190 + 90 + 80 + 50 = 410; PL 13 + 4 + 4 + 3 = 24
      expect: { points: 410, powerLevel: 24 },
    },
    {
      title: 'the same Kabal with a Harlequins Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        KABAL,
        {
          detachment: PATROL,
          catalogue: 'Aeldari - Harlequins',
          units: [
            { name: 'Shadowseer' }, // 100 (shuriken pistol, miststave, hallucinogen grenade launcher: 0), PL 5
            { name: 'Troupe' }, // 13 × 4 Players + Lead Player 13 = 65, PL 4
          ],
        },
      ],
      // 190 + 90 + 100 + 65 = 445; PL 13 + 4 + 5 + 4 = 26
      expect: { points: 445, powerLevel: 26 },
    },
  ],
  illegal: [
    {
      // §7.5: a Drukhari army may not ally a Craftworlds Patrol (Aeldari share AELDARI, so Army Faction holds).
      title: 'a Craftworlds Patrol ally',
      battleSize: 'strike-force',
      detachments: [KABAL, { detachment: PATROL, catalogue: 'Aeldari - Craftworlds', units: [{ name: 'Farseer' }, { name: 'Rangers' }] }],
      expectRules: ['detachment-not-allowed'],
    },
    {
      // Drazhar (000000643): "Your army can only include one DRAZHAR model."
      title: 'two Drazhars',
      battleSize: 'strike-force',
      detachments: [{ ...KABAL, units: [...CORE, DRAZHAR, DRAZHAR] }],
      expectRules: ['unique'],
    },
    {
      // §5: one model is the Warlord.
      title: 'an Archon and a Succubus both as Warlord',
      battleSize: 'strike-force',
      detachments: [KABAL, { ...WYCH_CULT, units: [{ name: 'Succubus', warlord: true, options: [GRAVE_LOTUS] }, { name: 'Wyches', options: [GRAVE_LOTUS] }] }],
      expectRules: ['warlord-extra'],
    },
  ],
} satisfies CatalogueCorpus;
