import { expect, test } from 'vitest';
import { factionLabel, factionMatches } from './factionSearch';

const cat = (name: string) => ({ name });
const ULTRAMARINES = cat('Imperium - Adeptus Astartes - Ultramarines');

test('space marines finds every chapter and Chaos Space Marines', () => {
  expect(factionMatches(ULTRAMARINES, 'space marines')).toBe(true);
  expect(factionMatches(cat('Imperium - Adeptus Astartes - Space Wolves'), 'Space Marines')).toBe(true);
  expect(factionMatches(cat('Chaos - Chaos Space Marines'), 'space marines')).toBe(true);
  expect(factionMatches(cat('Necrons'), 'space marines')).toBe(false);
});

test('a partial alias works from three letters', () => {
  expect(factionMatches(ULTRAMARINES, 'space mar')).toBe(true);
  expect(factionMatches(ULTRAMARINES, 'ast')).toBe(true);
  expect(factionMatches(ULTRAMARINES, 'as')).toBe(false);
});

test("apostrophes and case don't matter", () => {
  expect(factionMatches(cat("T'au Empire"), 'tau')).toBe(true);
  expect(factionMatches(cat("T'au Empire"), "T'AU")).toBe(true);
  expect(factionMatches(cat("T'au Empire"), 'T’au')).toBe(true);
});

test('guard finds the Astra Militarum and the Raven Guard', () => {
  expect(factionMatches(cat('Imperium - Astra Militarum'), 'guard')).toBe(true);
  expect(factionMatches(cat('Imperium - Adeptus Astartes - Raven Guard'), 'guard')).toBe(true);
  expect(factionMatches(cat('Imperium - Astra Militarum'), 'imperial guard')).toBe(true);
  expect(factionMatches(cat('Orks'), 'guard')).toBe(false);
});

test('eldar finds Craftworlds and Drukhari', () => {
  expect(factionMatches(cat('Aeldari - Craftworlds'), 'eldar')).toBe(true);
  expect(factionMatches(cat('Aeldari - Drukhari'), 'eldar')).toBe(true);
  expect(factionMatches(cat('Aeldari - Drukhari'), 'dark eldar')).toBe(true);
  expect(factionMatches(cat('Necrons'), 'eldar')).toBe(false);
});

test('older and everyday names find their factions', () => {
  expect(factionMatches(cat('Imperium - Adepta Sororitas'), 'sisters')).toBe(true);
  expect(factionMatches(cat('Imperium - Adeptus Mechanicus'), 'admech')).toBe(true);
  expect(factionMatches(cat('Chaos - Daemons'), 'demons')).toBe(true);
  expect(factionMatches(cat('Leagues of Votann'), 'squats')).toBe(true);
});

test('an empty search matches everything', () => {
  expect(factionMatches(cat('Necrons'), '   ')).toBe(true);
});

test('factionLabel drops the Legends tag and names chapters', () => {
  expect(factionLabel(cat('Chaos - Renegades & Heretics [LEGENDS]'))).toEqual({ name: 'Renegades & Heretics', legends: true, family: null });
  expect(factionLabel(ULTRAMARINES)).toEqual({ name: 'Ultramarines', legends: false, family: 'Space Marines' });
  expect(factionLabel(cat('Necrons'))).toEqual({ name: 'Necrons', legends: false, family: null });
});
