/**
 * Chaos Daemons (Legiones Daemonica). Points and PL: Wahapedia snapshot (Datasheets.power_points; Datasheets.Cost for
 * per-unit costs, otherwise Datasheets_models.Cost × models; Datasheets_wargear.cost). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 (Combat Patrol), §4 (Patrol), §7.5 (Arks of Omen Detachment; a
 * Daemons army's only allies are a Chaos Knights Super-heavy Auxiliary, or two allies as Disciples of Be'lakor);
 * Codex: Chaos Daemons (03_Codexes/Chaos/Chaos_Daemons.md §2: Daemonic Legions; §6: Nurglings can't fill compulsory
 * slots); Wahapedia datasheet 000001465 (Rotigus).
 *
 * Disciples of Be'lakor (two allied detachments, overrides/aoo-allies.json armiesOfRenown) is covered by
 * test/roster-gaps.test.ts.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const BLOODLETTERS: UnitSpec = { name: 'Bloodletters' }; // 130 per unit, PL 6
const THREE_BLOODLETTERS = [BLOODLETTERS, BLOODLETTERS, BLOODLETTERS]; // 3 × 130 = 390, PL 3 × 6 = 18
const PLAGUEBEARERS: UnitSpec = { name: 'Plaguebearers' }; // 130 per unit, PL 7
const THREE_PLAGUEBEARERS = [PLAGUEBEARERS, PLAGUEBEARERS, PLAGUEBEARERS];

export default {
  catalogue: 'Chaos - Daemons',
  legal: [
    {
      // Daemonic Legions (codex §2): a Greater Daemon is the Warlord, and it lets a Herald of its god in without a
      // slot.
      title: 'Arks of Omen Strike Force, a Bloodthirster and its Herald',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [
          { name: 'Bloodthirster', warlord: true }, // 310 (hellfire breath, great axe 0), PL 16
          { name: 'No Force Org Slot > Bloodmaster' }, // 90, PL 5
          ...THREE_BLOODLETTERS, // 390, PL 18
          { name: 'Flesh Hounds' }, // 15 × 5 = 75 (4 Flesh Hounds, Gore Hound), PL 5
        ],
      }],
      // 310 + 90 + 390 + 75 = 865; PL 16 + 5 + 18 + 5 = 44
      expect: { points: 865, powerLevel: 44 },
    },
    {
      title: 'Combat Patrol: a Poxbringer and Plaguebearers',
      battleSize: 'combat-patrol',
      detachments: [{
        detachment: PATROL,
        units: [
          { name: 'Poxbringer', warlord: true }, // 90 (foul balesword 0), PL 5
          PLAGUEBEARERS, // 130, PL 7
        ],
      }],
      // 90 + 130 = 220; PL 5 + 7 = 12
      expect: { points: 220, powerLevel: 12 },
    },
  ],
  illegal: [
    {
      // Daemonic Legions (codex §2): in a pure Legiones Daemonica army with a Greater Daemon, a Greater Daemon must be
      // the Warlord. BSData hides a Herald's Warlord option once a Greater Daemon is in the detachment, so the
      // Bloodmaster's Warlord, chosen first, is reported as hidden-selected.
      title: 'Bloodmaster Warlord beside a Bloodthirster',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [{ name: 'Bloodmaster', warlord: true }, ...THREE_BLOODLETTERS, { name: 'Bloodthirster' }] }],
      expectRules: ['hidden-selected'],
    },
    {
      // §7.5: a Daemons Arks of Omen army may only ally a Chaos Knights Super-heavy Auxiliary (or, as Disciples of
      // Be'lakor, a Traitoris Astartes Patrol and a House Korvax Knight); a second Daemons Patrol isn't allowed.
      title: 'Daemons Patrol ally in a Daemons army',
      battleSize: 'strike-force',
      detachments: [
        { detachment: AOO, units: [{ name: 'Bloodthirster', warlord: true }, ...THREE_BLOODLETTERS] },
        { detachment: PATROL, units: [{ name: 'Poxbringer' }, PLAGUEBEARERS] },
      ],
      expectRules: ['detachment-not-allowed'],
    },
    {
      // §4: a Patrol needs one Troops unit; Nurglings can't fill a compulsory slot (codex §6).
      title: 'Combat Patrol whose only Troops are Nurglings',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: PATROL, units: [{ name: 'Poxbringer', warlord: true }, { name: 'Nurglings' }] }],
      expectRules: ['slot-min'],
    },
    {
      // Wahapedia 000001465: "Your army can only include one ROTIGUS model."
      title: 'two Rotigus',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [{ name: 'Rotigus', warlord: true }, { name: 'Rotigus' }, ...THREE_PLAGUEBEARERS] }],
      expectRules: ['unique'],
    },
  ],
} satisfies CatalogueCorpus;
