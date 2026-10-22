/**
 * What the turn screen must ask now, worked out from the mission and the saved events (so a reload mid-phase asks
 * again only for what hasn't been answered).
 */
import { dueComponents, type MissionOut, type PlayerKey, type ScoringComponent, type When } from '@recruit/data/missions';
import { activePlayer, other, type Pos, type TableGameData, type TableSetup } from './game';

/** `at`: the moment it is being scored (round 5's second-player hold is scored at the end of the turn). */
export interface ScoreItem { player: PlayerKey; component: ScoringComponent; category: 'primary' | 'secondary'; sourceId: string; at: When }

const samePos = (a: Pos | null, b: Pos) => !!a && a.round === b.round && a.turn === b.turn && a.phase === b.phase;

/** True when `player` already has a VP event for `sourceId` at this position (a skip is a 0 VP event). */
export function scoredAt(g: TableGameData, pos: Pos, player: PlayerKey, sourceId: string): boolean {
  return g.events.some((e) => e.t === 'vp' && e.player === player && e.sourceId === sourceId && samePos(e.pos, pos));
}

/** The scoring due for the moment `at`; components already scored at `pos` (when the game is given) are left out. */
export function dueScoring(mission: MissionOut, setup: TableSetup, pos: Pos, at: When, game?: TableGameData): ScoreItem[] {
  const active = activePlayer(setup, pos);
  const bothPlayers = at === 'end-of-round' || at === 'end-of-battle';
  const players: PlayerKey[] = bothPlayers ? [setup.firstTurn, other(setup.firstTurn)] : [active];
  const items: ScoreItem[] = [];
  for (const player of players) {
    const fits = (c: ScoringComponent) => (bothPlayers ? c.who === 'each' : c.who === 'active');
    const due = (cs: ScoringComponent[]) => dueComponents(cs.filter(fits), { at, round: pos.round, activeIsFirst: pos.turn === 1 });
    for (const component of due(mission.primary.components)) items.push({ player, component, category: 'primary', sourceId: component.id, at });
    const ms = mission.missionSecondary;
    if (ms?.components && setup.players[player].secondaries.includes(ms.id)) {
      for (const component of due(ms.components)) items.push({ player, component, category: 'secondary', sourceId: ms.id, at });
    }
  }
  // An 'on-action' component can be scored many times a turn, so it is never "already done".
  return game && at !== 'on-action' ? items.filter((i) => !scoredAt(game, pos, i.player, i.sourceId)) : items;
}

/** Players who still need their Command phase CP bonus decided at `pos` (in order: whose turn it is, then the other). */
export function cpDecisionsNeeded(g: TableGameData, mission: MissionOut, pos: Pos): PlayerKey[] {
  if (pos.phase !== 'command') return [];
  const active = activePlayer(g.setup, pos);
  const decided = (p: PlayerKey) => g.events.some((e) => e.t === 'cp' && e.reason === 'bonus' && e.player === p && samePos(e.pos, pos));
  return [active, other(active)].filter((p) => (mission.cp.who === 'both' || p === active) && !decided(p));
}
