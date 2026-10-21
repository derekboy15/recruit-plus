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

test("factionDisplayName matches the roster engine's for every faction in the data", async () => {
  const { factionDisplayName: engine } = await import('@recruit/data/roster');
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const index = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'packages', 'data', 'generated', 'index.json'), 'utf8'));
  for (const { name } of index.catalogues as { name: string }[]) expect(factionDisplayName(name)).toBe(engine(name));
});
