import { expect, test } from 'vitest';
import { search, searchDocs } from './search';
import { coreStratagems, rulesData } from './__fixtures__/rules';

const docs = searchDocs(rulesData, coreStratagems);
const first = (q: string) => search(docs, q)[0]?.doc.title;

test('docs cover sections, glossary terms and core stratagems with their paths', () => {
  expect(docs.find((d) => d.title === 'Look Out, Sir')).toMatchObject({ kind: 'section', path: '/rules/shooting-phase#look-out-sir' });
  expect(docs.find((d) => d.title === "T'au")).toMatchObject({ kind: 'term', path: '/rules/glossary#tau' });
  expect(docs.find((d) => d.title === 'Fire Overwatch')).toMatchObject({ kind: 'stratagem', path: '/rules/stratagems#strat-000002134006' });
});

test('punctuation and case in the query are ignored', () => {
  expect(first('look out sir')).toBe('Look Out, Sir');
  expect(first('Look Out, Sir!')).toBe('Look Out, Sir');
  expect(first('LOOK OUT SIR')).toBe('Look Out, Sir');
});

test("apostrophes don't matter", () => {
  expect(first("t'au")).toBe("T'au");
  expect(first('tau')).toBe("T'au");
});

test('an exact title beats a title that contains the word', () => {
  expect(search(docs, 'overwatch').map((h) => h.doc.title).slice(0, 2)).toEqual(['Overwatch', 'Fire Overwatch']);
  expect(search(docs, 'OVERWATCH')[0].doc.title).toBe('Overwatch');
});

test('words are matched as prefixes of words in the text', () => {
  expect(search(docs, 'engag horiz').map((h) => h.doc.title)).toEqual(['Engagement Range']);
});

test('no hits and empty queries return nothing', () => {
  expect(search(docs, 'zzzz')).toEqual([]);
  expect(search(docs, '')).toEqual([]);
  expect(search(docs, '   ')).toEqual([]);
});

test('the snippet shows the match and stays short', () => {
  const hit = search(docs, 'fewer wounds')[0];
  expect(hit.doc.title).toBe('Look Out, Sir');
  expect(hit.snippet).toContain('fewer wounds');
  expect(hit.snippet.length).toBeLessThanOrEqual(125);
});

test('limit caps the results', () => {
  expect(search(docs, 'a', 2)).toHaveLength(2);
});
