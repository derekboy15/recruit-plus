/**
 * World Eaters. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §6 (Heroic
 * Support), §7.5 (Arks of Omen Detachment; World Eaters may ally a Khorne-only Legiones Daemonica Patrol); Codex: World
 * Eaters (03_Codexes/Chaos/World_Eaters.md §2: Chosen of Khorne; §6: Angron must be Warlord).
 *
 * Daemonic Pact (03_Codexes/Chaos/Chaos_Daemons.md §2): a Daemons detachment of at most 25% of the army's Power Level
 * gains AGENT OF CHAOS, so it doesn't break the Blood Tithe. It gates that benefit, not legality; the legal list keeps
 * its Daemons Patrol under 25% anyway (11 of 47 PL).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const DAEMONS = 'Chaos - Daemons';
/** Codex §2: a World Eaters detachment chooses one sub-faction, World Eaters or Disciples of the Red Angel. */
const WE_ARMY = { Subfaction: 'World Eaters' };
/** World Eaters Lord on Juggernaut: 125 (plasma pistol, exalted chainblade, bladed horn 0), PL 6. */
const LORD: UnitSpec = { name: 'World Eaters Lord on Juggernaut', warlord: true };
const BERZERKERS: UnitSpec = { name: 'Khorne Berserkers' }; // 22 × 5 = 110 (4 Berzerkers, Champion), PL 6
const THREE_BERZERKERS = [BERZERKERS, BERZERKERS, BERZERKERS]; // 3 × 110 = 330, PL 3 × 6 = 18
const EIGHTBOUND: UnitSpec = { name: 'Eightbound' }; // 40 × 3 = 120 (2 Eightbound, Champion), PL 6

export default {
  catalogue: 'Chaos - World Eaters',
  legal: [
    {
      title: 'Arks of Omen Strike Force with a Khorne Daemons Patrol',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, army: WE_ARMY, units: [LORD, ...THREE_BERZERKERS, EIGHTBOUND, EIGHTBOUND] }, // 125 + 330 + 240 = 695, PL 6 + 18 + 12 = 36
        {
          detachment: PATROL,
          catalogue: DAEMONS,
          units: [
            { name: 'Bloodmaster' }, // 90 (blade of blood 0), PL 5
            { name: 'Bloodletters' }, // 130 per unit, PL 6
          ],
        },
      ],
      // 695 + 90 + 130 = 915; PL 36 + 5 + 6 = 47
      expect: { points: 915, powerLevel: 47 },
    },
  ],
  illegal: [
    {
      // §7.5: a World Eaters army's Daemons Patrol must be Khorne only; a Poxbringer and Plaguebearers are Nurgle.
      title: 'Nurgle Daemons Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, army: WE_ARMY, units: [LORD, ...THREE_BERZERKERS] },
        { detachment: PATROL, catalogue: DAEMONS, units: [{ name: 'Poxbringer' }, { name: 'Plaguebearers' }] },
      ],
      expectRules: ['detachment-faction'],
    },
    {
      // Chosen of Khorne (codex §2): at most one Daemon Prince per detachment, without Heroic Support (§6).
      title: 'two World Eaters Daemon Princes in one detachment',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: WE_ARMY, units: [LORD, ...THREE_BERZERKERS, { name: 'World Eaters Daemon Prince' }, { name: 'World Eaters Daemon Prince' }] }],
      expectRules: ['unique'],
    },
    {
      // Codex §6: Angron must be the Warlord, so he is the Warlord as soon as he is added, and the Lord on
      // Juggernaut's Warlord is a second one.
      title: 'Angron beside a Lord on Juggernaut Warlord',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: WE_ARMY, units: [LORD, ...THREE_BERZERKERS, { name: 'Angron' }] }],
      expectRules: ['warlord-extra'],
    },
  ],
} satisfies CatalogueCorpus;
