import { test, expect } from 'vitest';
import { slugify, normalizeName, htmlToText, titleCase } from '../src/text';

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

test('titleCase keeps small words, hyphen and apostrophe tails lower-case', () => {
  expect(titleCase('COMMAND RE-ROLL')).toBe('Command Re-roll');
  expect(titleCase("T'AU EMPIRE")).toBe("T'au Empire");
  expect(titleCase('SONS OF THE FORGE')).toBe('Sons of the Forge');
  expect(titleCase('A HATED FOE')).toBe('A Hated Foe');
  expect(titleCase('THE SPIRIT OF THE MACHINE')).toBe('The Spirit of the Machine');
  expect(titleCase('HEROES OF RYNN’S WORLD')).toBe('Heroes of Rynn’s World');
  expect(titleCase('STRIKE FIRST, FOR ULTRAMAR!')).toBe('Strike First, for Ultramar!');
});

test('htmlToText puts list items on their own lines and decodes upper-case entities', () => {
  expect(htmlToText('Until then:<br><ul><li>Add 1 to hit.</li><li>Add 1 to wound.</li></ul>')).toBe(
    'Until then:\n• Add 1 to hit.\n• Add 1 to wound.',
  );
  expect(htmlToText('<ul><li>One</li></ul><br>After')).toBe('• One\n\nAfter');
  expect(htmlToText('that model’s &LT;CHAPTER&GT; keyword')).toBe('that model’s <CHAPTER> keyword');
});

test('htmlToText keeps table cells apart: one row per line, cells joined with " | "', () => {
  const html =
    'score as follows:<table><tbody><tr><td><table><tbody>' +
    '<tr><td style="w"></td><td></td></tr>' +
    '<tr><td><b>CONSECUTIVE COMMAND PHASES</b></td><td><b>VICTORY POINTS</b></td></tr>' +
    '<tr><td>2</td><td>2</td></tr><tr><td>4</td><td>5</td></tr>' +
    '</tbody></table></td></tr></tbody></table>For example, 3VP.';
  expect(htmlToText(html)).toBe('score as follows:\nCONSECUTIVE COMMAND PHASES | VICTORY POINTS\n2 | 2\n4 | 5\nFor example, 3VP.');
});
