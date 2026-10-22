import { useState } from 'react';
import { scoreComponent, type ComponentInput, type Label, type MissionOut, type PlayerKey, type When } from '@recruit/data/missions';
import type { ScoreItem } from './flow';
import { Stepper } from './Stepper';

const WHEN: Record<When, string> = {
  'end-of-command-phase': 'End of the Command phase',
  'end-of-turn': 'End of the turn',
  'end-of-round': 'End of the battle round',
  'end-of-battle': 'End of the battle',
  'on-action': 'When an action is completed',
};
const text = (l: Label, p: PlayerKey) => (typeof l === 'string' ? l : l[p]);

/** Asks the questions one scoring component needs, shows the VP as you answer, then scores it (or skips: 0 VP). */
export function ScorePrompt({ item, mission, name, round, onResolve }: {
  item: ScoreItem; mission: MissionOut; name: string; round: number; onResolve: (vp: number, detail: string) => void;
}) {
  const c = item.component;
  const [input, setInput] = useState<Required<ComponentInput>>({ controlled: 0, opponentControlled: 0, flags: {}, counts: {}, pick: '' });
  const vp = scoreComponent(c, input, { round, player: item.player });
  const title = item.category === 'primary' ? `Primary: ${mission.primary.name}` : `Secondary: ${mission.missionSecondary?.name ?? ''}`;
  const detail = () => {
    if (c.kind === 'hold') return `${input.controlled} controlled, opponent ${input.opponentControlled}`;
    const parts: string[] = [];
    for (const l of c.lines) {
      if (l.kind === 'flag' && input.flags[l.id]) parts.push(text(l.label, item.player));
      if ((l.kind === 'count' || l.kind === 'table') && input.counts[l.id]) parts.push(`${text(l.label, item.player)}: ${input.counts[l.id]}`);
      if (l.kind === 'pick' && input.pick) parts.push(`Objective marker ${input.pick}`);
    }
    return parts.join('; ') || 'none';
  };
  return (
    <section className="card prompt" aria-label={`Score: ${name} · ${title}`}>
      <h2>Score: {name}</h2>
      <p><strong>{title}</strong> <span className="muted">· {WHEN[item.at]}</span></p>
      {c.kind === 'hold' ? (
        <>
          <p className="muted">{c.mode === 'take-and-hold' ? `${c.vpPerCondition} VP each for: 1 or more, 2 or more, more than your opponent.` : `${c.vpPerCondition} VP each for: 2 or more, 3 or more, more than your opponent.`}</p>
          <Stepper label="Objective markers you control" value={input.controlled} onChange={(n) => setInput({ ...input, controlled: n })} />
          <Stepper label="Objective markers your opponent controls" value={input.opponentControlled} onChange={(n) => setInput({ ...input, opponentControlled: n })} />
        </>
      ) : (
        c.lines.map((l) =>
          l.kind === 'flag' ? (
            <label key={l.id} className="choices__option">
              <input type="checkbox" checked={!!input.flags[l.id]} onChange={(e) => setInput({ ...input, flags: { ...input.flags, [l.id]: e.target.checked } })} />
              {text(l.label, item.player)}
            </label>
          ) : l.kind === 'pick' ? (
            <div key={l.id} role="group" aria-label={text(l.label, item.player)}>
              <p>{text(l.label, item.player)}</p>
              <div className="chips">
                {l.options.map((o) => (
                  <button key={o.id} type="button" className="chip" aria-pressed={input.pick === o.id} disabled={o.vp[item.player] === null} onClick={() => setInput({ ...input, pick: o.id })}>
                    {o.label}{o.vp[item.player] === null ? ' (not for you)' : ` · ${o.vp[item.player]} VP`}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Stepper key={l.id} label={text(l.label, item.player)} value={input.counts[l.id] ?? 0} onChange={(n) => setInput({ ...input, counts: { ...input.counts, [l.id]: n } })} />
          ),
        )
      )}
      {c.max !== undefined && c.kind !== 'hold' && <p className="muted">At most {c.max} VP.</p>}
      <p className="prompt__total" aria-live="polite">{vp < 0 ? `Lose ${-vp} VP` : `= ${vp} VP`}</p>
      <div className="prompt__actions">
        <button type="button" className="btn btn--primary" onClick={() => onResolve(vp, detail())}>{vp < 0 ? `Lose ${-vp} VP` : `Score ${vp} VP`}</button>
        <button type="button" className="btn" onClick={() => onResolve(0, 'skipped')}>Skip</button>
      </div>
    </section>
  );
}
