import type { ProfileOut } from '@recruit/data/model';

/** The nine characteristics in two rows of five boxes, in the order a datasheet prints them. `Save` reads as Sv. */
export const STAT_KEYS: [label: string, key: string][] = [
  ['M', 'M'],
  ['WS', 'WS'],
  ['BS', 'BS'],
  ['S', 'S'],
  ['T', 'T'],
  ['W', 'W'],
  ['A', 'A'],
  ['Ld', 'Ld'],
  ['Sv', 'Save'],
];

/** A model's characteristics as a grid that fits a phone: M WS BS S T, then W A Ld Sv. */
export function StatGrid({ profile }: { profile: ProfileOut }) {
  return (
    <dl className="stat-grid" role="group" aria-label={`${profile.name} characteristics`}>
      {STAT_KEYS.map(([name, key]) => (
        <div key={name} className="stat-grid__box">
          <dt>{name}</dt>
          <dd>{profile.chars[key]?.trim() || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}
