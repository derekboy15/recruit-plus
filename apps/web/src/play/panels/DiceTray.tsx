/** Dice that tumble for a moment when a new roll arrives (at once with reduced motion), then show their values. */
import type { Die } from '@recruit/engine';
import { useEffect, useState } from 'react';

const TUMBLE_MS = 600;
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const reducedMotion = () => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};

export interface DiceTrayProps {
  dice: Die[];
  /** Changes whenever the dice change (a new roll, a re-roll): the tray tumbles again. */
  rollKey: string;
  /** Whether a die succeeds, when the roll has a target number. */
  judge?: (d: Die) => boolean;
  selected?: number[];
  onToggle?(i: number): void;
}

export function DiceTray({ dice, rollKey, judge, selected = [], onToggle }: DiceTrayProps) {
  const [settledKey, setSettledKey] = useState<string | null>(() => (reducedMotion() ? rollKey : null));
  const [face, setFace] = useState(0);
  const rolling = settledKey !== rollKey && !reducedMotion();
  useEffect(() => {
    if (reducedMotion()) return setSettledKey(rollKey);
    const spin = setInterval(() => setFace((f) => f + 1), 80);
    const stop = setTimeout(() => setSettledKey(rollKey), TUMBLE_MS);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [rollKey]);

  return (
    <div className="dice" role="group" aria-label="Dice" aria-busy={rolling}>
      {dice.map((d, i) => {
        if (rolling)
          return (
            <span key={i} className="die die--rolling" aria-label={`Die ${i + 1}: rolling`}>
              {FACES[(face + i * 2) % 6]}
            </span>
          );
        const pass = judge?.(d);
        const label = `Die ${i + 1}: ${d.value}${d.rerolled ? ', re-rolled' : ''}${d.replaced ? ', changed' : ''}${judge ? (pass ? ', success' : ', fail') : ''}`;
        const cls = `die${judge ? (pass ? ' die--pass' : ' die--fail') : ''}${selected.includes(i) ? ' die--picked' : ''}`;
        const marks = `${d.rerolled ? '↻' : ''}${d.replaced ? '✎' : ''}`;
        return onToggle ? (
          <button key={i} type="button" className={cls} aria-label={label} aria-pressed={selected.includes(i)} onClick={() => onToggle(i)}>
            {d.value}
            {marks && <small aria-hidden="true">{marks}</small>}
          </button>
        ) : (
          <span key={i} className={cls} aria-label={label}>
            {d.value}
            {marks && <small aria-hidden="true">{marks}</small>}
          </span>
        );
      })}
    </div>
  );
}
