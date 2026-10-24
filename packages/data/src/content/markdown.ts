/**
 * The Markdown subset our content is written in, compiled to JSON blocks the app renders without HTML:
 * `##` sections, `###` sub-headings, paragraphs, `- ` / `1. ` lists (one nested level, two-space indent),
 * **bold**, *italic*, `code` (kept as plain text), [links](/rules/…), pipe tables, and `> **Tip:**` /
 * `> **Not confirmed:**` notes. Anything else throws with the file and line.
 */
import type { Block, Inline } from '../model/types';
import { slugify } from '../text';

export interface Frontmatter {
  meta: Record<string, string | string[]>;
  body: string;
  /** 1-based line number of the body's first line in the file. */
  bodyLine: number;
}

/** `---`-fenced `key: value` / `key: [a, b]` lines at the top of a file. */
export function parseFrontmatter(src: string, file: string): Frontmatter {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const end = lines.indexOf('---', 1);
  if (lines[0] !== '---' || end < 0) throw new Error(`${file}: the file must start with --- frontmatter ---`);
  const meta: Record<string, string | string[]> = {};
  lines.slice(1, end).forEach((line, i) => {
    const m = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!m) throw new Error(`${file}:${i + 2}: frontmatter lines are "key: value"`);
    const list = /^\[(.*)\]$/.exec(m[2].trim());
    meta[m[1]] = list ? list[1].split(',').map((s) => s.trim()).filter(Boolean) : m[2].trim();
  });
  return { meta, body: lines.slice(end + 1).join('\n'), bodyLine: end + 2 };
}

const HTML_TAG = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/;
const LIST_ITEM = /^( *)(-|\d+\.) +(.*)$/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)/;

export interface CompiledMarkdown {
  intro: Block[];
  sections: { id: string; title: string; blocks: Block[] }[];
}

/** Compiles a body; `firstLine` is its first line's number in the file, for error messages. */
export function compileMarkdown(body: string, file: string, firstLine = 1): CompiledMarkdown {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const where = (i: number) => `${file}:${firstLine + i}`;
  const unsupported = (i: number): never => {
    throw new Error(`${where(i)}: unsupported Markdown "${lines[i].trim().slice(0, 60)}"`);
  };
  const ids = new Set<string>();
  const uniqueId = (title: string) => {
    const base = slugify(title);
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
    ids.add(id);
    return id;
  };

  function inline(s: string, i: number): Inline[] {
    const out: Inline[] = [];
    let buf = '';
    const flush = () => {
      if (buf) out.push({ t: 'text', v: buf });
      buf = '';
    };
    let k = 0;
    while (k < s.length) {
      if (s.startsWith('**', k)) {
        const end = s.indexOf('**', k + 2);
        if (end > k + 2) {
          flush();
          out.push({ t: 'b', c: inline(s.slice(k + 2, end), i) });
          k = end + 2;
          continue;
        }
      } else if (s[k] === '*') {
        const end = s.indexOf('*', k + 1);
        if (end > k + 1) {
          flush();
          out.push({ t: 'i', c: inline(s.slice(k + 1, end), i) });
          k = end + 1;
          continue;
        }
      } else if (s[k] === '`') {
        // A code span (`3+`, `9"`) is plain text: its content as written, without the backticks.
        const end = s.indexOf('`', k + 1);
        if (end > k + 1) {
          buf += s.slice(k + 1, end);
          k = end + 1;
          continue;
        }
      } else if (s[k] === '[' && s[k + 1] !== '[' && s[k - 1] !== '[') {
        const m = LINK.exec(s.slice(k));
        if (m) {
          if (!/^(\/rules\/|\/factions\/|#)/.test(m[2])) throw new Error(`${where(i)}: links must stay inside the app ("${m[2]}")`);
          flush();
          out.push({ t: 'a', href: m[2], c: inline(m[1], i) });
          k += m[0].length;
          continue;
        }
      }
      buf += s[k];
      k++;
    }
    flush();
    return out;
  }

  const startsBlock = (line: string) => /^(#|>|\||```|!\[)/.test(line) || LIST_ITEM.test(line);
  const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  const out: CompiledMarkdown = { intro: [], sections: [] };
  let blocks = out.intro;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (HTML_TAG.test(line)) unsupported(i);
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#+) (.+)$/.exec(line);
    if (h) {
      if (h[1] === '##') {
        const section = { id: uniqueId(h[2].trim()), title: h[2].trim(), blocks: [] as Block[] };
        out.sections.push(section);
        blocks = section.blocks;
      } else if (h[1] === '###') {
        blocks.push({ t: 'h3', id: uniqueId(h[2].trim()), c: inline(h[2].trim(), i) });
      } else unsupported(i);
      i++;
      continue;
    }
    if (/^(#|```|!\[)/.test(line)) unsupported(i);
    if (line.startsWith('>')) {
      const start = i;
      const parts: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) parts.push(lines[i++].replace(/^>\s?/, ''));
      const m = /^\*\*(Tip|Not confirmed):\*\*\s+(.+)$/.exec(parts.join(' ').trim());
      if (!m) unsupported(start);
      blocks.push({ t: 'note', kind: m![1] === 'Tip' ? 'tip' : 'unconfirmed', c: inline(m![2], start) });
      continue;
    }
    if (line.startsWith('|')) {
      const start = i;
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      if (rows.length < 2 || !/^\|(\s*:?-+:?\s*\|)+\s*$/.test(rows[1].trim())) unsupported(start);
      blocks.push({
        t: 'table',
        head: cells(rows[0]).map((c) => inline(c, start)),
        rows: rows.slice(2).map((r, n) => cells(r).map((c) => inline(c, start + 2 + n))),
      });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      if (item[1]) unsupported(i);
      const type = item[2] === '-' ? 'ul' : 'ol';
      const list: Block = { t: type, items: [] };
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (!m) break;
        const itemType = m[2] === '-' ? 'ul' : 'ol';
        if (m[1] === '') {
          if (itemType !== type) break;
          list.items.push([{ t: 'p', c: inline(m[3], i) }]);
        } else if (m[1] === '  ' && list.items.length) {
          const current = list.items[list.items.length - 1];
          let nested = current[1];
          if (!nested) current.push((nested = { t: itemType, items: [] }));
          if (nested.t !== itemType) unsupported(i);
          (nested as { items: Block[][] }).items.push([{ t: 'p', c: inline(m[3], i) }]);
        } else unsupported(i);
        i++;
      }
      blocks.push(list);
      continue;
    }
    const start = i;
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      if (HTML_TAG.test(lines[i])) unsupported(i);
      para.push(lines[i++].trim());
    }
    blocks.push({ t: 'p', c: inline(para.join(' '), start) });
  }
  return out;
}

export function inlineText(c: Inline[]): string {
  return c.map((x) => (x.t === 'text' ? x.v : inlineText(x.c))).join('');
}

/** Blocks flattened to plain text (for search). */
export function blocksText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case 'ul':
        case 'ol':
          return b.items.map(blocksText).join(' ');
        case 'table':
          return [...b.head, ...b.rows.flat()].map(inlineText).join(' ');
        default:
          return inlineText(b.c);
      }
    })
    .join(' ');
}
