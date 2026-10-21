/**
 * White Scars. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §2.1 (Combat
 * Patrol: 3 CP), §4 (Patrol refund), §5, §6 (Warlord Trait Requisition), §7.5 (Arks of Omen Detachment); Codex
 * Supplement: White Scars stratagems (Wahapedia Stratagems).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
/** Fast Attack as the Arks of Omen compulsory stack: three Fast Attack units, three more optional. */
const FAST_ARMY = { 'Arks of Omen Compulsory Type': 'Fast Attack' };
const KHAN: UnitSpec = { name: "Kor'sarro Khan", warlord: true }; // 100, PL 6
const OUTRIDERS: UnitSpec = { name: 'Outrider Squad' }; // 35 × 3 = 105 (2 Outriders, Outrider Sergeant; wargear 0), PL 6
const INTERCESSORS: UnitSpec = { name: 'Intercessor Squad' }; // 18 × 5 = 90 (4 Intercessors, Intercessor Sergeant), PL 5
/** The Codex Lieutenant datasheet (not the Primaris one), with its two weapons. */
const LIEUTENANT: UnitSpec = { name: 'Lieutenant', options: ['Master-crafted boltgun', 'Astartes Chainsword'] };
/** Khan's Champion (1 CP, Wahapedia Stratagems): a WHITE SCARS Sergeant gets a Special-issue Wargear Relic. */
const CHAMPION = "Stratagem: Khan's Champion";

export default {
  catalogue: 'Imperium - Adeptus Astartes - White Scars',
  legal: [
    {
      // Arks of Omen: Kor'sarro's Warlord Trait only comes with the 1 CP Warlord Trait Requisition (§5, §6), so he
      // may go without. The Termite carries the Intercessors (one Dedicated Transport per INFANTRY unit, §7.5).
      title: "Arks of Omen Strike Force, Fast Attack compulsory, Kor'sarro Khan without a Warlord Trait",
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: FAST_ARMY,
        units: [
          KHAN,
          { name: 'Primaris Chaplain on Bike' }, // 115, PL 7
          { name: 'Primaris Ancient' }, // 70, PL 4
          OUTRIDERS,
          OUTRIDERS,
          OUTRIDERS,
          INTERCESSORS,
          { name: 'Terrax-Pattern Termite' }, // 180 (default wargear 0), PL 10
        ],
      }],
      // 100 + 115 + 70 + 3 × 105 + 90 + 180 = 870; PL 6 + 7 + 4 + 3 × 6 + 5 + 10 = 50
      expect: { points: 870, powerLevel: 50 },
    },
  ],
  illegal: [
    {
      // Combat Patrol starts with 3 CP and the Patrol's 2 CP come back with the Warlord in it (§2.1, §4). Khan's
      // Champion four times (four Sergeants, four different Relics: the stratagem's own limit) costs 4 CP: -1 CP.
      title: "four Khan's Champions at Combat Patrol",
      battleSize: 'combat-patrol',
      detachments: [{
        detachment: PATROL,
        units: [
          { name: 'Khan on Bike', warlord: true },
          { ...INTERCESSORS, options: [CHAMPION, "Headtaker's Trophies"] },
          { ...INTERCESSORS, options: [CHAMPION, 'Stormwrath Bolts'] },
          { ...INTERCESSORS, options: [CHAMPION, 'Digital Weapons'] },
          { ...OUTRIDERS, options: [CHAMPION, 'Master-Crafted Weapon'] },
        ],
      }],
      expectRules: ['cp-negative'],
    },
    {
      // Damocles Command Rhino, Tactical Resource (Wahapedia datasheet 000001186): "for each Detachment in your army,
      // you can only include one Damocles Command Rhino model in that Detachment". BSData's limit of one per
      // detachment is reported as `unique`.
      title: 'two Damocles Command Rhinos in one detachment',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        units: [KHAN, { name: 'Damocles Command Rhino' }, { name: 'Damocles Command Rhino' }, INTERCESSORS, INTERCESSORS, INTERCESSORS],
      }],
      expectRules: ['unique'],
    },
    {
      // Company Command (03_Codexes/Imperium/Space_Marines.md §2.3): at most 2 LIEUTENANTS per detachment. Reported
      // twice: by the Lieutenant datasheet limit (unit-limit) and by the LIEUTENANT keyword limit (other).
      title: 'three Lieutenants in one detachment',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, units: [KHAN, LIEUTENANT, LIEUTENANT, LIEUTENANT, INTERCESSORS, INTERCESSORS, INTERCESSORS] }],
      expectRules: ['unit-limit', 'other'],
    },
  ],
} satisfies CatalogueCorpus;
