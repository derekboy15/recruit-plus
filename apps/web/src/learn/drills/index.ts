/** Every lesson's drill, by lesson id. */
import type { Drill } from '../drill/types';
import { whatIs40k } from './l01-what-is-40k';
import { datasheets } from './l02-datasheets';
import { attacks } from './l03-attacks';
import { commandPhase } from './l04-command-phase';
import { movement } from './l05-movement';
import { psychic } from './l06-psychic';
import { shooting } from './l07-shooting';
import { charge } from './l08-charge';
import { fight } from './l09-fight';

export const DRILLS: Record<string, Drill> = {
  [whatIs40k.id]: whatIs40k,
  [datasheets.id]: datasheets,
  [attacks.id]: attacks,
  [commandPhase.id]: commandPhase,
  [movement.id]: movement,
  [psychic.id]: psychic,
  [shooting.id]: shooting,
  [charge.id]: charge,
  [fight.id]: fight,
};
