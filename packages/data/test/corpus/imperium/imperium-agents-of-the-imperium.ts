/**
 * Agents of the Imperium. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §4 (Patrol),
 * §7.5 (Arks of Omen Detachment), §8.2; 03_Codexes/Imperium/Imperial_Agents_and_Allies.md §1-§2 (since 13 Feb 2023
 * AGENTS OF THE IMPERIUM is a Faction keyword, so a whole Agents detachment is possible; Shipborne Personnel).
 * In an Agents army the same datasheets are offered in their battlefield role and as the "Agent of the Imperium"
 * slot unit, so these lists name the role.
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
/** Elites as the Arks of Omen compulsory stack: three Elites units. */
const ELITES_ARMY = { 'Arks of Omen Compulsory Type': 'Elites' };
const INQUISITOR: UnitSpec = { name: 'HQ > Inquisitor', warlord: true, options: ['Bolt pistol', 'Ordo Xenos'] }; // 60 (bolt pistol, chainsword: 0), PL 4
const ELITES: UnitSpec[] = [
  { name: 'Elites > Acolytes', models: { Acolyte: 3 }, options: ['Ordo Xenos'] }, // 10 × 3 = 30, PL 3 (one per model)
  { name: 'Elites > Acolytes', options: ['Ordo Xenos'] }, // 10 × 1 = 10, PL 1
  { name: 'Elites > Jokaero Weaponsmith', options: ['Ordo Xenos'] }, // 20, PL 1
];
const VINDICARE: UnitSpec = { name: 'HQ > Vindicare Assassin' }; // 90 (wargear included), PL 5

export default {
  catalogue: 'Imperium - Agents of the Imperium',
  legal: [
    {
      title: 'Arks of Omen Strike Force, Elites compulsory',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: ELITES_ARMY,
        units: [INQUISITOR, ...ELITES, VINDICARE],
      }],
      // 60 + 30 + 10 + 20 + 90 = 210; PL 4 + 3 + 1 + 1 + 5 = 14
      expect: { points: 210, powerLevel: 14 },
    },
  ],
  illegal: [
    {
      // Lord Inquisitor Kyria Draxus: "Your army can only include one KYRIA DRAXUS model" (Wahapedia datasheet
      // 000002090; overrides/add-constraints.json). The Vindicare keeps the detachment from being all INQUISITION,
      // which may hold only one INQUISITOR (Authority of the Inquisition, Agents file §2).
      title: 'two Kyria Draxus',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: ELITES_ARMY,
        units: [INQUISITOR, ...ELITES, VINDICARE, { name: 'HQ > Lord Inquisitor Kyria Draxus' }, { name: 'HQ > Lord Inquisitor Kyria Draxus' }],
      }],
      expectRules: ['unique'],
    },
    {
      // Shipborne Personnel (Agents file §2): Voidsmen-at-Arms can't fill a compulsory slot unless the detachment is
      // NAVIS IMPERIALIS, and an Inquisitor isn't, so the Patrol's compulsory Troops slot (§4) is still empty.
      title: 'Combat Patrol Patrol whose only Troops are Voidsmen-at-Arms beside an Inquisitor',
      battleSize: 'combat-patrol',
      detachments: [{ detachment: 'Patrol Detachment -2CP', units: [INQUISITOR, { name: 'Troops > Voidsmen-at-Arms' }] }],
      expectRules: ['slot-min'],
    },
  ],
} satisfies CatalogueCorpus;
