/** Every lesson's drill, by lesson id. */
import type { Drill } from '../drill/types';
import { whatIs40k } from './l01-what-is-40k';

export const DRILLS: Record<string, Drill> = {
  [whatIs40k.id]: whatIs40k,
};
