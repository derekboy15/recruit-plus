import { PHASE_ORDER } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { realCatalogue } from '../__fixtures__/game';
import { PHASE_WORDS, relevantAbilities } from './abilities';

const warriors = realCatalogue('necrons').units.find((u) => u.name === 'Necron Warriors')!;

describe('relevant abilities', () => {
  test('Reanimation Protocols ("shoots or fights") comes first in the Shooting and Fight phases; Objective Secured goes last', () => {
    for (const phase of ['shooting', 'fight'] as const) {
      const names = relevantAbilities(warriors, phase).map((a) => a.name);
      expect(names[0]).toBe('Reanimation Protocols');
      expect(names.at(-1)).toBe('Objective Secured');
      expect(names).toHaveLength(warriors.abilities.length);
    }
  });

  test('in the Command phase Command Protocols comes first', () => {
    expect(relevantAbilities(warriors, 'command')[0].name).toBe('Command Protocols');
  });

  test('every phase has a word list', () => {
    for (const phase of PHASE_ORDER) expect(PHASE_WORDS[phase]).toBeInstanceOf(RegExp);
  });
});
