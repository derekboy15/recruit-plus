import { expect, test } from 'vitest';
import { testSetup } from './__fixtures__/setup';
import { armyEntries } from './armyEntries';

test('only players with a list, first turn first', () => {
  const setup = testSetup();
  setup.players.A.listId = 'list-1';
  expect(armyEntries(setup)).toEqual([{ player: 'A', listId: 'list-1', label: 'Your army' }]);
  setup.players.B.listId = 'list-2';
  setup.players.B.name = 'Sam';
  expect(armyEntries(setup).map((e) => e.label)).toEqual(['Your army', 'Sam’s army']);
  expect(armyEntries({ ...setup, firstTurn: 'B' }).map((e) => e.player)).toEqual(['B', 'A']);
});

test('no lists, no entries (games set up from factions only, or saved before lists were stored)', () => expect(armyEntries(testSetup())).toEqual([]));
