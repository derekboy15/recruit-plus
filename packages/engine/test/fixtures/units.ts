/** Hand-built datasheets with exact, easy numbers for rules tests (real data is tested through src/data). */
import { parseDice } from '../../src/core/dice';
import type { BaseShape, Datasheet, ModelChars, ModelProfile, Move, WeaponProfile } from '../../src/datasheet/types';

const mm = (v: number) => v / 25.4;
const circle = (d: number): BaseShape => ({ kind: 'circle', d: mm(d) });
const fixed = (inches: number): Move => ({ kind: 'fixed', inches });
const dice = (s: string) => parseDice(s)!;

type CharsIn = Omit<Partial<ModelChars>, 'A' | 'M'> & { A?: string | number; M?: Move | number };
export function chars(c: CharsIn): ModelChars {
  const { A, M, ...rest } = c;
  return {
    M: typeof M === 'number' ? fixed(M) : (M ?? fixed(6)),
    WS: 3, BS: 3, S: 4, T: 4, W: 1, Ld: 7, Sv: 3, invuln: null,
    ...rest,
    A: dice(String(A ?? 1)),
  };
}
export const model = (name: string, c: CharsIn, brackets: ModelProfile['brackets'] = []): ModelProfile => ({ name, chars: chars(c), brackets });

type WeaponIn = Partial<Omit<WeaponProfile, 'shots' | 'd' | 's'>> & { shots?: string; d?: string; s?: WeaponProfile['s'] | number };
export function weapon(name: string, w: WeaponIn): WeaponProfile {
  const { shots, d, s, ...rest } = w;
  return {
    name,
    type: 'Melee', range: null, minRange: null, ap: 0, blast: false, autoHit: false, indirect: false, text: '',
    ...rest,
    shots: dice(shots ?? '1'),
    d: dice(d ?? '1'),
    s: typeof s === 'number' ? { kind: 'fixed', v: s } : (s ?? { kind: 'user' }),
  };
}

export function sheet(d: Partial<Datasheet> & Pick<Datasheet, 'id' | 'name' | 'models' | 'weapons'>): Datasheet {
  return {
    role: null, keywords: [], factionKeywords: [], base: circle(32), baseEstimated: false, transportCapacity: null, psyker: null,
    objectiveSecured: false, ocPerModel: 1, powerRating: 5, points: 100,
    ...d,
  };
}

export const boltRifle = weapon('Bolt rifle', { type: 'Rapid Fire', range: 30, shots: '1', s: 4, ap: -1 });
export const boltPistol = weapon('Bolt pistol', { type: 'Pistol', range: 12, shots: '1', s: 4 });

/** M6 WS3 BS3 S4 T4 W2 A2 Ld7 Sv3 (the sergeant: A3 Ld8); bolt rifle and bolt pistol; 32mm. */
export const marines = () =>
  sheet({
    id: 'marines', name: 'Intercessor Squad', role: 'Troops', keywords: ['INFANTRY', 'CORE', 'INTERCESSORS'],
    factionKeywords: ['IMPERIUM', 'ADEPTUS ASTARTES'], objectiveSecured: true, base: circle(32), powerRating: 5, points: 100,
    models: [model('Intercessor Sergeant', { W: 2, A: 3, Ld: 8 }), model('Intercessor', { W: 2, A: 2, Ld: 7 })],
    weapons: [boltRifle, boltPistol],
  });

/** M6 WS4 BS4 S3 T3 W1 A1 Ld6 Sv5; lasgun, frag grenade (Grenade D6 Blast); 25mm. */
export const guardsmen = () =>
  sheet({
    id: 'guardsmen', name: 'Infantry Squad', role: 'Troops', keywords: ['INFANTRY', 'CORE'], factionKeywords: ['IMPERIUM', 'ASTRA MILITARUM'],
    objectiveSecured: true, base: circle(25), powerRating: 3, points: 55,
    models: [model('Sergeant', { WS: 4, BS: 4, S: 3, T: 3, Ld: 7, Sv: 5 }), model('Guardsman', { WS: 4, BS: 4, S: 3, T: 3, Ld: 6, Sv: 5 })],
    weapons: [
      weapon('Lasgun', { type: 'Rapid Fire', range: 24, shots: '1', s: 3 }),
      weapon('Frag grenade', { type: 'Grenade', range: 6, shots: 'D6', s: 3, blast: true }),
    ],
  });

/** CHARACTER INFANTRY; W5 Sv3 4++; master-crafted bolt rifle, power sword (S+1 AP-3 D1); 40mm. */
export const captain = () =>
  sheet({
    id: 'captain', name: 'Captain', role: 'HQ', keywords: ['INFANTRY', 'CHARACTER', 'CAPTAIN'], factionKeywords: ['IMPERIUM', 'ADEPTUS ASTARTES'],
    base: circle(40), powerRating: 5, points: 80,
    models: [model('Captain', { WS: 2, BS: 2, W: 5, A: 4, Ld: 9, invuln: 4 })],
    weapons: [
      weapon('Master-crafted bolt rifle', { type: 'Rapid Fire', range: 30, shots: '1', s: 4, ap: -1, d: '2' }),
      weapon('Power sword', { s: { kind: 'add', v: 1 }, ap: -3 }),
    ],
  });

/** VEHICLE; M10 BS3 T7 W11 Sv3; 60x35mm oval; BS4 at 3–5 wounds, BS5 at 1–2. */
export const tank = () =>
  sheet({
    id: 'tank', name: 'Battle Tank', role: 'Heavy Support', keywords: ['VEHICLE'], factionKeywords: ['IMPERIUM'],
    base: { kind: 'oval', w: mm(60), h: mm(35) }, powerRating: 10, points: 150,
    models: [
      model('Battle Tank', { M: 10, WS: 6, BS: 3, S: 6, T: 7, W: 11, A: 3, Ld: 8 }, [
        { minW: 6, maxW: 11, chars: {} },
        { minW: 3, maxW: 5, chars: { BS: 4 } },
        { minW: 1, maxW: 2, chars: { BS: 5 } },
      ]),
    ],
    weapons: [
      weapon('Lascannon', { type: 'Heavy', range: 48, shots: '1', s: 9, ap: -3, d: 'D6' }),
      weapon('Battle cannon', { type: 'Heavy', range: 48, shots: 'D6', s: 8, ap: -2, d: 'D3', blast: true }),
    ],
  });

/** VEHICLE TITANIC; W24; 130mm; counts as 10 models on objectives. */
export const knight = () =>
  sheet({
    id: 'knight', name: 'Knight Paladin', role: 'Lord of War', keywords: ['VEHICLE', 'TITANIC'], factionKeywords: ['IMPERIUM', 'QUESTOR IMPERIALIS'],
    base: circle(130), ocPerModel: 10, powerRating: 25, points: 400,
    models: [model('Knight Paladin', { M: 12, WS: 3, BS: 3, S: 8, T: 8, W: 24, A: 4, Ld: 9 })],
    weapons: [
      weapon('Thermal cannon', { type: 'Heavy', range: 36, shots: 'D6', s: 9, ap: -4, d: 'D6', blast: true }),
      weapon('Reaper chainsword', { s: { kind: 'add', v: 6 }, ap: -3, d: '6' }),
    ],
  });

/** VEHICLE AIRCRAFT FLY; M 20–50". */
export const flyer = () =>
  sheet({
    id: 'flyer', name: 'Stormtalon', role: 'Flyer', keywords: ['VEHICLE', 'AIRCRAFT', 'FLY'], factionKeywords: ['IMPERIUM'],
    base: circle(60), powerRating: 9, points: 165,
    models: [model('Stormtalon', { M: { kind: 'range', min: 20, max: 50 }, BS: 3, S: 6, T: 6, W: 10, A: 3 })],
    weapons: [weapon('Twin assault cannon', { type: 'Heavy', range: 24, shots: '12', s: 6, ap: -1 })],
  });

/** CHARACTER INFANTRY PSYKER; cast 2, deny 1; Smite and a WC 6 power. */
export const psyker = () =>
  sheet({
    id: 'psyker', name: 'Librarian', role: 'HQ', keywords: ['INFANTRY', 'CHARACTER', 'PSYKER'], factionKeywords: ['IMPERIUM', 'ADEPTUS ASTARTES'],
    base: circle(40), powerRating: 5, points: 90,
    models: [model('Librarian', { W: 5, A: 4, Ld: 9, invuln: 5 })],
    weapons: [weapon('Force sword', { s: { kind: 'add', v: 1 }, ap: -3, d: 'D3' })],
    psyker: { cast: 2, deny: 1, powers: [{ name: 'Smite', wc: 5, smite: true }, { name: 'Veil of Time', wc: 6 }] },
  });

/** VEHICLE TRANSPORT; capacity 10; 3"x5" hull. */
export const rhino = () =>
  sheet({
    id: 'rhino', name: 'Rhino', role: 'Dedicated Transport', keywords: ['VEHICLE', 'TRANSPORT'], factionKeywords: ['IMPERIUM'],
    base: { kind: 'rect', w: 3, h: 5 }, transportCapacity: 10, powerRating: 4, points: 75,
    models: [model('Rhino', { M: 12, WS: 6, BS: 3, S: 6, T: 7, W: 10, A: 3, Ld: 8 })],
    weapons: [weapon('Storm bolter', { type: 'Rapid Fire', range: 24, shots: '2', s: 4 })],
  });

/** INFANTRY with a Heavy 3 heavy bolter; 60mm. */
export const heavyTeam = () =>
  sheet({
    id: 'heavy-team', name: 'Heavy Weapons Team', role: 'Heavy Support', keywords: ['INFANTRY'], factionKeywords: ['IMPERIUM'],
    base: circle(60), powerRating: 3, points: 60,
    models: [model('Heavy Weapons Team', { WS: 4, BS: 4, S: 3, T: 3, W: 2, A: 2, Ld: 6, Sv: 5 })],
    weapons: [weapon('Heavy bolter', { type: 'Heavy', range: 36, shots: '3', s: 5, ap: -1, d: '2' })],
  });
