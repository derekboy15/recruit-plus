/** Stratagem phases in the order a game meets them, for the phase chips. */

const OWN = ['Command phase', 'Movement phase', 'Psychic phase', 'Shooting phase', 'Charge phase', 'Fight phase', 'Morale phase'];

const ORDER = [
  'Before battle',
  'During deployment',
  'At the start of battle round',
  ...OWN,
  'End of your turn',
  ...OWN.map((p) => `Enemy ${p}`),
  'Being targeted',
  'Taking casualties',
  'Enemy taking casualties',
  'Any phase',
  'Any of your phases',
  'Any time',
];

/** Game order, then the enemy's turn in game order, then the triggers; anything unknown after all of them. */
export function phaseRank(phase: string): number {
  const i = ORDER.indexOf(phase);
  return i < 0 ? ORDER.length : i;
}

/** The phases in game order; unknown ones last, A to Z. */
export function sortPhases(phases: string[]): string[] {
  return [...phases].sort((a, b) => phaseRank(a) - phaseRank(b) || a.localeCompare(b));
}
