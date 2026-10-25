/** Which players' lists a game can show: the army button (one list) or menu (two) on the game screen. */
import type { PlayerKey } from '@recruit/data/missions';
import { other, type TableSetup } from './game';

export interface ArmyEntry { player: PlayerKey; listId: string; label: string }

/** Players who started from one of their lists, first turn first. "Your army" for the default "You", else "Sam’s army". */
export function armyEntries(setup: TableSetup): ArmyEntry[] {
  return [setup.firstTurn, other(setup.firstTurn)].flatMap((player) => {
    const { name, listId } = setup.players[player];
    return listId ? [{ player, listId, label: name === 'You' ? 'Your army' : `${name}’s army` }] : [];
  });
}
