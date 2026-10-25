/** Faction pages show the points the builder charges (C1): the roster engine's price for the unit as added. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { CatalogueOut } from '../src/model/types';
import { availableUnits } from '../src/roster/options';
import { createRoster, FORCE } from '../src/roster/policy';
import { resolve } from '../src/roster/scope';
import { realCatalogues, realScope } from './helpers/realScope';

const GEN = join(__dirname, '..', 'generated');
const catalogue = (slug: string): CatalogueOut => JSON.parse(readFileSync(join(GEN, 'catalogues', `${slug}.json`), 'utf8'));

/** The builder's picker prices on a new Strike Force list (Arks of Omen Detachment), by unit (target entry) id. */
function pickerPrices(slug: string): Map<string, number> {
  const scope = realScope(slug);
  const id = realCatalogues().find((c) => c.slug === slug)!.id;
  const roster = createRoster(scope, { name: 'Points', catalogueId: id, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
  const out = new Map<string, number>();
  for (const o of availableUnits(scope, roster, roster.forces[0].id)) {
    const target = resolve(scope, scope.node(o.entryId)!).target.id;
    if (!out.has(target)) out.set(target, o.points);
  }
  return out;
}

test("the Catacomb Command Barge's faction-page points are the builder's", () => {
  const barge = catalogue('necrons').units.find((u) => u.name === 'Catacomb Command Barge')!;
  expect(barge.points).toBe(pickerPrices('necrons').get(barge.id));
});

test('Orikan the Diviner has points (Wahapedia has none)', () => {
  expect(catalogue('necrons').units.find((u) => u.name === 'Orikan the Diviner')!.points).not.toBeNull();
});

test('every unit the picker can price shows the picker price, in every playable catalogue', { timeout: 120_000 }, () => {
  const wrong: string[] = [];
  for (const c of realCatalogues().filter((x) => !x.library)) {
    const prices = pickerPrices(c.slug);
    for (const u of catalogue(c.slug).units) {
      const p = prices.get(u.id);
      // 0 is no price (the next test).
      if (p !== undefined && p > 0 && u.points !== p) wrong.push(`${c.slug}/${u.name}: page ${u.points}, picker ${p}`);
    }
  }
  expect(wrong).toEqual([]);
});

test('a unit the engine prices at 0 keeps its Wahapedia cost, or none: never "0 pts"', () => {
  const craftworlds = catalogue('aeldari-craftworlds').units;
  expect(pickerPrices('aeldari-craftworlds').get(craftworlds.find((u) => u.name === 'Corsair Reaver Band [Legends]')!.id)).toBe(0);
  expect(craftworlds.find((u) => u.name === 'Corsair Reaver Band [Legends]')!.points).toBe(45);
  for (const c of realCatalogues()) for (const u of catalogue(c.slug).units) expect(u.points, `${c.slug}/${u.name}`).not.toBe(0);
});

test('points-report.json lists each disagreement with Wahapedia, the barge among them', () => {
  expect(existsSync(join(GEN, 'points-report.json')), 'run npm run data:build').toBe(true);
  const report: { slug: string; unit: string; engine: number | null; wahapedia: number | null }[] = JSON.parse(readFileSync(join(GEN, 'points-report.json'), 'utf8'));
  expect(report).toContainEqual(expect.objectContaining({ slug: 'necrons', unit: 'Catacomb Command Barge', engine: 150, wahapedia: 145 }));
  for (const r of report) expect(r.engine, `${r.slug}/${r.unit}`).not.toBe(r.wahapedia);
});
