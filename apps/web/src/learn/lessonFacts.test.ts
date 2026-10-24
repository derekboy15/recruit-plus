/**
 * Every number a lesson states, pinned three ways: it is in the lesson, it is in the Rules Reference section the lesson
 * leans on, and it is what the engine (or the real data) does.
 */
import type { LessonsData, RulesData } from '@recruit/data/model';
import { TERRAIN_PRESETS, bestSave, blastShots, BOARD_SIZES, capMod, CLOSE_COMBAT_WEAPON, dispatch, hitSucceeds, inCoherency, inEngagementRange, inRangeOfObjective, livingModels, modelView, parseDice, unitView, unitVisibleTo, type Command, MARKER_RADIUS, missionRulesFor, saveSucceeds, stateOf, woundNeeded, type GameState } from '@recruit/engine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { deployedGame, realSheet, ULTRAMARINES } from '../play/__fixtures__/game';
import { diskCtx } from './__fixtures__/drills';
import { advanceTo, intercessors, NECRONS, scenario, terrainBox, ULTRA, warriors, type UnitSpec } from './drills/scenario';

const GENERATED = join(__dirname, '..', '..', '..', '..', 'packages', 'data', 'generated');
const lessons = (JSON.parse(readFileSync(join(GENERATED, 'lessons.json'), 'utf8')) as LessonsData).lessons;
const rules = JSON.parse(readFileSync(join(GENERATED, 'rules.json'), 'utf8')) as RulesData;

/** Curly apostrophes and doubled spaces don’t matter. */
const norm = (t: string) => t.replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
export const lessonText = (id: string) => {
  const l = lessons.find((x) => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return norm([...l.sections.map((s) => s.text), JSON.stringify(l.intro)].join(' '));
};
const sectionText = (ref: string) => {
  const [a, s] = ref.split('#');
  const sec = rules.articles.find((x) => x.id === a)?.sections.find((x) => x.id === s);
  if (!sec) throw new Error(`no section ${ref}`);
  return norm(sec.text);
};

export interface Fact {
  lesson: string;
  /** Exact text that must appear in the lesson. */
  says: string;
  /** Text that must appear in that Rules Reference section. */
  article?: [articleIdAndSection: string, text: string];
  /** expect(...) against the engine or the real data. */
  engine?: () => void;
}

const M = (slug: string, unit: string, profile: string) => {
  const c = realSheet(slug, unit).models.find((p) => p.name === profile)!.chars;
  return c;
};
const moveInches = (c: { M: { kind: string; inches?: number } }) => (c.M.kind === 'fixed' ? c.M.inches : null);

export const FACTS: Fact[] = [
  // ---------- 1. What 40k is ----------
  {
    lesson: 'what-is-40k',
    says: 'A game lasts 5 battle rounds',
    article: ['basics#the-battle-round', 'Most matched play missions last 5 battle rounds'],
    engine: () => expect(missionRulesFor('combat-patrol').battleRounds).toBe(5),
  },
  { lesson: 'what-is-40k', says: 'Each turn has 7 phases, always in this order', article: ['basics#the-battle-round', 'Each turn has seven phases, always in this order'] },
  {
    lesson: 'what-is-40k',
    says: '500 points of models each, on a battlefield 44" by 30"',
    article: ['matched-play#battle-sizes', 'Combat Patrol 500 3 not covered 44" x 30"'],
    engine: () => expect(BOARD_SIZES['combat-patrol']).toEqual({ w: 44, h: 30 }),
  },
  { lesson: 'what-is-40k', says: 'An Intercessor has a Move of 6"', engine: () => expect(moveInches(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor'))).toBe(6) },
  {
    lesson: 'what-is-40k',
    says: 'A model is in range of a marker if it is within 3" of it',
    article: ['matched-play#objective-markers', 'A model is in range of a marker if it is within 3" horizontally'],
    engine: () => {
      // The Lesson 1 drill pins this on the board; here, the engine's measure: base edge to marker edge.
      expect(engineInRange(3.0)).toBe(true);
      expect(engineInRange(3.1)).toBe(false);
    },
  },

  // ---------- 2. Reading a datasheet ----------
  {
    lesson: 'datasheets',
    says: 'Sv 6" 3+ 3+ 4 4 2 2 7 3+',
    engine: () => {
      const c = M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor');
      expect([moveInches(c), c.WS, c.BS, c.S, c.T, c.W, c.A.plus, c.Ld, c.Sv]).toEqual([6, 3, 3, 4, 4, 2, 2, 7, 3]);
    },
  },
  { lesson: 'datasheets', says: 'an Intercessor has a Move of 6"', engine: () => expect(moveInches(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor'))).toBe(6) },
  { lesson: 'datasheets', says: 'an Intercessor has 2 Wounds', engine: () => expect(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor').W).toBe(2) },
  {
    lesson: 'datasheets',
    says: 'An Intercessor saves on 3+; a Necron Warrior saves on 4+',
    engine: () => {
      expect(M(ULTRAMARINES, 'Intercessor Squad', 'Intercessor').Sv).toBe(3);
      expect(M('necrons', 'Necron Warriors', 'Necron Warrior').Sv).toBe(4);
    },
  },
  {
    lesson: 'datasheets',
    says: 'D 30" Rapid Fire 1 4 -1 1',
    engine: () => {
      const w = realSheet(ULTRAMARINES, 'Intercessor Squad').weapons.find((x) => x.name === 'Bolt rifle')!;
      expect([w.range, w.type, w.shots.plus, w.s, w.ap, w.d.plus]).toEqual([30, 'Rapid Fire', 1, { kind: 'fixed', v: 4 }, -1, 1]);
    },
  },
  {
    lesson: 'datasheets',
    says: 'Rapid Fire 1 means 1 shot, doubled when the target is within half range (15" for a bolt rifle)',
    article: ['shooting-phase#weapon-types', "Rapid Fire If the target is within half the weapon's range, the weapon makes double its normal number of attacks."],
  },

  // ---------- 3. The attack sequence and wound table ----------
  {
    lesson: 'attacks',
    says: 'S is double T or more 2+ S is higher than T 3+ S equals T 4+ S is lower than T 5+ S is half T or less 6+',
    article: ['shooting-phase#making-attacks', 'S is double T or more 2+ S is higher than T 3+ S equals T 4+ S is lower than T 5+ S is half T or less 6+'],
    engine: () => expect([woundNeeded(8, 4), woundNeeded(5, 4), woundNeeded(4, 4), woundNeeded(3, 4), woundNeeded(2, 4)]).toEqual([2, 3, 4, 5, 6]),
  },
  {
    lesson: 'attacks',
    says: 'An unmodified 6 always hits and always wounds. An unmodified 1 always fails, for hits, wounds and saves alike.',
    article: ['basics#re-rolls-and-modifiers', 'An unmodified hit roll or wound roll of 6 always succeeds, and an unmodified 1 always fails. An unmodified saving throw of 1 always fails.'],
    engine: () => {
      expect(hitSucceeds(6, 7, -1)).toBe(true);
      expect(hitSucceeds(1, 2, 1)).toBe(false);
      expect(saveSucceeds(1, 2, 3)).toBe(false);
    },
  },
  {
    lesson: 'attacks',
    says: 'A hit roll or wound roll can never be changed by more than +1 or -1 in total',
    article: ['basics#re-rolls-and-modifiers', 'A hit roll or a wound roll can never be modified by more than +1 or -1 in total'],
    engine: () => expect([capMod(3), capMod(-2), capMod(0)]).toEqual([1, -1, 0]),
  },
  {
    lesson: 'attacks',
    says: 'a bolt rifle (S 4) against a Necron Warrior (T 4) wounds on 4+',
    engine: () => expect(woundNeeded(4, M('necrons', 'Necron Warriors', 'Necron Warrior').T)).toBe(4),
  },
  {
    lesson: 'attacks',
    says: "Against the Warriors' 4+ save, AP -1 means they need 5+",
    engine: () => {
      const save = bestSave(M('necrons', 'Necron Warriors', 'Necron Warrior'), null, -1, 0, 0, false)!;
      expect(save.needed - save.mod).toBe(5);
    },
  },
  { lesson: 'attacks', says: 'so Rapid Fire doubles their bolt rifles: 10 shots', article: ['shooting-phase#weapon-types', 'the weapon makes double its normal number of attacks'] },

  // ---------- 4. Command phase and CP ----------
  {
    lesson: 'command-phase',
    says: 'In a Combat Patrol game you start with 3 CP.',
    article: ['matched-play#battle-sizes', 'You start with 3 CP (Combat Patrol)'],
    engine: () => expect(missionRulesFor('combat-patrol').startingCp).toBe(3),
  },
  {
    lesson: 'command-phase',
    says: 'In a Core Book mission (Combat Patrol and Onslaught), only the player whose turn it is gains it.',
    article: ['command-phase#gaining-command-points', 'you only gain this CP in your own Command phase'],
    engine: () => expect([missionRulesFor('combat-patrol').cpEveryCommandPhase, missionRulesFor('onslaught').cpEveryCommandPhase]).toEqual(['active', 'active']),
  },
  {
    lesson: 'command-phase',
    says: 'both players gain 1 CP at the start of every Command phase, and each player starts with 6 CP',
    article: ['command-phase#gaining-command-points', 'Both players gain 1 CP at the start of every Command phase'],
    engine: () => {
      for (const size of ['incursion', 'strike-force'] as const) expect([missionRulesFor(size).cpEveryCommandPhase, missionRulesFor(size).startingCp]).toEqual(['both', 6]);
    },
  },
  {
    lesson: 'command-phase',
    says: 'you score your primary objective at the end of your Command phase, starting in battle round 2',
    article: ['command-phase#scoring-at-the-end-of-the-phase', 'primary objectives are scored at the end of your Command phase, starting in battle round 2'],
  },
  {
    lesson: 'command-phase',
    says: 'you score 5 VP for each of these, up to 15 VP a turn',
    article: ['matched-play#primary-objectives', 'Each condition you meet is worth 5 VP, up to 15 VP per turn.'],
    engine: () => expect(missionRulesFor('combat-patrol').primary).toEqual({ kind: 'take-and-hold', vpPerCondition: 5, maxPerTurn: 15 }),
  },
  // ---------- 5. Movement ----------
  {
    lesson: 'movement',
    says: 'roll a D6 and add it to M for this move',
    article: ['movement-phase#advance', 'Each model in the unit can move up to its Move characteristic plus the Advance roll'],
  },
  {
    lesson: 'movement',
    says: 'For the rest of the turn the unit can’t charge, and it can only shoot Assault weapons, at -1 to hit.',
    article: ['movement-phase#advance', "can't shoot, except with Assault weapons. Each attack with an Assault weapon after Advancing takes a -1 penalty to its hit roll"],
  },
  {
    lesson: 'movement',
    says: 'A unit within Engagement Range of an enemy unit can only Fall Back or Remain Stationary.',
    article: ['movement-phase#the-move-units-step', 'it can only Fall Back or Remain Stationary'],
  },
  {
    lesson: 'movement',
    says: 'when it is within 1" of it (and 5" vertically)',
    article: ['basics#engagement-range', 'within 1" horizontally and 5" vertically of it'],
    engine: () => {
      expect(engaged(1)).toBe(true);
      expect(engaged(1.1)).toBe(false);
    },
  },
  {
    lesson: 'movement',
    says: 'Every model must be within 2" of at least one other model from its unit. A unit of 6 or more models needs every model within 2" of at least two others.',
    article: ['basics#unit-coherency', 'If a unit has 6 or more models, every model must instead be within 2" horizontally and 5" vertically of at least two'],
    engine: () => {
      expect(coherentLine(2, 5)).toBe(true); // 5 models in a line, 2" apart: each has one neighbour within 2"
      expect(coherentLine(2.1, 5)).toBe(false);
      expect(coherentLine(2, 6)).toBe(false); // 6 in a line: the end models have only one neighbour
    },
  },
  {
    lesson: 'movement',
    says: 'For the rest of the turn the unit can’t charge, and it can’t shoot either (unless it is TITANIC).',
    article: ['movement-phase#fall-back', "can't declare a charge; can't shoot, unless it is TITANIC"],
  },
  // ---------- 6. Psychic ----------
  {
    lesson: 'psychic',
    says: 'roll 2D6. If the total is equal to or higher than the power’s warp charge, the test is passed',
    article: ['psychic-phase#manifesting-a-power', "Roll 2D6. If the total is equal to or higher than the power's warp charge value, the test is passed."],
  },
  {
    lesson: 'psychic',
    says: 'one of their psykers within 24" rolls 2D6, and must roll higher than your total',
    article: ['psychic-phase#deny-the-witch', 'Pick one of your PSYKER units within 24" of the psyker that manifested the power. Roll 2D6.'],
  },
  {
    lesson: 'psychic',
    says: 'It has a warp charge of 5, plus 1 for each other Smite your army has already attempted this phase. It hits the closest visible enemy unit within 18", which suffers D3 mortal wounds, or D6 if your Psychic test was 11 or more.',
    article: ['psychic-phase#smite', 'Warp charge 5, plus 1 for each other attempt to manifest Smite your army has already made this phase Target The closest visible enemy unit within 18" of the psyker Effect The target suffers D3 mortal wounds'],
  },
  {
    lesson: 'psychic',
    says: 'If your Psychic test shows a double 1 or a double 6, your psyker suffers Perils of the Warp: D3 mortal wounds on itself.',
    article: ['psychic-phase#perils-of-the-warp', 'shows a double 1 or a double 6, the psyker unit suffers Perils of the Warp. The psyker unit suffers D3 mortal wounds.'],
  },

  // ---------- 7. Shooting ----------
  {
    lesson: 'shooting',
    says: 'models can’t see through or over the feature if it is at least 5" tall',
    article: ['basics#visibility', "a model can't see through or over an Obscuring feature that is at least 5\" tall"],
    engine: () => {
      expect(seesPastRuin(5)).toBe(false);
      expect(seesPastRuin(4.9)).toBe(true);
    },
  },
  {
    lesson: 'shooting',
    says: 'Light Cover adds +1 to their armour saves against ranged attacks. It never improves an invulnerable save.',
    article: ['terrain#cover-traits', 'Against ranged attacks, a model getting cover from this feature adds +1 to its armour saving throws. Light Cover never improves an invulnerable save.'],
  },
  {
    lesson: 'shooting',
    says: 'Against a unit of 6 to 10 models, a Blast weapon always makes at least 3 attacks. Against 11 or more models, it makes the most it can: 6 for a D6.',
    article: ['shooting-phase#blast', 'Target has between 6 and 10 models: the weapon always makes at least 3 attacks.'],
    engine: () => {
      const d6 = parseDice('D6')!;
      expect([blastShots(d6, 1, 6), blastShots(d6, 1, 10), blastShots(d6, 1, 11), blastShots(d6, 2, 5)]).toEqual([3, 3, 6, 2]);
    },
  },
  {
    lesson: 'shooting',
    says: 'A CHARACTER with 9 or fewer wounds can’t be shot while it is within 3" of a friendly unit of 3 or more models that has no CHARACTERS',
    article: ['shooting-phase#look-out-sir', 'contains a CHARACTER with 9 or fewer wounds (a Wounds characteristic of 9 or less) and it is within 3" of any of these friendly units'],
  },
  {
    lesson: 'shooting',
    says: 'It can still be shot if it is the closest visible enemy unit to the firing model.',
    article: ['shooting-phase#look-out-sir', "The character's unit can still be targeted if it is both visible to the firing model and the closest enemy unit to it."],
  },
  // ---------- 8. Charge ----------
  {
    lesson: 'charge',
    says: 'A unit can charge if it is within 12" of an enemy unit, didn’t Advance or Fall Back this turn',
    article: ['charge-phase#charging', 'It is within 12" of at least 1 enemy unit. It did not Advance or Fall Back this turn.'],
    engine: () => {
      expect(declareAt(11.9)).toBe(true);
      expect(declareAt(12.1)).toBe(false);
    },
  },
  {
    lesson: 'charge',
    says: 'each of its attacks only hits on an unmodified 6',
    article: ['charge-phase#overwatch', 'Each of its attacks only hits on an unmodified 6'],
  },
  {
    lesson: 'charge',
    says: 'Roll 2D6: that is how far, in inches, each model can move.',
    article: ['charge-phase#charging', 'Roll 2D6. The total, in inches, is the charge roll: the furthest each model in the unit can move.'],
  },
  {
    lesson: 'charge',
    says: 'ends within Engagement Range (1") of every unit it declared as a target, in unit coherency, and not within Engagement Range of any other enemy unit',
    article: ['charge-phase#charging', "the unit ends within Engagement Range of every target you declared; the unit ends in unit coherency; no model moves within Engagement Range of an enemy unit you didn't declare as a target."],
  },
  {
    lesson: 'charge',
    says: 'A CHARACTER within 3" of an enemy unit (and not in Engagement Range) moves up to 3", ending closer to the closest enemy model.',
    article: ['charge-phase#heroic-interventions', 'Each model in the intervening unit can move up to 3". It must end closer to the closest enemy model'],
  },
  // ---------- 9. Fight ----------
  {
    lesson: 'fight',
    says: 'Units that charged this turn fight first.',
    article: ['fight-phase#fight-order', 'Every unit that made a charge move this turn fights before any other unit.'],
  },
  {
    lesson: 'fight',
    says: 'Then the players take turns picking one unit each, starting with the player whose turn it isn’t',
    article: ['fight-phase#fight-order', 'The player whose turn it is not picks first.'],
  },
  {
    lesson: 'fight',
    says: 'each model may move up to 3". A model that moves must end closer to the closest enemy model.',
    article: ['fight-phase#pile-in', 'Each model can move up to 3". Moving is optional: you can move some, all or none of the models. Each model that moves must end closer to the closest enemy model.'],
  },
  {
    lesson: 'fight',
    says: 'within ½" of a friendly model that is within ½" of an enemy model',
    article: ['fight-phase#which-models-fight', 'it is within ½" of another model from its own unit, and that model is within ½" of an enemy model'],
  },
  {
    lesson: 'fight',
    says: 'Consolidate: each model may move up to 3", again ending closer to the closest enemy model.',
    article: ['fight-phase#consolidate', 'Each model can move up to 3". Like piling in, this is optional. Each model that moves must end closer to the closest enemy model'],
  },
  {
    lesson: 'fight',
    says: 'A model with no melee weapon fights with a close combat weapon: its own Strength, AP 0, Damage 1.',
    article: ['fight-phase#making-close-combat-attacks', "A model that has no melee weapon fights with a close combat weapon: its Strength is the model's own Strength, AP 0, Damage 1."],
    engine: () => expect([CLOSE_COMBAT_WEAPON.s, CLOSE_COMBAT_WEAPON.ap, CLOSE_COMBAT_WEAPON.d.plus]).toEqual([{ kind: 'user' }, 0, 1]),
  },

  // ---------- 10. Morale and Combat Attrition ----------
  {
    lesson: 'morale',
    says: 'A unit takes a Morale test if one or more of its models were destroyed this turn.',
    article: ['morale-phase#which-units-test', 'A unit must take a Morale test if one or more of its models were destroyed this turn.'],
  },
  {
    lesson: 'morale',
    says: 'Roll a D6 and add the number of the unit’s models destroyed this turn. Compare the total with the highest Leadership (Ld) in the unit',
    article: ['morale-phase#morale-tests', 'Roll a D6. Add the number of models from the unit that were destroyed this turn. Compare the total with the highest Leadership (Ld) characteristic among the models in the unit.'],
  },
  { lesson: 'morale', says: 'An unmodified roll of 1 always passes.', article: ['morale-phase#morale-tests', 'An unmodified roll of 1 always passes'] },
  {
    lesson: 'morale',
    says: 'After a failed test, roll a D6 for each model still in the unit. Each 1 means one more model flees. If the unit is below Half-strength (fewer than half the models it started with), subtract 1 from each roll',
    article: ['morale-phase#combat-attrition', 'After the first model flees, roll one D6 for each model still in the unit. If the unit is below Half-strength, subtract 1 from each of those rolls. For each result of 1, one more model flees.'],
  },
  {
    lesson: 'morale',
    says: 'The Insane Bravery Stratagem (2 CP, once per battle) passes a Morale test automatically.',
    article: ['core-stratagems#the-core-stratagems', 'Insane Bravery 2 Before one of your units takes a Morale test (once per battle)'],
  },
  // ---------- 11. Objectives and scoring ----------
  {
    lesson: 'objectives',
    says: 'A model is in range of a marker if it is within 3" horizontally and 5" vertically of it.',
    article: ['matched-play#objective-markers', 'A model is in range of a marker if it is within 3" horizontally and 5" vertically of it.'],
    engine: () => {
      expect(engineInRange(3.0)).toBe(true);
      expect(engineInRange(3.1)).toBe(false);
    },
  },
  {
    lesson: 'objectives',
    says: 'You control a marker if you have more models in range of it than your opponent.',
    article: ['matched-play#objective-markers', 'You control a marker if you have more models in range of it than your opponent.'],
  },
  {
    lesson: 'objectives',
    says: 'You control a marker if any of your Objective Secured models are in range of it, even if your opponent has more models there. If both players have Objective Secured models in range, the normal model count decides.',
    article: ['matched-play#objective-markers', 'You control a marker if any of your Objective Secured models are in range of it, even if your opponent has more models there. If both players have Objective Secured models in range, the normal model count decides.'],
  },
  {
    lesson: 'objectives',
    says: 'Take and Hold gives 5 VP for each of these, up to 15 VP a turn',
    article: ['matched-play#primary-objectives', 'Each condition you meet is worth 5 VP, up to 15 VP per turn.'],
    engine: () => expect(missionRulesFor('combat-patrol').primary).toMatchObject({ kind: 'take-and-hold', vpPerCondition: 5, maxPerTurn: 15 }),
  },
  // ---------- 12. Stratagems ----------
  {
    lesson: 'stratagems',
    says: 'You can use each Stratagem only once per phase.',
    article: ['core-stratagems#once-per-phase', 'not more than once in the same phase'],
  },
  {
    lesson: 'stratagems',
    says: 'Command Re-roll 1 After a roll such as a hit, wound, save or charge roll Counter-offensive 2 After an enemy unit has fought Insane Bravery 2 Before a Morale test (once per battle) Fire Overwatch 1',
    article: ['core-stratagems#the-core-stratagems', 'Command Re-roll 1 After you make certain rolls, such as a hit, wound, save or charge roll Counter-offensive 2 After an enemy unit has fought in the Fight phase Insane Bravery 2 Before one of your units takes a Morale test (once per battle) Fire Overwatch 1'],
  },
  {
    lesson: 'stratagems',
    says: 'Cut Them Down 1 When an enemy unit Falls Back Desperate Breakout 2',
    article: ['core-stratagems#the-core-stratagems', 'Cut Them Down 1 When an enemy unit Falls Back, before it moves Desperate Breakout 2'],
  },
  { lesson: 'stratagems', says: 'Emergency Disembarkation 1', article: ['core-stratagems#the-core-stratagems', 'Emergency Disembarkation 1'] },
  {
    lesson: 'stratagems',
    says: 'A charge roll is 2D6 rolled together, so you must re-roll both dice',
    article: ['charge-phase#charging', 'The Command Re-roll stratagem can re-roll a charge roll, but you must re-roll both dice.'],
  },
  // ---------- 13. Terrain ----------
  {
    lesson: 'terrain',
    says: 'Light Cover: +1 to armour saves against ranged attacks.',
    article: ['terrain#cover-traits', 'Against ranged attacks, a model getting cover from this feature adds +1 to its armour saving throws.'],
    engine: () => expect(TERRAIN_PRESETS.craters.traits).toContain('light-cover'),
  },
  {
    lesson: 'terrain',
    says: 'Heavy Cover: +1 to armour saves against melee attacks, but not for a model that made a charge move this turn.',
    article: ['terrain#cover-traits', "Against melee attacks, a model getting cover from this feature adds +1 to its armour saving throws. This doesn't apply if the model the attack is allocated to made a charge move this turn."],
  },
  {
    lesson: 'terrain',
    says: 'Dense Cover: if the feature is at least 3" tall, ranged attacks through it take -1 to hit.',
    article: ['terrain#cover-traits', 'Dense Cover only works if the feature is at least 3" tall. When a model makes a ranged attack, subtract 1 from the hit roll (-1 to hit)'],
    engine: () => expect(TERRAIN_PRESETS.woods.traits).toContain('dense-cover'),
  },
  {
    lesson: 'terrain',
    says: 'vehicles and monsters too (but not against AIRCRAFT, or a unit with a model of 18 or more wounds)',
    article: ['terrain#cover-traits', 'There is no penalty when attacking an AIRCRAFT unit, or a unit containing a model with a Wounds characteristic of 18 or more.'],
  },
  {
    lesson: 'terrain',
    says: 'a unit that makes a Normal Move, Advance or Fall Back over it subtracts 2" from its models’ Move, and charging over it gives -2 to the charge roll',
    article: ['terrain#movement-traits', 'When a unit makes a Normal Move, Advance or Fall Back, and any of its models will move over any part of this feature, subtract 2" from the Move characteristic of every model in the unit.'],
  },
  {
    lesson: 'terrain',
    says: 'INFANTRY, BEAST and SWARM models on or within an Area Terrain feature (ruins, woods, craters) get its cover.',
    article: ['terrain#terrain-categories', 'Area Terrain Ruins, woods, craters, industrial structures INFANTRY, BEAST and SWARM models within its footprint'],
  },

  // ---------- 14. Building an army ----------
  {
    lesson: 'army-building',
    says: 'up to the battle size’s points limit: 500 points for a Combat Patrol',
    article: ['matched-play#battle-sizes', 'Combat Patrol 500'],
  },
  {
    lesson: 'army-building',
    says: 'In matched play your army must be Battle-forged: every unit belongs to a detachment',
    article: ['army-building#battle-forged-armies', 'In matched play your army must be Battle-forged. That means every unit in it belongs to a detachment'],
  },
  {
    lesson: 'army-building',
    says: 'HQ 1–2 and Troops 1–3, plus 0–2 Elites, 0–2 Fast Attack, 0–2 Heavy Support and 0–2 Flyers. It costs 2 CP, and you get 2 CP back if it contains your Warlord.',
    article: ['army-building#core-book-detachments', 'Patrol 2 CP +2 CP if it contains your Warlord HQ 1–2, Troops 1–3, Elites 0–2, Fast Attack 0–2, Heavy Support 0–2, Flyers 0–2'],
  },
  {
    lesson: 'army-building',
    says: 'You can include the same datasheet at most 3 times (the Rule of Two allows only 2 at Incursion). Troops units and Dedicated Transports don’t count.',
    article: ['army-building#rule-of-two-and-rule-of-three', "Combat Patrol 3 Incursion 2 (the Rule of Two) Strike Force 3 (the Rule of Three) Onslaught 3 These units don't count towards the limit: Troops units; Dedicated Transports"],
  },
  // ---------- 15. Mission setup ----------
  {
    lesson: 'mission-setup',
    says: 'Roll off: the winner chooses who is the Attacker and who is the Defender. The Defender chooses a deployment zone.',
    article: ['matched-play#the-mission-sequence', 'Determine Attacker and Defender. Roll off; the winner chooses. Choose deployment zone. The Defender chooses.'],
  },
  {
    lesson: 'mission-setup',
    says: 'The players take turns setting up one unit at a time, starting with the Defender.',
    article: ['matched-play#the-mission-sequence', 'Take turns setting up one unit at a time, starting with the Defender.'],
  },
  {
    lesson: 'mission-setup',
    says: 'no more than half your units, and less than half your points',
    article: ['matched-play#reserve-limits', 'No more than half of your units, and less than half of your points, can start off the table.'],
  },
  {
    lesson: 'mission-setup',
    says: 'In a Core Book mission the winner chooses who goes first; in an Arks of Omen mission the winner goes first.',
    article: ['matched-play#the-mission-sequence', 'In step 12 you roll off, and the winner takes the first turn. In the Core Book version, the winner chooses who goes first.'],
    engine: () => {
      expect(missionRulesFor('combat-patrol').firstTurn).toBe('winner-chooses');
      expect(missionRulesFor('strike-force').firstTurn).toBe('winner-first');
    },
  },
  { lesson: 'mission-setup', says: 'lasts 5 battle rounds', engine: () => expect(missionRulesFor('combat-patrol').battleRounds).toBe(5) },
];

/** Is a Necron Warrior (32mm base) whose base edge is `gap` inches from a marker's edge in range of it? */
function engineInRange(gap: number): boolean {
  const s: GameState = stateOf(deployedGame());
  const m = s.models[s.units['A:war'].modelIds[0]];
  return inRangeOfObjective(s, m, { x: m.pos!.x + gap + MARKER_RADIUS + 32 / 25.4 / 2, y: m.pos!.y });
}

/** Can an Intercessor see a Necron Warrior straight across a ruin (Obscuring) of this height? */
function seesPastRuin(height: number): boolean {
  const units: UnitSpec[] = [
    { id: 'A:int', player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 6 } },
    { id: 'B:war', player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 24 } },
  ];
  const s = stateOf(scenario({ units, terrain: [terrainBox('ruins', 0, 12, 44, 14, height, 'Ruins')] }, diskCtx()));
  return livingModels(s, 'A:int').some((m) => unitVisibleTo(modelView(s, m), unitView(s, 'B:war'), s.setup.terrain));
}
/** Does the engine let Intercessors declare a charge at Warriors this far away (base to base)? */
function declareAt(gap: number): boolean {
  const units: UnitSpec[] = [
    { id: 'A:int', player: 'A', sheet: [ULTRA, 'Intercessor Squad'], models: intercessors(5), at: { x: 22, y: 4 } },
    { id: 'B:war', player: 'B', sheet: [NECRONS, 'Necron Warriors'], models: warriors(10), at: { x: 22, y: 4 + gap + 32 / 25.4 } },
  ];
  const g = advanceTo(scenario({ units }, diskCtx()), { phase: 'charge' });
  return dispatch(g, { type: 'declareCharge', by: 'A', unitId: 'A:int', targetIds: ['B:war'] } as Command).ok;
}

const at = (x: number) => ({ x, y: 0, z: 0, rot: 0 });
const base32 = { kind: 'circle' as const, d: 32 / 25.4 };
/** Two 32mm bases `gap` inches apart (edge to edge): within Engagement Range? */
const engaged = (gap: number) => inEngagementRange({ id: 'a', base: base32, pos: at(0) }, { id: 'b', base: base32, pos: at(base32.d + gap) });
/** `n` 32mm bases in a line, `gap` inches apart: in coherency? */
const coherentLine = (gap: number, n: number) => inCoherency(Array.from({ length: n }, (_, i) => ({ id: `m${i}`, base: base32, pos: at(i * (base32.d + gap)) })));

describe('lesson facts', () => {
  test('every lesson has at least one fact row', () => {
    expect(lessons.filter((l) => !FACTS.some((f) => f.lesson === l.id)).map((l) => l.id)).toEqual([]);
  });

  for (const f of FACTS) {
    test(`${f.lesson}: "${f.says}"`, () => {
      expect(f.article || f.engine, 'a fact needs an article or an engine check').toBeTruthy();
      expect(lessonText(f.lesson)).toContain(norm(f.says));
      if (f.article) expect(sectionText(f.article[0])).toContain(norm(f.article[1]));
      f.engine?.();
    });
  }
});
