import { describe, expect, test } from 'vitest';
import { mission } from './__fixtures__/missions';
import { prompts } from './checklist';
import type { Pos, TablePhase } from './game';

const aoo = mission('aoo-cleanse-the-land');
const cb = mission('cb-incisive-attack');
const texts = (pack: 'arks-of-omen' | 'core-book', pos: Pos) => prompts({ pack, pos, mission: pack === 'core-book' ? cb : aoo }).map((p) => p.text).join('\n');

describe('phase prompts', () => {
  test('round 1 movement says no reserves arrive', () => {
    expect(texts('arks-of-omen', { round: 1, turn: 1, phase: 'movement' })).toMatch(/can't arrive from Strategic Reserves or as Reinforcements in the first battle round/);
    expect(texts('arks-of-omen', { round: 1, turn: 1, phase: 'movement' })).not.toMatch(/Any units arriving/);
  });
  test('round 2 movement asks about Strategic Reserves, with the round-2 edge rule', () => {
    const t = texts('arks-of-omen', { round: 2, turn: 1, phase: 'movement' });
    expect(t).toMatch(/Any units arriving from Strategic Reserves this turn\?/);
    expect(t).toMatch(/not in your opponent's deployment zone/);
  });
  test('round 3 movement warns reserves are destroyed at end of round', () => {
    const t = texts('core-book', { round: 3, turn: 2, phase: 'movement' });
    expect(t).toMatch(/not on the battlefield by the end of this battle round count as destroyed/);
    expect(t).not.toMatch(/not in your opponent's deployment zone/);
  });
  test('Command phase CP wording follows the pack', () => {
    expect(texts('arks-of-omen', { round: 1, turn: 1, phase: 'command' })).toMatch(/Both players gain 1 CP/);
    expect(texts('core-book', { round: 1, turn: 1, phase: 'command' })).toMatch(/You gain 1 CP/);
  });
  test('primary scoring reminder from round 2, and the round 5 exception', () => {
    expect(texts('arks-of-omen', { round: 1, turn: 1, phase: 'command' })).not.toMatch(/primary objective/);
    expect(texts('arks-of-omen', { round: 2, turn: 2, phase: 'command' })).toMatch(/score the primary objective at the end of this phase/);
    expect(texts('arks-of-omen', { round: 5, turn: 2, phase: 'command' })).toMatch(/score the primary objective at the end of your turn instead/);
    expect(texts('core-book', { round: 5, turn: 2, phase: 'command' })).toMatch(/score the primary objective at the end of this phase/);
  });
  test('every phase has prompts and every prompt has a source', () => {
    for (const phase of ['command', 'movement', 'psychic', 'shooting', 'charge', 'fight', 'morale'] as TablePhase[]) {
      for (const pack of ['arks-of-omen', 'core-book'] as const) {
        const list = prompts({ pack, pos: { round: 2, turn: 1, phase }, mission: pack === 'core-book' ? cb : aoo });
        expect(list.length, `${pack} ${phase}`).toBeGreaterThan(0);
        for (const p of list) expect(p.source, p.id).toMatch(/\S/);
        expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
      }
    }
  });
});
