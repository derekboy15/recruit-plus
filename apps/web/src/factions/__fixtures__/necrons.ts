import type { CatalogueOut, DataIndex } from '@recruit/data/model';

export const necronWarriors = {
  id: '12ec-e22a-a06b-c611',
  slug: 'necron-warriors',
  name: 'Necron Warriors',
  catalogueId: 'nec',
  role: 'Troops',
  keywords: ['Core', 'Infantry', 'Necron Warriors'],
  factionKeywords: ['Necrons', '<Dynasty>'],
  models: [{ name: 'Necron Warrior', chars: { M: '5"', WS: '3+', BS: '3+', S: '4', T: '4', W: '1', A: '1', Ld: '10', Save: '4+' } }],
  weapons: [
    { name: 'Gauss Flayer', chars: { Range: '24"', Type: 'Rapid Fire 1', S: '4', AP: '-1', D: '1', Abilities: '' } },
  ],
  abilities: [{ name: 'Reanimation Protocols', text: 'Models may stand back up.', source: 'bsdata' }],
  psychic: [],
  woundTrack: [],
  transport: null,
  minModels: 10,
  maxModels: 20,
  powerLevel: 6,
  points: 110,
  baseSize: '32mm',
  wahapediaId: '000000534',
  legends: false,
  forgeWorld: false,
} satisfies CatalogueOut['units'][number];

export const necrons: CatalogueOut = {
  id: 'nec',
  slug: 'necrons',
  name: 'Necrons',
  group: 'Xenos',
  library: false,
  units: [necronWarriors],
  rules: [],
  stratagems: [],
};

export const index: DataIndex = {
  generatedAt: '2026-10-20T00:00:00Z',
  sources: { bsdata: 'v9.8.0', wahapediaLastUpdate: '2023-06-26' },
  catalogues: [{ id: 'nec', slug: 'necrons', name: 'Necrons', group: 'Xenos', library: false, unitCount: 1, rosterScope: ['necrons', 'system'], factions: ['Faction: Necrons'] }],
};
