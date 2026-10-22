import { PHASE_STEPS, stateOf, type CurrentStep, type GameState, type Phase, type Step } from '@recruit/engine';
import { describe, expect, test } from 'vitest';
import { deployedGame } from '../__fixtures__/game';
import { hintFor } from './hints';

const base = stateOf(deployedGame());
const at = (phase: Phase, step: Step, pending: CurrentStep['pending'] = null): [GameState, CurrentStep] => [
  { ...base, phase, step, pending } as GameState,
  { round: 1, active: 'A', phase, step, pending, actingPlayer: 'A', involvedUnitIds: [] },
];
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean).length;

describe('hints', () => {
  test('a hint for every phase and step', () => {
    for (const [phase, steps] of Object.entries(PHASE_STEPS) as [Phase, Step[]][]) {
      if (phase === 'ended') continue;
      for (const step of steps) {
        const hint = hintFor(...at(phase, step), null);
        expect(hint, `${phase}/${step}`).toBeTruthy();
        expect(sentences(hint!), hint!).toBeLessThanOrEqual(2);
      }
    }
  });

  test('a roll window hint mentions Command Re-roll', () => {
    const pending = { kind: 'roll' as const, rollId: 'r1', player: 'A' as const, then: { module: 'x', step: 'y', data: {} } };
    expect(hintFor(...at('shooting', 'main', pending), null)).toMatch(/Command Re-roll/);
  });

  test('movement hints change once a unit is picked', () => {
    const none = hintFor(...at('movement', 'move-units'), null);
    const picked = hintFor(...at('movement', 'move-units'), 'A:war');
    expect(none).toMatch(/Tap one of your units/);
    expect(picked).toMatch(/Advance/);
  });

  test('during a move the hint is about dragging, whoever is selected', () => {
    const [s, step] = at('movement', 'move-units');
    const moving = { ...s, activation: { kind: 'move', unitId: 'A:war', moveKind: 'normal', bonus: 0, rolled: true } } as GameState;
    expect(hintFor(moving, step, null)).toMatch(/^Drag the models/);
  });

  test('no hint once the game is over', () => {
    expect(hintFor(...at('ended', 'main'), null)).toBeNull();
  });
});
