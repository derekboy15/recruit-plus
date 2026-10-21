/**
 * Imperial Knights. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: Codex: Imperial Knights (03_Codexes/Imperium/Imperial_Knights.md: two Oaths, Questor
 * Allegiance, one Knight per detachment nominated as a CHARACTER), research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen: no HQ needed for Knights, 3 Lords of War as
 * the compulsory type, Rule of Three, Arks of Omen detachments only).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
/** Lords of War as the compulsory type; a custom Questor Imperialis household; two Oaths. */
const LANCE_ARMY = {
  'Arks of Omen Compulsory Type': 'Lord of War',
  'Questor Allegiance': ['Questor Imperialis', 'Custom', 'Custom Household: Hunter of Beasts'],
  'Chivalric Oath': ['Oath: Defend the Realm', 'Oath: Lay Low The Tyrants'],
} satisfies DetachmentSpec['army'];
/** Core Book battle sizes have no Arks of Omen compulsory type. */
const { 'Arks of Omen Compulsory Type': _aooType, ...ONSLAUGHT_ARMY } = LANCE_ARMY;
const SUPER_HEAVY = 'Super-Heavy Detachment -3CP';
/** The Knight nominated as the detachment's CHARACTER is the Warlord. */
const PALADIN: UnitSpec = { name: 'Knight Paladin', options: ['Character (Knight Lance)', 'Warlord'] }; // 425 + meltagun 5 = 430, PL 23
/** Core Book battle sizes: a CHARACTER Warlord gets one Warlord Trait (research library §5). */
const CORE_PALADIN: UnitSpec = { ...PALADIN, options: [...PALADIN.options!, 'Warlord Trait: Landstrider'] }; // 430, PL 23 (trait 0)

export default {
  catalogue: 'Imperium - Imperial Knights',
  legal: [
    {
      title: 'Arks of Omen Strike Force lance (Lords of War compulsory type)',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: LANCE_ARMY,
        units: [
          PALADIN,
          { name: 'Knight Warden' }, // 435 + meltagun 5 (avenger gatling cannon, heavy flamer 0) = 440, PL 23
          { name: 'Armiger Warglaives' }, // 145 + meltagun 5 = 150, PL 8
          { name: 'Armiger Helverins' }, // 155 + meltagun 5 = 160, PL 8
        ],
      }],
      // 430 + 440 + 150 + 160 = 1180; PL 23 + 23 + 8 + 8 = 62
      expect: { points: 1180, powerLevel: 62 },
    },
    {
      // Knight Lances (codex): each Super-heavy detachment nominates its own CHARACTER, so two detachments have two.
      title: 'Onslaught with two Super-Heavy Detachments, each with a CHARACTER',
      battleSize: 'onslaught',
      detachments: [
        {
          detachment: SUPER_HEAVY,
          army: ONSLAUGHT_ARMY,
          units: [
            CORE_PALADIN, // 430, PL 23
            { name: 'Knight Warden' }, // 440, PL 23
            { name: 'Armiger Warglaives' }, // 150, PL 8
          ],
        },
        {
          detachment: SUPER_HEAVY,
          units: [
            { name: 'Armiger Helverins', options: ['Character (Knight Lance)'] }, // 160, PL 8
            { name: 'Armiger Helverins' }, // 160, PL 8
            { name: 'Armiger Warglaives' }, // 150, PL 8
          ],
        },
      ],
      // 430 + 440 + 150 + 2 × 160 + 150 = 1490; PL 23 + 23 + 8 + 2 × 8 + 8 = 78
      expect: { points: 1490, powerLevel: 78 },
    },
  ],
  illegal: [
    {
      // Code Chivalric: pick two Oaths.
      title: 'one Oath',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: { ...LANCE_ARMY, 'Chivalric Oath': ['Oath: Defend the Realm'] },
        units: [PALADIN, { name: 'Knight Warden' }, { name: 'Armiger Warglaives' }],
      }],
      expectRules: ['option-required'],
    },
    {
      // §7.5: Lords of War as the compulsory type needs 3 Lords of War units.
      title: 'two Lords of War with Lords of War compulsory',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: LANCE_ARMY, units: [PALADIN, { name: 'Knight Warden' }] }],
      expectRules: ['slot-min'],
    },
    {
      // Rule of Three (§7.5): a fourth Armiger Warglaives unit.
      title: 'four Armiger Warglaives units',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: LANCE_ARMY,
        units: [PALADIN, { name: 'Armiger Warglaives' }, { name: 'Armiger Warglaives' }, { name: 'Armiger Warglaives' }, { name: 'Armiger Warglaives' }],
      }],
      expectRules: ['rule-of-three'],
    },
    {
      // §7.5: an Arks of Omen army takes no other detachments besides one permitted ally.
      title: 'Super-Heavy Detachment at Strike Force',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, army: LANCE_ARMY, units: [PALADIN, { name: 'Knight Warden' }, { name: 'Armiger Warglaives' }] },
        {
          // Questor Allegiance and the Oaths are chosen once per army (in the first detachment).
          detachment: SUPER_HEAVY,
          // Its own CHARACTER (Knight Lances: one per Super-heavy detachment), so only the detachment itself is wrong.
          units: [{ name: 'Armiger Helverins', options: ['Character (Knight Lance)'] }, { name: 'Armiger Helverins' }, { name: 'Armiger Warglaives' }],
        },
      ],
      expectRules: ['detachment-not-allowed'],
    },
    {
      // Knight Lances (codex): one CHARACTER per Super-heavy detachment, so a second one in the same detachment is wrong.
      // (Onslaught, so the Arks of Omen Heroic Support Requisition doesn't come into it.)
      title: 'two CHARACTERs in one Super-Heavy Detachment',
      battleSize: 'onslaught',
      detachments: [{
        detachment: SUPER_HEAVY,
        army: ONSLAUGHT_ARMY,
        units: [
          CORE_PALADIN,
          { name: 'Knight Warden', options: ['Character (Knight Lance)'] },
          { name: 'Armiger Warglaives' },
        ],
      }],
      expectRules: ['wargear-max'],
    },
  ],
} satisfies CatalogueCorpus;
