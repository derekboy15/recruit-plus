/** The other player's choice the game is waiting for: Cut Them Down, a reaction to a charge, Deny the Witch, Counter-offensive. */
import type { Problem } from '@recruit/engine';
import { armyName } from '../game/names';
import type { PanelProps } from './types';
import { PinAction } from '../game/actionBar';

export function ReactionPanel({ sb, ui }: PanelProps) {
  const s = sb.state;
  const p = s.pending?.kind === 'reaction' ? s.pending : null;
  if (!p) return null;
  const unit = (id: string) => s.units[id]?.name ?? id;
  const data = p.then.data as { targets?: string[]; deniers?: string[]; candidates?: string[] };
  const respond = (choice: string) => ui.setProblems((sb.act({ type: 'respond', by: p.player, choice }) as Problem[] | null) ?? []);
  const choices: [string, string][] = [];
  let title = '';
  switch (p.reaction) {
    case 'cut-them-down':
      title = `${unit(p.subjectUnitId)} is falling back`;
      if (p.options.includes('cut-them-down')) choices.push(['cut-them-down', 'Cut Them Down (1 CP)']);
      break;
    case 'charge-declared':
      title = `${unit(p.subjectUnitId)} declared a charge`;
      for (const t of data.targets ?? []) {
        if (p.options.includes('overwatch')) choices.push([`overwatch:${t}`, `Fire Overwatch with ${unit(t)} (1 CP)`]);
        if (p.options.includes('hold-steady')) choices.push([`hold-steady:${t}`, `Hold Steady with ${unit(t)}: Overwatch hitting on 5+ (1 CP)`]);
        if (p.options.includes('set-to-defend')) choices.push([`set-to-defend:${t}`, `Set to Defend with ${unit(t)}: +1 to hit when it fights`]);
      }
      break;
    case 'deny':
      title = `${unit(p.subjectUnitId)} manifested a power`;
      for (const d of data.deniers ?? []) choices.push([`deny:${d}`, `Deny the Witch with ${unit(d)}`]);
      break;
    case 'counter-offensive':
      title = 'An enemy unit has just fought';
      for (const c of data.candidates ?? []) choices.push([`counter-offensive:${c}`, `Counter-offensive (2 CP): ${unit(c)} fights next`]);
      break;
    case 'emergency-disembark':
      title = `${unit(p.subjectUnitId)} was destroyed`;
      for (const o of p.options) choices.push([o, o]);
      break;
  }
  return (
    <section>
      <h2>
        {armyName(s, p.player)}: {title}
      </h2>
      <PinAction slot="main">
        {choices.map(([choice, label]) => (
          <button key={choice} type="button" className="btn btn--primary" onClick={() => respond(choice)}>
            {label}
          </button>
        ))}
      </PinAction>
      <PinAction slot="end">
        <button type="button" className="btn" onClick={() => respond('decline')}>
          No
        </button>
      </PinAction>
    </section>
  );
}
