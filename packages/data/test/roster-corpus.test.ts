/**
 * The known-legal / known-illegal list corpus (test/corpus/<group>/<catalogue slug>.ts). Every legal list validates
 * with no issues and totals its hand-worked pts and PL; every illegal list fails for exactly the expected rules.
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { COST_PL, COST_PTS, validate, type Issue, type RuleKind } from '../src/roster';
import knightsCorpus from './corpus/imperium/imperium-imperial-knights';
import { buildFromSpec, type CatalogueCorpus, type IllegalSpec, type ListSpec } from './corpus/spec';
import { realCatalogues, realPolicy, realScope } from './helpers/realScope';

const CORPUS = join(import.meta.dirname, 'corpus');
const files = readdirSync(CORPUS, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts') && f !== 'spec.ts')
  .map((f) => join(CORPUS, f))
  .sort();
const corpora: { file: string; corpus: CatalogueCorpus }[] = [];
for (const file of files) corpora.push({ file, corpus: ((await import(pathToFileURL(file).href)) as { default: CatalogueCorpus }).default });

const catalogues = realCatalogues();
const policy = realPolicy();
const slugOf = (name: string) => {
  const hit = catalogues.find((c) => c.name === name);
  if (!hit) throw new Error(`Corpus: no catalogue "${name}" in generated/index.json`);
  return hit.slug;
};
const describeIssue = (i: Issue) => `${i.rule}: ${i.subject.name || i.subject.id} (limit ${i.limit}, actual ${i.actual})`;

function check(corpus: CatalogueCorpus, spec: ListSpec | IllegalSpec) {
  const primary = catalogues.find((c) => c.name === corpus.catalogue)!;
  const allies = spec.detachments.flatMap((d) => (d.catalogue && d.catalogue !== corpus.catalogue ? [slugOf(d.catalogue)] : []));
  const scope = realScope(primary.slug, ...allies);
  return validate(scope, buildFromSpec(scope, primary.id, spec), policy);
}

for (const { file, corpus } of corpora) {
  describe(relative(CORPUS, file).replaceAll('\\', '/'), () => {
    test('names a playable catalogue matching its file name', () => {
      const summary = catalogues.find((c) => c.name === corpus.catalogue);
      expect(summary, corpus.catalogue).toBeDefined();
      expect(summary!.library).toBe(false);
      expect(`${summary!.slug}.ts`).toBe(file.split(/[\\/]/).pop());
    });

    test('has at least one legal list and two illegal lists failing for different rules', () => {
      expect(corpus.legal.length).toBeGreaterThanOrEqual(1);
      expect(corpus.illegal.length).toBeGreaterThanOrEqual(2);
      expect(new Set(corpus.illegal.map((s) => [...s.expectRules].sort().join(','))).size).toBe(corpus.illegal.length);
    });

    for (const spec of corpus.legal) {
      test(`legal: ${spec.title}`, () => {
        const { view, issues } = check(corpus, spec);
        expect(issues.map(describeIssue)).toEqual([]);
        expect({ points: view.total[COST_PTS] ?? 0, powerLevel: view.total[COST_PL] ?? 0 }).toEqual(spec.expect);
      });
    }

    for (const spec of corpus.illegal) {
      test(`illegal: ${spec.title}`, () => {
        const { issues } = check(corpus, spec);
        expect(issues.map((i) => i.rule).sort(), issues.map(describeIssue).join('\n')).toEqual([...spec.expectRules].sort());
      });
    }
  });
}

describe('buildFromSpec', () => {
  const am = catalogues.find((c) => c.slug === 'imperium-astra-militarum')!;
  const scope = realScope(am.slug);
  const list = (units: ListSpec['detachments'][number]['units']): ListSpec => ({
    title: 'test', battleSize: 'strike-force', detachments: [{ detachment: 'Arks of Omen Detachment', units }], expect: { points: 0, powerLevel: 0 },
  });
  const unitSels = (r: ReturnType<typeof buildFromSpec>) => validate(scope, r, policy).view.forces[0].selections.filter((v) => v.type !== 'upgrade');

  test('throws instead of guessing a name', () => {
    expect(() => buildFromSpec(scope, am.id, list([{ name: 'No Such Unit' }]))).toThrow('Corpus: "No Such Unit" not found under "Arks of Omen Detachment"');
    // With a Cadian Castellan in the list, a Commissar can be Elites or take no slot.
    expect(() => buildFromSpec(scope, am.id, list([{ name: 'Cadian Castellan' }, { name: 'Commissar' }]))).toThrow('Corpus: "Commissar" is ambiguous under "Arks of Omen Detachment"');
    expect(() => buildFromSpec(scope, am.id, list([{ name: 'Infantry Squad', options: ['No Such Option'] }]))).toThrow('Corpus: "No Such Option" not found under "Infantry Squad"');
  });

  test('"Role > Name" picks by battlefield role; models, options and warlord apply to the unit', () => {
    const r = buildFromSpec(scope, am.id, list([
      { name: 'Cadian Castellan', warlord: true },
      { name: 'Infantry Squad' },
      { name: 'Elites > Commissar' },
      { name: 'Leman Russ Battle Tanks', models: { 'Leman Russ Battle Tank': 2 } },
      { name: 'Chimera', options: ['Heavy Bolter'] },
    ]));
    const [castellan, , commissar, russ, chimera] = unitSels(r);
    expect(castellan.children.some((c) => c.name === 'Warlord')).toBe(true);
    expect(commissar.primary && scope.category(commissar.primary)?.name).toBe('Elites');
    expect(russ.models).toBe(2);
    expect(chimera.children.map((c) => c.name.trim())).toContain('Heavy Bolter');
    expect(chimera.children.map((c) => c.name.trim())).not.toContain('Heavy Flamer');
  });

  test('throws on an unknown detachment, catalogue or army choice and on an ambiguous option', () => {
    expect(() => buildFromSpec(scope, am.id, { ...list([]), detachments: [{ detachment: 'No Such Detachment', units: [] }] })).toThrow(
      'Corpus: "No Such Detachment" not found under "strike-force"',
    );
    const ally = (catalogue: string): ListSpec => ({ ...list([]), detachments: [...list([]).detachments, { detachment: 'Patrol Detachment -2CP', catalogue, units: [] }] });
    expect(() => buildFromSpec(scope, am.id, ally('No Such Catalogue'))).toThrow('Corpus: "No Such Catalogue" not found under "test"');
    const army = (a: Record<string, string>): ListSpec => ({ ...list([]), detachments: [{ detachment: 'Arks of Omen Detachment', army: a, units: [] }] });
    expect(() => buildFromSpec(scope, am.id, army({ 'No Such Configuration': 'Cadian' }))).toThrow('Corpus: "No Such Configuration" not found under "Arks of Omen Detachment"');
    expect(() => buildFromSpec(scope, am.id, army({ 'Arks of Omen Compulsory Type': 'No Such Type' }))).toThrow('Corpus: "No Such Type" not found under "Arks of Omen Compulsory Type"');
    // A Canoness Warlord has two "Stratagem: Warlord Trait" options (one in Character Stratagems).
    const sisters = catalogues.find((c) => c.slug === 'imperium-adepta-sororitas')!;
    expect(() => buildFromSpec(realScope(sisters.slug), sisters.id, list([{ name: 'Canoness', warlord: true, options: ['Stratagem: Warlord Trait'] }]))).toThrow(
      'Corpus: "Stratagem: Warlord Trait" is ambiguous under "Canoness"',
    );
  });

  test('throws on a second choice in a group of one choice or an option named twice, not on an automatic one', () => {
    expect(() => buildFromSpec(scope, am.id, list([{ name: 'Chimera', options: ['Heavy Bolter', 'Heavy Flamer'] }]))).toThrow(
      'Corpus: "Heavy Flamer" is a second choice in',
    );
    expect(() => buildFromSpec(scope, am.id, list([{ name: 'Chimera', options: ['Heavy Bolter', 'Heavy Bolter'] }]))).toThrow('Corpus: "Heavy Bolter" is named twice under "Chimera"');
    expect(() => buildFromSpec(scope, am.id, list([{ name: 'Cadian Castellan', warlord: true, options: ['Warlord'] }]))).toThrow('Corpus: "Warlord" is named twice under "Cadian Castellan"');
    // Trajann Valoris is always the Warlord: `warlord: true` leaves his automatic Warlord as it is.
    const custodes = catalogues.find((c) => c.slug === 'imperium-adeptus-custodes')!;
    const custodesScope = realScope(custodes.slug);
    const trajann = validate(custodesScope, buildFromSpec(custodesScope, custodes.id, list([{ name: 'Trajann Valoris', warlord: true }])), policy).view.forces[0].selections.find((v) => v.name === 'Trajann Valoris')!;
    expect(trajann.children.filter((c) => c.name === 'Warlord').map((c) => c.sel.count)).toEqual([1]);
  });

  test('after.army picks once every unit is built, replacing a choice made before them', () => {
    const knights = catalogues.find((c) => c.slug === 'imperium-imperial-knights')!;
    const knightsScope = realScope(knights.slug);
    const lance = knightsCorpus.legal[0];
    const changed: ListSpec = { ...lance, detachments: [{ ...lance.detachments[0], after: { army: { 'Questor Allegiance': 'Questor Mechanicus' } } }] };
    const { view, issues } = validate(knightsScope, buildFromSpec(knightsScope, knights.id, changed), policy);
    const allegiance = view.forces[0].selections.find((v) => v.name === 'Questor Allegiance')!;
    expect(allegiance.children.map((c) => c.name.trim())).toContain('Questor Mechanicus');
    expect(allegiance.children.map((c) => c.name.trim())).not.toContain('Questor Imperialis');
    // The custom household stays, but only Questor Imperialis may take it now.
    expect(issues.filter((i) => i.rule === 'hidden-selected').map((i) => i.subject.name)).toContain('Custom Household: Hunter of Beasts');
  });
});

const RULE_KINDS = [
  'points-over', 'cp-negative', 'slot-min', 'slot-max', 'warlord-missing', 'warlord-extra', 'unique', 'unit-limit',
  'model-count', 'wargear-max', 'option-required', 'hidden-selected', 'unknown-entry', 'rule-of-three',
  'detachment-not-allowed', 'detachment-count', 'detachment-faction', 'army-faction', 'other',
] as const satisfies readonly RuleKind[];
/** Fails to compile when RuleKind gains a kind RULE_KINDS doesn't list. */
const allRuleKinds: Exclude<RuleKind, (typeof RULE_KINDS)[number]> extends never ? true : false = true;
const UNCOVERED_RULES = new Set<RuleKind>(['unknown-entry', 'other']);
const MIN_CATALOGUES_PER_RULE = 3;

describe('corpus coverage', () => {
  // Both enabled in Task 11, once Tasks 10–11 have added the remaining catalogues.
  test.todo('covers every playable catalogue in the index', () => {
    const covered = new Set(corpora.map((c) => c.corpus.catalogue));
    expect(catalogues.filter((c) => !c.library && !covered.has(c.name)).map((c) => c.name)).toEqual([]);
  });

  test.todo(`every rule kind except unknown-entry and other appears in at least ${MIN_CATALOGUES_PER_RULE} catalogues`, () => {
    expect(allRuleKinds).toBe(true);
    const thin = RULE_KINDS.filter((rule) => !UNCOVERED_RULES.has(rule)).flatMap((rule) => {
      const n = corpora.filter((c) => c.corpus.illegal.some((s) => s.expectRules.includes(rule))).length;
      return n < MIN_CATALOGUES_PER_RULE ? [`${rule}: ${n}`] : [];
    });
    expect(thin).toEqual([]);
  });
});
