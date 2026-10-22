import { test, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Block, DataIndex, Inline, RulesData, StratagemOut } from '../src/model/types';
import { crossCheck } from '../src/plain/check';

const GEN = join(__dirname, '..', 'generated');
let rules: RulesData;
let core: StratagemOut[];
let index: DataIndex;

beforeAll(() => {
  if (!existsSync(join(GEN, 'rules.json'))) throw new Error('Run npm run data:build first');
  rules = JSON.parse(readFileSync(join(GEN, 'rules.json'), 'utf8'));
  core = JSON.parse(readFileSync(join(GEN, 'core-stratagems.json'), 'utf8'));
  index = JSON.parse(readFileSync(join(GEN, 'index.json'), 'utf8'));
});

const section = (articleId: string, sectionId: string) => {
  const a = rules.articles.find((x) => x.id === articleId);
  const s = a?.sections.find((x) => x.id === sectionId);
  if (!s) throw new Error(`No section ${articleId}#${sectionId}`);
  return s;
};

test('articles are the twelve ids in order', () => {
  expect(rules.articles.map((a) => a.id)).toEqual([
    'basics', 'command-phase', 'movement-phase', 'psychic-phase', 'shooting-phase', 'charge-phase',
    'fight-phase', 'morale-phase', 'terrain', 'army-building', 'matched-play', 'core-stratagems',
  ]);
});

test('glossary has at least 40 terms', () => {
  expect(rules.glossary.length).toBeGreaterThanOrEqual(40);
});

test('no section or term is empty', () => {
  for (const a of rules.articles) {
    expect(a.sections.length, a.id).toBeGreaterThan(0);
    for (const s of a.sections) expect(s.text.trim(), `${a.id}#${s.id}`).not.toBe('');
  }
  for (const g of rules.glossary) expect(g.text.trim(), g.id).not.toBe('');
});

// Each row: the section's text must contain every listed token (numbers, distances, dice), matched as the
// plain-English cross-check matches them (a bare number may be satisfied by any token of the same value).
const PINNED: [string, string, string, string][] = [
  ['basics', 'unit-coherency', '2" 5" 6', 'units of 6 or more models need two neighbours'],
  ['basics', 'engagement-range', '1" 5"', 'Engagement Range'],
  ['shooting-phase', 'look-out-sir', '3" 9', 'Look Out, Sir'],
  ['charge-phase', 'charging', '12" 2D6', 'charge distance and roll'],
  ['shooting-phase', 'blast', '6 10 11 3', 'Blast'],
  ['shooting-phase', 'indirect-fire', '-1 +1', 'Indirect Fire penalty'],
  ['psychic-phase', 'smite', '5 D3 D6 10', 'Smite'],
  ['psychic-phase', 'perils-of-the-warp', 'D3', 'Perils of the Warp'],
  ['matched-play', 'battle-sizes', '500 1000 2000 3000 3 6 12 18', 'points limits and starting CP'],
  ['matched-play', 'aircraft', '1 2 3', 'Aircraft caps'],
  ['matched-play', 'secondary-objectives', '17 11', 'Core Book and Arks of Omen secondary counts'],
];

for (const [article, id, tokens, what] of PINNED) {
  test(`pinned: ${article}#${id} (${what})`, () => {
    // Thousands may be written with a separator ("1,000"); the checker reads both as the same number.
    expect(crossCheck(tokens, section(article, id).text).missing).toEqual([]);
  });
}

// Final Core Rules text (Wahapedia 9th archive, post-errata), as the engine implements it (RULINGS.md R-25):
// three protectors, and only the first needs 10+ wounds.
test('Look Out, Sir lists all three protectors from the final Core Rules', () => {
  const text = section('shooting-phase', 'look-out-sir').text;
  expect(text).toMatch(/VEHICLE or MONSTER[^.\n]*10 or more wounds/i);
  expect(text).toMatch(/no CHARACTER[^.\n]*(VEHICLE or MONSTER)/i);
  expect(text).toMatch(/no CHARACTER[^.\n]*3 or more models/i);
  expect(text).not.toMatch(/only protect a character if their unit has 3 or more models/i);
});

test('Look Out, Sir states the dataslate bodyguard change', () => {
  expect(section('shooting-phase', 'look-out-sir').text).toMatch(/bodyguard/i);
});

function hrefs(blocks: Block[]): string[] {
  const fromInline = (c: Inline[]): string[] => c.flatMap((x) => (x.t === 'a' ? [x.href, ...fromInline(x.c)] : x.t === 'text' ? [] : fromInline(x.c)));
  return blocks.flatMap((b) => {
    switch (b.t) {
      case 'ul':
      case 'ol':
        return b.items.flatMap(hrefs);
      case 'table':
        return [...b.head, ...b.rows.flat()].flatMap(fromInline);
      default:
        return fromInline(b.c);
    }
  });
}

test('every internal link resolves to an article, section, glossary term, stratagem or faction', () => {
  const anchors = (articleId: string) => {
    const a = rules.articles.find((x) => x.id === articleId);
    if (!a) return null;
    const h3 = a.sections.flatMap((s) => s.blocks).concat(a.intro).filter((b) => b.t === 'h3').map((b) => (b as { id: string }).id);
    return new Set([...a.sections.map((s) => s.id), ...h3]);
  };
  const terms = new Set(rules.glossary.map((g) => g.id));
  const strats = new Set(core.map((s) => `strat-${s.id}`));
  const slugs = new Set(index.catalogues.map((c) => c.slug));
  const pages = new Set(['/rules', '/rules/glossary', '/rules/stratagems', '/rules/factions', '/rules/reports']);
  const bad: string[] = [];
  const check = (from: string, articleId: string | null, href: string) => {
    const [path, anchor] = href.split('#');
    if (!path) {
      // In-page anchor: a section of the same article, or another term on the glossary page.
      const ok = articleId ? anchors(articleId)?.has(anchor) : terms.has(anchor);
      if (!ok) bad.push(`${from}: ${href}`);
      return;
    }
    if (path === '/rules/glossary') {
      if (anchor && !terms.has(anchor)) bad.push(`${from}: ${href}`);
      return;
    }
    if (path === '/rules/stratagems') {
      if (anchor && !strats.has(anchor)) bad.push(`${from}: ${href}`);
      return;
    }
    if (pages.has(path)) return;
    const art = /^\/rules\/([^/]+)$/.exec(path);
    if (art) {
      const set = anchors(art[1]);
      if (!set || (anchor && !set.has(anchor))) bad.push(`${from}: ${href}`);
      return;
    }
    const fac = /^\/factions\/([^/]+)/.exec(path);
    if (fac && slugs.has(fac[1])) return;
    bad.push(`${from}: ${href}`);
  };
  for (const a of rules.articles) {
    for (const h of hrefs(a.intro)) check(a.id, a.id, h);
    for (const s of a.sections) for (const h of hrefs(s.blocks)) check(`${a.id}#${s.id}`, a.id, h);
  }
  for (const g of rules.glossary) for (const h of hrefs(g.blocks)) check(`glossary#${g.id}`, null, h);
  expect(bad).toEqual([]);
});
