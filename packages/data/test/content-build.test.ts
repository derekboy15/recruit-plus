import { test, expect } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContent } from '../src/content/build';
import { blocksText, compileMarkdown, parseFrontmatter } from '../src/content/markdown';
import type { CatalogueOut, UnitOut } from '../src/model/types';

const FIXTURE = join(__dirname, 'fixtures', 'content');
const t = (v: string) => ({ t: 'text', v });
const p = (...c: unknown[]) => ({ t: 'p', c });

function unit(name: string): UnitOut {
  return {
    id: name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''), name, catalogueId: 'nec', role: 'Troops',
    keywords: [], factionKeywords: [], models: [], weapons: [], abilities: [], psychic: [], woundTrack: [], transport: null,
    minModels: 1, maxModels: 1, powerLevel: 1, points: 1, baseSize: null, wahapediaId: null, legends: false, forgeWorld: false,
  };
}
const cats: CatalogueOut[] = [
  { id: 'nec', slug: 'necrons', name: 'Necrons', group: 'Xenos', library: false, rules: [], stratagems: [], units: ['Necron Warriors', 'Overlord', 'Immortals [Legends]'].map(unit) },
  { id: 'lib', slug: 'library', name: 'Library', group: 'Xenos', library: true, rules: [], stratagems: [], units: [] },
];

/** A copy of the fixture with one file replaced, for the rejection tests. */
function withFile(rel: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'recruit-content-'));
  cpSync(FIXTURE, dir, { recursive: true });
  writeFileSync(join(dir, rel), content);
  return dir;
}
const fixtureFile = (rel: string) => readFileSync(join(FIXTURE, rel), 'utf8');

test('frontmatter: scalars and lists', () => {
  const { meta, body } = parseFrontmatter(fixtureFile('rules/01-basics.md'), '01-basics.md');
  expect(meta).toEqual({
    id: 'basics',
    title: 'The basics',
    order: '1',
    summary: 'Datasheets, dice and measuring.',
    sources: ['01_Core_Rules/Core_Rules_Turn_Sequence.md', '01_Core_Rules/Glossary_and_Keywords.md §4'],
  });
  expect(body.startsWith('Everything here')).toBe(true);
});

test('an article compiles to sections of blocks', () => {
  const { rules } = buildContent(FIXTURE, cats);
  const article = rules.articles[0];
  expect(article).toMatchObject({ id: 'basics', title: 'The basics', order: 1, summary: 'Datasheets, dice and measuring.' });
  expect(article.intro).toEqual([p(t('Everything here applies in every phase.'))]);
  expect(article.sections.map((s) => [s.id, s.title])).toEqual([
    ['measuring', 'Measuring'],
    ['engagement-range', 'Engagement Range'],
  ]);
  expect(article.sections[0].blocks).toEqual([
    p(
      t('Measure from the closest points of the '),
      { t: 'b', c: [t('bases')] },
      t('. See '),
      { t: 'a', href: '#engagement-range', c: [t('Engagement Range')] },
      t(' and the '),
      { t: 'a', href: '/rules/glossary#core', c: [t('glossary')] },
      t('.'),
    ),
    {
      t: 'table',
      head: [[t('Distance')], [t('Meaning')]],
      rows: [
        [[t('1"')], [t('Engagement Range, '), { t: 'i', c: [t('horizontally')] }]],
        [[t('5"')], [t('Engagement Range, vertically')]],
      ],
    },
    {
      t: 'ul',
      items: [
        [p(t('Units keep '), { t: 'b', c: [t('coherency')] }, t(':')), { t: 'ul', items: [[p(t('within 2" horizontally'))], [p(t('within 5" vertically'))]] }],
        [p(t('Check it at the end of every move.'))],
      ],
    },
    { t: 'note', kind: 'tip', c: [t('Use a tape measure, not a ruler.')] },
    { t: 'h3', id: 'rounding', c: [t('Rounding')] },
    p(t('Never round distances.')),
  ]);
  expect(article.sections[1].blocks).toEqual([
    { t: 'ol', items: [[p(t('Measure 1" horizontally.'))], [p(t('Measure 5" vertically.'))]] },
    { t: 'note', kind: 'unconfirmed', c: [t('Some older FAQs measured differently.')] },
  ]);
});

test('blocksText flattens tables and lists into searchable text', () => {
  const { rules } = buildContent(FIXTURE, cats);
  const text = rules.articles[0].sections[0].text;
  expect(text).toContain('Distance Meaning 1" Engagement Range, horizontally');
  expect(text).toContain('within 2" horizontally');
  expect(text).toContain('Use a tape measure');
  expect(blocksText([{ t: 'ul', items: [[p(t('a'))], [p(t('b'))]] }])).toBe('a b');
});

test('glossary terms get ids', () => {
  const { rules } = buildContent(FIXTURE, cats);
  expect(rules.glossary.map((g) => [g.id, g.term])).toEqual([
    ['core', 'CORE'],
    ['tau-empire', "T'au Empire"],
  ]);
  expect(rules.glossary[0].text).toBe('A keyword on most rank-and-file units. Many auras only affect CORE units.');
});

test('a guide resolves its key units to datasheets', () => {
  const { guides } = buildContent(FIXTURE, cats);
  expect(guides).toHaveLength(1);
  expect(guides[0]).toMatchObject({ slug: 'necrons', title: 'Necrons' });
  expect(guides[0].keyUnits).toEqual([
    { name: 'Necron Warriors', unitSlug: 'necron-warriors', why: [t('Cheap, tough Troops that '), { t: 'i', c: [t('hold')] }, t(' objectives.')] },
    { name: 'Overlord', unitSlug: 'overlord', why: [t('Your Warlord.')] },
    { name: 'Immortals', unitSlug: 'immortals-legends', why: [t('Elite Troops.')] },
  ]);
  expect(guides[0].plays).toEqual([p(t('Tough robots that get back up.'))]);
});

test('an empty content directory builds nothing', () => {
  expect(buildContent(mkdtempSync(join(tmpdir(), 'recruit-empty-')), cats)).toEqual({ rules: { articles: [], glossary: [] }, guides: [] });
});

test('HTML tags are rejected with file and line', () => {
  expect(() => compileMarkdown('Hello\n\nSome <b>bold</b> text.', 'x.md')).toThrow(/^x\.md:3: unsupported Markdown "Some <b>bold<\/b> text\."/);
  // Keywords in angle brackets are not HTML.
  expect(() => compileMarkdown('A <DYNASTY> unit.', 'x.md')).not.toThrow();
});

test('unsupported headings, code and images are rejected', () => {
  expect(() => compileMarkdown('# Title', 'x.md')).toThrow(/x\.md:1: unsupported Markdown/);
  expect(() => compileMarkdown('#### Deep', 'x.md')).toThrow(/x\.md:1: unsupported Markdown/);
  expect(() => compileMarkdown('```\ncode\n```', 'x.md')).toThrow(/x\.md:1: unsupported Markdown/);
  expect(() => compileMarkdown('![alt](/a.png)', 'x.md')).toThrow(/x\.md:1: unsupported Markdown/);
  expect(() => compileMarkdown('> A quote', 'x.md')).toThrow(/x\.md:1: unsupported Markdown/);
});

test('external links are rejected', () => {
  expect(() => compileMarkdown('## A\n\nSee [this](https://example.com).', 'x.md')).toThrow(/x\.md:3: links must stay inside the app/);
});

test('"(unverified)" is rejected', () => {
  const dir = withFile('rules/glossary.md', fixtureFile('rules/glossary.md').replace('A Xenos faction.', 'A Xenos faction (Unverified).'));
  expect(() => buildContent(dir, cats)).toThrow(/glossary\.md:12: "\(unverified\)"/);
});

test('tabletopbattles is rejected', () => {
  const dir = withFile('rules/glossary.md', fixtureFile('rules/glossary.md').replace('A Xenos faction.', 'See tabletopbattles.'));
  expect(() => buildContent(dir, cats)).toThrow(/glossary\.md:12: "tabletopbattles"/);
});

test('a guide missing a section is rejected', () => {
  const dir = withFile('guides/necrons.md', fixtureFile('guides/necrons.md').replace('## Army rules\n\nYour units have **Reanimation Protocols**.\n\n', ''));
  expect(() => buildContent(dir, cats)).toThrow(/necrons\.md: a guide has exactly the sections "How this army plays", "Army rules", "Key units"/);
});

test('an unknown key unit is rejected', () => {
  const dir = withFile('guides/necrons.md', fixtureFile('guides/necrons.md').replace('[[Overlord]]', '[[Overlord on Barge]]'));
  expect(() => buildContent(dir, cats)).toThrow(/necrons\.md:\d+: no unit called "Overlord on Barge" in Necrons/);
});

test('too few key units is rejected', () => {
  const dir = withFile('guides/necrons.md', fixtureFile('guides/necrons.md').replace('- [[Immortals]] - Elite Troops.\n', ''));
  expect(() => buildContent(dir, cats)).toThrow(/necrons\.md: "Key units" is a list of 3–8 items/);
});

test('a guide for a library or unknown catalogue is rejected', () => {
  const lib = withFile('guides/library.md', fixtureFile('guides/necrons.md').replace('catalogue: Necrons', 'catalogue: Library'));
  expect(() => buildContent(lib, cats)).toThrow(/library\.md: "Library" is not a playable catalogue/);
  const other = withFile('guides/necrons.md', fixtureFile('guides/necrons.md').replace('catalogue: Necrons', 'catalogue: Orks'));
  expect(() => buildContent(other, cats)).toThrow(/necrons\.md: "Orks" is not a playable catalogue/);
});

test('a guide file is named after its catalogue slug', () => {
  const dir = withFile('guides/necrons-2.md', fixtureFile('guides/necrons.md'));
  expect(() => buildContent(dir, cats)).toThrow(/necrons-2\.md: a guide for Necrons must be guides\/necrons\.md/);
});

test('sources must name library files', () => {
  const dir = withFile('rules/01-basics.md', fixtureFile('rules/01-basics.md').replace('01_Core_Rules/Core_Rules_Turn_Sequence.md', 'Goonhammer'));
  expect(() => buildContent(dir, cats)).toThrow(/01-basics\.md: source "Goonhammer" is not a library file/);
});

test('an article needs every frontmatter field', () => {
  const dir = withFile('rules/01-basics.md', fixtureFile('rules/01-basics.md').replace('summary: Datasheets, dice and measuring.\n', ''));
  expect(() => buildContent(dir, cats)).toThrow(/01-basics\.md: missing "summary"/);
});
