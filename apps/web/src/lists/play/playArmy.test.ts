import type { SelView } from '@recruit/data/roster';
import { unitSummary } from '@recruit/data/roster';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { datasheet, novokhIncursionData, unitNamed, viewOf } from './__fixtures__/playList';
import { playArmy, takenWeapons } from './playArmy';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

test('the fixture: Novokh Incursion with an Overlord Warlord', async () => {
  const { view } = await viewOf(await novokhIncursionData());
  expect(unitSummary(unitNamed(view, 'Overlord')).warlord).toBe(true);
  expect(view.roster.battleSize).toBe('incursion');
});

test('taken weapons match profiles by name, by "name (mode)", ignoring case and apostrophes', async () => {
  const { view, units } = await viewOf(await novokhIncursionData());
  const warriors = unitNamed(view, 'Necron Warriors');
  // The count the unit carries comes along, so the weapon card reads ×10 (DatasheetView parses "10x ").
  expect(takenWeapons(warriors, datasheet(units, 'Necron Warriors'))).toEqual(['10x Gauss Flayer']);
  const fake = (names: string[]): SelView => ({
    ...warriors,
    children: names.map((name) => ({ ...warriors.children[0], name, children: [], sel: { ...warriors.children[0].sel, count: 1 } })),
  });
  const overlordSheet = datasheet(units, 'Overlord');
  expect(takenWeapons(fake(['staff of light']), overlordSheet)).toEqual(['Staff of Light (Shooting)', 'Staff of Light (Melee)']);
  expect(takenWeapons(fake(['  Staff  of   Light ']), overlordSheet)).toEqual(['Staff of Light (Shooting)', 'Staff of Light (Melee)']);
  expect(takenWeapons(fake(['Nothing That Matches']), overlordSheet)).toBeUndefined();
});

test('the army: totals, choices, roles in rulebook order, and a flat order for Previous and Next', async () => {
  const data = await novokhIncursionData();
  const { view, scope, units } = await viewOf(data);
  const army = playArmy(view, scope, units);
  expect(army).toMatchObject({ name: 'Novokh Incursion', faction: 'Necrons', sizeName: 'Incursion', pointsLimit: 1000, points: data.summary.points });
  expect(army.choices).toContainEqual(expect.objectContaining({ heading: 'Dynasty', name: 'Novokh' }));
  expect(army.roles.map((r) => r.role)).toEqual(['HQ', 'Troops', 'Elites']);
  expect(army.units.map((u) => u.name)).toEqual(['Overlord', 'Royal Warden', 'Necron Warriors', 'Immortals', 'Skorpekh Destroyers']);
  const warriors = army.units[2];
  expect(warriors).toMatchObject({ models: 10, points: 110, wargear: ['10x Gauss Flayer'], warlord: false, warlordTrait: null, taken: ['10x Gauss Flayer'] });
  expect(warriors.unit?.name).toBe('Necron Warriors');
  expect(army.units[0]).toMatchObject({ warlord: true, warlordTrait: null }); // Arks of Omen: no trait without the requisition
  const s = unitSummary(unitNamed(view, 'Overlord'));
  expect(army.units[0].wargear).toEqual([...s.gear, ...s.relics, ...s.other]);
});

test('two detachments merge under their roles, in detachment order', async () => {
  const { view, scope, units } = await viewOf(await novokhIncursionData({ secondDetachment: true }));
  const army = playArmy(view, scope, units);
  expect(army.roles.find((r) => r.role === 'Fast Attack')!.units.map((u) => u.name)).toEqual(['Canoptek Scarab Swarms']);
  expect(army.units.at(-1)!.name).toBe('Canoptek Scarab Swarms');
});

test('a unit with no datasheet is still listed', async () => {
  const { view, scope } = await viewOf(await novokhIncursionData());
  const army = playArmy(view, scope, null); // no unit index: no datasheets at all
  expect(army.units).toHaveLength(5);
  expect(army.units.every((u) => u.unit === null && u.taken === undefined)).toBe(true);
});

test('an item the rules data no longer has is listed by name and points, with no datasheet', async () => {
  const data = await novokhIncursionData();
  const [force] = data.roster.forces;
  data.roster = { ...data.roster, forces: [{ ...force, selections: [...force.selections, { id: 'gone-1', entryId: 'no-such-entry', count: 1, children: [] }] }] };
  const { view, scope, units } = await viewOf(data);
  const gone = playArmy(view, scope, units).units.find((u) => u.selId === 'gone-1');
  expect(gone).toMatchObject({ name: 'Unknown item', role: 'Other', points: 0, unit: null, taken: undefined, wargear: [] });
});

test('curly and straight apostrophes match each other', () => {
  const unit = { weapons: [{ name: "Tesla Lord's Staff", chars: {} }, { name: 'Other Gun', chars: {} }] } as never;
  const v = { children: [{ name: 'Tesla Lord’s Staff', sel: { count: 1 }, children: [] }] } as never;
  expect(takenWeapons(v, unit)).toEqual(["Tesla Lord's Staff"]);
});
