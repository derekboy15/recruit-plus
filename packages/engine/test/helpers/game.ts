import type { GameSetup } from '../../src/core/state';

/** The smallest valid setup; later tasks grow it into full armies (see newTestGame). */
export function testSetup(over: Partial<GameSetup> = {}): GameSetup {
  return { seed: 1, ...over } as GameSetup;
}
