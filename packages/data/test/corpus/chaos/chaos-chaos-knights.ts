/**
 * Chaos Knights. Points and PL: Wahapedia snapshot (Datasheets.power_points, Datasheets_models.Cost × models,
 * Datasheets_wargear.cost). Rules: Codex: Chaos Knights (03_Codexes/Chaos/Chaos_Knights.md §2 Traitoris Lances and
 * Fallen Hero, §8 January 2023 FAQ: in an Arks of Omen Detachment one model can gain CHARACTER, §9: no HQ needed);
 * research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5 (Arks of Omen Detachment, 3 Lords of War as the compulsory
 * type, Rule of Three; any CHAOS army may ally one Chaos Knights Super-heavy Auxiliary holding a single Dreadblade).
 */
import type { CatalogueCorpus, DetachmentSpec, UnitSpec } from '../spec';

const AOO = 'Arks of Omen Detachment';
const SUPER_HEAVY_AUX = 'Super-Heavy Auxiliary Detachment -3CP';
const LORDS_OF_WAR = { 'Arks of Omen Compulsory Type': 'Lord of War' };
const VEXTRIX = 'House Vextrix';
/** The Knight nominated as the detachment's CHARACTER (Traitoris Lances) is the Warlord. */
const RAMPAGER: UnitSpec = { name: 'Knight Rampager', options: [VEXTRIX, 'Character (Traitoris Lance)', 'Warlord'] }; // 400 (default weapons 0), PL 20
const DESECRATOR: UnitSpec = { name: 'Knight Desecrator', options: [VEXTRIX] }; // 400 (default weapons 0), PL 20
const KARNIVORE: UnitSpec = { name: 'War Dog Karnivore Squadron', options: [VEXTRIX] }; // 140 + havoc multi-launcher 5 = 145, PL 8
/** A Dreadblade War Dog with its own Fell Bond. */
const DREADBLADE: UnitSpec = { name: 'War Dog Karnivore Squadron', options: ['Infernal Dreadblade', 'Biomechanical Fusion'] }; // 145, PL 8
const DREADBLADE_ALLY: DetachmentSpec = { detachment: SUPER_HEAVY_AUX, units: [DREADBLADE] };
const LANCE: DetachmentSpec = {
  detachment: AOO,
  army: LORDS_OF_WAR,
  units: [
    RAMPAGER, // 400, PL 20
    DESECRATOR, // 400, PL 20
    KARNIVORE, // 145, PL 8
    KARNIVORE, // 145, PL 8
  ],
};

export default {
  catalogue: 'Chaos - Chaos Knights',
  legal: [
    {
      title: 'Arks of Omen Strike Force lance, House Vextrix (Lords of War compulsory type)',
      battleSize: 'strike-force',
      detachments: [LANCE],
      // 400 + 400 + 145 + 145 = 1090; PL 20 + 20 + 8 + 8 = 56
      expect: { points: 1090, powerLevel: 56 },
    },
    {
      // §7.5: any CHAOS Arks of Omen army, Chaos Knights included, may ally one Super-heavy Auxiliary with a Dreadblade.
      title: 'the same lance with a Dreadblade Super-Heavy Auxiliary ally',
      battleSize: 'strike-force',
      detachments: [LANCE, DREADBLADE_ALLY],
      // 1090 + 145 = 1235; PL 56 + 8 = 64
      expect: { points: 1235, powerLevel: 64 },
    },
  ],
  illegal: [
    {
      // Rule of Three (§7.5): a fourth War Dog Karnivore Squadron at Strike Force.
      title: 'four War Dog Karnivore Squadrons',
      battleSize: 'strike-force',
      detachments: [{ detachment: AOO, army: LORDS_OF_WAR, units: [RAMPAGER, KARNIVORE, KARNIVORE, KARNIVORE, KARNIVORE] }],
      expectRules: ['rule-of-three'],
    },
    {
      // Codex §8, January 2023 FAQ: in an Arks of Omen Detachment, Traitoris Lances lets one model gain CHARACTER.
      title: 'two Knights nominated as CHARACTERs in one Arks of Omen Detachment',
      battleSize: 'strike-force',
      detachments: [{
        detachment: AOO,
        army: LORDS_OF_WAR,
        units: [RAMPAGER, { name: 'Knight Desecrator', options: [VEXTRIX, 'Character (Traitoris Lance)'] }, KARNIVORE, KARNIVORE],
      }],
      expectRules: ['wargear-max'],
    },
    {
      // §7.5: the allied Super-heavy Auxiliary holds a Dreadblade; a House Vextrix War Dog is not one.
      title: 'House Vextrix War Dog as the Super-Heavy Auxiliary ally',
      battleSize: 'strike-force',
      detachments: [LANCE, { detachment: SUPER_HEAVY_AUX, units: [KARNIVORE] }],
      expectRules: ['detachment-faction'],
    },
  ],
} satisfies CatalogueCorpus;
