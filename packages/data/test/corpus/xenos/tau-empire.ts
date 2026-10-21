/**
 * T'au Empire (Codex: T'au Empire, 2022; 03_Codexes/Xenos/Tau_Empire.md). Points and PL: Wahapedia snapshot
 * (Datasheets.power_points; Datasheets.Cost for per-unit costs, otherwise Datasheets_models.Cost × models;
 * Datasheets_wargear.cost; default wargear costs 0). Rules: research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen Detachment: 1 HQ plus 3 Troops as the compulsory
 * type; Commander Shadowsun may lead any Sept; no ally is listed for a T'au army); Wahapedia datasheets 000000407
 * (Commander Shadowsun, Hero of the Empire: "If your army is Battle-forged, this unit's COMMANDER SHADOWSUN model must
 * be your army's WARLORD"), 000000410 (Darkstrider: "Your army can only include one DARKSTRIDER model") and 000000413
 * (Kroot Carnivores: 10-20 models).
 *
 * The first list has a Kroot Shaper beside Fire Warriors: it shares T'AU EMPIRE with them through
 * overrides/faction-keywords.json (Wahapedia 000000416).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const TAU_SEPT = { 'Sept Choice': "T'au Sept" };
const FIREBLADE: UnitSpec = { name: 'Cadre Fireblade', warlord: true }; // 50 (Fireblade pulse rifle: 0), PL 3
const STRIKE_TEAM: UnitSpec = { name: 'Strike Team' }; // 80 per unit (9 Fire Warriors and a Shas'ui), PL 4
const DARKSTRIDER: UnitSpec = { name: 'Darkstrider' }; // 60, PL 3
const THREE_STRIKE_TEAMS = [STRIKE_TEAM, STRIKE_TEAM, STRIKE_TEAM]; // 3 × 80 = 240, PL 3 × 4 = 12
const CADRE: DetachmentSpec = {
  detachment: AOO,
  army: TAU_SEPT,
  units: [
    FIREBLADE, // 50, PL 3
    { name: 'Kroot Shaper' }, // 25 (Shaper Kroot rifle, ritual blade: 0), PL 2
    ...THREE_STRIKE_TEAMS, // 240, PL 12
    { name: 'Pathfinder Team' }, // 90 per unit (9 Pathfinders and a Shas'ui), PL 5
    DARKSTRIDER, // 60, PL 3
    { name: 'Kroot Carnivores' }, // 7 × 10 = 70, PL 3
    { name: 'Stealth Battlesuits' }, // 25 × 2 Stealth Shas'ui + Shas'vre 25 = 75 (burst cannons: 0), PL 4
  ],
};

export default {
  catalogue: "T'au Empire",
  legal: [
    {
      title: "Arks of Omen Strike Force, T'au Sept (Troops compulsory type), with a Kroot Shaper",
      battleSize: 'strike-force',
      detachments: [CADRE],
      // 50 + 25 + 240 + 90 + 60 + 70 + 75 = 610; PL 3 + 2 + 12 + 5 + 3 + 3 + 4 = 32
      expect: { points: 610, powerLevel: 32 },
    },
    {
      // Hero of the Empire (000000407): Shadowsun is the Warlord; §7.5: she may lead any Sept.
      title: 'Arks of Omen Strike Force led by Commander Shadowsun',
      battleSize: 'strike-force',
      detachments: [{ ...CADRE, units: [{ name: 'Commander Shadowsun', warlord: true }, ...THREE_STRIKE_TEAMS] }],
      // 150 (her Advanced Guardian Drone and Command-link Drone: no cost) + 240 = 390; PL 8 + 12 = 20
      expect: { points: 390, powerLevel: 20 },
    },
  ],
  illegal: [
    {
      // Hero of the Empire (000000407): if Shadowsun is in the army, she must be the Warlord.
      title: 'Commander Shadowsun beside a Cadre Fireblade Warlord',
      battleSize: 'strike-force',
      detachments: [{ ...CADRE, units: [FIREBLADE, { name: 'Commander Shadowsun' }, ...THREE_STRIKE_TEAMS] }],
      expectRules: ['warlord-missing'],
    },
    {
      // Darkstrider (000000410): "Your army can only include one DARKSTRIDER model."
      title: 'two Darkstriders',
      battleSize: 'strike-force',
      detachments: [{ ...CADRE, units: [FIREBLADE, DARKSTRIDER, DARKSTRIDER, ...THREE_STRIKE_TEAMS] }],
      expectRules: ['unique'],
    },
    {
      // Kroot Carnivores (000000413): 10-20 models.
      title: 'a Kroot Carnivores unit of 21 models',
      battleSize: 'strike-force',
      detachments: [{ ...CADRE, units: [FIREBLADE, STRIKE_TEAM, STRIKE_TEAM, { name: 'Kroot Carnivores', models: { Kroot: 21 } }] }],
      expectRules: ['model-count'],
    },
  ],
} satisfies CatalogueCorpus;
