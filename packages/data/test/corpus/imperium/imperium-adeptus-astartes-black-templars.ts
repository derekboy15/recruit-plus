/**
 * Black Templars. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: research library 01_Core_Rules/Army_Building_Detachments_and_CP.md §5 (Warlord),
 * §7.5 (Arks of Omen Detachment); Codex Supplement: Black Templars (03_Codexes/Imperium/Black_Templars.md).
 */
import type { CatalogueCorpus, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const HELBRECHT: UnitSpec = { name: 'High Marshal Helbrecht', warlord: true }; // 140, PL 8
/** The Sword Brother's two weapons are a bolt pistol and a boltgun (Wahapedia datasheet). */
const CRUSADERS: UnitSpec = { name: 'Crusader Squad', options: ['Sword Brother > Boltgun'] }; // 18 × 5 = 90 (4 Initiates, Sword Brother; wargear 0), PL 5
const THREE_CRUSADERS: UnitSpec[] = [CRUSADERS, CRUSADERS, CRUSADERS];

export default {
  catalogue: 'Imperium - Adeptus Astartes - Black Templars',
  legal: [
    {
      title: 'Arks of Omen Incursion',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        units: [
          HELBRECHT,
          { name: 'Chaplain Grimaldus' }, // 120 (with 3 Cenobyte Servitors), PL 7
          { name: "The Emperor's Champion" }, // 90, PL 5
          ...THREE_CRUSADERS,
        ],
      }],
      // 140 + 120 + 90 + 3 × 90 = 620; PL 8 + 7 + 5 + 3 × 5 = 35
      expect: { points: 620, powerLevel: 35 },
    },
  ],
  illegal: [
    {
      // Crusader Squad: 4-9 Initiates, a Sword Brother and 0-10 Neophytes (Wahapedia datasheet). BSData counts the
      // Initiates and the Sword Brother together (5-10), so three Initiates and a Sword Brother are one short.
      title: 'Crusader Squad of three Initiates and a Sword Brother',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        units: [HELBRECHT, CRUSADERS, CRUSADERS, { ...CRUSADERS, models: { Initiate: 3 } }],
      }],
      expectRules: ['model-count'],
    },
    {
      // §7.5: Arks of Omen HQ slots are 1 compulsory + 0-3 optional, so a fifth HQ unit is one too many.
      title: 'five HQ units',
      battleSize: 'incursion',
      detachments: [{
        detachment: AOO,
        units: [
          HELBRECHT,
          { name: 'Chaplain Grimaldus' },
          { name: "The Emperor's Champion" },
          { name: 'Primaris Lieutenant' },
          { name: 'Primaris Techmarine' },
          ...THREE_CRUSADERS,
        ],
      }],
      expectRules: ['slot-max'],
    },
    {
      // §5: one Warlord per army.
      title: 'Helbrecht and Grimaldus both Warlord',
      battleSize: 'incursion',
      detachments: [{ detachment: AOO, units: [HELBRECHT, { name: 'Chaplain Grimaldus', warlord: true }, ...THREE_CRUSADERS] }],
      expectRules: ['warlord-extra'],
    },
  ],
} satisfies CatalogueCorpus;
