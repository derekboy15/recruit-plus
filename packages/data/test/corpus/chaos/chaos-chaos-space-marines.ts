/**
 * Chaos Space Marines. Points and PL: Wahapedia snapshot (Datasheets.power_points; Datasheets.Cost for per-unit costs,
 * otherwise Datasheets_models.Cost × models; Datasheets_wargear.cost). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 (Combat Patrol: one detachment), §6 (Heroic Support),
 * §7.5 (Arks of Omen Detachment; Traitoris Astartes other than Emperor's Children may ally a Daemons Patrol of any god);
 * Codex: Chaos Space Marines (03_Codexes/Chaos/Chaos_Space_Marines.md §2: Champions of Chaos; §8: Arks of Omen allies
 * limited to a Daemons Patrol).
 *
 * Daemonic Pact (03_Codexes/Chaos/Chaos_Daemons.md §2): a Daemons detachment of at most 25% of the army's Power Level
 * gains AGENT OF CHAOS, so it doesn't break Let the Galaxy Burn. It gates that benefit, not legality; the legal list
 * keeps its Daemons Patrol under 25% anyway (11 of 45 PL).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const DAEMONS = 'Chaos - Daemons';
const BLACK_LEGION = { Legion: 'Black Legion' };
const CHAOS_LORD: UnitSpec = { name: 'Chaos Lord' }; // 90 + thunder hammer 10 (plasma pistol 0) = 100, PL 5
const LEGIONARIES: UnitSpec = { name: 'Legionaries' }; // 18 × 5 = 90 (4 Legionaries, Aspiring Champion), PL 6
const THREE_LEGIONARIES = [LEGIONARIES, LEGIONARIES, LEGIONARIES]; // 3 × 90 = 270, PL 3 × 6 = 18
/** A Tzeentch Daemons Patrol: Changecaster 80 (ritual dagger 0), PL 4; Pink Horrors 140 per unit, PL 7. */
const TZEENTCH_PATROL: DetachmentSpec = { detachment: PATROL, catalogue: DAEMONS, units: [{ name: 'Changecaster' }, { name: 'Pink Horrors' }] };

export default {
  catalogue: 'Chaos - Chaos Space Marines',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Black Legion, with a Tzeentch Daemons Patrol',
      battleSize: 'strike-force',
      detachments: [
        {
          detachment: AOO,
          army: BLACK_LEGION,
          units: [
            { ...CHAOS_LORD, warlord: true }, // 100, PL 5
            ...THREE_LEGIONARIES, // 270, PL 18
            { name: 'Possessed' }, // 28 × 5 = 140, PL 7
            { name: 'Chaos Rhino' }, // 80 (combi-bolter 0), PL 4
          ],
        },
        TZEENTCH_PATROL, // 80 + 140 = 220, PL 4 + 7 = 11
      ],
      // 100 + 270 + 140 + 80 + 220 = 810; PL 5 + 18 + 7 + 4 + 11 = 45
      expect: { points: 810, powerLevel: 45 },
    },
    {
      // Heroic Support (§6, 1 CP): a detachment rule that limits a unit to 1 per detachment allows 2 instead, so
      // Champions of Chaos allows a second Chaos Lord (Chaos_Space_Marines.md §8: "two Daemon Princes or two Chaos
      // Lords possible for 1CP").
      title: 'two Chaos Lords with Heroic Support',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: { ...BLACK_LEGION, 'Stratagem: Heroic Support': [] },
        units: [{ ...CHAOS_LORD, warlord: true }, CHAOS_LORD, ...THREE_LEGIONARIES],
      }],
      // 100 + 100 + 270 = 470; PL 5 + 5 + 18 = 28
      expect: { points: 470, powerLevel: 28 },
    },
  ],
  illegal: [
    {
      // Champions of Chaos (codex §2): at most one Chaos Lord per detachment, without Heroic Support. BSData's CHAOS
      // LORD limit is a keyword limit, so it is reported as `other`.
      title: 'two Chaos Lords without Heroic Support',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: BLACK_LEGION, units: [{ ...CHAOS_LORD, warlord: true }, CHAOS_LORD, ...THREE_LEGIONARIES] }],
      expectRules: ['other'],
    },
    {
      // §7.5: a Traitoris Astartes army's Daemons ally is a Patrol; an Auxiliary Support isn't on the list.
      title: 'Daemons Auxiliary Support ally',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, army: BLACK_LEGION, units: [{ ...CHAOS_LORD, warlord: true }, ...THREE_LEGIONARIES] },
        { detachment: 'Auxiliary Support Detachment -2CP', catalogue: DAEMONS, units: [{ name: 'Flamers' }] },
      ],
      expectRules: ['detachment-not-allowed'],
    },
    {
      // §7.5: an Arks of Omen army may include only one SUPREME COMMANDER unit, its ally included. Abaddon and Be'lakor
      // are both SUPREME COMMANDERs (Wahapedia datasheet keywords).
      title: "Abaddon with a Daemons Patrol holding Be'lakor",
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, army: BLACK_LEGION, units: [{ name: 'Abaddon the Despoiler', warlord: true }, ...THREE_LEGIONARIES] },
        { detachment: PATROL, catalogue: DAEMONS, units: [{ name: "Be'lakor" }, { name: 'Pink Horrors' }] },
      ],
      expectRules: ['unit-limit'],
    },
    {
      // §2.1 and global constraints: Combat Patrol allows one detachment, so the Daemons Patrol is one too many.
      title: 'Daemons Patrol ally at Combat Patrol',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, army: BLACK_LEGION, units: [{ ...CHAOS_LORD, warlord: true }, LEGIONARIES] }, TZEENTCH_PATROL],
      expectRules: ['detachment-count'],
    },
  ],
} satisfies CatalogueCorpus;
