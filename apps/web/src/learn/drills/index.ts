/** Every lesson's drill, by lesson id. */
import type { Drill } from '../drill/types';
import { whatIs40k } from './l01-what-is-40k';
import { datasheets } from './l02-datasheets';
import { attacks } from './l03-attacks';

export const DRILLS: Record<string, Drill> = {
  [whatIs40k.id]: whatIs40k,
  [datasheets.id]: datasheets,
  [attacks.id]: attacks,
};
