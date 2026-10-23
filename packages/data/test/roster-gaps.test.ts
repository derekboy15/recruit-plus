/**
 * Milestone 8: army-builder gaps that a reliable source settles (docs/superpowers/m2-known-gaps.md).
 * - Dataslate #7 (13 Apr 2023) removed the June 2022 Tyranids restrictions, among them "a HIVE TYRANT must be the
 *   Warlord" (research library 05_Balance_Errata_and_Points/Balance_Dataslates.md §9, Faction changes).
 * - Arks of Omen GT, Battle Brothers (Wahapedia the-rules/arks-of-omen-grand-tournament/; library
 *   01_Core_Rules/Army_Building_Detachments_and_CP.md §7.5): Genestealer Cults ally a BROOD BROTHERS detachment; a Kabal,
 *   Wych Cult or Haemonculus Coven allies a Drukhari Patrol "of a different type"; an Emperor's Children Traitoris
 *   Astartes army allies a SLAANESH-only Daemons Patrol; a Disciples of Be'lakor Daemons army allies a Traitoris
 *   Astartes Patrol and a House Korvax Chaos Knights Super-heavy Auxiliary.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadPolicy } from '../src/build';
import { detachmentChoices, explain, validate, type AooAllies, type Issue } from '../src/roster';
import { evaluate } from '../src/roster/evaluate';
import { buildFromSpec, type DetachmentSpec, type ListSpec } from './corpus/spec';
import { realCatalogueId, realCatalogues, realFiles, realPolicy, realScope } from './helpers/realScope';

const policy = realPolicy();
const AOO = 'Arks of Omen Detachment';
const PATROL = 'Patrol Detachment -2CP';
const SHA = 'Super-Heavy Auxiliary Detachment -3CP';

function issuesOf(primary: string, scopeSlugs: string[], detachments: DetachmentSpec[], battleSize: ListSpec['battleSize'] = 'strike-force'): Issue[] {
  const scope = realScope(primary, ...scopeSlugs);
  const spec: ListSpec = { title: 'gap', battleSize, detachments, expect: { points: 0, powerLevel: 0 } };
  return validate(scope, buildFromSpec(scope, realCatalogueId(primary), spec), policy).issues;
}
const rules = (issues: Issue[]) => issues.map((i) => i.rule);

describe('[Dataslate 13 Apr 2023] Tyranids', () => {
  const swarm = (warlord: 'prime' | 'tyrant'): DetachmentSpec => ({
    detachment: AOO,
    army: { 'Hive Fleet': ['Kraken', '(Hunt) Heightened Reflexes'] },
    units: [
      { name: 'Tyranid Prime', warlord: warlord === 'prime' },
      { name: 'Hive Tyrant', warlord: warlord === 'tyrant', options: ['2x Monstrous Scything Talon', 'Lash Whip and Monstrous Bonesword'] },
      { name: 'Termagants' },
      { name: 'Termagants' },
      { name: 'Termagants' },
    ],
  });

  test('a Tyranids list with a Hive Tyrant need not make it the Warlord', () => {
    expect(rules(issuesOf('tyranids', [], [swarm('prime')]))).toEqual([]);
  });

  test('a Hive Tyrant Warlord is still fine', () => {
    expect(rules(issuesOf('tyranids', [], [swarm('tyrant')]))).toEqual([]);
  });
});

describe("[AoO GT: Disciples of Be'lakor] two allies", () => {
  const daemons = (army?: DetachmentSpec['army']): DetachmentSpec => ({
    detachment: AOO,
    ...(army ? { army } : {}),
    units: [{ name: "Be'lakor", warlord: true }, { name: 'Bloodletters' }, { name: 'Bloodletters' }, { name: 'Bloodletters' }],
  });
  const csmPatrol: DetachmentSpec = { detachment: PATROL, catalogue: 'Chaos - Chaos Space Marines', army: { Legion: 'Black Legion' }, units: [{ name: 'Chaos Lord' }, { name: 'Legionaries' }] };
  const korvax = (household: string): DetachmentSpec => ({ detachment: SHA, catalogue: 'Chaos - Chaos Knights', units: [{ name: 'War Dog Karnivore Squadron', options: [household] }] });
  const scopes = ['chaos-chaos-space-marines', 'chaos-chaos-knights'];
  const DOB = { "Army of Renown - Disciples of Be'lakor": [] };

  test("two allies allowed: a Traitoris Astartes Patrol and a House Korvax Knight", () => {
    const issues = issuesOf('chaos-daemons', scopes, [daemons(DOB), csmPatrol, korvax('House Korvax')]);
    expect(rules(issues).filter((r) => r.startsWith('detachment'))).toEqual([]);
  });

  test("a Disciples of Be'lakor Knight must be House Korvax", () => {
    const issues = issuesOf('chaos-daemons', scopes, [daemons(DOB), csmPatrol, korvax('House Vextrix')]);
    expect(rules(issues)).toContain('detachment-faction');
  });

  test("a non-Disciples Daemons army with two allies is still flagged", () => {
    const issues = issuesOf('chaos-daemons', scopes, [daemons(), csmPatrol, korvax('Infernal Dreadblade')]);
    expect(rules(issues).some((r) => r === 'detachment-count' || r === 'detachment-not-allowed')).toBe(true);
  });
});

describe('[AoO GT: Battle Brothers] Genestealer Cults ally Brood Brothers', () => {
  const cult: DetachmentSpec = {
    detachment: AOO,
    army: { 'Cult Creed': 'The Bladed Cog' },
    units: [{ name: 'Primus', warlord: true }, ...[1, 2, 3].map(() => ({ name: 'Neophyte Hybrids', options: ['Neophyte Leader > Chainsword'] }))],
  };
  const guard = (army?: DetachmentSpec['army']): DetachmentSpec => ({
    detachment: PATROL,
    catalogue: 'Imperium - Astra Militarum',
    ...(army ? { army } : {}),
    units: [{ name: 'Platoon Command Squad' }, { name: 'Infantry Squad' }],
  });

  test('an Astra Militarum ally with the Brood Brothers doctrine is allowed', () => {
    const issues = issuesOf('tyranids-genestealer-cults', ['imperium-astra-militarum'], [cult, guard({ 'Regimental Doctrine': 'Brood Brothers' })]);
    expect(rules(issues).filter((r) => r.startsWith('detachment') || r === 'army-faction')).toEqual([]);
  });

  test('an Astra Militarum ally that is not Brood Brothers is flagged, with the reason in plain words', () => {
    const scope = realScope('tyranids-genestealer-cults', 'imperium-astra-militarum');
    const spec: ListSpec = { title: 'gap', battleSize: 'strike-force', detachments: [cult, guard({ 'Regimental Doctrine': 'Born Soldiers' })], expect: { points: 0, powerLevel: 0 } };
    const r = buildFromSpec(scope, realCatalogueId('tyranids-genestealer-cults'), spec);
    const issue = validate(scope, r, policy).issues.find((i) => i.rule === 'detachment-faction')!;
    expect(issue).toBeDefined();
    expect(explain(issue, evaluate(scope, r), scope).text).toBe("A Genestealer Cults army's Astra Militarum ally must be Brood Brothers. Choose Brood Brothers as the detachment's Regimental Doctrine.");
  });
});

describe('[AoO GT: Battle Brothers] Drukhari ally of a different type', () => {
  const kabal: DetachmentSpec = {
    detachment: AOO,
    army: { Obsession: 'Kabal of the Black Heart: Thirst for Power' },
    units: [{ name: 'Archon', warlord: true }, { name: 'Kabalite Warriors' }, { name: 'Kabalite Warriors' }, { name: 'Kabalite Warriors' }],
  };
  const ally = (obsession: string, units: DetachmentSpec['units']): DetachmentSpec => ({ detachment: PATROL, army: { Obsession: obsession }, units });

  test('a Wych Cult Patrol beside a Kabal is allowed', () => {
    const wyches = ally('Cult of Strife: The Spectacle of Murder', [{ name: 'Succubus', options: ['2 - Grave Lotus (Combat Drug)'] }, { name: 'Wyches', options: ['2 - Grave Lotus (Combat Drug)'] }]);
    expect(rules(issuesOf('aeldari-drukhari', [], [kabal, wyches])).filter((r) => r.startsWith('detachment'))).toEqual([]);
  });

  test('a second Kabal as the ally is flagged', () => {
    const kabal2 = ally("Kabal of the Poisoned Tongue: The Serpent's Kiss", [{ name: 'Archon' }, { name: 'Kabalite Warriors' }]);
    expect(rules(issuesOf('aeldari-drukhari', [], [kabal, kabal2]))).toContain('detachment-faction');
  });
});

describe("[AoO GT: Battle Brothers] Emperor's Children take Slaanesh Daemons", () => {
  const legion = (name: string): DetachmentSpec => ({
    detachment: AOO,
    army: { Legion: name },
    units: [{ name: 'Chaos Lord', warlord: true }, { name: 'Legionaries' }, { name: 'Legionaries' }, { name: 'Legionaries' }],
  });
  const daemonPatrol = (herald: string, troops: string): DetachmentSpec => ({ detachment: PATROL, catalogue: 'Chaos - Daemons', units: [{ name: herald }, { name: troops }] });

  test("an Emperor's Children army with a Slaanesh Daemons Patrol is allowed", () => {
    const issues = issuesOf('chaos-chaos-space-marines', ['chaos-daemons'], [legion("Emperor's Children"), daemonPatrol('Infernal Enrapturess', 'Daemonettes')]);
    expect(rules(issues).filter((r) => r.startsWith('detachment'))).toEqual([]);
  });

  test("an Emperor's Children army with a Khorne Daemons Patrol is flagged", () => {
    const issues = issuesOf('chaos-chaos-space-marines', ['chaos-daemons'], [legion("Emperor's Children"), daemonPatrol('Bloodmaster', 'Bloodletters')]);
    expect(rules(issues)).toContain('detachment-faction');
  });

  test('a Black Legion army may still take any Daemons Patrol', () => {
    const issues = issuesOf('chaos-chaos-space-marines', ['chaos-daemons'], [legion('Black Legion'), daemonPatrol('Bloodmaster', 'Bloodletters')]);
    expect(rules(issues).filter((r) => r.startsWith('detachment'))).toEqual([]);
  });
});

describe('aoo-allies.json restrictions are checked at build', () => {
  const files = () => realFiles(...realCatalogues().map((c) => c.slug));
  const withAllies = (edit: (a: AooAllies[]) => void) => {
    const dir = mkdtempSync(join(tmpdir(), 'recruit-overrides-'));
    cpSync(join(import.meta.dirname, '..', 'overrides'), dir, { recursive: true });
    const allies: AooAllies[] = JSON.parse(readFileSync(join(dir, 'aoo-allies.json'), 'utf8'));
    edit(allies);
    writeFileSync(join(dir, 'aoo-allies.json'), JSON.stringify(allies));
    return () => loadPolicy(dir, files());
  };
  const named = (all: AooAllies[], name: string) => all.find((a) => a.catalogueName === name)!;

  test('an unknown keyword, faction or Army of Renown entry fails the build', () => {
    expect(withAllies((a) => { named(a, 'Tyranids - Genestealer Cults').allies[0].onlyKeywords = ['No Such Keyword']; })).toThrow('names unknown category "No Such Keyword"');
    expect(withAllies((a) => { named(a, 'Chaos - Chaos Space Marines').allies[1].onlyFactionsIf = [{ armyFaction: 'Faction: Nobody', onlyFactions: ['Faction: Slaanesh'] }]; })).toThrow('names unknown category "Faction: Nobody"');
    expect(withAllies((a) => { named(a, 'Chaos - Daemons').armiesOfRenown![0].entryName = 'Army of Renown - Nobody'; })).toThrow('names unknown Army of Renown entry "Army of Renown - Nobody"');
    expect(withAllies((a) => { named(a, 'Chaos - Daemons').armiesOfRenown![0].allies[1].onlyFactions = ['Faction: Nobody']; })).toThrow('names unknown category "Faction: Nobody"');
  });
});

describe("[AoO GT: Disciples of Be'lakor] the builder offers the second ally", () => {
  test('after the Traitoris Astartes Patrol, only the Chaos Knights ally is offered; then nothing', () => {
    const scope = realScope('chaos-daemons', 'chaos-chaos-space-marines', 'chaos-chaos-knights');
    const spec = (detachments: DetachmentSpec[]): ListSpec => ({ title: 'dob', battleSize: 'strike-force', detachments, expect: { points: 0, powerLevel: 0 } });
    const arks: DetachmentSpec = { detachment: AOO, army: { "Army of Renown - Disciples of Be'lakor": [] }, units: [{ name: "Be'lakor", warlord: true }] };
    const patrol: DetachmentSpec = { detachment: PATROL, catalogue: 'Chaos - Chaos Space Marines', units: [] };
    const knight: DetachmentSpec = { detachment: SHA, catalogue: 'Chaos - Chaos Knights', units: [] };
    const offered = (d: DetachmentSpec[]) =>
      detachmentChoices(scope, buildFromSpec(scope, realCatalogueId('chaos-daemons'), spec(d)), policy, realCatalogues()).map((c) => `${c.name} (${scope.catalogue(c.catalogueId)?.name})`);
    expect(offered([arks])).toEqual(expect.arrayContaining(['Patrol Detachment -2CP (Chaos - Chaos Space Marines)', 'Super-Heavy Auxiliary Detachment -3CP (Chaos - Chaos Knights)']));
    expect(offered([arks, patrol])).toEqual(['Super-Heavy Auxiliary Detachment -3CP (Chaos - Chaos Knights)']);
    expect(offered([arks, patrol, knight])).toEqual([]);
  });
});
