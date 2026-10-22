/**
 * Final-rules check: every change the 2023 dataslates (5 Jan 2023 Arks of Omen, 13 Apr 2023 final) made, or that an
 * earlier balance update made and was still in force at the end, to a stratagem's CP or effect, a datasheet ability or
 * an army rule that we show. The checks come from the research library
 * (05_Balance_Errata_and_Points/Balance_Dataslates.md) and are never edited to match the data: a gap gets an amendment
 * (overrides/amendments.json) instead.
 *
 * Reads the generated catalogues (`npm run data:build`), so a value is read after amendments:
 * - `contains`: each fragment is in the text or in the amendment note;
 * - `absent`: each fragment is missing from the text, unless the item carries an amendment (the note then tells the
 *   reader the printed text is out of date);
 * - `cp`: the stratagem's CP after amendments.
 * Matching ignores case and treats curly quotes and straight quotes alike.
 */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyAmendments, checkSelectorMatches, validateAmendments, type Amendment } from '../src/build';
import type { CatalogueOut, DataIndex, UnitOut } from '../src/model/types';

interface FinalRuleCheck {
  catalogue: string;
  kind: 'ability' | 'rule' | 'stratagem';
  name: string;
  cp?: string;
  contains?: string[];
  absent?: string[];
  source: string;
}

const GENERATED = join(__dirname, '..', 'generated');
const index: DataIndex = JSON.parse(readFileSync(join(GENERATED, 'index.json'), 'utf8'));
const cache = new Map<string, CatalogueOut>();
function catalogue(name: string): CatalogueOut {
  if (!cache.has(name)) {
    const summary = index.catalogues.find((c) => c.name === name);
    if (!summary) throw new Error(`no catalogue "${name}" in generated/index.json`);
    cache.set(name, JSON.parse(readFileSync(join(GENERATED, 'catalogues', `${summary.slug}.json`), 'utf8')));
  }
  return cache.get(name)!;
}

const norm = (s: string) => s.replace(/[″“”]/g, '"').replace(/[’‘]/g, "'").toLowerCase();

const LIB = '05_Balance_Errata_and_Points/Balance_Dataslates.md';
const ARKS = `${LIB} §8 (Arks of Omen dataslate, 5 Jan 2023)`;
const FINAL = `${LIB} §9 (final dataslate, 13 Apr 2023)`;

const SM = 'Imperium - Space Marines';
const DA = 'Imperium - Adeptus Astartes - Dark Angels';
const DW = 'Imperium - Adeptus Astartes - Deathwatch';
const SW = 'Imperium - Adeptus Astartes - Space Wolves';
const CHAPTERS = [
  'Imperium - Adeptus Astartes - Black Templars',
  'Imperium - Adeptus Astartes - Blood Angels',
  DA,
  DW,
  'Imperium - Adeptus Astartes - Imperial Fists',
  'Imperium - Adeptus Astartes - Iron Hands',
  'Imperium - Adeptus Astartes - Raven Guard',
  'Imperium - Adeptus Astartes - Salamanders',
  SW,
  'Imperium - Adeptus Astartes - Ultramarines',
  'Imperium - Adeptus Astartes - White Scars',
];
const CUSTODES = 'Imperium - Adeptus Custodes';
const ADMECH = 'Imperium - Adeptus Mechanicus';
const HARLEQUINS = 'Aeldari - Harlequins';
const CRAFTWORLDS = 'Aeldari - Craftworlds';
const TYRANIDS = 'Tyranids';
const AM = 'Imperium - Astra Militarum';

const ONCE = ['once per battle', 'only use this stratagem once'];

const each = (catalogues: string[], check: Omit<FinalRuleCheck, 'catalogue'>): FinalRuleCheck[] => catalogues.map((c) => ({ catalogue: c, ...check }));

const CHECKS: FinalRuleCheck[] = [
  // --- 5 Jan 2023: Arks of Omen dataslate ---
  // Not Imperium - Space Marines: its Combat Doctrines row is only a page pointer, excluded in overrides/rule-exclusions.json.
  ...each([DA, DW], {
    kind: 'rule',
    name: 'Combat Doctrines',
    contains: ['remain active'],
    source: `${ARKS}: Space Marines: you may stay in the Devastator or Tactical Doctrine instead of being forced forward`,
  }),
  ...each([SM, SW], {
    kind: 'rule',
    name: 'Objective Secured',
    contains: ['under your control'],
    source: `${ARKS}: Space Marines: objectives taken by Troops stay controlled until the enemy retakes them`,
  }),
  {
    catalogue: SW,
    kind: 'ability',
    name: 'Objective Secured',
    contains: ['under your control'],
    source: `${ARKS}: Space Marines: objectives taken by Troops stay controlled until the enemy retakes them`,
  },
  {
    catalogue: CUSTODES,
    kind: 'rule',
    name: 'Adeptus Custodes',
    contains: ['CORE INFANTRY', 'Objective Secured', 'both CORE and INFANTRY'],
    absent: ['ADEPTUS CUSTODES INFANTRY and'],
    source: `${ARKS}: Adeptus Custodes: Objective Secured extended to all CORE INFANTRY`,
  },
  ...['Esteemed Amalgam', 'The Emperor’s Auspice', 'Martial Discretion'].map(
    (name): FinalRuleCheck => ({
      catalogue: CUSTODES,
      kind: 'stratagem',
      name,
      absent: ONCE,
      source: `${ARKS}: Adeptus Custodes: once-per-game limits on Esteemed Amalgam, Emperor's Auspice and Martial Discretion removed`,
    }),
  ),
  {
    catalogue: ADMECH,
    kind: 'ability',
    name: 'Bionics',
    contains: ['5+ invulnerable'],
    absent: ['6+ invulnerable'],
    source: `${ARKS}: Adeptus Mechanicus: Bionics now give a 5+ invulnerable save`,
  },
  ...[
    ["Harlequin's Panoply", '5+', '4+'],
    ['Holo-Suit', '5+', '4+'],
    ['Holo-fields', '5+', '4+'],
    ['Impossible Form', '4+', '3+'],
  ].map(
    ([name, now, was]): FinalRuleCheck => ({
      catalogue: HARLEQUINS,
      kind: 'ability',
      name,
      contains: [`${now} invulnerable`],
      absent: [`${was} invulnerable`],
      source: `${ARKS}: Harlequins: all invulnerable saves worsened by 1 (most units 5+, Solitaires 4+)`,
    }),
  ),
  ...each([HARLEQUINS, CRAFTWORLDS], {
    kind: 'stratagem',
    name: 'Prismatic Blur',
    contains: ['4+ invulnerable'],
    absent: ['3+ invulnerable'],
    source: `${ARKS}: Harlequins: all invulnerable saves worsened by 1 (Prismatic Blur on 4+)`,
  }),
  {
    catalogue: HARLEQUINS,
    kind: 'ability',
    name: 'Mirror Architect (Aura)',
    contains: ['6"'],
    absent: ['9"'],
    source: `${ARKS}: Harlequins: the original Mirror Architect (a 6" aura) returns, replacing the 14 Apr 2022 single unit within 9" (§5)`,
  },
  ...each([CRAFTWORLDS, HARLEQUINS], {
    kind: 'stratagem',
    name: 'Fire and Fade',
    absent: ONCE,
    source: `${LIB} §10 (once-per-battle stratagem limits): the Fire and Fade limit of 23 Jun 2022 (§6) was removed in Jan 2023`,
  }),
  {
    catalogue: TYRANIDS,
    kind: 'stratagem',
    name: 'Overrun',
    contains: ['CORE'],
    source: `${ARKS}: Tyranids: Overrun only for CORE units`,
  },
  ...['Seed Spore Mines', 'Spore Mine Cysts', 'Seed Spores'].map(
    (name): FinalRuleCheck => ({
      catalogue: TYRANIDS,
      kind: 'ability',
      name,
      contains: ['Reinforcement Points'],
      source: `${ARKS}: Tyranids: Biovores, Harpies and Sporocysts must spend Reinforcement Points to create Spore Mines/Mucolid Spores`,
    }),
  ),

  // --- 13 Apr 2023: final dataslate ---
  ...['Arcane Genetic Alchemy', 'The Emperor’s Auspice'].map(
    (name): FinalRuleCheck => ({
      catalogue: CUSTODES,
      kind: 'stratagem',
      name,
      contains: ['same unit', 'same phase'],
      source: `${FINAL}: Adeptus Custodes: Arcane Genetic Alchemy and Emperor's Auspice can't both be used on the same unit in the same phase`,
    }),
  ),
  // Not Adeptus Astra Telepathica: its per-id allow-list drops this stratagem, which needs KASRKIN or MILITARUM
  // TEMPESTUS units it doesn't have (overrides/stratagem-factions.json).
  {
    catalogue: AM,
    kind: 'stratagem',
    name: 'Overcharged Las-cells',
    contains: ['6 mortal wounds', 'per phase'],
    source: `${FINAL}: Astra Militarum: Overcharged Las-cells capped at 6 mortal wounds per phase for the firing unit`,
  },
  ...each([DA, SM], {
    kind: 'rule',
    name: 'Inner Circle',
    absent: ['Transhuman', 'DEATHWING'],
    source: `${FINAL}: Dark Angels: fourth bullet of Inner Circle deleted (no permanent Transhuman Physiology)`,
  }),
  ...each(CHAPTERS, {
    kind: 'ability',
    name: 'Inner Circle',
    absent: ['Transhuman', 'DEATHWING'],
    source: `${FINAL}: Dark Angels: fourth bullet of Inner Circle deleted (no permanent Transhuman Physiology)`,
  }),
  {
    catalogue: DW,
    kind: 'rule',
    name: 'Mission Tactics',
    contains: ['any of the three'],
    absent: ['more than once', 'more than twice', 'more than three times'],
    source: `${FINAL}: Deathwatch: Mission Tactics: freely choose any doctrine each battle round`,
  },

  // --- earlier changes still in force at the end ---
  {
    catalogue: TYRANIDS,
    kind: 'ability',
    name: 'Guardian Organism',
    contains: ['HIVE TYRANT', 'Look Out, Sir', 'greater than 9'],
    source: `${LIB} §5 (14/20 Apr 2022) and §10 (bodyguard rules work like Look Out, Sir; never removed): Guardian Organism carved out by the HIVE TYRANT keyword`,
  },
  {
    catalogue: ADMECH,
    kind: 'stratagem',
    name: 'Acquisition at Any Cost',
    absent: ONCE,
    source: `${LIB} §2 (Jul 2021 FAQ: once per game) and §6 (23 Jun 2022: loses usage restrictions); §7 (20 Oct 2022) deleted the AdMech section`,
  },
  {
    catalogue: ADMECH,
    kind: 'stratagem',
    name: 'Enriched Rounds',
    absent: ['5+', '11+', '11 or more'],
    source: `${LIB} §2 (Jul 2021 FAQ: 5+ trigger, 2CP for 11+ models), §6 (23 Jun 2022: CP reverted) and §7 (20 Oct 2022: AdMech section deleted, full Enriched Rounds restored)`,
  },
  {
    catalogue: ADMECH,
    kind: 'stratagem',
    name: 'Galvanic Volley Fire',
    contains: ['Rapid Fire 2'],
    absent: ['Heavy 3'],
    source: `${LIB} §2 (Jul 2021 FAQ: Heavy 3) and §6 (23 Jun 2022: reverted to Rapid Fire 2)`,
  },
];

/** The items a check reads: every unit ability with that name, or the named rules or stratagems. */
function targets(c: FinalRuleCheck): { text: string; amended?: string; cp?: string }[] {
  const cat = catalogue(c.catalogue);
  if (c.kind === 'ability') return cat.units.flatMap((u) => u.abilities.filter((a) => a.name === c.name));
  if (c.kind === 'rule') return cat.rules.filter((r) => r.name === c.name);
  return cat.stratagems.filter((s) => s.name === c.name);
}

describe('final rules: abilities, army rules and stratagems', () => {
  for (const c of CHECKS) {
    test(`${c.catalogue}: ${c.kind} "${c.name}"`, () => {
      const found = targets(c);
      expect(found.length, `no ${c.kind} "${c.name}" in ${c.catalogue}`).toBeGreaterThan(0);
      for (const t of found) {
        const shown = norm(`${t.text}\n${t.amended ?? ''}`);
        if (c.cp !== undefined) expect(t.cp, `cp (${c.source})`).toBe(c.cp);
        for (const f of c.contains ?? []) expect(shown, `should contain "${f}" (${c.source})`).toContain(norm(f));
        if (t.amended) continue;
        for (const f of c.absent ?? []) expect(norm(t.text), `should not contain "${f}" (${c.source})`).not.toContain(norm(f));
      }
    });
  }

  // Changes the library doesn't establish as still in force at the end: each dataslate replaced the last in full, and
  // §8/§9 neither reprint nor remove these. Asserting them could teach a reverted rule, so they stay todo.
  const notEstablished = 'library §8/§9 do not say whether this survived the Jan 2023 dataslate';
  test.todo(`Imperium - Adepta Sororitas: ability "Acts of Faith": a Miracle Die each turn (§5, 14 Apr 2022): ${notEstablished}`);
  test.todo(`${CUSTODES}: Arcane Genetic Alchemy / The Emperor's Auspice limited to INFANTRY (§5, 14 Apr 2022): ${notEstablished}`);
  test.todo(`Chaos - Death Guard: Blightlord and Deathshroud Terminators gain Objective Secured (§5, 14 Apr 2022): ${notEstablished}`);
  test.todo(`${HARLEQUINS}: ability "Luck of the Laughing God": start each round with 0 re-rolls (§6, 23 Jun 2022): ${notEstablished}`);
  test.todo(`T'au Empire: Mont'ka loses its AP bonus (§5, 14 Apr 2022): ${notEstablished}`);
  test.todo(`T'au Empire: a Farsight Enclaves allied world gives automatic markerlights only within 9" (§5, 14 Apr 2022): ${notEstablished}`);
  test.todo(`T'au Empire: charge-reduction abilities no longer stack (§5, 14 Apr 2022): ${notEstablished}`);
  test.todo(`${CRAFTWORLDS}, ${HARLEQUINS}: stratagem "Matchless Agility" re-rolls the Battle Focus roll (§6, 23 Jun 2022); the data shows that version, with its first sentence duplicated: ${notEstablished}`);
  test.todo(`${CRAFTWORLDS}: stratagem "Eldritch Storm" needs line of sight, 4+ vs non-characters (§6, 23 Jun 2022): ${notEstablished}`);
  test.todo(`Necrons: rule "Command Protocols": CHARACTER as NOBLE, one protocol active all game (§6, 23 Jun 2022): ${notEstablished}`);
  test.todo(`Orks: rule "Waaagh!": 5+ then 6+ invulnerable save (§6, 23 Jun 2022): ${notEstablished}`);
  test.todo(`${TYRANIDS}: ability "The Reaper of Obilterax" capped at 3 mortal wounds (§7, 20 Oct 2022): ${notEstablished}`);
  test.todo(`Necrons: CORE on Flayed Ones, Canoptek Reanimator, Triarch Praetorians, Ophydian/Lokhust/Skorpekh Destroyers, Canoptek Wraiths and Acanthrites (§3, 9 Nov 2021): ${notEstablished}`);
  // Marked unverified in the library.
  test.todo(`4 Feb 2022 dataslate: anything beyond the Drukhari items: the library marks its contents "(partially unverified)" (§11)`);
});

/**
 * Keyword and weapon-profile changes. These sit outside the Amendment kinds (ability, rule, stratagem), so a gap here
 * can't be amended: it is written as a known-gap todo and raised for a decision.
 */
describe('final rules: keywords and profiles', () => {
  const unit = (cat: string, name: string): UnitOut => {
    const u = catalogue(cat).units.find((x) => x.name === name);
    if (!u) throw new Error(`no unit "${name}" in ${cat}`);
    return u;
  };
  const has = (u: UnitOut, keyword: string) => u.keywords.some((k) => k.toUpperCase() === keyword.toUpperCase());
  const hasCore = (u: UnitOut) => has(u, 'CORE');
  const core: [string, string, string][] = [
    [ADMECH, 'Kataphron Breachers', `${ARKS}: Kataphron Breachers and Destroyers gain CORE`],
    [ADMECH, 'Kataphron Destroyers', `${ARKS}: Kataphron Breachers and Destroyers gain CORE`],
    [ADMECH, 'Ironstrider Ballistarii', `${LIB} §6 (23 Jun 2022): Ironstriders and Dragoons regain CORE`],
    [ADMECH, 'Sydonian Dragoons', `${LIB} §6 (23 Jun 2022): Ironstriders and Dragoons regain CORE`],
    ['Aeldari - Drukhari', 'Talos', `${FINAL}: Talos/Cronos CORE removal deleted`],
    ['Aeldari - Drukhari', 'Cronos', `${FINAL}: Talos/Cronos CORE removal deleted`],
    ["T'au Empire", 'Broadside Battlesuits', `${FINAL}: Broadside CORE removal deleted`],
  ];
  for (const [cat, name, source] of core) {
    test(`${cat}: ${name} has CORE`, () => expect(hasCore(unit(cat, name)), source).toBe(true));
  }

  const necronVehicles = () => catalogue('Necrons').units.filter((u) => has(u, 'VEHICLE'));
  test('Necrons: every non-CHARACTER VEHICLE has CORE', () => {
    const missing = necronVehicles().filter((u) => !has(u, 'CHARACTER') && !hasCore(u)).map((u) => u.name);
    expect(missing, `${LIB} §6 (23 Jun 2022) CORE on all Necron VEHICLEs, carried over in §8`).toEqual([]);
  });
  test('Necrons: no CHARACTER VEHICLE has CORE', () => {
    const wrong = necronVehicles().filter((u) => has(u, 'CHARACTER') && hasCore(u)).map((u) => u.name);
    expect(wrong, `${LIB} §7 (20 Oct 2022) CHARACTER vehicles lose CORE, carried over in §8`).toEqual([]);
  });
  test('Necrons: Catacomb Command Barge lacks CORE (BSData gives it CORE; amended)', () => {
    const barge = unit('Necrons', 'Catacomb Command Barge');
    const source = `${LIB} §7 (20 Oct 2022) CHARACTER vehicles such as the Catacomb Command Barge lose CORE, carried over in §8`;
    expect(has(barge, 'VEHICLE') && has(barge, 'CHARACTER'), source).toBe(true);
    expect(hasCore(barge), source).toBe(false);
    expect(barge.amended, source).toMatch(/CORE/);
  });
  test.todo('KNOWN GAP: Necrons: The Silent King has an empty keyword list in our output, so "lacks CORE" (§7, 20 Oct 2022) cannot be checked');
  test.todo('KNOWN GAP: Exaction Squad (and e.g. Thunderfire Cannon, War Dog squadrons, Celestine and Geminae Superia) have empty keyword lists in our output');

  test('Chaos - Daemons: Flamers roll to hit with BS 3+', () => {
    const flamers = unit('Chaos - Daemons', 'Flamers');
    const source = `${ARKS}: Flamers of Tzeentch must roll to hit (BS3+) instead of auto-hitting`;
    for (const m of flamers.models) expect(m.chars.BS, source).toBe('3+');
    const flames = flamers.weapons.find((w) => w.name === 'Flickering flames');
    expect(flames, source).toBeDefined();
    expect(norm(flames!.chars.Abilities ?? ''), source).not.toContain('automatically hit');
  });
});

describe('final rules: AIRCRAFT bombing abilities', () => {
  const amendments: { catalogueName: string; unitKeyword?: string; note: string }[] = JSON.parse(
    readFileSync(join(__dirname, '..', 'overrides', 'amendments.json'), 'utf8'),
  );
  const bombing = amendments.find((a) => a.catalogueName === '*' && a.unitKeyword === 'AIRCRAFT');
  const source = `${ARKS} (universal rules): "moves over" bombing abilities only trigger if the aircraft stays on the battlefield after its move`;

  test('one selector amendment covers them', () => expect(bombing, source).toBeDefined());

  test('it notes exactly the bombing abilities of AIRCRAFT units', () => {
    const names = new Set<string>();
    for (const summary of index.catalogues) {
      for (const u of catalogue(summary.name).units) for (const a of u.abilities) if (a.amended?.includes(bombing!.note)) names.add(a.name);
    }
    expect([...names].sort(), source).toEqual(
      [
        'Big Bomb',
        'Bigbomm',
        'Blackstar Cluster Launcher',
        'Bomb Rack',
        'Boom Bomb',
        'Burna Bomb',
        'Burna bombs',
        'Death Sphere Bombardment',
        'Heavy Bombs',
        'Heavy bomb',
        'Infernal bomb',
        'Inferno Bombs',
        'Inferno bomb',
        'Infernus Firebomb',
        'Infernus firebombs',
        'Pulse Bombs',
        'Small Bomms',
        'Spore Mine Cysts',
        'Stasis bomb',
        'Thunderhawk Cluster Bombs',
        'Thunderhawk cluster bombs',
        'Void mine',
      ].sort(),
    );
  });

  test("the Harpy's Spore Mine Cysts carries both its notes, in file order", () => {
    const own = amendments.find((a) => a.catalogueName === TYRANIDS && (a as { name?: string }).name === 'Spore Mine Cysts')!;
    const harpy = catalogue(TYRANIDS).units.find((u) => u.name === 'Harpy')!;
    expect(harpy.abilities.find((a) => a.name === 'Spore Mine Cysts')!.amended).toBe(`${own.note} ${bombing!.note}`);
  });
});

describe('applyAmendments', () => {
  const fixture = (): CatalogueOut => {
    const ability = (name: string, text: string) => ({ name, text, source: 'bsdata' as const });
    const u = (id: string, keywords: string[], abilities: ReturnType<typeof ability>[]) => ({ id, name: id, keywords, abilities }) as unknown as UnitOut;
    return {
      id: 'c1',
      slug: 'test',
      name: 'Test Faction',
      group: 'Xenos',
      library: false,
      units: [
        u('a', ['Infantry', 'Core'], [ability('Shield', '4+'), ability('Other', 'x')]),
        u('b', ['Infantry'], [ability('Shield', '4+')]),
        u('jet', ['Aircraft', 'Vehicle'], [ability('Bombs', 'Pick one unit this model moved across.'), ability('Supersonic', 'Pivot, then move.')]),
        u('walker', ['Vehicle'], [ability('Stomp', 'Pick one unit this model moved across.')]),
      ],
      rules: [{ id: 'r1', name: 'Army Rule', text: 'old' }],
      stratagems: [{ id: 's1', name: 'Big Gun', cp: '1', group: 'Test', kind: 'Battle Tactic', phases: [], text: 'boom' }],
    };
  };
  const amend = (a: Record<string, unknown>): Amendment => ({ catalogueName: 'Test Faction', kind: 'ability', name: 'Shield', note: 'Now 5+.', source: 'test', ...a }) as Amendment;
  const selector = (a: Record<string, unknown> = {}) => amend({ name: undefined, unitKeyword: 'AIRCRAFT', textPattern: 'moved across', note: 'Must stay on.', ...a });

  test('notes every unit ability with that name, the named rule, and a stratagem (replacing its cp)', () => {
    const out = fixture();
    applyAmendments(out, [amend({}), amend({ kind: 'rule', name: 'Army Rule', note: 'Changed.' }), amend({ kind: 'stratagem', name: 'Big Gun', cp: '2', note: 'Costs more.' })]);
    expect(out.units.flatMap((u) => u.abilities.filter((a) => a.name === 'Shield').map((a) => a.amended))).toEqual(['Now 5+.', 'Now 5+.']);
    expect(out.units[0].abilities[1].amended).toBeUndefined();
    expect(out.rules[0]).toMatchObject({ text: 'old', amended: 'Changed.' });
    expect(out.stratagems[0]).toMatchObject({ cp: '2', text: 'boom', amended: 'Costs more.' });
  });

  test('several amendments on one item join their notes with a space, in order', () => {
    const out = fixture();
    applyAmendments(out, [amend({ kind: 'rule', name: 'Army Rule', note: 'First.' }), amend({ kind: 'rule', name: 'Army Rule', note: 'Second.' })]);
    expect(out.rules[0].amended).toBe('First. Second.');
  });

  test('the same note reaching one item twice (a unit matching two keyword selectors) is added once', () => {
    const out = fixture();
    applyAmendments(out, [selector({ unitKeyword: 'AIRCRAFT' }), selector({ unitKeyword: 'VEHICLE' })]);
    expect(out.units[2].abilities[0].amended).toBe('Must stay on.');
    expect(out.units[3].abilities[0].amended).toBe('Must stay on.');
  });

  test('an amendment that matches nothing throws', () => {
    expect(() => applyAmendments(fixture(), [amend({ name: 'Nope' })])).toThrow(/matches nothing/);
    expect(() => applyAmendments(fixture(), [amend({ kind: 'rule', name: 'Shield' })])).toThrow(/matches nothing/);
    expect(() => applyAmendments(fixture(), [amend({ kind: 'stratagem', name: 'Army Rule' })])).toThrow(/matches nothing/);
    expect(() => applyAmendments(fixture(), [amend({ kind: 'unit-keywords', name: 'nobody', remove: ['Core'] })])).toThrow(/matches nothing/);
    expect(() => applyAmendments(fixture(), [selector({ textPattern: 'flew over' })])).toThrow(/matches nothing/);
  });

  test('a unit-keywords amendment removes keywords (any case) and notes the unit; a missing keyword throws', () => {
    const out = fixture();
    applyAmendments(out, [amend({ kind: 'unit-keywords', name: 'a', remove: ['CORE'], note: 'Not CORE.' })]);
    expect(out.units[0]).toMatchObject({ keywords: ['Infantry'], amended: 'Not CORE.' });
    expect(() => applyAmendments(fixture(), [amend({ kind: 'unit-keywords', name: 'b', remove: ['Core'] })])).toThrow(/has no keyword "Core"/);
  });

  test('an ability selector notes abilities matching the text on units with the keyword only', () => {
    const out = fixture();
    const counts = applyAmendments(out, [selector()]);
    const noted = out.units.flatMap((u) => u.abilities.filter((a) => a.amended).map((a) => `${u.name}/${a.name}`));
    expect(noted).toEqual(['jet/Bombs']);
    expect([...counts.values()]).toEqual([1]);
  });

  test("a '*' selector may miss one catalogue but must match somewhere", () => {
    const everywhere = selector({ catalogueName: '*', textPattern: 'flew over' });
    const counts = applyAmendments(fixture(), [everywhere]);
    expect(counts.get(everywhere)).toBe(0);
    expect(() => checkSelectorMatches([everywhere], counts)).toThrow(/matches nothing in any catalogue/);
    const hit = selector({ catalogueName: '*' });
    expect(() => checkSelectorMatches([hit], applyAmendments(fixture(), [hit]))).not.toThrow();
  });

  test('validateAmendments rejects bad catalogues, kinds, selectors, keyword removals, cp, note and source', () => {
    const names = new Set(['Test Faction']);
    const ok = (a: Amendment) => expect(() => validateAmendments([a], names)).not.toThrow();
    const bad = (a: Amendment, why: RegExp) => expect(() => validateAmendments([a], names)).toThrow(why);
    ok(amend({}));
    expect(() => validateAmendments([amend({}), amend({ note: 'Again.' })], names)).not.toThrow();
    ok(selector({ catalogueName: '*' }));
    ok(amend({ kind: 'unit-keywords', name: 'a', remove: ['Core'], note: undefined }));
    bad(amend({ catalogueName: 'Nowhere' }), /unknown catalogue "Nowhere"/);
    bad(amend({ catalogueName: '*' }), /only an ability selector may use \*/);
    bad(amend({ kind: 'keyword' }), /kind/);
    bad(amend({ cp: '2' }), /cp/);
    bad(amend({ note: ' ' }), /note/);
    bad(amend({ source: '' }), /source/);
    bad(selector({ textPattern: undefined }), /unitKeyword and textPattern/);
    bad(selector({ textPattern: '(' }), /invalid textPattern/);
    bad(selector({ name: 'Shield' }), /both a name and a selector/);
    bad(amend({ kind: 'rule', name: 'Army Rule', unitKeyword: 'AIRCRAFT', textPattern: 'x' }), /only ability amendments can select/);
    bad(amend({ kind: 'unit-keywords', name: 'a', remove: [] }), /removes no keywords/);
  });
});
