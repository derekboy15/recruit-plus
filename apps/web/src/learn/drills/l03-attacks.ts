/** Lesson 3: the attack sequence with real dice: work out the rolls needed, then count the hits and wounds yourself. */
import { bestSave, livingModels, stateOf, strengthOf, woundNeeded, type Command, type GameState } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { charsIn, inches, numberChoices, openRoll, passingDice, plural, rollChoices, weaponOf } from './helpers';
import { advanceTo, gapBetween, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

const SQUAD = 'A:int';
const ENEMY = 'B:war';
const RIFLE = 'Bolt rifle';
const BASE = 32 / 25.4;

const rifle = (s: GameState) => weaponOf(s, SQUAD, RIFLE);
const strength = (s: GameState) => strengthOf(charsIn(s, SQUAD, 'Intercessor'), rifle(s));
const toughness = (s: GameState) => charsIn(s, ENEMY).T;
const saveNeeded = (s: GameState) => {
  const save = bestSave(charsIn(s, ENEMY), null, rifle(s).ap, 0, 0, false)!;
  return save.needed - save.mod;
};
const destroyed = (s: GameState, start: GameState) => livingModels(start, ENEMY).length - livingModels(s, ENEMY).length;
const shootingOver = (s: GameState) => !s.pending && !s.activation;

export const attacks: Drill = {
  id: 'attacks',
  title: 'Hits and wounds',
  intro: 'Your Intercessors are 12" from the Necron Warriors. Work out what you need, then roll and count the dice yourself.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 5 } },
            { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 5 + 12 + BASE } },
          ],
        },
        ctx,
      ),
      { phase: 'shooting' },
    ),
  stages: [
    {
      kind: 'ask',
      id: 'wound',
      question: (w) => `A bolt rifle has Strength ${strength(w.state)}. A Necron Warrior has Toughness ${toughness(w.state)}. What do you need to roll to wound?`,
      choices: rollChoices,
      answer: (w) => `${woundNeeded(strength(w.state), toughness(w.state))}+`,
      explain: (w) => {
        const [s, t] = [strength(w.state), toughness(w.state)];
        const how = s >= 2 * t ? 'is at least double' : s > t ? 'is higher than' : s === t ? 'equals' : s * 2 <= t ? 'is half or less of' : 'is lower than';
        return `Strength ${s} ${how} Toughness ${t}, so you need ${woundNeeded(s, t)}+ to wound.`;
      },
    },
    {
      kind: 'ask',
      id: 'save',
      question: (w) => `A Warrior saves on ${charsIn(w.state, ENEMY).Sv}+. The bolt rifle has AP ${rifle(w.state).ap}. What does a Warrior need to save?`,
      choices: rollChoices,
      answer: (w) => `${saveNeeded(w.state)}+`,
      explain: (w) => `AP ${rifle(w.state).ap} takes ${-rifle(w.state).ap} off each save roll, so a Warrior needs ${saveNeeded(w.state)}+ instead of ${charsIn(w.state, ENEMY).Sv}+.`,
    },
    {
      kind: 'do',
      id: 'shoot',
      prompt: () => 'Tap your Intercessors and shoot their bolt rifles at the Necron Warriors.',
      guard: (cmd: Command) =>
        cmd.type === 'shoot' && cmd.unitId === SQUAD && cmd.assignments.length > 0 && cmd.assignments.every((a) => a.weapon === RIFLE && a.targetUnitId === ENEMY)
          ? null
          : 'In this drill, shoot the bolt rifles at the Necron Warriors.',
      check: (w) => {
        const roll = openRoll(w.state);
        if (roll?.kind !== 'hit') return null;
        const r = rifle(w.state);
        const n = livingModels(w.state, SQUAD).length;
        return {
          pass: true,
          explain: `${roll.dice.length} shots: the Warriors are within ${inches(r.range! / 2)} (half the bolt rifle’s range), so Rapid Fire ${r.shots.plus} becomes ${r.shots.plus * 2} shots for each of your ${n} Intercessors.`,
        };
      },
    },
    {
      kind: 'ask',
      id: 'hits',
      question: (w) => `Your Intercessors hit on ${charsIn(w.state, SQUAD, 'Intercessor').BS}+ (their Ballistic Skill). How many of these ${openRoll(w.state)?.dice.length} dice hit?`,
      choices: (w) => numberChoices(0, openRoll(w.state)?.dice.length ?? 0),
      answer: (w) => String(passingDice(w.state)),
      explain: (w) => `${plural(passingDice(w.state) ?? 0, 'die hits', 'dice hit')}: every roll of ${charsIn(w.state, SQUAD, 'Intercessor').BS} or more.`,
    },
    {
      kind: 'do',
      id: 'accept-hits',
      prompt: () => 'Accept the hit roll.',
      guard: (cmd) => (cmd.type === 'confirmRoll' ? null : 'Accept the hit roll to go on.'),
      check: (w) => {
        const roll = openRoll(w.state);
        if (roll?.kind === 'wound') return { pass: true, explain: `${plural(roll.dice.length, 'hit goes', 'hits go')} on to the wound roll.` };
        if (shootingOver(w.state)) return { pass: true, explain: 'No hits, so there is nothing to wound this time. Unlucky!' };
        return null;
      },
    },
    {
      kind: 'ask',
      id: 'wounds',
      skip: (w) => openRoll(w.state)?.kind !== 'wound',
      question: (w) => `You need ${woundNeeded(strength(w.state), toughness(w.state))}+ to wound. How many of these dice wound?`,
      choices: (w) => numberChoices(0, openRoll(w.state)?.dice.length ?? 0),
      answer: (w) => String(passingDice(w.state)),
      explain: (w) => `${plural(passingDice(w.state) ?? 0, 'die wounds', 'dice wound')}: every roll of ${woundNeeded(strength(w.state), toughness(w.state))} or more.`,
    },
    {
      kind: 'do',
      id: 'finish',
      skip: (w) => w.answers.wounds === undefined,
      prompt: (w) => `Accept the wound roll. The Necrons then roll their saves: they need ${saveNeeded(w.state)}+.`,
      guard: (cmd) => (cmd.type === 'confirmRoll' ? null : 'Accept the roll to go on.'),
      check: (w) => {
        if (!shootingOver(w.state)) return null;
        const wounds = Number(w.answers.wounds);
        const lost = destroyed(w.state, stateOf(w.start));
        if (!wounds) return { pass: true, explain: 'No wounds, so the Necrons had nothing to save this time.' };
        return {
          pass: true,
          explain: `The Necrons rolled ${plural(wounds, 'save')} needing ${saveNeeded(w.state)}+: ${wounds - lost} saved and ${lost} failed. Each failed save does 1 damage, and a Warrior has 1 Wound, so ${plural(lost, 'Warrior was', 'Warriors were')} destroyed.`,
        };
      },
    },
  ],
};
