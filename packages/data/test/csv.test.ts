import { test, expect } from 'vitest';
import { parseWahapediaCsv } from '../src/wahapedia/csv';

test('strips BOM, trailing pipe, CRLF', () => {
  const rows = parseWahapediaCsv('\uFEFFid|name|\r\n1|Necrons|\r\n2|T\'au Empire|\r\n');
  expect(rows).toEqual([{ id: '1', name: 'Necrons' }, { id: '2', name: "T'au Empire" }]);
});

test('keeps HTML inside fields and ignores blank trailing lines', () => {
  const rows = parseWahapediaCsv('a|b|\n<b>x</b>|y|\n\n');
  expect(rows).toEqual([{ a: '<b>x</b>', b: 'y' }]);
});
