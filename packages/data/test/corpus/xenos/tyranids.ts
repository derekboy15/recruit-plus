/**
 * Tyranids (Codex: Tyranids, 2021; 03_Codexes/Xenos/Tyranids.md). Points and PL: Wahapedia snapshot
 * (Datasheets.power_points, Datasheets_models.Cost × models, Datasheets_wargear.cost; default wargear costs 0). Rules:
 * research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen Detachment: 1 HQ plus 3 Troops
 * as the compulsory type; no ally is listed for a Tyranids army); Tyranids.md §2 (Detachment limits: no more than one
 * HIVE TYRANT model per detachment) and §3 (Kraken's Hyper-adaptations come from Feed or Hunt; BSData v9.8.0 asks for
 * one in the roster, as the June 2022 dataslate did); Wahapedia datasheets 000000479 (Deathleaper: "Your army can only
 * include one DEATHLEAPER model") and 000000468 (Termagants: 10-30 models).
 *
 * The June 2022 dataslate made a HIVE TYRANT in the army the Warlord; Dataslate #7 (13 April 2023) removed it
 * (05_Balance_Errata_and_Points/Balance_Dataslates.md §9), so BSData v9.8.0's rule is dropped
 * (overrides/modifier-removals.json, constraints.json) and test/roster-gaps.test.ts has a Hive Tyrant beside a Prime
 * Warlord.
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const KRAKEN = { 'Hive Fleet': ['Kraken', '(Hunt) Heightened Reflexes'] };
const PRIME: UnitSpec = { name: 'Tyranid Prime', warlord: true }; // 85 (devourer, bonesword, lash whip: 0), PL 5
const TERMAGANTS: UnitSpec = { name: 'Termagants' }; // 7 × 10 = 70 (fleshborers: 0), PL 4
const DEATHLEAPER: UnitSpec = { name: 'Deathleaper' }; // 120, PL 5
const THREE_TERMAGANTS = [TERMAGANTS, TERMAGANTS, TERMAGANTS]; // 3 × 70 = 210, PL 3 × 4 = 12
const SWARM: DetachmentSpec = {
  detachment: AOO,
  army: KRAKEN,
  units: [
    PRIME, // 85, PL 5
    ...THREE_TERMAGANTS, // 210, PL 12
    { name: 'Hormagaunts' }, // 8 × 10 = 80, PL 4
    { name: 'Lictor' }, // 70, PL 4
    { name: 'Genestealers' }, // 16 × 5 = 80, PL 5
    { name: 'Ripper Swarms' }, // 15 × 3 = 45 (no spinemaws), PL 2
  ],
};

export default {
  catalogue: 'Tyranids',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Kraken (Troops compulsory type)',
      battleSize: 'strike-force',
      detachments: [SWARM],
      // 85 + 210 + 80 + 70 + 80 + 45 = 570; PL 5 + 12 + 4 + 4 + 5 + 2 = 32
      expect: { points: 570, powerLevel: 32 },
    },
    {
      title: 'Arks of Omen Strike Force led by the Swarmlord',
      battleSize: 'strike-force',
      detachments: [{ ...SWARM, units: [{ name: 'The Swarmlord', warlord: true }, ...THREE_TERMAGANTS] }],
      // 240 (bone sabres: 0) + 210 = 450; PL 11 + 12 = 23
      expect: { points: 450, powerLevel: 23 },
    },
  ],
  illegal: [
    {
      // Tyranids.md §2: no more than one HIVE TYRANT model per detachment, and the Swarmlord is one. BSData's limit is not
      // a battlefield-role slot, so it is reported as `other`.
      title: 'the Swarmlord and a Hive Tyrant in one detachment',
      battleSize: 'strike-force',
      detachments: [{
        ...SWARM,
        units: [{ name: 'The Swarmlord', warlord: true }, { name: 'Hive Tyrant', options: ['2x Monstrous Scything Talon', 'Lash Whip and Monstrous Bonesword'] }, ...THREE_TERMAGANTS],
      }],
      expectRules: ['other'],
    },
    {
      // Deathleaper (000000479): "Your army can only include one DEATHLEAPER model."
      title: 'two Deathleapers',
      battleSize: 'strike-force',
      detachments: [{ ...SWARM, units: [PRIME, DEATHLEAPER, DEATHLEAPER, ...THREE_TERMAGANTS] }],
      expectRules: ['unique'],
    },
    {
      // Termagants (000000468): 10-30 models.
      title: 'a Termagants unit of 31 models',
      battleSize: 'strike-force',
      detachments: [{ ...SWARM, units: [PRIME, TERMAGANTS, TERMAGANTS, { name: 'Termagants', models: { Termagant: 31 } }] }],
      expectRules: ['model-count'],
    },
  ],
} satisfies CatalogueCorpus;
