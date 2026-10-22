/** The Command phase: the CP gained (automatic), then the player ends the phase; stratagems show in the assist panel. */
import type { Problem } from '@recruit/engine';
import { armyName } from '../game/names';
import type { PanelProps } from './types';

const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

export function CommandPanel({ sb, ui }: PanelProps) {
  const s = sb.state;
  const gained = sb.log.filter((l) => l.round === s.round && l.phase === 'command' && /\bCP\b/.test(l.text)).slice(-2);
  return (
    <section>
      <h2>{possessive(armyName(s, s.active))} Command phase</h2>
      {gained.map((l, i) => (
        <p key={i}>{l.text}</p>
      ))}
      <button type="button" className="btn btn--primary" onClick={() => ui.setProblems((sb.act({ type: 'endPhase', by: s.active }) as Problem[] | null) ?? [])}>
        End Command phase
      </button>
    </section>
  );
}
