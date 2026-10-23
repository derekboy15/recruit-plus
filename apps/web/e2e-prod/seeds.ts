/** Saved documents built in code for seeding the fake remote. */

/** A table companion game of the seeded Necrons list against Necrons, just started (Arks of Omen, Cleanse the Land). */
export function tableGame(listId: string) {
  const player = (name: string, extra: object) => ({
    name,
    catalogueSlug: 'necrons',
    secondaries: ['aoo-assassination', 'aoo-grind-them-down', 'aoo-behind-enemy-lines'],
    battleReady: false,
    startingCp: 6,
    ...extra,
  });
  return {
    mode: 'table',
    schema: 1,
    setup: {
      battleSize: 'incursion',
      pack: 'arks-of-omen',
      missionId: 'aoo-cleanse-the-land',
      players: { A: player('You', { listId }), B: player('Opponent', {}) },
      attacker: 'A',
      firstTurn: 'A',
    },
    events: [{ id: 'e2e-start', at: '2026-10-23T00:00:00.000Z', pos: null, t: 'start' }],
  };
}
