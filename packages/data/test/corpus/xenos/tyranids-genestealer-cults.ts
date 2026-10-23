/**
 * Tyranids - Genestealer Cults (Codex: Genestealer Cults, 2022; 03_Codexes/Xenos/Genestealer_Cults.md). Points and PL:
 * Wahapedia snapshot (Datasheets.power_points; Datasheets.Cost for per-unit costs, otherwise Datasheets_models.Cost ×
 * models; Datasheets_wargear.cost; default wargear costs 0). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §1 (Army Faction), §7.5 (Arks of Omen Detachment: 1 HQ plus 3 Troops
 * as the compulsory type; Rule of Two at Incursion; a Genestealer Cults army may ally one Brood Brothers Patrol,
 * Auxiliary Support or Super-heavy Auxiliary Detachment, and nothing else); Genestealer_Cults.md §3 (Brood Brothers:
 * one Astra Militarum detachment of <REGIMENT> units, none of them the Warlord); Wahapedia datasheet 000000512
 * (Neophyte Hybrids: 10-20 models).
 *
 * BSData v9.8.0 asks every Neophyte Leader for a melee weapon; each list's leader takes a chainsword (0 pts on
 * Wahapedia 000000512).
 *
 * Not covered: a Genestealer Cults "Cult" datasheet counting as its Astra Militarum one for the Rule of Two/Three
 * (§7.2, overrides/datasheet-equivalence.json). BSData v9.8.0 hides every Cult vehicle and Brood Brothers entry
 * (Cult Leman Russ, Cult Chimera, Cult Sentinels, Brood Brothers Infantry and Heavy Weapons Squads), so no list can
 * take one.
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const BLADED_COG = { 'Cult Creed': 'The Bladed Cog' };
const AM = 'Imperium - Astra Militarum';
const PRIMUS: UnitSpec = { name: 'Primus', warlord: true }; // 70 (scoped needle pistol, cult bonesword, toxin injector claw: 0), PL 4
/** 6 × 9 Neophyte Hybrids + Neophyte Leader 6 = 60 (autoguns, autopistols, chainsword: 0), PL 4 */
const NEOPHYTES: UnitSpec = { name: 'Neophyte Hybrids', options: ['Neophyte Leader > Chainsword'] };
const PURESTRAINS: UnitSpec = { name: 'Purestrain Genestealers' }; // 14 × 5 = 70, PL 3
const THREE_NEOPHYTES = [NEOPHYTES, NEOPHYTES, NEOPHYTES]; // 3 × 60 = 180, PL 3 × 4 = 12
const CULT: DetachmentSpec = {
  detachment: AOO,
  army: BLADED_COG,
  units: [
    PRIMUS, // 70, PL 4
    ...THREE_NEOPHYTES, // 180, PL 12
    { name: 'Acolyte Hybrids' }, // 9 × 4 Acolyte Hybrids + Acolyte Leader 9 = 45 (autopistols, cult claws and knives: 0), PL 3
    PURESTRAINS, // 70, PL 3
    { name: 'Elites > Kelermorph' }, // 80 (3 liberator autostubs: 0), PL 3
  ],
};
/**
 * §7.5 and Genestealer_Cults.md §3: a Patrol of <REGIMENT> units, neither of them the Warlord, made Brood Brothers by
 * the Brood Brothers Regimental Doctrine (BSData v9.8.0 swaps their ASTRA MILITARUM keyword for BROOD BROTHERS).
 */
const BROOD_BROTHERS: DetachmentSpec = {
  detachment: 'Patrol Detachment -2CP',
  catalogue: AM,
  army: { 'Regimental Doctrine': 'Brood Brothers' },
  units: [
    { name: 'Platoon Command Squad' }, // 75 per unit (Platoon Commander and 4 Veteran Guardsmen), PL 4
    { name: 'Infantry Squad' }, // 65 per unit (Sergeant and 9 Guardsmen), PL 3
  ],
};

export default {
  catalogue: 'Tyranids - Genestealer Cults',
  legal: [
    {
      title: 'Arks of Omen Strike Force, The Bladed Cog (Troops compulsory type)',
      battleSize: 'strike-force',
      detachments: [CULT],
      // 70 + 180 + 45 + 70 + 80 = 445; PL 4 + 12 + 3 + 3 + 3 = 25
      expect: { points: 445, powerLevel: 25 },
    },
    {
      title: 'the same cult with a Brood Brothers Patrol ally',
      battleSize: 'strike-force',
      detachments: [CULT, BROOD_BROTHERS],
      // 445 + 75 + 65 = 585; PL 25 + 4 + 3 = 32
      expect: { points: 585, powerLevel: 32 },
    },
  ],
  illegal: [
    {
      // §7.5: a Brood Brothers ally is a Patrol, Auxiliary Support or Super-heavy Auxiliary Detachment, never a
      // Vanguard. Not being a permitted ally, the Vanguard also counts towards Army Faction (§1), and Astra Militarum
      // units share no Faction keyword with Genestealer Cults ones.
      title: 'an Astra Militarum Vanguard ally',
      battleSize: 'strike-force',
      detachments: [
        { ...CULT, units: [PRIMUS, ...THREE_NEOPHYTES] },
        { detachment: 'Vanguard Detachment -3CP', catalogue: AM, units: [{ name: 'Platoon Command Squad' }, { name: 'Bullgryns' }, { name: 'Bullgryns' }, { name: 'Bullgryns' }] },
      ],
      expectRules: ['detachment-not-allowed', 'army-faction'],
    },
    {
      // Neophyte Hybrids (000000512): 10-20 models.
      title: 'a Neophyte Hybrids unit of 21 models',
      battleSize: 'strike-force',
      detachments: [{ ...CULT, units: [PRIMUS, NEOPHYTES, NEOPHYTES, { ...NEOPHYTES, models: { 'Neophyte Hybrid': 20 } }] }],
      expectRules: ['model-count'],
    },
    {
      // Rule of Two (§7.5): a datasheet other than Troops or Dedicated Transports at most twice at Incursion.
      title: 'three Purestrain Genestealers units at Incursion',
      battleSize: 'incursion',
      detachments: [{ ...CULT, units: [PRIMUS, ...THREE_NEOPHYTES, PURESTRAINS, PURESTRAINS, PURESTRAINS] }],
      expectRules: ['rule-of-three'],
    },
  ],
} satisfies CatalogueCorpus;
