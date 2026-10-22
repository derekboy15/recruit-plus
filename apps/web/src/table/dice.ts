/** Real dice for the table: the engine's seeded generator, seeded from the browser's crypto unless a seed is given. */
import { d3FromD6, nextD6, seedDice } from '@recruit/engine/dice';

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] | 0;

export function rollDice(n: number, sides: 3 | 6, seed: number = randomSeed()): number[] {
  let state = seedDice(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = nextD6(state);
    state = r.next;
    out.push(sides === 3 ? d3FromD6(r.value) : r.value);
  }
  return out;
}

export const rollD6 = (): number => rollDice(1, 6)[0];
