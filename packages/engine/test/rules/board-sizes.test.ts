import { expect, test } from 'vitest';
import { BOARD_SIZES } from '../../src/setup/mission';

test('[MP §2; Wahapedia Matched Play Battlefields; AoO GT step 6] Combat Patrol and Incursion are 44x30, Strike Force 44x60, Onslaught 44x90', () => {
  expect(BOARD_SIZES).toEqual({
    'combat-patrol': { w: 44, h: 30 },
    incursion: { w: 44, h: 30 },
    'strike-force': { w: 44, h: 60 },
    onslaught: { w: 44, h: 90 },
  });
});
