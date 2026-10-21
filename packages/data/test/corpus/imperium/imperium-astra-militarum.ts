/**
 * Astra Militarum. Points and PL: Wahapedia snapshot (Datasheets.power_points; Datasheets.Cost for per-unit costs,
 * otherwise Datasheets_models.Cost × models; Datasheets_wargear.cost). Rules: Codex: Astra Militarum
 * (03_Codexes/Imperium/Astra_Militarum.md: Chain of Command, all-Scion detachments), research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen: Astra Militarum may ally a Militarum
 * Tempestus-only Patrol).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const THREE_INFANTRY: UnitSpec[] = [{ name: 'Infantry Squad' }, { name: 'Infantry Squad' }, { name: 'Infantry Squad' }]; // each 65 per unit, PL 3

export default {
  catalogue: 'Imperium - Astra Militarum',
  legal: [
    {
      title: 'Arks of Omen Strike Force with a Militarum Tempestus Patrol',
      battleSize: 'strike-force',
      detachments: [
        {
          detachment: AOO,
          units: [
            { name: 'Cadian Castellan', warlord: true }, // 50 (laspistol, chainsword 0), PL 3
            ...THREE_INFANTRY, // 3 × 65 = 195, PL 3 × 3 = 9
            { name: 'Leman Russ Battle Tanks' }, // 150 + lascannon 5 (battle cannon 0) = 155, PL 9
            { name: 'Chimera', options: ['Heavy Bolter'] }, // 85 (heavy bolter, multi-laser, lasgun arrays 0), PL 5
            { name: 'Elites > Commissar' }, // 40 (bolt pistol, chainsword 0), PL 3
          ],
        },
        {
          // All-Scion detachment: Tempestus Scions are Troops.
          detachment: PATROL,
          army: { 'Militarum Tempestus Detachment': [] },
          units: [
            { name: 'Militarum Tempestus Command Squad' }, // 95 per unit, PL 5
            { name: 'Tempestus Scions' }, // 11 × 5 = 55, PL 5
          ],
        },
      ],
      // 50 + 195 + 155 + 85 + 40 + 95 + 55 = 675; PL 3 + 9 + 9 + 5 + 3 + 5 + 5 = 39
      expect: { points: 675, powerLevel: 39 },
    },
  ],
  illegal: [
    {
      // §7.5: the allied Patrol must be Militarum Tempestus only. With a Leman Russ in it, it isn't an all-Scion
      // detachment either, so its Tempestus Scions stay Elites and the Patrol has no Troops.
      title: 'Leman Russ in the Militarum Tempestus Patrol',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, units: [{ name: 'Cadian Castellan', warlord: true }, ...THREE_INFANTRY] },
        { detachment: PATROL, units: [{ name: 'Militarum Tempestus Command Squad' }, { name: 'Tempestus Scions' }, { name: 'Leman Russ Battle Tanks' }] },
      ],
      expectRules: ['detachment-faction', 'slot-min'],
    },
    {
      // Chain of Command: at most one COMMANDANT per detachment. BSData's COMMANDANT limit is not a battlefield-role
      // slot, so it is reported as `other`.
      title: 'two Commandants in one detachment',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [{ name: 'Cadian Castellan', warlord: true }, { name: 'Ursula Creed' }, ...THREE_INFANTRY] }],
      expectRules: ['other'],
    },
    {
      // Chain of Command: a detachment's COMMANDANT must be the Warlord. BSData allows no Warlord upgrade on the
      // Platoon Command Squad here, so the extra upgrade is reported as `wargear-max`.
      title: 'Platoon Command Squad Warlord beside a Cadian Castellan',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [{ name: 'Cadian Castellan' }, { name: 'Platoon Command Squad', warlord: true }, ...THREE_INFANTRY] }],
      expectRules: ['wargear-max'],
    },
    {
      // Incursion: 1000 pts. A Cadian Castellan (50), three Infantry Squads (195), two Rogal Dorns (250 each) and a
      // Baneblade (470) come to over 1200.
      title: 'over 1000 pts at Incursion',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        units: [{ name: 'Cadian Castellan', warlord: true }, ...THREE_INFANTRY, { name: 'Rogal Dorn Battle Tank' }, { name: 'Rogal Dorn Battle Tank' }, { name: 'Baneblade' }],
      }],
      expectRules: ['points-over'],
    },
  ],
} satisfies CatalogueCorpus;
