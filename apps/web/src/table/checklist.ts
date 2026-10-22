/**
 * Beginner prompts for each phase, in plain English. Each one cites where it comes from: Wahapedia's 9th Edition core
 * rules (WCR, wahapedia.ru/wh40k9ed/the-rules/core-rules/), the mission pack's sequence, or the research library.
 */
import type { MissionOut, Pack } from '@recruit/data/missions';
import type { Pos } from './game';

export interface Prompt { id: string; text: string; source: string }

const WCR = (section: string) => `WCR: ${section}; library 01_Core_Rules/Core_Rules_Turn_Sequence.md`;

export function prompts({ pack, pos, mission }: { pack: Pack; pos: Pos; mission: MissionOut }): Prompt[] {
  const aoo = pack === 'arks-of-omen';
  const out: Prompt[] = [];
  const add = (id: string, text: string, source: string) => out.push({ id, text, source });
  switch (pos.phase) {
    case 'command': {
      add('cp', aoo
        ? 'Both players gain 1 CP (the Battle-forged CP bonus) at the start of every Command phase, unless a mission rule says otherwise.'
        : 'You gain 1 CP at the start of your Command phase (the Battle-forged CP bonus).',
        aoo ? 'Mission rule: Battle-forged CP Bonus' : WCR('Command phase, Battle-forged CP bonus (§2)'));
      add('start-abilities', 'Use any abilities and Stratagems that happen at the start of your Command phase.', WCR('Command phase (§2)'));
      const holds = mission.primary.components.some((c) => c.when === 'end-of-command-phase');
      if (holds && pos.round >= 2) {
        const late = aoo && pos.round === 5 && pos.turn === 2;
        add('primary', late
          ? 'In battle round 5 the player going second doesn\'t score the primary objective now: you score the primary objective at the end of your turn instead.'
          : 'You score the primary objective at the end of this phase. Count the objective markers each player controls (the app asks when you tap Next phase).',
          aoo ? 'Mission primary objective (Arks of Omen GT)' : 'Mission primary objective (Eternal War); library MP §5');
      }
      break;
    }
    case 'movement':
      add('move', 'Move each unit: a Normal Move, an Advance (roll a D6 and add it to its Move), or Remain Stationary.', WCR('Movement phase, Move Units (§3.1)'));
      add('engaged', 'A unit that starts within Engagement Range of an enemy unit can only Fall Back or Remain Stationary.', WCR('Movement phase, Move Units (§3.1)'));
      add('consequences', "A unit that Advances can't charge this turn and can only shoot Assault weapons. A unit that Falls Back can't charge this turn, and can't shoot or manifest psychic powers unless it's TITANIC.", WCR('Advance; Fall Back; Assault weapons'));
      if (pos.round === 1) {
        add('no-reserves', "Units can't arrive from Strategic Reserves or as Reinforcements in the first battle round.", 'Mission sequence step 10 (Declare reserves and transports); WCR Strategic Reserves (§3.3)');
      } else {
        add('reserves', pos.round === 2
          ? "Any units arriving from Strategic Reserves this turn? In battle round 2, set them up wholly within 6\" of a battlefield edge that isn't your opponent's, not in your opponent's deployment zone, and more than 9\" from enemy models."
          : "Any units arriving from Strategic Reserves this turn? Set them up wholly within 6\" of a battlefield edge that isn't your opponent's, and more than 9\" from enemy models.",
          WCR('Setting Up Strategic Reserve Units (§3.3)'));
        add('reinforcements', 'Set up any other Reinforcement units (such as Deep Strike) now, in the Reinforcements step, as their rules say.', WCR('Movement phase, Reinforcements step (§3.2)'));
      }
      if (pos.round === 3) {
        add('reserves-deadline', 'Strategic Reserve and Reinforcement units that are not on the battlefield by the end of this battle round count as destroyed.', 'Mission sequence step 10 (Declare reserves and transports)');
      }
      break;
    case 'psychic':
      add('manifest', 'Each of your PSYKER units can try to manifest psychic powers: roll 2D6 and match or beat the warp charge value. A double 1 or double 6 means Perils of the Warp.', WCR('Psychic phase, Psychic tests (§4)'));
      add('deny', 'Your opponent can try to Deny the Witch with one of their PSYKER units within 24": they must roll higher on 2D6 than your Psychic test.', WCR('Psychic phase, Deny the Witch (§4)'));
      break;
    case 'shooting':
      add('pick', 'Pick your units to shoot one at a time, and choose targets for their weapons.', WCR('Shooting phase (§5)'));
      add('limits', "A unit that Advanced can only shoot its Assault weapons. A unit that Fell Back can't shoot unless it's TITANIC.", WCR('Advance; Fall Back; Assault weapons'));
      break;
    case 'charge':
      add('declare', "Declare charges with units within 12\" of an enemy unit (not units that Advanced or Fell Back this battle round, or that start the phase in Engagement Range), then roll 2D6 for the charge.", WCR('Charge phase, Charges (§6.1)'));
      add('overwatch', 'Your opponent can use the Fire Overwatch Stratagem against a unit that declares a charge.', 'Core Stratagems: Fire Overwatch');
      add('heroic', 'After all your charges, your opponent can make Heroic Interventions with CHARACTER units within 3" horizontally of your units.', WCR('Charge phase, Heroic Interventions (§6.2)'));
      break;
    case 'fight':
      add('order', "Units that charged this turn fight first. Then the players take turns choosing units to fight, starting with the player whose turn it isn't.", WCR('Fight phase, Charging Units Fight First (§7.1)'));
      add('pile-in', 'Each unit piles in up to 3", makes its close combat attacks, then consolidates up to 3".', WCR('Fight phase, Pile In and Consolidate (§7.3)'));
      break;
    case 'morale':
      add('morale', 'Each unit that lost models this turn takes a Morale test: roll a D6 and add the number of models it lost this turn. If that beats its highest Leadership, one model flees and the rest take Combat Attrition tests. An unmodified 1 always passes.', WCR('Morale phase, Morale tests (§8.1)'));
      add('coherency', 'Then both players remove models from any units that are out of unit coherency.', WCR('Morale phase, Unit Coherency Checks (§8.3)'));
      add('end-of-turn', 'Actions and abilities that happen "at the end of your turn" happen when you tap End turn.', 'Mission rules and actions (library §10 Actions)');
      break;
  }
  return out;
}
