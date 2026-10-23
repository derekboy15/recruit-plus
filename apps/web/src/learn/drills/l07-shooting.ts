/** Lesson 7: choosing targets: line of sight through ruins, Look Out, Sir, Light Cover and Blast. */
import { bestSave, blastShots, coverFor, livingModels, modelView, parseDice, placedModel, unitVisibleTo, unitView, type GameState } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { charsIn, numberChoices, openRoll, refused, rollChoices, weaponOf } from './helpers';
import { advanceTo, intercessors, NECRONS, scenario, terrainBox, ULTRA, warriors } from './scenario';

const SQUAD = 'A:int';
const CRATER = 'B:war';
const HIDDEN = 'B:war2';
const LORD = 'B:lord';
const ENEMIES = [CRATER, HIDDEN, LORD];
const RUINS = terrainBox('ruins', 22, 11, 42, 17, 6, 'Ruins');
const CRATER_AREA = terrainBox('craters', 9.5, 17, 18.5, 21, 0.5, 'Crater');

const label = (id: string) => ({ [CRATER]: 'Necron Warriors (in the crater)', [HIDDEN]: 'Necron Warriors (behind the ruins)', [LORD]: 'Overlord' })[id]!;
const seenBySquad = (s: GameState, target: string) => livingModels(s, SQUAD).some((m) => unitVisibleTo(modelView(s, m), unitView(s, target), s.setup.terrain));
/** What a Warrior in the crater needs to save a bolt rifle hit, with the cover the engine gives it. */
function craterSave(s: GameState): number {
  const warrior = livingModels(s, CRATER)[0];
  const shooter = livingModels(s, SQUAD)[0];
  const light = coverFor(modelView(s, warrior), placedModel(s, shooter), 'ranged', s.setup.terrain).light ? 1 : 0;
  const save = bestSave(charsIn(s, CRATER), null, weaponOf(s, SQUAD, 'Bolt rifle').ap, light, 0, false)!;
  return save.needed - save.mod;
}

export const shooting: Drill = {
  id: 'shooting',
  title: 'Choose your target',
  intro: 'Three Necron units, and your Intercessors can only shoot some of them. Find out which, and why.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 6 } },
            { id: CRATER, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 14, y: 18 } },
            { id: HIDDEN, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 34, y: 20.5 } },
            {
              id: LORD,
              player: 'B',
              sheet: [NECRONS, 'Overlord'],
              models: [{ profile: 'Overlord', weapons: ['Staff of Light (Shooting)', 'Staff of Light (Melee)'], count: 1 }],
              // Behind the Warriors in the crater: their back row's bases end at y = 19.5 + 0.63; 2" further, then the 40mm base's radius.
              at: { x: 14, y: 19.5 + 16 / 25.4 + 2 + 20 / 25.4 },
            },
          ],
          terrain: [RUINS, CRATER_AREA],
        },
        ctx,
      ),
      { phase: 'shooting' },
    ),
  stages: [
    {
      kind: 'ask',
      id: 'hidden',
      question: () => 'Which Necron unit can’t your Intercessors see?',
      choices: () => ENEMIES.map((id) => ({ id, label: label(id) })),
      answer: (w) => ENEMIES.find((id) => !seenBySquad(w.state, id)) ?? 'none',
      explain: () => `The Warriors behind the ruins: the ruins are Obscuring and ${RUINS.height}" tall, and models can’t see through or over Obscuring terrain 5" or taller.`,
    },
    {
      kind: 'do',
      id: 'try-overlord',
      prompt: () => 'The Overlord is in plain sight. Try it: tap your Intercessors and shoot their bolt rifles at the Overlord.',
      guard: (cmd) => (cmd.type === 'shoot' && cmd.unitId === SQUAD && cmd.assignments.every((a) => a.targetUnitId === LORD) ? null : 'In this drill, try shooting the Overlord first.'),
      check: (w) => {
        if (!refused(w, 'shoot').some((a) => a.problems!.some((p) => p.code === 'look-out-sir'))) return null;
        return {
          pass: true,
          explain: `Look Out, Sir: the Overlord is a CHARACTER with ${charsIn(w.state, LORD).W} Wounds, within 3" of the Necron Warriors (a unit of 3 or more models), and it isn’t the closest enemy unit, so it can’t be shot.`,
        };
      },
    },
    {
      kind: 'ask',
      id: 'cover-save',
      question: (w) =>
        `The Warriors in the crater save on ${charsIn(w.state, CRATER).Sv}+. The bolt rifle has AP ${weaponOf(w.state, SQUAD, 'Bolt rifle').ap}, and the crater gives Light Cover: +1 to saves against shooting. What do they need?`,
      choices: rollChoices,
      answer: (w) => `${craterSave(w.state)}+`,
      explain: (w) =>
        `${craterSave(w.state)}+: AP ${weaponOf(w.state, SQUAD, 'Bolt rifle').ap} makes their ${charsIn(w.state, CRATER).Sv}+ save a ${charsIn(w.state, CRATER).Sv! + 1}+, and Light Cover adds 1 back against shooting.`,
    },
    {
      kind: 'ask',
      id: 'blast',
      question: () => 'Your Intercessors also carry frag grenades: D6 shots, with Blast. Thrown at the 10 Warriors in the crater, the D6 rolls a 2. How many shots?',
      choices: () => numberChoices(1, 6),
      answer: (w) => String(blastShots(parseDice('D6')!, 2, livingModels(w.state, CRATER).length)),
      explain: (w) => `${blastShots(parseDice('D6')!, 2, livingModels(w.state, CRATER).length)}: against a unit of 6 to 10 models, a Blast weapon always makes at least 3 attacks.`,
    },
    {
      kind: 'do',
      id: 'shoot',
      prompt: () => 'Now shoot the bolt rifles at a target you can hit.',
      guard: (cmd) => (cmd.type === 'shoot' && cmd.unitId === SQUAD ? null : 'In this drill, shoot with the Intercessors.'),
      check: (w) => (openRoll(w.state)?.kind === 'hit' ? { pass: true, explain: 'The Warriors in the crater are visible and in range, so the shot goes ahead.' } : null),
    },
  ],
};
