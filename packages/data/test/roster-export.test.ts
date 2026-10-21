import { describe, expect, test } from 'vitest';
import {
  addChild,
  addForce,
  addUnit,
  buildScope,
  chooseInGroup,
  createRoster,
  evaluate,
  exportText,
  FORCE,
  unitExport,
  UNTITLED_LIST,
  setCount,
  splitSelection,
  COST_CP,
  COST_PL,
  COST_PTS,
  type Roster,
  type RosterView,
  type Scope,
} from '../src/roster';
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
