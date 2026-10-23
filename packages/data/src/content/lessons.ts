/** packages/content/lessons Markdown -> LessonsData. Every reference and /rules/ link must point at built rules content. */
import type { Block, Inline, Lesson, RulesData } from '../model/types';
import { checkSources, field, mdFiles, readSource } from './build';
import { blocksText, compileMarkdown } from './markdown';

const MAX_WORDS = 600;

function hrefs(blocks: Block[]): string[] {
  const out: string[] = [];
  const inl = (c: Inline[]) => {
    for (const x of c) {
      if (x.t === 'a') out.push(x.href);
      if (x.t !== 'text') inl(x.c);
    }
  };
  for (const b of blocks) {
    if ('items' in b) b.items.forEach((i) => out.push(...hrefs(i)));
    else if ('rows' in b) [...b.head, ...b.rows.flat()].forEach(inl);
    else inl(b.c);
  }
  return out;
}

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * `stratagemAnchors` are the `strat-<id>` anchors of the core stratagems page; without them, links to a stratagem
 * anchor are refused (a bare /rules/stratagems link is always fine).
 */
export function buildLessons(dir: string, rules: RulesData, stratagemAnchors: Set<string> = new Set()): { lessons: Lesson[] } {
  const sectionsOf = (articleId: string) => {
    const a = rules.articles.find((x) => x.id === articleId);
    if (!a) return null;
    const h3 = [...a.intro, ...a.sections.flatMap((s) => s.blocks)].filter((b) => b.t === 'h3').map((b) => (b as { id: string }).id);
    return new Set([...a.sections.map((s) => s.id), ...h3]);
  };
  const terms = new Set(rules.glossary.map((g) => g.id));
  const pages = new Set(['/rules', '/rules/glossary', '/rules/stratagems', '/rules/factions']);
  const linkOk = (href: string): boolean => {
    if (!href.startsWith('/rules')) return true;
    const [path, anchor] = href.split('#');
    if (path === '/rules/glossary') return !anchor || terms.has(anchor);
    if (path === '/rules/stratagems') return !anchor || stratagemAnchors.has(anchor);
    if (pages.has(path)) return !anchor;
    const art = /^\/rules\/([^/]+)$/.exec(path);
    const set = art ? sectionsOf(art[1]) : null;
    return !!set && (!anchor || set.has(anchor));
  };

  const lessons: Lesson[] = [];
  for (const path of mdFiles(dir)) {
    const s = readSource(path);
    checkSources(s);
    const fail = (msg: string): never => {
      throw new Error(`${s.file}: ${msg}`);
    };
    const id = field(s, 'id');
    const order = Number(field(s, 'order'));
    const minutes = Number(field(s, 'minutes'));
    if (!Number.isInteger(order) || order < 1) fail('"order" must be a whole number from 1');
    if (!Number.isInteger(minutes) || minutes < 2 || minutes > 5) fail('"minutes" must be 2 to 5');
    const md = compileMarkdown(s.body, s.file, s.bodyLine);
    const sections = md.sections.map((x) => ({ ...x, text: blocksText(x.blocks) }));
    const words = [blocksText(md.intro), ...sections.map((x) => x.text)].join(' ').split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) fail(`the text is ${words} words; a lesson is at most ${MAX_WORDS} words`);
    const refs = list(s.meta.rules).map((ref) => {
      const [article, section] = ref.split('#');
      const a = rules.articles.find((x) => x.id === article);
      const sec = a?.sections.find((x) => x.id === section);
      if (!a || !sec) return fail(`rules reference "${ref}" is not an article section`);
      return { article, section, title: sec.title };
    });
    const glossary = list(s.meta.glossary);
    for (const g of glossary) if (!terms.has(g)) fail(`glossary id "${g}" is not a glossary term`);
    for (const h of [...hrefs(md.intro), ...md.sections.flatMap((x) => hrefs(x.blocks))]) if (!linkOk(h)) fail(`the link ${h} points nowhere`);
    if (lessons.some((l) => l.id === id)) fail(`duplicate lesson id "${id}"`);
    if (lessons.some((l) => l.order === order)) fail(`another lesson already has order ${order}`);
    lessons.push({ id, title: field(s, 'title'), order, minutes, summary: field(s, 'summary'), drill: field(s, 'drill'), intro: md.intro, sections, rules: refs, glossary });
  }
  lessons.sort((a, b) => a.order - b.order);
  return { lessons };
}
