/**
 * Attack odds, worked out exactly (no simulation) from the engine's own attack maths: the wound table, the ±1 cap on
 * hit and wound modifiers, natural 1s and 6s, the best save after AP, Blast, and re-rolls judged on the unmodified
 * roll (engine ruling, TS §1.6). Excess damage from one attack is lost; it doesn't carry over to the next model.
 */
import { bestSave, blastShots, capMod, hitSucceeds, saveSucceeds, woundNeeded, woundSucceeds } from '@recruit/engine/attack-math';
import { parseDice, type DiceExpr } from '@recruit/engine/dice';

export type Reroll = 'none' | 'ones' | 'failed';
export interface OddsInput {
  /** How many of this weapon fire. */
  weapons: number;
  /** Attacks per weapon: "2", "D6", "2D3+1". */
  attacks: string;
  blast: boolean;
  targetModels: number;
  /** BS or WS (2–6), or 'auto' for weapons that hit automatically. */
  skill: number | 'auto';
  hitMod: number;
  rerollHits: Reroll;
  strength: number;
  toughness: number;
  woundMod: number;
  rerollWounds: Reroll;
  /** 0, -1, …, -6. */
  ap: number;
  /** Armour save (2–6), or null for none. */
  save: number | null;
  invuln: number | null;
  /** Other modifiers to the saving throw (e.g. +1). */
  saveMod: number;
  damage: string;
  fnp: number | null;
  woundsPerModel: number;
}
export interface OddsResult {
  hits: number;
  wounds: number;
  unsaved: number;
  /** Damage inflicted after Feel No Pain (before any is lost to overkill). */
  damage: number;
  kills: number;
  /** atLeast[k-1]: the chance of destroying at least k models. */
  atLeast: number[];
}

export const DEFAULT_ODDS: OddsInput = {
  weapons: 10, attacks: '1', blast: false, targetModels: 10, skill: 3, hitMod: 0, rerollHits: 'none', strength: 4, toughness: 4,
  woundMod: 0, rerollWounds: 'none', ap: 0, save: 3, invuln: null, saveMod: 0, damage: '1', fnp: null, woundsPerModel: 1,
};

const FACES = [1, 2, 3, 4, 5, 6];
type Dist = Map<number, number>;

/** The chance one roll succeeds, with an optional re-roll judged on the unmodified result. */
function rollChance(succeeds: (face: number) => boolean, failedUnmodified: (face: number) => boolean, reroll: Reroll): number {
  const once = FACES.filter(succeeds).length / 6;
  return FACES.reduce((p, f) => {
    const again = (reroll === 'ones' && f === 1) || (reroll === 'failed' && failedUnmodified(f));
    return p + (again ? once : succeeds(f) ? 1 : 0) / 6;
  }, 0);
}

function diceDist(e: DiceExpr): Dist {
  let d: Dist = new Map([[e.plus, 1]]);
  for (let i = 0; i < e.n; i++) {
    const next: Dist = new Map();
    for (const [v, p] of d) for (let f = 1; f <= e.sides; f++) next.set(v + f, (next.get(v + f) ?? 0) + p / e.sides);
    d = next;
  }
  return d;
}
const add = (a: Dist, b: Dist): Dist => {
  const out: Dist = new Map();
  for (const [x, p] of a) for (const [y, q] of b) out.set(x + y, (out.get(x + y) ?? 0) + p * q);
  return out;
};
const mean = (d: Dist) => [...d].reduce((s, [v, p]) => s + v * p, 0);

/** The number of attacks: each weapon's dice (with Blast's minimum or maximum), added up over the weapons. */
function attacksDist(i: OddsInput): Dist {
  const e = parseDice(i.attacks) ?? { n: 0, sides: 6 as const, plus: 0 };
  const one: Dist = new Map();
  for (const [v, p] of diceDist(e)) {
    const shots = i.blast ? blastShots(e, v, i.targetModels) : v;
    one.set(shots, (one.get(shots) ?? 0) + p);
  }
  let total: Dist = new Map([[0, 1]]);
  for (let w = 0; w < Math.max(0, Math.floor(i.weapons)); w++) total = add(total, one);
  return total;
}

/** Damage from one unsaved attack after Feel No Pain (each point is ignored on the FNP roll). */
function damageDist(i: OddsInput): Dist {
  const raw = diceDist(parseDice(i.damage) ?? { n: 0, sides: 6, plus: 1 });
  if (!i.fnp) return raw;
  const ignore = Math.min(1, Math.max(0, (7 - i.fnp) / 6));
  const out: Dist = new Map();
  for (const [d, p] of raw) {
    // Binomial: k of the d points get through.
    let coeff = 1;
    for (let k = 0; k <= d; k++) {
      if (k > 0) coeff = (coeff * (d - k + 1)) / k;
      out.set(k, (out.get(k) ?? 0) + p * coeff * (1 - ignore) ** k * ignore ** (d - k));
    }
  }
  return out;
}

export function attackOdds(i: OddsInput): OddsResult {
  const hitMod = capMod(i.hitMod);
  const pHit = i.skill === 'auto' ? 1 : rollChance((f) => hitSucceeds(f, i.skill as number, hitMod), (f) => !hitSucceeds(f, i.skill as number, 0), i.rerollHits);
  const need = woundNeeded(Math.max(1, i.strength), Math.max(1, i.toughness));
  const woundMod = capMod(i.woundMod);
  const pWound = rollChance((f) => woundSucceeds(f, need, woundMod), (f) => !woundSucceeds(f, need, 0), i.rerollWounds);
  const chars = { M: { kind: 'none' }, WS: null, BS: null, S: 1, T: i.toughness, W: i.woundsPerModel, A: { n: 0, sides: 6, plus: 1 }, Ld: 7, Sv: i.save, invuln: i.invuln } as const;
  const save = bestSave(chars as Parameters<typeof bestSave>[0], null, i.ap, 0, i.saveMod, false);
  const pSave = save ? FACES.filter((f) => saveSucceeds(f, save.needed, save.mod)).length / 6 : 0;
  const pUnsaved = pHit * pWound * (1 - pSave);

  const attacks = attacksDist(i);
  const dmg = damageDist(i);
  const models = Math.max(1, Math.floor(i.targetModels));
  const W = Math.max(1, Math.floor(i.woundsPerModel));
  // dp[k][w]: k models destroyed, w wounds left on the model being damaged.
  const fresh = () => Array.from({ length: models + 1 }, () => new Array<number>(W + 1).fill(0));
  let dp = fresh();
  dp[0][W] = 1;
  const killsAfter: number[] = new Array(models + 1).fill(0);
  const maxN = Math.max(...attacks.keys());
  for (let n = 0; n <= maxN; n++) {
    const pn = attacks.get(n) ?? 0;
    if (pn) for (let k = 0; k <= models; k++) killsAfter[k] += pn * dp[k].reduce((a, b) => a + b, 0);
    if (n === maxN) break;
    const next = fresh();
    for (let k = 0; k <= models; k++) {
      for (let w = 0; w <= W; w++) {
        const p = dp[k][w];
        if (!p) continue;
        if (k === models) {
          next[k][w] += p;
          continue;
        }
        next[k][w] += p * (1 - pUnsaved);
        for (const [d, q] of dmg) {
          const pq = p * pUnsaved * q;
          if (d >= w) next[k + 1][W] += pq;
          else next[k][w - d] += pq;
        }
      }
    }
    dp = next;
  }
  const atLeast = Array.from({ length: models }, (_, k) => Math.min(1, Math.max(0, killsAfter.slice(k + 1).reduce((a, b) => a + b, 0))));
  const n = mean(attacks);
  return {
    hits: n * pHit,
    wounds: n * pHit * pWound,
    unsaved: n * pUnsaved,
    damage: n * pUnsaved * mean(dmg),
    kills: killsAfter.reduce((s, p, k) => s + k * p, 0),
    atLeast,
  };
}
