import { test, expect, describe, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadGameData } from '../src/bsdata/gamedata';
import type { RawCatalogue, RawNode } from '../src/bsdata/types';
import { buildAll } from '../src/build';
import type { DataIndex } from '../src/model/types';
import { emitRosterFile, type AddedConstraint, type ConstraintOverride, type CostOverride, type FactionKeywordOverride, type ModifierRemoval } from '../src/roster/emit';
import { COST_CP, COST_PL, COST_PTS, type Cond, type CondGroup, type Constraint, type Mod, type RNode, type RosterFile } from '../src/roster/types';

const ROOT = join(__dirname, '..');
const FIX = join(__dirname, 'fixtures', 'mini');

describe('mini fixture', () => {
  const gd = loadGameData(FIX);
  const cat = gd.catalogues.get('cat-mini')!;

  test('emits the selection tree with flattened modifier groups and defaulted flags omitted', () => {
    const coreWhen: Cond = { type: 'greaterThan', field: 'selections', scope: 'roster', childId: 'cat-core', value: 0, childSel: true };
    const groupRepeat = { field: 'selections', scope: 'parent', childId: 'se-warrior-model', value: 5, repeats: 1, roundUp: true as const };
    const expected: RosterFile = {
      schema: 1,
      id: 'cat-mini',
      name: 'Mini Faction',
      slug: 'mini-faction',
      library: false,
      links: [{ targetId: 'cat-lib', importRootEntries: true }],
      rootEntries: [
        {
          id: 'el-unit',
          kind: 'link',
          name: 'Warriors',
          targetId: 'se-warriors',
          targetKind: 'entry',
          cats: [{ id: 'cl-troops', targetId: 'cat-troops', primary: true }],
        },
      ],
      shared: [
        {
          id: 'se-warriors',
          kind: 'entry',
          name: 'Warriors',
          type: 'unit',
          costs: { [COST_PL]: 5 },
          cats: [{ id: 'cl-core', targetId: 'cat-core' }],
          constraints: [
            { id: 'c-roster', type: 'max', field: 'selections', scope: 'roster', value: 3, shared: false, childSel: true },
          ],
          mods: [
            {
              type: 'increment',
              field: 'c-roster',
              value: '1.0',
              when: {
                type: 'and',
                conds: [],
                groups: [
                  {
                    type: 'or',
                    conds: [
                      { type: 'instanceOf', field: 'selections', scope: 'force', childId: 'force-patrol', value: 0 },
                      { type: 'atLeast', field: 'points', scope: 'roster', childId: 'any', value: 1000, shared: false, childForces: true },
                    ],
                    groups: [],
                  },
                ],
              },
              repeats: [{ field: 'selections', scope: 'roster', childId: 'cat-troops', value: 1, repeats: 1, childSel: true }],
            },
            // From the modifier group: the group's condition is ANDed in and its repeat appended.
            { type: 'increment', field: 'points', value: '5.0', when: { type: 'and', conds: [coreWhen], groups: [] }, repeats: [groupRepeat] },
            // The `page` modifier is dropped. The nested group wraps first, then the outer group.
            {
              type: 'set',
              field: 'hidden',
              value: 'true',
              when: {
                type: 'and',
                conds: [coreWhen],
                groups: [
                  {
                    type: 'and',
                    conds: [],
                    groups: [
                      {
                        type: 'and',
                        conds: [{ type: 'lessThan', field: 'selections', scope: 'parent', childId: 'se-warrior-model', value: 15 }],
                        groups: [],
                      },
                      {
                        type: 'and',
                        conds: [{ type: 'atMost', field: 'forces', scope: 'roster', childId: 'force-patrol', value: 2 }],
                        groups: [],
                      },
                    ],
                  },
                ],
              },
              repeats: [groupRepeat],
            },
          ],
          children: [
            {
              id: 'seg-1',
              kind: 'group',
              name: 'Models',
              defaultId: 'el-model',
              constraints: [
                { id: 'c-min', type: 'min', field: 'selections', scope: 'parent', value: 10 },
                { id: 'c-max', type: 'max', field: 'selections', scope: 'parent', value: 20 },
              ],
              // "Crusade Relics" is dropped.
              children: [
                {
                  id: 'el-model',
                  kind: 'link',
                  name: 'Warrior',
                  targetId: 'se-warrior-model',
                  targetKind: 'entry',
                  collective: true,
                  costs: { [COST_PTS]: 11, [COST_PL]: 0 },
                },
              ],
            },
          ],
        },
      ],
      categories: [],
      forces: [],
    };
    expect(emitRosterFile(cat, 'mini-faction')).toStrictEqual(expected);
  });

  test('library entries drop profiles and keep children', () => {
    const lib = emitRosterFile(gd.catalogues.get('cat-lib')!, 'mini-library');
    expect(lib.library).toBe(true);
    expect(lib.shared).toStrictEqual([
      {
        id: 'se-warrior-model',
        kind: 'entry',
        name: 'Warrior',
        type: 'model',
        children: [{ id: 'el-gun', kind: 'link', name: 'Gauss gun', targetId: 'se-gun', targetKind: 'entry' }],
      },
      { id: 'se-gun', kind: 'entry', name: 'Gauss gun', type: 'upgrade' },
    ]);
  });

  test('system file: categories with modifiers, top-level forces only', () => {
    const sys = emitRosterFile(gd.system, 'system');
    expect(sys.categories).toStrictEqual([
      { id: 'cat-troops', name: 'Troops' },
      { id: 'cat-core', name: 'Core', hidden: true, mods: [{ type: 'set', field: 'name', value: 'Core Units' }] },
    ]);
    expect(sys.forces).toStrictEqual([
      {
        id: 'force-patrol',
        name: 'Patrol Detachment',
        cats: [
          {
            id: 'fcl-troops',
            targetId: 'cat-troops',
            constraints: [{ id: 'c-f-troops', type: 'min', field: 'selections', scope: 'parent', value: 1 }],
          },
        ],
      },
    ]);
  });

  const override = (o: Partial<CostOverride>): CostOverride => ({
    catalogueName: 'Mini Faction',
    entryId: 'el-model',
    entryName: 'Warrior',
    costTypeId: COST_PTS,
    value: 12,
    source: 'test',
    ...o,
  });
  const findNode = (nodes: RNode[], id: string): RNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = findNode(n.children ?? [], id);
      if (hit) return hit;
    }
    return undefined;
  };

  test('cost overrides replace one cost on the matching node', () => {
    const out = emitRosterFile(cat, 'mini-faction', { costs: [override({}), override({ catalogueName: 'Other', entryId: 'nope' })] });
    expect(findNode(out.shared, 'el-model')!.costs).toEqual({ [COST_PTS]: 12, [COST_PL]: 0 });
  });

  test('cost overrides throw when no node matches or the name differs', () => {
    expect(() => emitRosterFile(cat, 'mini-faction', { costs: [override({ entryId: 'missing' })] })).toThrow(/missing/);
    expect(() => emitRosterFile(cat, 'mini-faction', { costs: [override({ entryName: 'Wrong' })] })).toThrow(/Wrong/);
  });

  const factionOverride = (o: Partial<FactionKeywordOverride>): FactionKeywordOverride => ({
    catalogueName: 'Mini Faction',
    entryId: 'el-unit',
    entryName: 'Warriors',
    add: ['Imperium'],
    source: 'test',
    ...o,
  });
  const systemCategories = new Map([['Faction: Imperium', 'cat-faction-imperium'], ['Faction: Mini', 'cat-faction-mini']]);

  test('faction keyword overrides add a link to each Faction category, once', () => {
    const out = emitRosterFile(cat, 'mini-faction', {
      factionKeywords: [factionOverride({ add: ['Imperium', 'Mini'] }), factionOverride({}), factionOverride({ catalogueName: 'Other', entryId: 'nope' })],
      systemCategories,
    });
    expect(findNode(out.rootEntries, 'el-unit')!.cats).toEqual([
      { id: 'cl-troops', targetId: 'cat-troops', primary: true },
      { id: 'el-unit-faction-cat-faction-imperium', targetId: 'cat-faction-imperium' },
      { id: 'el-unit-faction-cat-faction-mini', targetId: 'cat-faction-mini' },
    ]);
    // A shared entry works too.
    const shared = emitRosterFile(cat, 'mini-faction', { factionKeywords: [factionOverride({ entryId: 'se-warriors' })], systemCategories });
    expect(findNode(shared.shared, 'se-warriors')!.cats).toContainEqual({ id: 'se-warriors-faction-cat-faction-imperium', targetId: 'cat-faction-imperium' });
  });

  test("faction keyword overrides use the catalogue's own Faction category before the .gst's", () => {
    const el = (tag: string, attrs: Record<string, string>, children: RawNode[] = []): RawNode => ({ tag, attrs, children });
    const own: RawCatalogue = {
      id: 'cat-own',
      name: 'Own',
      library: false,
      links: [],
      root: el('catalogue', { id: 'cat-own', name: 'Own' }, [
        el('categoryEntries', {}, [el('categoryEntry', { id: 'cat-faction-own', name: 'Faction: Mini' })]),
        el('sharedSelectionEntries', {}, [el('selectionEntry', { id: 'se-x', name: 'X', type: 'unit' })]),
      ]),
    };
    const out = emitRosterFile(own, 'own', { factionKeywords: [factionOverride({ catalogueName: 'Own', entryId: 'se-x', entryName: 'X', add: ['Mini'] })], systemCategories });
    expect(findNode(out.shared, 'se-x')!.cats).toEqual([{ id: 'se-x-faction-cat-faction-own', targetId: 'cat-faction-own' }]);
  });

  test('faction keyword overrides throw on an unknown entry, a different name or an unknown faction', () => {
    const emit = (o: Partial<FactionKeywordOverride>) => () => emitRosterFile(cat, 'mini-faction', { factionKeywords: [factionOverride(o)], systemCategories });
    expect(emit({ entryId: 'missing' })).toThrow(/missing/);
    expect(emit({ entryName: 'Wrong' })).toThrow(/Wrong/);
    expect(emit({ add: ['Chaos'] })).toThrow(/Faction: Chaos/);
  });

  test('constraint overrides pin a constraint at a value: its modifiers are dropped', () => {
    const before = findNode(emitRosterFile(cat, 'mini-faction').shared, 'se-warriors')!;
    expect(before.mods!.some((m) => m.field === 'c-roster')).toBe(true);
    const pin: ConstraintOverride = { catalogueName: 'Mini Faction', entryName: 'Warriors', constraintId: 'c-roster', value: 0, source: 'test' };
    const after = findNode(emitRosterFile(cat, 'mini-faction', { constraints: [pin, { ...pin, catalogueName: 'Other', constraintId: 'nope' }] }).shared, 'se-warriors')!;
    expect(after.constraints!.find((c) => c.id === 'c-roster')).toMatchObject({ value: 0, scope: 'roster' });
    expect(after.mods!.some((m) => m.field === 'c-roster')).toBe(false);
    expect(after.mods!.length).toBe(before.mods!.length - 1);
    // Force category link constraints too; a category link goes by its category's name.
    const sys = emitRosterFile(gd.system, 'system', { constraints: [{ catalogueName: 'Mini System', entryName: 'Troops', constraintId: 'c-f-troops', value: 2, source: 'test' }] });
    expect(sys.forces[0].cats[0].constraints![0].value).toBe(2);
  });

  test('constraint overrides set a new scope together with the value', () => {
    const pin: ConstraintOverride = { catalogueName: 'Mini Faction', entryName: 'Warriors', constraintId: 'c-roster', value: 1, scope: 'force', source: 'test' };
    const after = findNode(emitRosterFile(cat, 'mini-faction', { constraints: [pin] }).shared, 'se-warriors')!;
    expect(after.constraints!.find((c) => c.id === 'c-roster')).toMatchObject({ type: 'max', value: 1, scope: 'force' });
  });

  test('constraint overrides throw when no constraint has the id, or its owner has another name', () => {
    const emit = (o: Partial<ConstraintOverride>) => () =>
      emitRosterFile(cat, 'mini-faction', { constraints: [{ catalogueName: 'Mini Faction', entryName: 'Warriors', constraintId: 'c-roster', value: 0, source: 'test', ...o }] });
    expect(emit({ constraintId: 'missing' })).toThrow(/missing/);
    expect(emit({ entryName: 'Wrong' })).toThrow(/expects "Wrong" but found "Warriors"/);
    expect(emit({ scope: 'detachment' as ConstraintOverride['scope'] })).toThrow(/unknown scope "detachment"/);
  });

  test('modifier removals drop the modifiers of one field on the matching node', () => {
    const before = findNode(emitRosterFile(cat, 'mini-faction').shared, 'se-warriors')!;
    const field = before.mods![0].field;
    const removal: ModifierRemoval = { catalogueName: 'Mini Faction', entryId: 'se-warriors', entryName: 'Warriors', field, source: 'test' };
    const after = findNode(emitRosterFile(cat, 'mini-faction', { modifierRemovals: [removal, { ...removal, catalogueName: 'Other', entryId: 'nope' }] }).shared, 'se-warriors')!;
    expect((after.mods ?? []).some((m) => m.field === field)).toBe(false);
    expect((after.mods ?? []).length).toBe(before.mods!.filter((m) => m.field !== field).length);
  });

  test('modifier removals throw on an unknown entry, a different name or a field with no modifier', () => {
    const emit = (o: Partial<ModifierRemoval>) => () =>
      emitRosterFile(cat, 'mini-faction', { modifierRemovals: [{ catalogueName: 'Mini Faction', entryId: 'se-warriors', entryName: 'Warriors', field: 'hidden', source: 'test', ...o }] });
    expect(emit({ entryId: 'missing' })).toThrow(/missing/);
    expect(emit({ entryName: 'Wrong' })).toThrow(/expects "Wrong" but found "Warriors"/);
    expect(emit({ field: 'no-such-field' })).toThrow(/no-such-field/);
  });

  const added = (o: Partial<AddedConstraint> = {}, c: Partial<AddedConstraint['constraint']> = {}): AddedConstraint => ({
    catalogueName: 'Mini Faction',
    entryId: 'se-warriors',
    entryName: 'Warriors',
    constraint: { type: 'max', field: 'selections', scope: 'roster', value: 1, ...c },
    source: 'test',
    ...o,
  });

  test('added constraints go on the matching node with a stable id', () => {
    const out = emitRosterFile(cat, 'mini-faction', { addedConstraints: [added(), added({ catalogueName: 'Other', entryId: 'nope' })] });
    const node = findNode(out.shared, 'se-warriors')!;
    // Counted like BSData's own once-per-army limits: child selections and child forces included.
    expect(node.constraints!.at(-1)).toEqual({ id: 'se-warriors-added-max-roster', type: 'max', field: 'selections', scope: 'roster', value: 1, childSel: true, childForces: true });
    expect(node.constraints!.length).toBe(findNode(emitRosterFile(cat, 'mini-faction').shared, 'se-warriors')!.constraints!.length + 1);
    // A link works too.
    const link = findNode(emitRosterFile(cat, 'mini-faction', { addedConstraints: [added({ entryId: 'el-unit' }, { scope: 'force' })] }).rootEntries, 'el-unit')!;
    expect(link.constraints).toEqual([{ id: 'el-unit-added-max-force', type: 'max', field: 'selections', scope: 'force', value: 1, childSel: true, childForces: true }]);
  });

  test('added constraints throw on an unknown entry, a different name, an unsupported constraint or a duplicate', () => {
    const emit = (...list: AddedConstraint[]) => () => emitRosterFile(cat, 'mini-faction', { addedConstraints: list });
    expect(emit(added({ entryId: 'missing' }))).toThrow(/missing/);
    expect(emit(added({ entryName: 'Wrong' }))).toThrow(/expects "Wrong" but found "Warriors"/);
    expect(emit(added({}, { scope: 'self' as never }))).toThrow(/unsupported constraint/);
    expect(emit(added({}, { type: 'exactly' as never }))).toThrow(/unsupported constraint/);
    expect(emit(added({}, { field: 'points' as never }))).toThrow(/unsupported constraint/);
    expect(emit(added({}, { value: -1 }))).toThrow(/unsupported constraint/);
    expect(emit(added(), added())).toThrow(/already has constraint se-warriors-added-max-roster/);
  });

  test("constraint overrides name a category link by a linked catalogue's category, or say the name is unknown", () => {
    // A force whose category link targets a category defined only in a linked catalogue.
    const el = (tag: string, attrs: Record<string, string>, children: RawNode[] = []): RawNode => ({ tag, attrs, children });
    const linked: RawCatalogue = {
      id: 'cat-x',
      name: 'Linked',
      library: false,
      links: [{ targetId: 'cat-lib', importRootEntries: false }],
      root: el('catalogue', { id: 'cat-x', name: 'Linked' }, [
        el('forceEntries', {}, [el('forceEntry', { id: 'f-x', name: 'Force X' }, [
          el('categoryLinks', {}, [el('categoryLink', { id: 'cl-x', targetId: 'cat-lib-only' }, [
            el('constraints', {}, [el('constraint', { id: 'c-x', type: 'max', field: 'selections', scope: 'force', value: '1' })]),
          ])]),
        ])]),
      ]),
    };
    const pin: ConstraintOverride = { catalogueName: 'Linked', entryName: 'Lib Category', constraintId: 'c-x', value: 2, source: 'test' };
    const out = emitRosterFile(linked, 'linked', { constraints: [pin], scopeCategories: new Map([['cat-lib-only', 'Lib Category']]) });
    expect(out.forces[0].cats[0].constraints![0].value).toBe(2);
    expect(() => emitRosterFile(linked, 'linked', { constraints: [pin] })).toThrow('constraint c-x: unknown category name for cat-lib-only');
  });
});

describe('real BSData v9.8.0', () => {
  const out = mkdtempSync(join(tmpdir(), 'recruit-roster-'));
  let index: DataIndex;
  const files = new Map<string, RosterFile>();
  const read = (slug: string) => files.get(slug)!;

  beforeAll(() => {
    index = buildAll({ rawDir: join(ROOT, 'raw'), overridesDir: join(ROOT, 'overrides'), outDir: out }).index;
    for (const f of readdirSync(join(out, 'roster'))) {
      if (f === 'policy.json') continue; // matched-play policy data (roster-policy.test.ts), not a roster file
      files.set(f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(out, 'roster', f), 'utf8')));
    }
  });

  function* walk(nodes: RNode[]): Generator<RNode> {
    for (const n of nodes) {
      yield n;
      yield* walk(n.children ?? []);
    }
  }
  const allNodes = (f: RosterFile) => [...walk(f.rootEntries), ...walk(f.shared)];

  test('one roster file per catalogue plus system, each under 4 MB', () => {
    expect(files.size).toBe(53);
    expect(read('system').name).toBe('Warhammer 40,000 9th Edition');
    for (const c of index.catalogues) expect(files.has(c.slug), c.slug).toBe(true);
    let total = 0;
    for (const slug of files.keys()) {
      const size = statSync(join(out, 'roster', `${slug}.json`)).size;
      total += size;
      expect(size, slug).toBeLessThan(4 * 1024 * 1024);
    }
    console.log(`generated/roster total: ${(total / 1024 / 1024).toFixed(2)} MB`);
  });

  test('rosterScope lists the catalogue, its linked catalogues, then system', () => {
    for (const c of index.catalogues) {
      expect(c.rosterScope[0], c.name).toBe(c.slug);
      expect(c.rosterScope.at(-1), c.name).toBe('system');
      for (const s of c.rosterScope) expect(files.has(s), `${c.name}: ${s}`).toBe(true);
    }
    const um = index.catalogues.find((c) => c.slug === 'imperium-adeptus-astartes-ultramarines')!;
    expect(um.rosterScope.slice(0, 2)).toEqual(['imperium-adeptus-astartes-ultramarines', 'imperium-space-marines']);
  });

  test('every link resolves to an entry or group of its kind within the catalogue scope (or is a listed exception)', () => {
    const allowed: { catalogue: string; targetId: string }[] = JSON.parse(
      readFileSync(join(ROOT, 'overrides', 'unresolved-links.json'), 'utf8'),
    );
    const unresolved: string[] = [];
    for (const c of index.catalogues) {
      const scope = c.rosterScope.map(read);
      const targets = new Map<string, RNode['kind']>();
      for (const f of scope) for (const n of allNodes(f)) if (n.kind !== 'link' && !targets.has(n.id)) targets.set(n.id, n.kind);
      for (const n of allNodes(read(c.slug))) {
        if (n.kind !== 'link') continue;
        if (targets.get(n.targetId!) === n.targetKind) continue;
        if (allowed.some((a) => a.catalogue === c.name && a.targetId === n.targetId)) continue;
        unresolved.push(`${c.name}: ${n.id} "${n.name}" -> ${n.targetId} (${n.targetKind}, found ${targets.get(n.targetId!) ?? 'nothing'})`);
      }
    }
    // The system file resolves on its own.
    const sysTargets = new Set(allNodes(read('system')).filter((n) => n.kind !== 'link').map((n) => n.id));
    for (const n of allNodes(read('system'))) if (n.kind === 'link' && !sysTargets.has(n.targetId!)) unresolved.push(`system: ${n.id}`);
    expect(unresolved).toEqual([]);
  });

  test('supported vocabulary: modifier, condition and constraint types, scopes and fields', () => {
    const isId = (s: string) => /^[0-9a-f]{4}-/i.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const modTypes = new Set<string>();
    const condTypes = new Set<string>();
    const scopes = new Set<string>();
    const fields = new Set<string>();
    const modFields = new Set<string>();
    const constraintIds = new Set<string>();
    const conds = (g: CondGroup | undefined): Cond[] => (g ? [...g.conds, ...g.groups.flatMap(conds)] : []);
    const visitConstraints = (cs: Constraint[] | undefined) =>
      (cs ?? []).forEach((c) => {
        scopes.add(c.scope);
        fields.add(c.field);
        constraintIds.add(c.id);
      });
    const visitMods = (ms: Mod[] | undefined) =>
      (ms ?? []).forEach((m) => {
        modTypes.add(m.type);
        modFields.add(m.field);
        for (const c of conds(m.when)) {
          condTypes.add(c.type);
          scopes.add(c.scope);
          if (c.type !== 'instanceOf' && c.type !== 'notInstanceOf') fields.add(c.field);
        }
        for (const r of m.repeats ?? []) {
          scopes.add(r.scope);
          fields.add(r.field);
        }
      });
    const visitHolder = (h: { constraints?: Constraint[]; mods?: Mod[] }) => {
      visitConstraints(h.constraints);
      visitMods(h.mods);
    };
    for (const f of files.values()) {
      for (const n of allNodes(f)) {
        visitHolder(n);
        (n.cats ?? []).forEach(visitHolder);
      }
      f.categories.forEach(visitHolder);
      for (const force of f.forces) {
        visitHolder(force);
        force.cats.forEach(visitHolder);
      }
    }
    const notId = (s: Set<string>) => [...s].filter((x) => !isId(x)).sort();
    const MOD_TYPES = ['set', 'increment', 'decrement', 'append', 'add', 'remove', 'set-primary', 'unset-primary'];
    const COND_TYPES = ['lessThan', 'greaterThan', 'equalTo', 'notEqualTo', 'atLeast', 'atMost', 'instanceOf', 'notInstanceOf'];
    const SCOPES = ['self', 'parent', 'ancestor', 'force', 'roster', 'primary-catalogue'];
    expect(notId(modTypes).filter((x) => !MOD_TYPES.includes(x))).toEqual([]);
    expect(notId(condTypes).filter((x) => !COND_TYPES.includes(x))).toEqual([]);
    expect(notId(scopes).filter((x) => !SCOPES.includes(x))).toEqual([]);
    expect([...fields].filter((x) => !['selections', 'forces', COST_PTS, COST_PL, COST_CP].includes(x))).toEqual([]);
    // Kept modifier fields: hidden, name, category, a cost type id, or the id of a constraint in some roster file.
    // Cost types are declared in the .gst and in a few catalogues (Orks' Scrap Points, Thousand Sons' Cabal Points).
    const gd = loadGameData(join(ROOT, 'raw', 'bsdata'));
    const costTypeIds = [gd.system, ...gd.catalogues.values()].flatMap((c) =>
      (c.root.children.find((n) => n.tag === 'costTypes')?.children ?? []).map((n) => n.attrs.id),
    );
    expect(costTypeIds).toEqual(expect.arrayContaining([COST_PTS, COST_PL, COST_CP]));
    expect([...modFields].filter((x) => !['hidden', 'name', 'category', ...costTypeIds].includes(x) && !constraintIds.has(x))).toEqual([]);
  });

  test('Necron Warriors: 10-20 Warriors, Gauss Flayer model at 11 pts', () => {
    const necrons = read('necrons');
    const root = necrons.rootEntries.find((n) => n.name === 'Necron Warriors')!;
    expect(root).toBeDefined();
    const unit = root.kind === 'link' ? allNodes(necrons).find((n) => n.id === root.targetId)! : root;
    const group = unit.children!.find((n) => n.name === 'Warriors')!;
    expect(group.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'min', field: 'selections', scope: 'parent', value: 10 }),
        expect.objectContaining({ type: 'max', field: 'selections', scope: 'parent', value: 20 }),
      ]),
    );
    const link = group.children!.find((n) => n.kind === 'link' && n.name.includes('Gauss Flayer'))!;
    const scope = index.catalogues.find((c) => c.slug === 'necrons')!.rosterScope.map(read);
    const target = scope.flatMap(allNodes).find((n) => n.id === link.targetId)!;
    expect(target.kind).toBe('entry');
    expect(target.costs?.[COST_PTS]).toBe(11);
  });

  test("Aeldari Library: Harlequin's Kiss links carry their own 10 pts", () => {
    const links = allNodes(read('aeldari-aeldari-library')).filter((n) => n.kind === 'link' && n.name === "Harlequin's Kiss");
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((n) => n.costs?.[COST_PTS] === 10)).toBe(true);
  });

  test('dropped elements: no Crusade or Battle Honours nodes, no nested forces', () => {
    for (const [slug, f] of files) {
      const bad = allNodes(f).filter((n) => /^(battle honours|battle scars|crusade)\b/i.test(n.name));
      expect(bad.map((n) => n.name), slug).toEqual([]);
    }
    expect(read('system').forces.length).toBeGreaterThan(0);
  });
});
