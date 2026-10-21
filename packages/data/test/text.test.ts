import { test, expect } from 'vitest';
import { slugify, normalizeName, htmlToText } from '../src/text';

test('slugify handles apostrophes, diacritics and separators', () => {
  expect(slugify("T'au Empire")).toBe('tau-empire');
  expect(slugify('Ûthar the Destined')).toBe('uthar-the-destined');
  expect(slugify('Imperium - Blood Angels')).toBe('imperium-blood-angels');
});

test('normalizeName strips Legends tags and case', () => {
  expect(normalizeName('Necron Warriors [Legends]')).toBe('necron warriors');
  expect(normalizeName('Lord Of Contagion')).toBe(normalizeName('Lord of Contagion'));
  expect(normalizeName('Ork Boyz')).not.toBe(normalizeName('Boyz'));
  expect(normalizeName('‘Iron Hand’ Straken')).toBe(normalizeName("'Iron Hand' Straken"));
  expect(slugify('‘Iron Hand’ Straken')).toBe('iron-hand-straken');
});

test('htmlToText converts breaks and decodes entities', () => {
  expect(htmlToText('<b>Re-roll</b> hit rolls of 1.<br>Then &amp; more')).toBe('Re-roll hit rolls of 1.\nThen & more');
});
