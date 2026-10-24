/** A roll window: the dice, what they are for, and accept, Command Re-roll, an ability re-roll or changing a die. */
import { hitSucceeds, saveSucceeds, woundSucceeds, type Die, type GameState, type Problem } from '@recruit/engine';
import { useEffect, useState } from 'react';
import { armyName } from '../game/names';
import { DiceTray } from './DiceTray';
import type { PanelProps } from './types';
import { PinAction } from '../game/actionBar';

/** "Bolt rifle vs Necron Warriors: 10 attacks · 6 hits · 3 wounds", from the attack in progress. */
export function attackSummary(s: GameState): string | null {
  const a = s.attack;
  const g = a?.groups[a.index];
  if (!a || !g) return null;
  const parts = [`${a.attacks} ${a.attacks === 1 ? 'attack' : 'attacks'}`];
  if (a.stage !== 'attacks' && a.stage !== 'hit') parts.push(`${a.hits} ${a.hits === 1 ? 'hit' : 'hits'}`);
  if (a.stage === 'save' || a.stage === 'damage') parts.push(`${a.wounds} ${a.wounds === 1 ? 'wound' : 'wounds'} to save`);
  return `${g.weapon.name} vs ${s.units[g.targetUnitId].name}: ${parts.join(' · ')}`;
}

/** For an open hit, wound or save roll: what each die needs, judged exactly as the engine will judge it. */
export function rollJudge(s: GameState): { label: string; passes(d: Die): boolean } | null {
  const p = s.pending;
  if (p?.kind !== 'roll' || p.then.module !== 'attack') return null;
  const d = p.then.data as { needed?: number; mod?: number };
  if (typeof d.needed !== 'number') return null;
  const needed = d.needed;
  const mod = d.mod ?? 0;
  const g = s.attack?.groups[s.attack.index];
  const modText = mod ? ` (${mod > 0 ? '+' : ''}${mod} to the roll)` : '';
  switch (p.then.step) {
    case 'hitRolled':
      if (g?.overwatch) return { label: `Unmodified ${g.overwatch.needs}+ needed`, passes: (x) => x.value >= g.overwatch!.needs };
      return { label: `${needed}+ needed${modText}`, passes: (x) => hitSucceeds(x.value, needed, mod) };
    case 'woundRolled':
      return { label: `${needed}+ needed${modText}`, passes: (x) => woundSucceeds(x.value, needed, mod) };
    case 'saveRolled':
      return { label: `${needed}+ needed${modText}`, passes: (x) => saveSucceeds(x.value, needed, mod) };
    default:
      return null;
  }
}

export function RollPanel({ sb, ui }: PanelProps) {
  const s = sb.state;
  const p = s.pending?.kind === 'roll' ? s.pending : null;
  const roll = p ? s.rolls[p.rollId] : null;
  const rollKey = roll ? `${roll.id}:${roll.dice.map((d) => `${d.value}${d.rerolled ? 'r' : ''}${d.replaced ? 'x' : ''}`).join(',')}` : '';
  const [picked, setPicked] = useState<number[]>([]);
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    setPicked([]);
    setChanging(false);
  }, [rollKey]);
  if (!p || !roll) return null;
  const judge = rollJudge(s);
  const summary = attackSummary(s);
  const run = (problems: Problem[] | null) => ui.setProblems(problems ?? []);
  const toggle = (i: number) => setPicked((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]));
  const one = picked.length === 1 ? picked[0] : null;

  return (
    <section>
      <h2>{roll.context}</h2>
      <p className="muted">{armyName(s, p.player)} rolls.</p>
      {summary && <p>{summary}</p>}
      {judge && <p className="muted">{judge.label}</p>}
      <DiceTray dice={roll.dice} rollKey={rollKey} judge={judge?.passes} selected={picked} onToggle={toggle} />
      <p className="muted play-small">Tap dice to pick them for a re-roll or a change.</p>
      <PinAction slot="main">
        <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'confirmRoll', by: p.player }))}>
          Accept
        </button>
      </PinAction>
      <div className="play-row">
        <button
          type="button"
          className="btn"
          disabled={!roll.whole && one === null}
          onClick={() => run(sb.act({ type: 'reroll', by: p.player, dice: roll.whole ? [0] : [one!], source: 'command-reroll' }))}
        >
          Command Re-roll (1 CP)
        </button>
        <button type="button" className="btn" disabled={!picked.length} onClick={() => run(sb.act({ type: 'reroll', by: p.player, dice: picked, source: 'ability' }))}>
          Re-roll selected (ability)
        </button>
        <button type="button" className="btn" disabled={one === null} onClick={() => setChanging((c) => !c)}>
          Change a die…
        </button>
      </div>
      {changing && one !== null && (
        <div className="play-row" role="group" aria-label={`Change die ${one + 1}`}>
          {[1, 2, 3, 4, 5, 6].slice(0, roll.dice[one].sides).map((v) => (
            <button key={v} type="button" className="btn" aria-label={`Make it a ${v}`} onClick={() => run(sb.act({ type: 'replaceDie', by: p.player, rollId: roll.id, index: one, value: v }))}>
              {v}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
