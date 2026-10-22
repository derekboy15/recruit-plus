/** packages/content Markdown -> RulesData (articles + glossary) and one FactionGuide per playable catalogue. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Block, CatalogueOut, FactionGuide, GlossaryTerm, Inline, KeyUnit, RulesArticle, RulesData } from '../model/types';
import { blocksText, compileMarkdown, parseFrontmatter, type Frontmatter } from './markdown';

const SOURCE = /^0[1-5]_[^/]+\/.+\.md( §[\d.]+)?$/;
const GUIDE_SECTIONS = ['How this army plays', 'Army rules', 'Key units'];
const FORBIDDEN: [RegExp, string][] = [
  [/\(unverified\)/i, '(unverified)'],
  [/tabletopbattles/i, 'tabletopbattles'],
];

interface Source extends Frontmatter {
  file: string;
}

function readSource(path: string): Source {
  const file = basename(path);
  const src = readFileSync(path, 'utf8');
  src.split(/\r?\n/).forEach((line, i) => {
    for (const [re, what] of FORBIDDEN) if (re.test(line)) throw new Error(`${file}:${i + 1}: "${what}" may not appear in content`);
  });
  return { ...parseFrontmatter(src, file), file };
}

function field(s: Source, key: string): string {
  const v = s.meta[key];
  if (typeof v !== 'string' || !v) throw new Error(`${s.file}: missing "${key}"`);
  return v;
}

function checkSources(s: Source): void {
  const sources = s.meta.sources;
  if (!Array.isArray(sources) || !sources.length) throw new Error(`${s.file}: missing "sources"`);
  for (const src of sources) if (!SOURCE.test(src)) throw new Error(`${s.file}: source "${src}" is not a library file`);
}

const mdFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => join(dir, f)) : []);

function buildRules(dir: string): RulesData {
  const articles: RulesArticle[] = [];
  let glossary: GlossaryTerm[] = [];
  for (const path of mdFiles(dir)) {
    const s = readSource(path);
    checkSources(s);
    const md = compileMarkdown(s.body, s.file, s.bodyLine);
    if (s.file === 'glossary.md') {
      field(s, 'title');
      glossary = md.sections.map((x) => ({ id: x.id, term: x.title, blocks: x.blocks, text: blocksText(x.blocks) }));
      continue;
    }
    const order = Number(field(s, 'order'));
    if (!Number.isFinite(order)) throw new Error(`${s.file}: "order" must be a number`);
    articles.push({
      id: field(s, 'id'),
      title: field(s, 'title'),
      order,
      summary: field(s, 'summary'),
      intro: md.intro,
      sections: md.sections.map((x) => ({ ...x, text: blocksText(x.blocks) })),
    });
  }
  articles.sort((a, b) => a.order - b.order);
  return { articles, glossary };
}

/** `[[Unit Name]] - why it matters`: the unit must be in the catalogue (a ` [Legends]` suffix is ignored). */
function keyUnit(item: Block[], cat: CatalogueOut, s: Source, line: number): KeyUnit {
  const first = item[0];
  const c: Inline[] = first?.t === 'p' ? first.c : [];
  const head = c[0]?.t === 'text' ? c[0].v : '';
  const m = /^\[\[([^\]]+)\]\] - (.*)$/s.exec(head);
  if (item.length !== 1 || !m) throw new Error(`${s.file}:${line}: key units are "[[Unit Name]] - why it matters"`);
  const name = m[1];
  const unit = cat.units.find((u) => u.name === name || u.name.replace(/\s*\[legends\]\s*$/i, '') === name);
  if (!unit) throw new Error(`${s.file}:${line}: no unit called "${name}" in ${cat.name}`);
  const why: Inline[] = [...(m[2] ? [{ t: 'text' as const, v: m[2] }] : []), ...c.slice(1)];
  return { name, unitSlug: unit.slug, why };
}

function buildGuide(path: string, cats: CatalogueOut[]): FactionGuide {
  const s = readSource(path);
  checkSources(s);
  const name = field(s, 'catalogue');
  const cat = cats.find((c) => c.name === name && !c.library);
  if (!cat) throw new Error(`${s.file}: "${name}" is not a playable catalogue`);
  if (s.file !== `${cat.slug}.md`) throw new Error(`${s.file}: a guide for ${cat.name} must be guides/${cat.slug}.md`);
  const md = compileMarkdown(s.body, s.file, s.bodyLine);
  if (md.sections.map((x) => x.title).join('|') !== GUIDE_SECTIONS.join('|')) {
    throw new Error(`${s.file}: a guide has exactly the sections ${GUIDE_SECTIONS.map((x) => `"${x}"`).join(', ')}, in that order`);
  }
  const [plays, armyRules, key] = md.sections;
  const list = key.blocks[0];
  if (key.blocks.length !== 1 || list.t !== 'ul' || list.items.length < 3 || list.items.length > 8) {
    throw new Error(`${s.file}: "Key units" is a list of 3–8 items`);
  }
  // The list's line in the file: for messages only.
  const keyLine = s.bodyLine + s.body.split('\n').findIndex((l) => l.startsWith('## Key units'));
  return {
    slug: cat.slug,
    title: field(s, 'title'),
    plays: plays.blocks,
    armyRules: armyRules.blocks,
    keyUnits: list.items.map((item, n) => keyUnit(item, cat, s, keyLine + 2 + n)),
  };
}

export function buildContent(contentDir: string, cats: CatalogueOut[]): { rules: RulesData; guides: FactionGuide[] } {
  const rules = buildRules(join(contentDir, 'rules'));
  const guides = mdFiles(join(contentDir, 'guides')).map((p) => buildGuide(p, cats));
  return { rules, guides };
}

