import type { SelView } from '@recruit/data/roster';
import { unitSummary } from '@recruit/data/roster';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { datasheet, novokhIncursionData, unitNamed, viewOf } from './__fixtures__/playList';
import { takenWeapons } from './playArmy';

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

test('curly and straight apostrophes match each other', () => {
  const unit = { weapons: [{ name: "Tesla Lord's Staff", chars: {} }, { name: 'Other Gun', chars: {} }] } as never;
  const v = { children: [{ name: 'Tesla Lord’s Staff', sel: { count: 1 }, children: [] }] } as never;
  expect(takenWeapons(v, unit)).toEqual(["Tesla Lord's Staff"]);
});
