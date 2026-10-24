/** Badge tints by faction group (background, initials), from the Lists mockup. */
const TINTS = {
  xenos: ['#1f3328', '#8fd19c'],
  imperium: ['#1d2a40', '#9cc2f0'],
  chaos: ['#3a1d22', '#f0a0a6'],
  orks: ['#33301a', '#dccb6a'],
} as const;

/** Catalogue slug prefixes to groups. Orks are their own tint; the other xenos share one. */
const GROUP_BY_SLUG: [prefix: string, group: keyof typeof TINTS][] = [
  ['imperium-', 'imperium'],
  ['chaos-', 'chaos'],
  ['fallen', 'chaos'],
  ['orks', 'orks'],
  ['necrons', 'xenos'],
  ['aeldari-', 'xenos'],
  ['tau-empire', 'xenos'],
  ['tyranids', 'xenos'],
  ['leagues-of-votann', 'xenos'],
];

function factionTint(slug: string): readonly [string, string] {
  const group = GROUP_BY_SLUG.find(([prefix]) => slug.startsWith(prefix))?.[1];
  return group ? TINTS[group] : ['var(--surface-2)', 'var(--text)'];
}

const MINOR = new Set(['of', 'the']);

/** "Necrons" → "NEC", "Space Marines" → "SM", "T'au Empire" → "TE": a short tag for the faction badge. */
export function factionInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ''))
    .filter((w) => w && !MINOR.has(w.toLowerCase()));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** The faction's initials on its group's tint. Decorative: the faction's name is always written beside it. */
export function FactionBadge({ slug, name, size = 'md' }: { slug: string; name: string; size?: 'sm' | 'md' }) {
  const [backgroundColor, color] = factionTint(slug);
  return (
    <span className={`faction-badge faction-badge--${size}`} aria-hidden="true" style={{ backgroundColor, color }}>
      {factionInitials(name)}
    </span>
  );
}
