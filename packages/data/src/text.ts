const stripDiacritics = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const stripApostrophes = (s: string) => s.replace(/['‘’ʼ`]/g, '');

/** Stable URL slug: "T'au Empire" -> "tau-empire". */
export function slugify(s: string): string {
  return stripApostrophes(stripDiacritics(s))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Name key for matching across data sources. */
export function normalizeName(s: string): string {
  return stripApostrophes(stripDiacritics(s))
    .replace(/[[(]legends[\])]/gi, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Plain text from Wahapedia's HTML fragments. List items become "• " lines. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/gi, (_, e: string) => ENTITIES[e.toLowerCase()])
    .replace(/\n\s*\n• /g, '\n• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);

/**
 * Title case for Wahapedia's upper-case names: "COMMAND RE-ROLL" -> "Command Re-roll", "SONS OF THE FORGE" -> "Sons of
 * the Forge". Each space-separated word's first letter is capitalised, except small words after the first; the part
 * after a hyphen or apostrophe stays lower-case ("T'AU" -> "T'au").
 */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.replace(/\p{L}/u, (c) => c.toUpperCase())))
    .join(' ');
}
