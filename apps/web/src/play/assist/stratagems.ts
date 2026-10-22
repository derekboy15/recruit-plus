/** Which stratagems a player could use at this moment, by Wahapedia's "when" labels. */
import type { StratagemOut } from '@recruit/data/model';
import type { GameState, Phase, PlayerId } from '@recruit/engine';

export interface Moment {
  phase: Phase;
  /** It is this player's turn. */
  mine: boolean;
  /** One of this player's units is being attacked. */
  targeted: boolean;
  /** One of this player's units is taking casualties (an attack against it is under way). */
  casualties: boolean;
  /** One of the other player's units is taking casualties. */
  enemyCasualties: boolean;
  preBattle: boolean;
  roundStart: boolean;
}

/** Core stratagems the engine offers in its own prompts (roll windows, reactions, Morale): never a separate spend button. */
export const ENGINE_STRATAGEMS = ['Command Re-roll', 'Cut Them Down', 'Desperate Breakout', 'Emergency Disembarkation', 'Fire Overwatch', 'Counter-offensive', 'Insane Bravery'];
const engineRuns = new Set(ENGINE_STRATAGEMS.map((n) => n.toLowerCase()));

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  command: 'Command',
  movement: 'Movement',
  psychic: 'Psychic',
  shooting: 'Shooting',
  charge: 'Charge',
  fight: 'Fight',
  morale: 'Morale',
};

function fits(label: string, m: Moment): boolean {
  const p = PHASE_LABEL[m.phase];
  switch (label) {
    case 'Any time':
    case 'Any phase':
      return true;
    case 'Any of your phases':
      return m.mine;
    case 'Being targeted':
      return m.targeted;
    case 'Taking casualties':
      return m.casualties;
    case 'Enemy taking casualties':
      return m.enemyCasualties;
    case 'Before battle':
    case 'During deployment':
      return m.preBattle;
    case 'At the start of battle round':
      return m.roundStart;
    case 'End of your turn':
      return m.mine && m.phase === 'morale';
  }
  if (!p) return false;
  if (label === `${p} phase`) return m.mine;
  if (label === `Enemy ${p} phase`) return !m.mine;
  return false;
}

export function stratagemsNow(all: StratagemOut[], m: Moment): StratagemOut[] {
  return all.filter((s) => !engineRuns.has(s.name.toLowerCase()) && s.phases.some((label) => fits(label, m)));
}

export function momentFor(s: GameState, player: PlayerId): Moment {
  const g = s.attack?.groups[s.attack.index];
  const targetOwner = g ? s.units[g.targetUnitId]?.player : null;
  return {
    phase: s.phase,
    mine: s.phase !== 'pre-battle' && s.active === player,
    targeted: targetOwner === player,
    casualties: targetOwner === player,
    enemyCasualties: !!targetOwner && targetOwner !== player,
    preBattle: s.phase === 'pre-battle',
    roundStart: s.phase === 'command' && s.turn === 'first',
  };
}
