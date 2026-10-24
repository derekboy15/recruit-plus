const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", "2 weeks ago", else "12 Mar 2026". */
export function relativeTime(at: number, now: number = Date.now()): string {
  const diff = now - at;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return ago(Math.floor(diff / MINUTE), 'minute');
  if (diff < DAY) return ago(Math.floor(diff / HOUR), 'hour');
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return ago(days, 'day');
  if (days <= 30) return ago(Math.floor(days / 7), 'week');
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
