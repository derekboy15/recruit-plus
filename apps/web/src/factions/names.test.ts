import { expect, test } from 'vitest';
import { factionDisplayName } from './names';

test('factionDisplayName drops grouping prefixes', () => {
  expect(factionDisplayName('Imperium - Adeptus Astartes - Blood Angels')).toBe('Blood Angels');
  expect(factionDisplayName('Chaos - Death Guard')).toBe('Death Guard');
  expect(factionDisplayName('Aeldari - Craftworlds')).toBe('Craftworlds');
  expect(factionDisplayName('Tyranids - Genestealer Cults')).toBe('Genestealer Cults');
  expect(factionDisplayName("T'au Empire")).toBe("T'au Empire");
  expect(factionDisplayName('Chaos - Renegades & Heretics [LEGENDS]')).toBe('Renegades & Heretics [LEGENDS]');
});
