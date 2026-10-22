import type { RulesData, StratagemOut } from '@recruit/data/model';

export interface SearchDoc {
  id: string;
  kind: 'section' | 'term' | 'stratagem';
  title: string;
  text: string;
  path: string;
}

/** Everything the Rules search covers: article sections, glossary terms and core stratagems. */
export function searchDocs(rules: RulesData, core: StratagemOut[]): SearchDoc[] {
  return [
    ...rules.articles.flatMap((a) =>
      a.sections.map((s) => ({ id: `${a.id}#${s.id}`, kind: 'section' as const, title: s.title, text: s.text, path: `/rules/${a.id}#${s.id}` })),
    ),
    ...rules.glossary.map((g) => ({ id: `glossary#${g.id}`, kind: 'term' as const, title: g.term, text: g.text, path: `/rules/glossary#${g.id}` })),
    ...core.map((s) => ({
      id: `strat-${s.id}`,
      kind: 'stratagem' as const,
      title: s.name,
      text: [s.plain, s.text].filter(Boolean).join(' '),
      path: `/rules/stratagems#strat-${s.id}`,
    })),
  ];
}

/** Lower-case words without diacritics, apostrophes or punctuation: "Look Out, Sir!" -> ["look", "out", "sir"]. */
function words(s: string): string[] {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[-,.!?"():;]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const prefixOfAny = (q: string, ws: string[]) => ws.some((w) => w.startsWith(q));

function score(doc: SearchDoc, q: string[]): number {
  const title = words(doc.title);
  const query = q.join(' ');
  const joined = title.join(' ');
  if (joined === query) return 100;
  if (joined.startsWith(query)) return 50;
  if (q.every((w) => prefixOfAny(w, title))) return 30;
  return 10;
}

const SNIPPET = 120;

function snippet(text: string, q: string[]): string {
  const lower = text.toLowerCase();
  const at = q.map((w) => lower.search(new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).filter((i) => i >= 0);
  const hit = at.length ? Math.min(...at) : 0;
  const start = Math.max(0, hit - 40);
  const end = Math.min(text.length, start + SNIPPET);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/** Docs where every query word starts a word of the title or text, best first (exact title, title start, title words, text). */
export function search(docs: SearchDoc[], query: string, limit = 20): { doc: SearchDoc; snippet: string }[] {
  const q = words(query);
  if (!q.length) return [];
  return docs
    .filter((d) => {
      const all = [...words(d.title), ...words(d.text)];
      return q.every((w) => prefixOfAny(w, all));
    })
    .map((doc) => ({ doc, score: score(doc, q) }))
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .slice(0, limit)
    .map(({ doc }) => ({ doc, snippet: snippet(doc.text, q) }));
}
