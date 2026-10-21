/**
 * Thousand Sons. Points and PL: Wahapedia snapshot (Datasheets.power_points; Datasheets.Cost for per-unit costs,
 * otherwise Datasheets_models.Cost × models; Datasheets_wargear.cost). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen Detachment; Thousand Sons may ally a
 * Tzeentch-only Daemons Patrol); Codex: Thousand Sons (03_Codexes/Chaos/Thousand_Sons.md §2: Mere Servants; §6: Magnus
 * must be Warlord); Wahapedia datasheet 000001031 (Magnus the Red, Daemon Primarch).
 *
 * Daemonic Pact (03_Codexes/Chaos/Chaos_Daemons.md §2): a Daemons detachment of at most 25% of the army's Power Level
 * gains AGENT OF CHAOS, so it doesn't break Cabal of Sorcerers. It gates that benefit, not legality; the legal list
 * keeps its Daemons Patrol under 25% anyway (11 of 49 PL).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const DAEMONS = 'Chaos - Daemons';
/** Exalted Sorcerer: 100 (inferno bolt pistol, force stave 0), PL 6; knows Smite and two Discipline of Change powers. */
const SORCERER: UnitSpec = { name: 'Exalted Sorcerer', warlord: true, options: ['13. Doombolt', '22. Weaver of Fates'] };
const RUBRICS: UnitSpec = { name: 'Rubric Marines' }; // 21 × 5 = 105 (4 Rubric Marines, Aspiring Sorcerer; wargear 0), PL 6
const THREE_RUBRICS = [RUBRICS, RUBRICS, RUBRICS]; // 3 × 105 = 315, PL 3 × 6 = 18
const SCARABS: UnitSpec = { name: 'Scarab Occult Terminators' }; // 40 × 5 = 200 (wargear 0), PL 10
const TZAANGORS: UnitSpec = { name: 'Tzaangors' }; // 7 × 10 = 70, PL 4
const ARKS_UNITS = [SORCERER, ...THREE_RUBRICS, SCARABS, TZAANGORS];

export default {
  catalogue: 'Chaos - Thousand Sons',
  legal: [
    {
      title: 'Arks of Omen Strike Force with a Tzeentch Daemons Patrol',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, units: ARKS_UNITS }, // 100 + 315 + 200 + 70 = 685, PL 6 + 18 + 10 + 4 = 38
        {
          detachment: PATROL,
          catalogue: DAEMONS,
          units: [
            { name: 'Changecaster' }, // 80 (ritual dagger 0), PL 4
            { name: 'Pink Horrors' }, // 140 per unit, PL 7
          ],
        },
      ],
      // 685 + 80 + 140 = 905; PL 38 + 4 + 7 = 49
      expect: { points: 905, powerLevel: 49 },
    },
  ],
  illegal: [
    {
      // §7.5: a Thousand Sons army's Daemons Patrol must be Tzeentch only; a Poxbringer and Plaguebearers are Nurgle.
      title: 'Nurgle Daemons Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, units: ARKS_UNITS },
        { detachment: PATROL, catalogue: DAEMONS, units: [{ name: 'Poxbringer' }, { name: 'Plaguebearers' }] },
      ],
      expectRules: ['detachment-faction'],
    },
    {
      // Mere Servants (codex §2): Cultist and BRAY units can't outnumber Rubric Marines and Scarab Occult Terminators
      // units. Five Tzaangors units beside four is one too many; BSData's limit is a keyword limit (`other`).
      title: 'five Tzaangors units beside four Rubric and Scarab units',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [...ARKS_UNITS, TZAANGORS, TZAANGORS, TZAANGORS, TZAANGORS] }],
      expectRules: ['other'],
    },
    {
      // Daemon Primarch (Wahapedia 000001031): Magnus must be the Warlord of a Battle-forged army, and no other unit
      // here has a rule to that effect, so the Exalted Sorcerer can't be the Warlord: Magnus's Warlord is missing.
      title: 'Magnus the Red beside an Exalted Sorcerer Warlord',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [SORCERER, ...THREE_RUBRICS, { name: 'Magnus the Red' }] }],
      expectRules: ['warlord-missing'],
    },
  ],
} satisfies CatalogueCorpus;
