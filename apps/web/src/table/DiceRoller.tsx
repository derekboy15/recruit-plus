import { useState } from 'react';
import { makeEvent, type Pos, type TableEvent } from './game';
import { Stepper } from './Stepper';

/** Roll a handful of D6 or D3, count successes, re-roll 1s or fails. Every roll goes in the game log. */
export function DiceRoller({ pos, roll, append }: { pos: Pos | null; roll: (sides: 3 | 6) => number; append: (events: TableEvent[]) => Promise<void> }) {
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState<3 | 6>(6);
  const [dice, setDice] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const log = (label: string, rolled: number[]) => void append([makeEvent({ t: 'roll', label, sides, dice: rolled }, pos)]);
  const rollAll = () => {
    const rolled = Array.from({ length: count }, () => roll(sides));
    setDice(rolled);
    log('Dice', rolled);
  };
  const reroll = (which: (v: number) => boolean, label: string) => {
    const again: number[] = [];
    const next = dice.map((v) => {
      if (!which(v)) return v;
      const r = roll(sides);
      again.push(r);
      return r;
    });
    if (!again.length) return;
    setDice(next);
    log(label, again);
  };
  const sorted = [...dice].sort((a, b) => b - a);
  const hits = target ? dice.filter((v) => v >= target).length : 0;
  return (
    <div className="dice">
      <Stepper label="Dice" value={count} min={1} max={60} onChange={setCount} />
      <div className="seg" role="group" aria-label="Dice type">
        {([6, 3] as const).map((s) => (
          <button key={s} type="button" className="seg__btn" aria-pressed={sides === s} onClick={() => { setSides(s); setDice([]); }}>D{s}</button>
        ))}
      </div>
      <button type="button" className="btn btn--primary" onClick={rollAll}>Roll {count}D{sides}</button>
      {dice.length > 0 && (
        <>
          <ul className="dice__results" aria-label="Results">
            {sorted.map((v, i) => <li key={i} className={`die${target && v >= target ? ' die--hit' : ''}`}>{v}</li>)}
          </ul>
          <div className="chips" role="group" aria-label="Count successes">
            {Array.from({ length: sides - 1 }, (_, i) => i + 2).map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={target === t} onClick={() => setTarget(target === t ? null : t)}>{t}+</button>
            ))}
          </div>
          {target && <p role="status">{hits} of {dice.length} rolled {target}+</p>}
          <div className="prompt__actions">
            <button type="button" className="btn btn--small" onClick={() => reroll((v) => v === 1, 'Re-roll 1s')}>Re-roll 1s</button>
            {target && <button type="button" className="btn btn--small" onClick={() => reroll((v) => v < target, `Re-roll fails (below ${target}+)`)}>Re-roll fails</button>}
          </div>
        </>
      )}
    </div>
  );
}
