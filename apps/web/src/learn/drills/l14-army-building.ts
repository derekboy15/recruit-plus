/** Lesson 14: fix a Patrol Detachment with the real list builder, then test the Rule of Three with its own checks. */
import { addUnit, availableUnits, explain, FORCE, validate, type Issue, type Roster } from '@recruit/data/roster';
import { startingRoster } from '../../lists/newListSetup';
import type { ListDrill, ListWatch, ListWorld } from '../drill/types';
import { yesNo } from './helpers';
import { ULTRA } from './scenario';

const PICKER = ['Intercessor Squad', 'Assault Intercessor Squad', 'Hellblaster Squad'];

const issues = (w: ListWorld): Issue[] => validate(w.scope, w.roster, w.policy).issues;
const slotMin = (w: ListWorld) => issues(w).find((i) => i.rule === 'slot-min');
const words = (w: ListWorld, i: Issue) => explain(i, validate(w.scope, w.roster, w.policy).view, w.scope).text;
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** A Strike Force (Arks of Omen) roster with `n` copies of a datasheet: does the builder flag the Rule of Three? */
function ruleOfThree(w: ListWatch, unit: string, n: number): boolean {
  const { scope, policy } = w.world;
  let r: Roster = startingRoster(scope, { name: 'Rule of Three', catalogueId: w.world.roster.catalogueId, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  const entry = availableUnits(scope, r, r.forces[0].id).find((u) => u.name === unit)!.entryId;
  for (let i = 0; i < n; i++) r = addUnit(scope, r, r.forces[0].id, entry).roster;
  return validate(scope, r, policy).issues.some((i) => i.rule === 'rule-of-three');
}

const MISSING = [
  { id: 'troops', label: 'A Troops unit', role: 'Troops' },
  { id: 'elites', label: 'An Elites unit', role: 'Elites' },
  { id: 'hq', label: 'A second HQ unit', role: 'HQ' },
  { id: 'none', label: 'Nothing: it is ready', role: null },
];

export const armyBuilding: ListDrill = {
  kind: 'list',
  id: 'army-building',
  title: 'Build a Patrol',
  intro: 'An Ultramarines Combat Patrol: one Patrol Detachment holding a single Captain (HQ). The army builder below checks the list as you go.',
  catalogue: ULTRA,
  build: ({ scope, policy, catalogueId }) => {
    let roster = startingRoster(scope, { name: 'Ultramarines Combat Patrol', catalogueId, sizeId: 'combat-patrol', forceId: FORCE.patrol });
    const units = availableUnits(scope, roster, roster.forces[0].id);
    roster = addUnit(scope, roster, roster.forces[0].id, units.find((u) => u.name === 'Captain')!.entryId).roster;
    const picker = PICKER.map((name) => units.find((u) => u.name === name)!).map((u) => ({ entryId: u.entryId, name: u.name, role: u.role }));
    return { roster, scope, policy, picker };
  },
  stages: [
    {
      kind: 'ask',
      id: 'missing',
      question: () => 'Your Patrol has one Captain, an HQ unit. What does it still need?',
      choices: () => MISSING.map(({ id, label }) => ({ id, label })),
      answer: (w) => MISSING.find((m) => m.role === (slotMin(w.world)?.subject.name ?? null))?.id ?? 'none',
      explain: (w) => {
        const i = slotMin(w.world);
        const m = MISSING.find((x) => x.role === (i?.subject.name ?? null));
        return i ? `${m?.label ?? i.subject.name}: ${lowerFirst(words(w.world, i))}` : 'Nothing: it has what a Patrol needs.';
      },
    },
    {
      kind: 'do',
      id: 'add',
      prompt: () => 'Add a unit from the list below so that the Patrol has what it needs.',
      check: (w) =>
        w.attempts.length && !slotMin(w.world)
          ? {
              pass: true,
              explain:
                'Your Patrol now has its HQ and Troops, so every unit is in a legal detachment: the army is Battle-forged. (It still needs a Warlord: in the list builder, open a CHARACTER and turn on Warlord.)',
            }
          : null,
    },
    {
      kind: 'ask',
      id: 'rule-of-three',
      question: () => 'In a Strike Force army, could you take 4 Hellblaster Squads?',
      choices: yesNo,
      answer: (w) => (ruleOfThree(w, 'Hellblaster Squad', 4) ? 'no' : 'yes'),
      explain: () => 'No: the Rule of Three allows at most 3 units from the same datasheet in a Strike Force army (the Rule of Two allows 2 at Incursion).',
    },
    {
      kind: 'ask',
      id: 'troops-exempt',
      question: () => 'And 4 Intercessor Squads?',
      choices: yesNo,
      answer: (w) => (ruleOfThree(w, 'Intercessor Squad', 4) ? 'no' : 'yes'),
      explain: () => 'Yes: Troops units (and Dedicated Transports) don’t count towards the Rule of Three.',
    },
  ],
};
