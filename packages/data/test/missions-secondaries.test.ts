import { beforeAll, describe, expect, test } from 'vitest';
import { join } from 'node:path';
import { extractSecondaries, loadAmendments, loadPacks, loadSecondaryFactions } from '../src/missions/build';
import type { SecondaryOut } from '../src/missions/types';
import { loadWahapedia, type Wahapedia } from '../src/wahapedia/load';
import { loadGameData, isPlayableCatalogue } from '../src/bsdata/gamedata';
import { loadOverrides } from '../src/join/wahapedia';

const ROOT = join(__dirname, '..');
let w: Wahapedia;
let aoo: SecondaryOut[];
let cb: SecondaryOut[];
beforeAll(() => {
  w = loadWahapedia(join(ROOT, 'raw', 'wahapedia'));
  aoo = extractSecondaries(w, 'arks-of-omen');
  cb = extractSecondaries(w, 'core-book');
});
const universal = (s: SecondaryOut[]) => s.filter((x) => !x.faction);

describe('secondaries', () => {
  test('96 Arks of Omen secondaries, 11 universal in 5 categories', () => {
    expect(aoo).toHaveLength(96);
    expect(universal(aoo).map((s) => s.name).sort()).toEqual(
      ['Abhor the Witch', 'Assassination', 'Behind Enemy Lines', 'Bring It Down', 'Engage on All Fronts', 'Grind Them Down', 'No Prisoners',
        'Psychic Interrogation', 'Raise the Banners High', 'Retrieve Battlefield Data', 'Warp Ritual'].sort(),
    );
    expect(new Set(universal(aoo).map((s) => s.category))).toEqual(
      new Set(['Purge the Enemy', 'No Mercy, No Respite', 'Battlefield Supremacy', 'Warpcraft', 'Shadow Operations']),
    );
  });
  test('Abhor the Witch is Purge the Enemy in Arks of Omen', () => {
    expect(aoo.find((s) => s.id === 'aoo-abhor-the-witch')!.category).toBe('Purge the Enemy');
  });
  test('17 universal Core Book secondaries', () => {
    expect(universal(cb).map((s) => s.name).sort()).toEqual(
      ['Abhor the Witch', 'Assassinate', 'Attrition', 'Bring It Down', 'Domination', 'Engage on All Fronts', 'First Strike', 'Investigate Sites',
        'Linebreaker', 'Mental Interrogation', 'Psychic Ritual', 'Raise the Banners High', 'Repair Teleport Homer', 'Slay the Warlord',
        'Thin Their Ranks', 'Titan Slayers', 'While We Stand, We Fight'].sort(),
    );
  });
  test('ids are unique and prefixed by pack', () => {
    for (const [list, prefix] of [[aoo, 'aoo-'], [cb, 'cb-']] as const) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
      for (const s of list) expect(s.id.startsWith(prefix), s.id).toBe(true);
    }
  });
  test('texts have no HTML and keep their numbers', () => {
    for (const s of [...aoo, ...cb]) expect(s.text, s.id).not.toMatch(/<\/?[a-z][a-z0-9]*[\s>/]|&nbsp;|&amp;/);
    expect(aoo.find((s) => s.id === 'aoo-grind-them-down')!.text).toMatch(/Score 3VP if more enemy units than friendly units were destroyed/);
  });
  test('types are mapped', () => {
    expect(aoo.find((s) => s.id === 'aoo-assassination')!.type).toBe('progressive-and-end-game');
    expect(aoo.find((s) => s.id === 'aoo-no-prisoners')!.type).toBe('end-game');
    expect(aoo.find((s) => s.id === 'aoo-grind-them-down')!.type).toBe('progressive');
  });
});

describe('packs', () => {
  test('pack rules', () => {
    const packs = loadPacks(join(ROOT, 'missions'));
    const a = packs.find((p) => p.id === 'arks-of-omen')!;
    const c = packs.find((p) => p.id === 'core-book')!;
    expect(a.battleSizes).toEqual(['incursion', 'strike-force']);
    expect(a.startingCp).toEqual({ incursion: 6, 'strike-force': 6 });
    expect(c.battleSizes).toEqual(['combat-patrol', 'onslaught']);
    expect(c.startingCp).toEqual({ 'combat-patrol': 3, onslaught: 18 });
    for (const p of [a, c]) expect(p.caps).toEqual({ primary: 45, secondaryEach: 15, secondaryTotal: 45, battleReady: 10 });
    expect(a.firstTurn).toBe('winner-takes-first');
    expect(c.firstTurn).toBe('winner-chooses');
    expect(a.concede).toBe('opponent-wins');
    expect(c.concede).toBe('conceder-scores-0');
    expect(a.setupSteps).toHaveLength(16);
    expect(c.setupSteps).toHaveLength(16);
  });
  test('defaults exist and are universal', () => {
    const a = loadPacks(join(ROOT, 'missions')).find((p) => p.id === 'arks-of-omen')!;
    expect(a.defaultSecondaries).toEqual(['aoo-assassination', 'aoo-grind-them-down', 'aoo-behind-enemy-lines']);
    for (const id of a.defaultSecondaries) expect(universal(aoo).some((s) => s.id === id), id).toBe(true);
  });
});

describe('faction mapping', () => {
  test('every playable catalogue has a faction mapping', () => {
    const data = loadGameData(join(ROOT, 'raw', 'bsdata'));
    const overrides = loadOverrides(join(ROOT, 'overrides'));
    const playable = [...data.catalogues.values()].filter((c) => isPlayableCatalogue(c, overrides.playableCatalogues)).map((c) => c.name).sort();
    const mapped = loadSecondaryFactions(join(ROOT, 'overrides')).map((e) => e.catalogueName).sort();
    expect(mapped).toEqual(playable);
  });
  test("every faction secondary's faction is mapped from at least one catalogue", () => {
    const ids = new Set(loadSecondaryFactions(join(ROOT, 'overrides')).flatMap((e) => e.factions.map((f) => f.factionId)));
    for (const s of [...aoo, ...cb].filter((x) => x.faction)) expect(ids.has(s.factionId!), `${s.id} (${s.factionId})`).toBe(true);
  });
  test('Blood Angels may pick Space Marines and Blood Angels', () => {
    const ba = loadSecondaryFactions(join(ROOT, 'overrides')).find((e) => e.catalogueName === 'Imperium - Adeptus Astartes - Blood Angels')!;
    expect(ba.factions.map((f) => f.factionId)).toEqual(['SM', 'CHBA']);
  });
  test('amendments file loads', () => {
    expect(Array.isArray(loadAmendments(join(ROOT, 'overrides')).items)).toBe(true);
  });
});
