import type { TableSetup } from '../game';

const AOO_DEFAULTS = ['aoo-assassination', 'aoo-grind-them-down', 'aoo-behind-enemy-lines'];

/** A two-player Incursion setup: You (Necrons, Player A, first turn) against Opponent (Orks). */
export const testSetup = (o: Partial<TableSetup> = {}): TableSetup => ({
  battleSize: 'incursion', pack: 'arks-of-omen', missionId: 'aoo-cleanse-the-land', attacker: 'A', firstTurn: 'A',
  players: {
    A: { name: 'You', catalogueSlug: 'necrons', secondaries: AOO_DEFAULTS, battleReady: false, startingCp: 6 },
    B: { name: 'Opponent', catalogueSlug: 'orks', secondaries: AOO_DEFAULTS, battleReady: false, startingCp: 6 },
  },
  ...o,
});
