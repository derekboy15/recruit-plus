import type { ProfileOut } from '@recruit/data/model';
import { useId } from 'react';
import { useWording } from '../../rules/wording';

const CELLS: [label: string, key: string][] = [
  ['RANGE', 'Range'],
  ['TYPE', 'Type'],
  ['S', 'S'],
  ['AP', 'AP'],
  ['D', 'D'],
];

/** "-" and "" both mean the weapon has no special rules. */
const hasText = (t: string | undefined): t is string => !!t && t.trim() !== '-' && t.trim() !== '';

/** One weapon: its name (and how many the unit has), the five numbers, then its abilities in the chosen wording. */
export function WeaponCard({ weapon, count }: { weapon: ProfileOut; count?: number }) {
  const { wording } = useWording();
  const id = useId();
  const official = weapon.chars.Abilities;
  const text = (wording === 'plain' && weapon.plain?.Abilities) || official;
  return (
    <article className="weapon-card" aria-labelledby={id}>
      <p className="weapon-card__head">
        <span id={id} className="weapon-card__name">
          {weapon.name}
        </span>
        {count != null && count > 1 && <span className="weapon-card__count">×{count}</span>}
      </p>
      <dl className="weapon-card__stats">
        {CELLS.map(([label, key]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{weapon.chars[key]?.trim() || '-'}</dd>
          </div>
        ))}
      </dl>
      {hasText(text) && <p className="weapon-card__text">{text}</p>}
    </article>
  );
}
