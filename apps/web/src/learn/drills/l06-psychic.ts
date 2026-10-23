/** Lesson 6: a Psychic test for Smite with real dice: does it go off, and what do mortal wounds do? */
import { livingModels, stateOf, type GameEvent, type GameState } from '@recruit/engine';
import type { Drill, Watch } from '../drill/types';
import { eventsSince, openRoll, rollTotal, yesNo } from './helpers';
import { advanceTo, NECRONS, scenario, ULTRA, warriors } from './scenario';

const PSYKER = 'A:lib';
const ENEMY = 'B:war';
const BASE = 32 / 25.4;

/** The warp charge in the open Psychic test's description, e.g. "Psychic test for Smite (5+)". */
const warpCharge = (s: GameState) => Number(/\((\d+)\+\)/.exec(openRoll(s)?.context ?? '')?.[1]);
const doubled = (s: GameState) => {
  const r = openRoll(s)!;
  const [a, b] = r.dice.map((d) => d.value);
  return a === b && (a === 1 || a === 6) ? a : null;
};
type E<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
const mortalOn = (events: GameEvent[], s: GameState, unitId: string) =>
  events.filter((e): e is E<'woundsLost'> => e.type === 'woundsLost' && e.mortal && s.units[s.models[e.modelId].unitId]?.id === unitId).reduce((a, e) => a + e.wounds, 0);

export const psychic: Drill = {
  id: 'psychic',
  title: 'Smite the Warriors',
  intro: 'Your Librarian is a PSYKER, 10" from the Necron Warriors. Every psyker knows Smite.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: PSYKER, player: 'A', sheet: [ULTRA, 'Librarian'], models: [{ profile: 'Librarian', weapons: ['Bolt pistol', 'Force sword'], count: 1 }], at: { x: 22, y: 6 } },
            { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 6 + 10 + BASE } },
          ],
        },
        ctx,
      ),
      { phase: 'psychic' },
    ),
  stages: [
    {
      kind: 'do',
      id: 'manifest',
      prompt: () => 'Tap your Librarian and attempt Smite.',
      guard: (cmd) => (cmd.type === 'manifest' && cmd.unitId === PSYKER && cmd.power.toLowerCase() === 'smite' ? null : 'In this drill, attempt Smite with your Librarian.'),
      check: (w) => {
        const r = openRoll(w.state);
        if (r?.kind !== 'psychic') return null;
        const [a, b] = r.dice.map((d) => d.value);
        return { pass: true, explain: `Psychic test: you rolled ${a} and ${b}, a total of ${a + b}.` };
      },
    },
    {
      kind: 'ask',
      id: 'goes-off',
      question: (w) => `Smite has a warp charge of ${warpCharge(w.state)}. You rolled ${rollTotal(openRoll(w.state)!)}. Does it go off?`,
      choices: yesNo,
      answer: (w) => (rollTotal(openRoll(w.state)!) >= warpCharge(w.state) ? 'yes' : 'no'),
      explain: (w) => {
        const t = rollTotal(openRoll(w.state)!);
        const wc = warpCharge(w.state);
        const d = doubled(w.state);
        const perils = d ? ` But a double ${d} means Perils of the Warp!` : '';
        return t >= wc ? `Yes: ${t} is at least the warp charge of ${wc}.${perils}` : `No: ${t} is less than the warp charge of ${wc}.${perils}`;
      },
    },
    {
      kind: 'do',
      id: 'resolve',
      prompt: () => 'Accept the roll and see what happens.',
      guard: (cmd) => (cmd.type === 'confirmRoll' ? null : 'Accept the roll to go on.'),
      check: (w) => {
        const events = eventsSince(w.stageStart, w.record);
        const done = events.find((e): e is E<'powerManifested'> | E<'powerFailed'> => e.type === 'powerManifested' || e.type === 'powerFailed');
        if (!done || w.state.pending) return null;
        const start = stateOf(w.stageStart);
        const perilsWounds = mortalOn(events, w.state, PSYKER);
        const perils = perilsWounds ? `Perils of the Warp: your Librarian suffered ${perilsWounds} mortal wound${perilsWounds === 1 ? '' : 's'}. ` : '';
        if (done.type === 'powerFailed') return { pass: true, explain: `${perils}The Psychic test failed, so the power has no effect.` };
        const mw = mortalOn(events, w.state, ENEMY);
        const lost = livingModels(start, ENEMY).length - livingModels(w.state, ENEMY).length;
        const dice = done.total >= 11 ? 'a D6, because the test was 11 or more' : 'a D3';
        return {
          pass: true,
          explain: `${perils}Smite went off. The Warriors, the closest visible enemy unit within 18", suffered ${mw} mortal wound${mw === 1 ? '' : 's'} (${dice}), and ${lost} Warrior${lost === 1 ? ' was' : 's were'} destroyed.`,
        };
      },
    },
    {
      kind: 'ask',
      id: 'saves',
      skip: (w: Watch) => !eventsSince(w.start, w.record).some((e) => e.type === 'powerManifested'),
      question: () => 'Did the Warriors get a saving throw against Smite?',
      choices: yesNo,
      answer: (w) => (eventsSince(w.start, w.record).some((e) => e.type === 'diceRolled' && e.roll.kind === 'save') ? 'yes' : 'no'),
      explain: () => 'No: mortal wounds skip the wound roll and every saving throw.',
    },
  ],
};
