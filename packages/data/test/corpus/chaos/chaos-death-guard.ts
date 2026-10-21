/**
 * Death Guard. Points and PL: Wahapedia snapshot (Datasheets.power_points; Datasheets.Cost for per-unit costs,
 * otherwise Datasheets_models.Cost × models; Datasheets_wargear.cost). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.2–§7.3 (Rule of Two/Three: all Daemon Prince datasheets count as
 * one), §7.5 (Arks of Omen Detachment; Death Guard may ally a Nurgle-only Legiones Daemonica Patrol); Codex: Death
 * Guard (03_Codexes/Chaos/Death_Guard.md §2: Diseased Minions, Infernal Jealousy).
 *
 * Daemonic Pact (03_Codexes/Chaos/Chaos_Daemons.md §2): a Daemons detachment of at most 25% of the army's Power Level
 * gains AGENT OF CHAOS, so it doesn't break Contagions of Nurgle. It gates that benefit, not legality; both legal lists
 * keep their Daemons Patrol under 25% anyway (12 of 53 PL, 21 of 88 PL).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const DAEMONS = 'Chaos - Daemons';
const PRINCE: UnitSpec = { name: 'Death Guard Daemon Prince', warlord: true }; // 140 + hellforged sword 10 (malefic talons 0) = 150, PL 8
const PLAGUE_MARINES: UnitSpec = { name: 'Plague Marines' }; // 19 × 5 = 95 (4 Plague Marines, Plague Champion; wargear 0), PL 6
const THREE_PLAGUE_MARINES = [PLAGUE_MARINES, PLAGUE_MARINES, PLAGUE_MARINES]; // 3 × 95 = 285, PL 3 × 6 = 18
const TEN_PLAGUE_MARINES: UnitSpec = { name: 'Plague Marines', models: { 'Plague Marine w/ boltgun': 9 } }; // 19 × 10 = 190, PL 12
/** Two Daemons-codex Daemon Princes, each 140 + hellforged sword 10 = 150, PL 7, given the Nurgle allegiance. */
const NURGLE_PRINCE: UnitSpec = { name: 'Daemon Prince of Chaos', options: ['Nurgle'] };
/** A Nurgle Patrol with two Daemon Princes: 150 + 150 + Plaguebearers 130 per unit = 430, PL 7 + 7 + 7 = 21. */
const PRINCES_PATROL: DetachmentSpec = { detachment: PATROL, catalogue: DAEMONS, units: [NURGLE_PRINCE, NURGLE_PRINCE, { name: 'Plaguebearers' }] };

export default {
  catalogue: 'Chaos - Death Guard',
  legal: [
    {
      title: 'Arks of Omen Strike Force with a Nurgle Daemons Patrol',
      battleSize: 'strike-force',
      detachments: [
        {
          detachment: AOO,
          units: [
            PRINCE, // 150, PL 8
            ...THREE_PLAGUE_MARINES, // 285, PL 18
            { name: 'Plagueburst Crawler' }, // 135 + 2 entropy cannons × 5 (mortar, heavy slugger 0) = 145, PL 8
            { name: 'Foetid Bloat-drone' }, // 115 (fleshmower 0), PL 7
          ],
        },
        {
          detachment: PATROL,
          catalogue: DAEMONS,
          units: [
            { name: 'Poxbringer' }, // 90 (foul balesword 0), PL 5
            { name: 'Plaguebearers' }, // 130 per unit, PL 7
          ],
        },
      ],
      // 150 + 285 + 145 + 115 + 90 + 130 = 915; PL 8 + 18 + 8 + 7 + 5 + 7 = 53
      expect: { points: 915, powerLevel: 53 },
    },
    {
      // Three Daemon Princes from two datasheets (one Death Guard, two Daemons-codex) count as one datasheet three
      // times: the Strike Force limit. Infernal Jealousy (one Daemon Prince per Death Guard detachment) is kept: the
      // other two are in the Daemons Patrol.
      title: 'three Daemon Princes from two datasheets at Strike Force',
      battleSize: 'strike-force',
      detachments: [
        {
          detachment: AOO,
          units: [
            PRINCE, // 150, PL 8
            TEN_PLAGUE_MARINES, // 190, PL 12
            TEN_PLAGUE_MARINES, // 190, PL 12
            TEN_PLAGUE_MARINES, // 190, PL 12
            { name: 'Plagueburst Crawler' }, // 145, PL 8
            { name: 'Plagueburst Crawler' }, // 145, PL 8
            { name: 'Foetid Bloat-drone' }, // 115, PL 7
          ],
        },
        PRINCES_PATROL, // 430, PL 21
      ],
      // 150 + 3 × 190 + 2 × 145 + 115 + 430 = 1555; PL 8 + 3 × 12 + 2 × 8 + 7 + 21 = 88
      expect: { points: 1555, powerLevel: 88 },
    },
  ],
  illegal: [
    {
      // Rule of Two (§7.2–§7.3): at Incursion a datasheet may appear twice, and all Daemon Prince datasheets count as
      // one. A Death Guard Daemon Prince and two Daemons-codex Daemon Princes are three: each datasheet alone would be
      // within its limit.
      title: 'three Daemon Princes from two datasheets at Incursion',
      battleSize: 'incursion',
      detachments: [{ detachment: AOO, units: [PRINCE, ...THREE_PLAGUE_MARINES] }, PRINCES_PATROL],
      expectRules: ['rule-of-three'],
    },
    {
      // §7.5: a Death Guard army's Daemons Patrol must be Nurgle only; a Changecaster and Pink Horrors are Tzeentch.
      title: 'Tzeentch Daemons Patrol ally',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, units: [PRINCE, ...THREE_PLAGUE_MARINES] },
        { detachment: PATROL, catalogue: DAEMONS, units: [{ name: 'Changecaster' }, { name: 'Pink Horrors' }] },
      ],
      expectRules: ['detachment-faction'],
    },
    {
      // Diseased Minions (codex §2): Poxwalker units can't outnumber BUBONIC ASTARTES CORE INFANTRY units. BSData's
      // limit is a keyword limit, so it is reported as `other`.
      title: 'two Poxwalkers units beside one Plague Marines unit',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [PRINCE, PLAGUE_MARINES, { name: 'Poxwalkers' }, { name: 'Poxwalkers' }] }],
      expectRules: ['other'],
    },
  ],
} satisfies CatalogueCorpus;
