/**
 * Deathwatch. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen
 * Detachment); Codex Supplement: Deathwatch (03_Codexes/Imperium/Deathwatch.md: Kill Team Specialisms, Kill Team
 * Strike Force Army of Renown).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const WATCH_MASTER: UnitSpec = { name: 'Watch Master', warlord: true }; // 115, PL 7

export default {
  catalogue: 'Imperium - Adeptus Astartes - Deathwatch',
  legal: [
    {
      title: 'Arks of Omen Strike Force of Kill Teams',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          WATCH_MASTER,
          { name: 'Fortis Kill Team' }, // 18 × 5 = 90 (Intercessor Sergeant, 4 Intercessors; wargear 0), PL 6
          { name: 'Spectrus Kill Team' }, // 20 × 5 = 100 (Infiltrator Sergeant, 4 Infiltrators; wargear 0), PL 8
          { name: 'Indomitor Kill Team' }, // 23 × 5 = 115 (Heavy Intercessor Sergeant, 4 Heavy Intercessors; wargear 0), PL 9
          { name: 'Corvus Blackstar' }, // 150 (default weapons 0), PL 9
        ],
      }],
      // 115 + 90 + 100 + 115 + 150 = 570; PL 7 + 6 + 8 + 9 + 9 = 39
      expect: { points: 570, powerLevel: 39 },
    },
  ],
  illegal: [
    {
      // Kill Team Specialisms (Codex Supplement: Deathwatch): one Kill Team per Specialism per army.
      title: 'two Aquila Kill Teams',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          WATCH_MASTER,
          { name: 'Fortis Kill Team', options: ['Aquila'] },
          { name: 'Spectrus Kill Team', options: ['Aquila'] },
          { name: 'Indomitor Kill Team' },
        ],
      }],
      expectRules: ['wargear-max'],
    },
    {
      // Kill Team Strike Force Army of Renown (Codex Supplement: Deathwatch): only Kill Teams with a Specialism,
      // characters, Corvus Blackstars and Dedicated Transports, so a Deathwatch Terminator Squad already in the list is no
      // longer allowed once the army takes it. (Onslaught, a Core Book battle size: the Army of Renown left Arks of Omen
      // play on 1 January 2023.)
      title: 'Kill Team Strike Force chosen after adding a Deathwatch Terminator Squad',
      battleSize: 'onslaught',
      detachments: [{
        detachment: PATROL,
        units: [WATCH_MASTER, { name: 'Fortis Kill Team', options: ['Aquila'] }, { name: 'Deathwatch Terminator Squad' }],
        after: { army: { 'Army of Renown: Kill Team Strike Force': [] } },
      }],
      expectRules: ['hidden-selected'],
    },
  ],
} satisfies CatalogueCorpus;
