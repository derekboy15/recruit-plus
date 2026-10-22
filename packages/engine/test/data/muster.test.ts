import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { addUnit, availableUnits, createRoster, evaluate, FORCE } from '@recruit/data/roster';
import type { UnitOut } from '@recruit/data/model';
import { musterFromRoster, type MusterProblem } from '../../src/data/muster';
import { validateSetup } from '../../src';
import { buildFromSpec, type CatalogueCorpus } from '../../../data/test/corpus/spec';
import { realCatalogueId, realCatalogues as realSummaries, realScope } from '../../../data/test/helpers/realScope';
import { realCatalogues } from '../helpers/realData';
import { testSetup } from '../helpers/game';

const BASELINE = join(import.meta.dirname, 'muster-baseline.json');

/** Every unit of every catalogue, by BattleScribe id (first catalogue wins, like the web app's unit index). */
function unitIndex(): Map<string, { unit: UnitOut; catalogueName: string }> {
  const out = new Map<string, { unit: UnitOut; catalogueName: string }>();
  for (const c of realCatalogues()) for (const unit of c.units) if (!out.has(unit.id)) out.set(unit.id, { unit, catalogueName: c.name });
  return out;
}
const units = unitIndex();

describe('musterFromRoster', () => {
  test('a Necron Warriors unit musters 10 models with Gauss Flayers', () => {
    const scope = realScope('necrons');
    const catalogueId = realCatalogueId('necrons');
    let roster = createRoster(scope, { name: 'Test', catalogueId, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    const entry = availableUnits(scope, roster, roster.forces[0].id).find((u) => u.name === 'Necron Warriors')!;
    roster = addUnit(scope, roster, roster.forces[0].id, entry.entryId).roster;
    const { army, problems } = musterFromRoster(evaluate(scope, roster), units, 'A');
    expect(problems).toEqual([]);
    const warriors = army.units.find((u) => u.datasheet.name === 'Necron Warriors')!;
    expect(warriors.models.reduce((a, m) => a + m.count, 0)).toBe(10);
    expect(warriors.models.every((m) => m.weapons.includes('Gauss Flayer'))).toBe(true);
  });

  test('every legal list in the army-builder corpus musters into a valid engine army', async () => {
    const dir = join(import.meta.dirname, '../../../data/test/corpus');
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts') && f !== 'spec.ts').sort();
    const summaries = realSummaries();
    const counts: Record<string, number> = {};
    const examples: Record<string, string[]> = {};
    let lists = 0;
    for (const f of files) {
      const corpus = ((await import(pathToFileURL(join(dir, f)).href)) as { default: CatalogueCorpus }).default;
      const primary = summaries.find((c) => c.name === corpus.catalogue)!;
      for (const spec of corpus.legal) {
        const allies = spec.detachments.flatMap((d) => (d.catalogue && d.catalogue !== corpus.catalogue ? [summaries.find((c) => c.name === d.catalogue)!.slug] : []));
        const scope = realScope(primary.slug, ...allies);
        const view = evaluate(scope, buildFromSpec(scope, primary.id, spec));
        const { army, problems } = musterFromRoster(view, units, 'A');
        lists++;
        expect(army.units.length, `${spec.title}: no units mustered`).toBeGreaterThan(0);
        const setup = testSetup();
        setup.armies = [{ ...army, player: 'A' }, setup.armies[1]];
        expect(validateSetup(setup), spec.title).toEqual([]);
        for (const p of problems as MusterProblem[]) {
          counts[p.kind] = (counts[p.kind] ?? 0) + 1;
          (examples[p.kind] ??= []).length < 8 && examples[p.kind].push(`${spec.title}: ${p.unit}: ${p.detail}`);
        }
      }
    }
    expect(lists).toBeGreaterThan(40);
    if (!existsSync(BASELINE)) writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    for (const [kind, n] of Object.entries(counts)) expect({ kind, n, examples: examples[kind] }).toMatchObject({ kind, n: expect.toSatisfy((v: number) => v <= (baseline[kind] ?? 0)) });
  });
});
