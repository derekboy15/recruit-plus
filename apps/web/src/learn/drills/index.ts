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
import { morale } from './l10-morale';
import { objectives } from './l11-objectives';
import { stratagems } from './l12-stratagems';
import { terrain } from './l13-terrain';

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
  [morale.id]: morale,
  [objectives.id]: objectives,
  [stratagems.id]: stratagems,
  [terrain.id]: terrain,
};
