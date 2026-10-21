const stripDiacritics = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const stripApostrophes = (s: string) => s.replace(/['’`]/g, '');

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

/** Plain text from Wahapedia's HTML fragments. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
