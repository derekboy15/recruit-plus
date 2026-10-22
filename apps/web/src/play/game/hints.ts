/** Short tips for new players, one per moment of the game (at most two sentences each). */
import type { CurrentStep, GameState } from '@recruit/engine';

export function hintFor(s: GameState, step: CurrentStep, selectedUnitId: string | null): string | null {
  if (s.phase === 'ended') return null;
  if (step.pending?.kind === 'roll') return 'Happy with the dice? Accept them, or spend 1 CP on a Command Re-roll.';
  if (step.pending?.kind === 'reaction') return 'The other player has a choice to make before the game goes on. Hand them the device.';
  if (s.placements?.length) return 'A transport was destroyed: set up the units that were inside it near where it was.';
  switch (s.step) {
    case 'deploy':
      return 'Tap a unit below, then tap inside your zone to set it up. Drag models to adjust, then tap Deploy.';
    case 'first-turn':
      return 'Roll off to see who takes the first turn. In Core Book missions the winner chooses; in Arks of Omen the winner goes first.';
    case 'move-units':
      if (s.activation?.kind === 'move') return 'Drag the models; the ring shows how far they can go. The app checks the move when you let go.';
      return selectedUnitId
        ? 'Choose a Normal Move, an Advance (add a D6 to its Move, but then it can only shoot Assault weapons and can’t charge) or Remain Stationary.'
        : 'Tap one of your units to move it. Each model can move up to its Move characteristic (M).';
    case 'reinforcements':
      return 'Units in reserve can arrive from battle round 2. They must be set up more than 9" from every enemy model.';
    case 'charges':
      return 'Pick a unit within 12" of an enemy and declare a charge. Roll 2D6: each model can move that far to reach Engagement Range (1").';
    case 'heroic-interventions':
      return 'Characters within 3" of an enemy unit can Heroically Intervene: move up to 3" towards the closest enemy model.';
    case 'morale-tests':
      return 'Units that lost models this turn take a Morale test: a D6 plus the models lost. If that beats their Leadership, one model flees and the rest test for Combat Attrition.';
    case 'coherency':
      return 'Any unit that is no longer in unit coherency removes models until it is.';
    case 'main':
      break;
  }
  switch (s.phase) {
    case 'command':
      return 'You gain 1 Command Point (CP) in your Command phase. Use stratagems now if you want, then end the phase.';
    case 'psychic':
      return 'Psykers can try to manifest a power: roll 2D6 and get at least its warp charge. The enemy may try to Deny the Witch.';
    case 'shooting':
      return 'Pick a unit, then a target. The app checks range and line of sight for you.';
    case 'fight':
      return 'Units that charged fight first, then players take turns picking units. Pile in up to 3", attack, then consolidate up to 3".';
    default:
      return null;
  }
}
