import { describe, expect, test } from 'vitest';
import {
  addChild,
  addForce,
  addUnit,
  availableUnits,
  buildScope,
  chooseInGroup,
  createRoster,
  displayName,
  evaluate,
  exportText,
  findSelView,
  FORCE,
  unitExport,
  unitSummary,
  UNTITLED_LIST,
  setCount,
  splitSelection,
  COST_CP,
  COST_PL,
  COST_PTS,
  type Roster,
  type RosterView,
  type Scope,
  type SelView,
} from '../src/roster';
import { buildFromSpec, type UnitSpec } from './corpus/spec';
import * as M from './fixtures/roster/mini';
import { realCatalogueId, realScope } from './helpers/realScope';

const FOOTER = 'Built with Recruit+ (unofficial fan-made tool)';
const fmt = (n: number) => n.toLocaleString('en-GB');

// ---------- helpers ----------

function rootEntryId(scope: Scope, catalogueId: string, name: string): string {
  const hit = scope.catalogue(catalogueId)!.rootEntries.find((n) => n.name === name);
  if (!hit) throw new Error(`no root entry ${name}`);
  return hit.id;
}
/** The first root selection with this name, read from the evaluated view. */
const rootView = (view: RosterView, name: string) => view.forces.flatMap((f) => f.selections).find((v) => v.name === name)!;
/** The pts of the first root selection with this name, as BSData (after modifiers) says. */
const ptsOf = (view: RosterView, name: string) => rootView(view, name).total[COST_PTS] ?? 0;
const unitSel = (r: Roster, selId: string) => r.forces[0].selections.find((s) => s.id === selId)!;

// ---------- real Necrons ----------

describe('exportText (real Necrons)', () => {
  const scope = realScope('necrons');
  const necrons = realCatalogueId('necrons');
  const DYNASTY_SAUTEKH = '22ae-fa31-010d-60e9';

  /** A Strike Force roster: Dynasty Choice made, a Warlord Overlord with Hand of the Phaeron, 18 + 2 Necron Warriors. */
  function build(): Roster {
    let r = createRoster(scope, { name: 'Sautekh Strike', catalogueId: necrons, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
    const force = r.forces[0].id;
    const dynasty = rootView(evaluate(scope, r), 'Dynasty Choice');
    r = addChild(scope, r, dynasty.sel.id, DYNASTY_SAUTEKH);

    const overlord = addUnit(scope, r, force, rootEntryId(scope, necrons, 'Overlord'));
    r = overlord.roster;
    for (const name of ['Warlord', 'Hand of the Phaeron']) {
      const option = rootView(evaluate(scope, r), 'Overlord').merged!.children.find((c) => c.name === name)!;
      r = addChild(scope, r, overlord.selId, option.id);
    }

    const warriors = addUnit(scope, r, force, rootEntryId(scope, necrons, 'Necron Warriors'));
    r = setCount(scope, warriors.roster, unitSel(warriors.roster, warriors.selId).children[0].id, 18);
    const reaper = rootView(evaluate(scope, r), 'Necron Warriors').merged!.children
      .flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.name === 'Necron Warrior (Gauss Reaper)')!;
    return addChild(scope, r, warriors.selId, reaper.id, 2);
  }

  test('a Warlord Overlord and 20 Necron Warriors split 18/2 export to the exact list', () => {
    const view = evaluate(scope, build());
    const total = view.total;
    const expected = [
      'Sautekh Strike',
      `Necrons · Strike Force · ${fmt(total[COST_PTS]!)} / 2,000 pts · ${fmt(total[COST_PL]!)} PL · ${fmt(total[COST_CP]!)} CP`,
      '',
      '== Arks of Omen Detachment (Necrons) ==',
      'Army: Dynasty Choice: Dynasty: Sautekh',
      'Army: Arks of Omen Compulsory Type: Troops',
      'HQ',
      `- Overlord · ${ptsOf(view, 'Overlord')} pts`,
      '    Warlord',
      '    1x Tachyon Arrow',
      '    1x Hyperphase Glaive',
      '    1x Hand of the Phaeron',
      'Troops',
      `- Necron Warriors (20 models) · ${ptsOf(view, 'Necron Warriors')} pts`,
      '    Necron Warrior (Gauss Flayer) (18): Gauss Flayer',
      '    Necron Warrior (Gauss Reaper) (2): Gauss Reaper',
      '',
      FOOTER,
    ].join('\n');
    expect(exportText(view, scope)).toBe(expected);
    // The auto-managed policy entries are still in the roster, just not printed.
    expect(view.forces[0].selections.map((v) => v.name)).toEqual(expect.arrayContaining(['Game Type', 'Battle Size', 'Detachment Command Cost']));
    // The values read from BSData are real, not zero.
    expect(ptsOf(view, 'Overlord')).toBeGreaterThan(0);
    expect(ptsOf(view, 'Necron Warriors')).toBeGreaterThan(0);
    expect(total[COST_PTS]).toBe(ptsOf(view, 'Overlord') + ptsOf(view, 'Necron Warriors'));
  });

  test('a detachment name loses its CP suffix', () => {
    const r = createRoster(scope, { name: 'Battalion', catalogueId: necrons, battleSize: 'onslaught', forceId: FORCE.battalion });
    const view = evaluate(scope, r);
    expect(view.forces[0].name).toMatch(/ -?\d+CP$/);
    expect(exportText(view, scope)).toContain('\n== Battalion Detachment (Necrons) ==\n');
  });
});

// ---------- unit-wide weapon choices and unitSummary (real data) ----------

describe('unit-wide weapon choices and unitSummary (real data)', () => {
  /** The unit as added to a new Strike Force list (Arks of Omen Detachment), defaults filled in. */
  function added(slug: string, unit: string, spec?: Partial<UnitSpec>): SelView {
    const scope = realScope(slug);
    const r = buildFromSpec(scope, realCatalogueId(slug), {
      title: unit,
      battleSize: 'strike-force',
      detachments: [{ detachment: 'Arks of Omen Detachment', ...(slug === 'necrons' && { army: { 'Dynasty Choice': 'Dynasty: Novokh' } }), units: [{ name: unit, ...spec }] }],
      expect: { points: 0, powerLevel: 0 },
    });
    return evaluate(scope, r).forces[0].selections.find((v) => v.name === unit)!;
  }

  test('Immortals (5 models) with their unit weapon choice export 5x Gauss Blaster', () => {
    const immortals5 = added('necrons', 'Immortals');
    expect(immortals5.models).toBe(5);
    expect(unitExport(immortals5).details).toContain('5x Gauss Blaster');
  });

  test('Lychguard (5) with warscythes export 5x Warscythe', () => {
    expect(unitExport(added('necrons', 'Lychguard')).details).toContain('5x Warscythe');
  });

  test('the same choice made by a bigger squad counts every model', () => {
    const ten = added('necrons', 'Immortals', { models: { Immortal: 10 } });
    expect(ten.models).toBe(10);
    expect(unitExport(ten).details).toContain('10x Gauss Blaster');
  });

  test('a sergeant-only weapon in a squad stays 1x', () => {
    const squad = added('imperium-adeptus-astartes-ultramarines', 'Intercessor Squad', { options: ['Intercessor Sergeant > Power fist'] });
    const lines = unitExport(squad).details;
    expect(lines.some((l) => /^Intercessor Sergeant \(1\): .*Power fist/.test(l))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/\dx Power fist/);
  });

  test('a choice for some of the models (Weapons (Neophytes)) is not counted per model', () => {
    const squad = added('imperium-adeptus-astartes-black-templars', 'Primaris Crusader Squad');
    expect(unitExport(squad).details).toContain('1x Bolt Pistol and Astartes Chainsword');
  });

  test('a one-model character keeps 1x', () => {
    const overlord = added('necrons', 'Overlord', { options: ['Staff of Light'] });
    expect(unitExport(overlord).details).toContain('1x Staff of Light');
  });

  test('unitSummary: a Novokh Overlord Warlord with Blood-Fuelled Fury and the Blood Scythe', () => {
    const overlordWarlord = added('necrons', 'Overlord', {
      warlord: true,
      // The Blood Scythe replaces a warscythe, so the Overlord takes one first.
      options: ['Warscythe', 'Stratagem: Warlord Trait', 'Warlord Trait (Novokh): Blood-Fuelled Fury', 'Stratagem: Relic', 'Relic (Novokh): Blood Scythe'],
    });
    const s = unitSummary(overlordWarlord);
    expect(s).toMatchObject({ warlord: true, traits: ['Blood-Fuelled Fury'], relics: ['Blood Scythe'], other: [] });
    expect(s.gear.join(' ')).not.toMatch(/Blood Scythe|Warlord Trait|Stratagem/); // relics aren't repeated as gear; requisitions aren't shown
  });

  test('unitSummary: Immortals gear is per model', () => expect(unitSummary(added('necrons', 'Immortals')).gear).toEqual(['5x Gauss Blaster']));

  test('unitSummary: a one-of group that holds a model (Meganobz "Boss") is not counted per model', () => {
    const meganobz = added('orks', 'Meganobz');
    expect(meganobz.models).toBe(3);
    expect(unitSummary(meganobz).gear.sort()).toEqual(['3x Kustom Shoota', '3x Power Klaw', '3x Stikkbombs']);
  });

  /** Weapon counts the export prints: unit-level "Nx Name" lines plus each model stack's "Stack (n): a, 2x b" upgrades. */
  function exportCounts(v: SelView): Map<string, number> {
    const out = new Map<string, number>();
    const add = (name: string, n: number) => out.set(name, (out.get(name) ?? 0) + n);
    for (const line of unitExport(v).details) {
      const stack = /^(.*) \((\d+)\)(?:: (.*))?$/.exec(line);
      if (stack) {
        for (const item of (stack[3] ?? '').split(', ').filter(Boolean)) {
          const m = /^(\d+)x (.*)$/.exec(item);
          add(m ? m[2] : item, Number(stack[2]) * (m ? Number(m[1]) : 1));
        }
        continue;
      }
      const m = /^(\d+)x (.*)$/.exec(line);
      if (m) add(m[2], Number(m[1]));
    }
    return out;
  }

  test.each(['necrons', 'orks', 'imperium-imperial-navy', 'imperium-death-korps-of-krieg', 'imperium-adeptus-astartes-ultramarines'])(
    "unitSummary counts each weapon as the export does, for every unit %s's picker offers",
    { timeout: 60_000 },
    (slug) => {
      const scope = realScope(slug);
      const r = createRoster(scope, { name: 'All', catalogueId: realCatalogueId(slug), battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
      const wrong: string[] = [];
      for (const o of availableUnits(scope, r, r.forces[0].id)) {
        const a = addUnit(scope, r, r.forces[0].id, o.entryId);
        const v = findSelView(evaluate(scope, a.roster), a.selId);
        if (!v) continue;
        const counts = exportCounts(v);
        for (const g of unitSummary(v).gear) {
          const m = /^(\d+)x (.*)$/.exec(g);
          const [n, name] = m ? [Number(m[1]), m[2]] : [1, g];
          const printed = counts.get(name) ?? counts.get(displayName(name));
          if (printed !== undefined && printed !== n) wrong.push(`${o.name}: summary ${n}x ${name}, export ${printed}x`);
        }
      }
      expect(wrong).toEqual([]);
    },
  );

  test('unitSummary: a relic or trait without a "Relic:" prefix is known by its group (Space Marines Codex Relics)', () => {
    const captain = added('imperium-adeptus-astartes-ultramarines', 'Captain', { warlord: true, options: ['Stratagem: Relic', 'The Armour Indomitus'] });
    expect(unitSummary(captain)).toMatchObject({ warlord: true, relics: ['The Armour Indomitus'] });
    expect(unitSummary(captain).other).not.toContain('The Armour Indomitus');
  });

  test('a unit-level single choice that is not a weapon (Mark of Chaos) is not counted per model', () => {
    const legionaries = added('chaos-chaos-space-marines', 'Legionaries', { options: ['Mark of Khorne'] });
    expect(legionaries.models).toBeGreaterThan(1);
    expect(unitExport(legionaries).details.join('\n')).not.toMatch(/[2-9]\d*x Mark of Khorne/);
  });

  test('unitSummary: a single item reads just its name, and a non-weapon upgrade is "other"', () => {
    const overlord = unitSummary(added('necrons', 'Overlord', { options: ['Staff of Light', 'Resurrection Orb'] }));
    expect(overlord.gear).toEqual(['Staff of Light']);
    expect(overlord.other).toEqual(['Resurrection Orb']);
    expect(overlord).toMatchObject({ warlord: false, traits: [], relics: [] });
  });
});

// ---------- mini fixture ----------

describe('exportText (mini fixture)', () => {
  const scope = buildScope(M.miniFiles);
  const empty = (): Roster =>
    addForce(scope, { schema: 1, name: 'Mini', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] }, M.FORCE_PATROL, M.CAT_ID);
  const text = (r: Roster) => exportText(evaluate(scope, r), scope);

  test('a blank list name prints as "Untitled list" so the first line is never empty', () => {
    for (const name of ['', '   ']) {
      const lines = text({ ...empty(), name }).split('\n');
      expect(UNTITLED_LIST).toBe('Untitled list');
      expect(lines[0]).toBe('Untitled list');
      expect(lines[1]).toBe('Mini Faction · Strike Force · 0 / 2,000 pts · 0 PL · 0 CP');
    }
  });

  test('unitExport gives the parts of a unit line, and the printed lines are built from them', () => {
    const start = empty();
    const r = addUnit(scope, start, start.forces[0].id, M.L_SQUAD).roster;
    const view = evaluate(scope, r);
    const unit = view.forces[0].selections[0];
    const u = unitExport(unit);
    expect(u.title).toMatch(/Squad/);
    expect(u.points).toMatch(/^[\d,]+ pts$/);
    const lines = exportText(view, scope).split('\n');
    const at = lines.indexOf(`- ${u.title} · ${u.points}`);
    expect(at).toBeGreaterThan(0);
    expect(lines.slice(at + 1, at + 1 + u.details.length)).toEqual(u.details.map((d) => `    ${d}`));
  });

  test('an empty detachment prints its heading and the footer', () => {
    expect(text(empty())).toBe(
      ['Mini', 'Mini Faction · Strike Force · 0 / 2,000 pts · 0 PL · 0 CP', '', '== Patrol Detachment (Mini Faction) ==', '', FOOTER].join('\n'),
    );
  });

  test('roles follow the battlefield order, the Warlord leads its unit and is not repeated, role-less items go under Other', () => {
    let r = empty();
    const f = r.forces[0].id;
    // Added out of order on purpose.
    r = addUnit(scope, r, f, M.E_PACT).roster;
    r = addUnit(scope, r, f, M.L_SQUAD).roster;
    r = addUnit(scope, r, f, M.L_WARRIORS).roster;
    const lord = addUnit(scope, r, f, M.L_LORD);
    r = addChild(scope, addChild(scope, lord.roster, lord.selId, M.L_LORD_BLADE), lord.selId, M.E_WARLORD_UPG);
    const view = evaluate(scope, r);
    expect(exportText(view, scope)).toBe(
      [
        'Mini',
        `Mini Faction · Strike Force · ${fmt(view.total[COST_PTS]!)} / 2,000 pts · ${fmt(view.total[COST_PL]!)} PL · 0 CP`,
        '',
        '== Patrol Detachment (Mini Faction) ==',
        'HQ',
        `- Lord · ${ptsOf(view, 'Lord')} pts`,
        '    Warlord',
        '    1x Blade',
        'Troops',
        `- Warriors (10 models) · ${ptsOf(view, 'Warriors')} pts`,
        '    10x Gauss Flayer',
        'Elites',
        `- Squad (5 models) · ${ptsOf(view, 'Squad')} pts`,
        '    5x Bolter',
        'Other',
        '- Pact · 0 pts',
        '',
        FOOTER,
      ].join('\n'),
    );
  });

  test('a unit with several model stacks lists each stack with its own upgrades', () => {
    let r = empty();
    const squad = addUnit(scope, r, r.forces[0].id, M.L_SQUAD);
    r = setCount(scope, squad.roster, unitSel(squad.roster, squad.selId).children[0].id, 3);
    r = addChild(scope, r, squad.selId, M.L_SQUAD_MODEL, 2);
    r = chooseInGroup(scope, r, unitSel(r, squad.selId).children[1].id, M.G_SQUAD_WEAPON, M.E_PLASMA);
    const view = evaluate(scope, r);
    const lines = exportText(view, scope).split('\n');
    const at = lines.indexOf('Elites');
    // Model wargear appears only on the per-model lines.
    expect(lines.slice(at, at + 5)).toEqual([
      'Elites',
      `- Squad (5 models) · ${ptsOf(view, 'Squad')} pts`,
      '    Squad Marine (3): Bolter',
      '    Squad Marine (2): Plasma',
      '',
    ]);
  });

  test('one model stack keeps its upgrades in the aggregate and has no per-model line', () => {
    let r = empty();
    const squad = addUnit(scope, r, r.forces[0].id, M.L_SQUAD);
    r = squad.roster;
    const out = text(r).split('\n');
    expect(out).toContain('    5x Bolter');
    expect(out.some((l) => l.startsWith('    Squad Marine ('))).toBe(false);
  });

  test('stacks with the same model and upgrades are one stack, so no per-model lines', () => {
    let r = empty();
    const squad = addUnit(scope, r, r.forces[0].id, M.L_SQUAD);
    r = splitSelection(squad.roster, unitSel(squad.roster, squad.selId).children[0].id).roster;
    const out = text(r);
    expect(out).toContain('- Squad (5 models)');
    expect(out).toContain('\n    5x Bolter\n');
    expect(out).not.toContain('Squad Marine (');
  });

  test('names wrapped in BattleScribe decoration print without it', () => {
    const files = structuredClone(M.miniFiles);
    const rename = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(rename);
      if (!o || typeof o !== 'object') return;
      const rec = o as Record<string, unknown>;
      if (rec.name === 'Blade') rec.name = '-Blade-';
      if (rec.name === 'Gauss Flayer') rec.name = '* Gauss Flayer *';
      Object.values(rec).forEach(rename);
    };
    rename(files);
    const s = buildScope(files);
    let r = addForce(s, { schema: 1, name: 'Mini', catalogueId: M.CAT_ID, battleSize: 'strike-force', forces: [] }, M.FORCE_PATROL, M.CAT_ID);
    const f = r.forces[0].id;
    r = addUnit(s, r, f, M.L_WARRIORS).roster;
    const lord = addUnit(s, r, f, M.L_LORD);
    r = addChild(s, lord.roster, lord.selId, M.L_LORD_BLADE);
    const out = exportText(evaluate(s, r), s).split('\n');
    expect(out).toContain('    1x Blade');
    expect(out).toContain('    10x Gauss Flayer');
  });

  test('items the rules data no longer has are left out', () => {
    const r = empty();
    const broken: Roster = { ...r, forces: [{ ...r.forces[0], selections: [{ id: 'x', entryId: 'gone', count: 1, children: [] }] }] };
    const out = text(broken);
    expect(out).not.toContain('Unknown item');
    expect(out).toContain(`== Patrol Detachment (Mini Faction) ==\n\n${FOOTER}`);
  });

  test('numbers use en-GB separators and a negative CP prints as is', () => {
    const view = evaluate(scope, empty());
    const big: RosterView = { ...view, total: { [COST_PTS]: 12345, [COST_PL]: 1234, [COST_CP]: -3 } };
    expect(exportText(big, scope).split('\n')[1]).toBe('Mini Faction · Strike Force · 12,345 / 2,000 pts · 1,234 PL · -3 CP');
  });
});
