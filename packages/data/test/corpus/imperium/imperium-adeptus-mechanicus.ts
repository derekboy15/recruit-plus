/**
 * Adeptus Mechanicus. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §5, §6
 * (Warlord Trait Requisition), §7.5 (Arks of Omen Detachment, Rule of Two at Incursion); Codex: Adeptus Mechanicus
 * (03_Codexes/Imperium/Adeptus_Mechanicus.md §4 Forge World Dogmas).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const MARS = { 'Forge World Choice': 'Forge World: Mars' };
const DOMINUS: UnitSpec = { name: 'Tech-Priest Dominus', warlord: true }; // 70 (volkite blaster, macrostubber: 0), PL 4
/** Its smoke launchers or broad spectrum data-tether are optional (Wahapedia datasheet options; overrides/constraints.json). */
const ONAGER: UnitSpec = { name: 'Onager Dunecrawler' }; // 100 (eradication beamer: 0), PL 6
/** 9 × 5 = 45 (4 Rangers, Ranger Alpha; wargear 0), PL 3 each. */
const TROOPS: UnitSpec[] = [{ name: 'Skitarii Rangers' }, { name: 'Skitarii Rangers' }, { name: 'Skitarii Vanguards' }];

export default {
  catalogue: 'Imperium - Adeptus Mechanicus',
  legal: [
    {
      // The Termite carries Skitarii (one Dedicated Transport per INFANTRY unit, §7.5).
      title: 'Arks of Omen Incursion, Forge World Mars',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        army: MARS,
        units: [
          DOMINUS,
          ...TROOPS,
          ONAGER,
          { name: 'Archaeopter Transvector' }, // 110, PL 6
          { name: 'Terrax-Pattern Termite' }, // 180 (default wargear 0), PL 10
        ],
      }],
      // 70 + 45 + 45 + 45 + 100 + 110 + 180 = 595; PL 4 + 3 + 3 + 3 + 6 + 6 + 10 = 35
      expect: { points: 595, powerLevel: 35 },
    },
  ],
  illegal: [
    {
      // Forge World Dogmas (codex §4): a named Forge World's Warlord Trait is only for that Forge World's
      // Tech-Priests. The Mars trait stays on the Dominus after the army becomes Ryza.
      title: 'Mars Warlord Trait kept after changing to Forge World Ryza',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        army: MARS,
        units: [{ ...DOMINUS, options: ['Stratagem: Warlord Trait', 'Warlord Trait (Mars): Panegyric Procession'] }, ...TROOPS],
        after: { army: { 'Forge World Choice': 'Forge World: Ryza' } },
      }],
      expectRules: ['hidden-selected'],
    },
    {
      // §7.5: Rule of Two at Incursion; Heavy Support isn't exempt.
      title: 'three Onager Dunecrawlers at Incursion',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        army: MARS,
        units: [DOMINUS, ...TROOPS, ONAGER, ONAGER, ONAGER],
      }],
      expectRules: ['rule-of-three'],
    },
    {
      // X-101: "Only one of this model can be included in your army" (Wahapedia datasheet 000001822). BSData limits it
      // per detachment; overrides/constraints.json makes it per army.
      title: 'two X-101s at Onslaught, one in each Patrol',
      battleSize: 'onslaught',
      detachments: [
        { detachment: 'Patrol Detachment -2CP', army: MARS, units: [DOMINUS, TROOPS[0], { name: 'X-101' }] },
        { detachment: 'Patrol Detachment -2CP', army: MARS, units: [{ name: 'Tech-Priest Enginseer' }, TROOPS[1], { name: 'X-101' }] },
      ],
      expectRules: ['unique'],
    },
  ],
} satisfies CatalogueCorpus;
