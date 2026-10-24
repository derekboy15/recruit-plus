import { expect, test } from 'vitest';
import { phaseRank, sortPhases } from './phases';
import { capitalised } from './guideText';

test('phases sort in game order, then the enemy turn, then triggers, then anything else A to Z', () => {
  expect(
    sortPhases([
      'Any time',
      'Enemy Fight phase',
      'Zebra',
      'Fight phase',
      'Taking casualties',
      'Before battle',
      'Morale phase',
      'Command phase',
      'Enemy Command phase',
      'During deployment',
      'Alpha',
      'End of your turn',
    ]),
  ).toEqual([
    'Before battle',
    'During deployment',
    'Command phase',
    'Fight phase',
    'Morale phase',
    'End of your turn',
    'Enemy Command phase',
    'Enemy Fight phase',
    'Taking casualties',
    'Any time',
    'Alpha',
    'Zebra',
  ]);
});

test('phaseRank puts unknown phases last', () => {
  expect(phaseRank('Command phase')).toBeLessThan(phaseRank('Enemy Command phase'));
  expect(phaseRank('Something new')).toBeGreaterThan(phaseRank('Any time'));
});

test('capitalised upper-cases the first letter of the first text, wherever it sits', () => {
  expect(capitalised([{ t: 'text', v: 'each turn' }])).toEqual([{ t: 'text', v: 'Each turn' }]);
  expect(capitalised([{ t: 'b', c: [{ t: 'text', v: 'core' }] }, { t: 'text', v: ' units' }])).toEqual([
    { t: 'b', c: [{ t: 'text', v: 'Core' }] },
    { t: 'text', v: ' units' },
  ]);
  expect(capitalised([])).toEqual([]);
});
