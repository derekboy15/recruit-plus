/** Lesson 2: read M, Sv and a weapon profile off real datasheets, then fire the shots you worked out. */
import type { Command } from '@recruit/engine';
import type { Drill } from '../drill/types';
import { charsIn, inches, moveOf, openRoll, plural, rollChoices, weaponOf } from './helpers';
import { advanceTo, gapBetween, intercessors, NECRONS, scenario, ULTRA, warriors } from './scenario';

const SQUAD = 'A:int';
const ENEMY = 'B:war';
const RIFLE = 'Bolt rifle';
const BASE = 32 / 25.4;

export const datasheets: Drill = {
  id: 'datasheets',
  title: 'Read the datasheet',
  intro: 'Every answer is on a datasheet: open it under each question. Then your Intercessors open fire.',
  catalogues: [ULTRA, NECRONS],
  learner: 'A',
  build: (ctx) =>
    advanceTo(
      scenario(
        {
          units: [
            { id: SQUAD, player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 5 } },
            { id: ENEMY, player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 5 + 18 + BASE } },
          ],
        },
        ctx,
      ),
      { phase: 'shooting' },
    ),
  stages: [
    {
      kind: 'ask',
      id: 'move',
      datasheet: () => SQUAD,
      question: () => 'How far can an Intercessor move in a Normal Move? Look for M on the datasheet.',
      choices: () => [4, 5, 6, 7].map((n) => ({ id: `${n}"`, label: `${n}"` })),
      answer: (w) => inches(moveOf(charsIn(w.state, SQUAD, 'Intercessor'))),
      explain: (w) => {
        const m = inches(moveOf(charsIn(w.state, SQUAD, 'Intercessor')));
        return `M is ${m}: an Intercessor moves up to ${m} in a Normal Move.`;
      },
    },
    {
      kind: 'ask',
      id: 'save',
      datasheet: () => ENEMY,
      question: () => 'What does a Necron Warrior need to roll to save a wound, before the weapon’s AP? Look for Sv.',
      choices: rollChoices,
      answer: (w) => `${charsIn(w.state, ENEMY).Sv}+`,
      explain: (w) => {
        const sv = charsIn(w.state, ENEMY).Sv;
        return `Sv is ${sv}+: a Necron Warrior saves on a roll of ${sv} or more, before AP.`;
      },
    },
    {
      kind: 'ask',
      id: 'shots',
      datasheet: () => SQUAD,
      question: (w) => {
        const r = weaponOf(w.state, SQUAD, RIFLE);
        return `The Warriors are ${inches(gapBetween(w.state, SQUAD, ENEMY))} away. A bolt rifle is ${r.type} ${r.shots.plus} with a range of ${r.range}". How many shots does each Intercessor fire?`;
      },
      choices: () => [
        { id: '1', label: '1 shot' },
        { id: '2', label: '2 shots' },
      ],
      answer: (w) => {
        const r = weaponOf(w.state, SQUAD, RIFLE);
        return String(gapBetween(w.state, SQUAD, ENEMY) <= r.range! / 2 ? r.shots.plus * 2 : r.shots.plus);
      },
      explain: (w) => {
        const r = weaponOf(w.state, SQUAD, RIFLE);
        const gap = gapBetween(w.state, SQUAD, ENEMY);
        const close = gap <= r.range! / 2;
        return close
          ? `Each fires ${r.shots.plus * 2} shots: the Warriors are within half range (${inches(r.range! / 2)}), so Rapid Fire doubles the shots.`
          : `Each fires ${plural(r.shots.plus, 'shot')}. Rapid Fire doubles the shots only within half range (${inches(r.range! / 2)}), and the Warriors are ${inches(gap)} away.`;
      },
    },
    {
      kind: 'do',
      id: 'shoot',
      prompt: () => 'Tap your Intercessors and shoot their bolt rifles at the Necron Warriors.',
      guard: (cmd: Command) => {
        if (cmd.type !== 'shoot') return 'In this drill, shoot the bolt rifles at the Necron Warriors.';
        const ok = cmd.unitId === SQUAD && cmd.assignments.length > 0 && cmd.assignments.every((a) => a.weapon === RIFLE && a.targetUnitId === ENEMY);
        return ok ? null : 'In this drill, shoot the bolt rifles at the Necron Warriors.';
      },
      check: (w) => {
        const roll = openRoll(w.state);
        if (!roll || roll.kind !== 'hit') return null;
        const models = new Set(w.state.units[SQUAD].modelIds.filter((id) => !w.state.models[id].destroyed)).size;
        return { pass: true, explain: `${models} Intercessors, ${plural(roll.dice.length / models, 'shot')} each: ${roll.dice.length} hit rolls, one die for each shot.` };
      },
    },
  ],
};
