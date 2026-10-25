import type { Phase } from '@recruit/engine';
import { PHASE_NAMES } from './names';

const ORDER: Phase[] = ['command', 'movement', 'psychic', 'shooting', 'charge', 'fight', 'morale'];

/** The seven phases of a turn in order, the current one marked and the ones before it done. None outside the battle. */
export function PhaseStrip({ phase }: { phase: Phase }) {
  const at = ORDER.indexOf(phase);
  if (at < 0) return null;
  return (
    <ol className="phase-strip" aria-label="Phases">
      {ORDER.map((p, i) => (
        <li key={p} className="phase-strip__item" aria-current={i === at ? 'step' : undefined} data-done={i < at ? 'true' : undefined}>
          {PHASE_NAMES[p]}
        </li>
      ))}
    </ol>
  );
}
