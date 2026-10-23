/** The game log: one plain-English line per event that a player cares about (null for bookkeeping). */
import { apply } from '../core/apply';
import type { GameRecord } from '../core/record';
import { initialState, objectiveName, type GameState, type Phase } from '../core/state';
import type { EventMap, EventType, GameEvent, PlayerId } from '../core/types';
import { moveInches } from '../move/moves';

type Describer<E> = (e: E, s: GameState) => string | null;
const army = (s: GameState, p: PlayerId) => s.setup.armies.find((a) => a.player === p)?.name ?? `Player ${p}`;
const unit = (s: GameState, id: string) => s.units[id]?.name ?? id;
const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
const unitOfModel = (s: GameState, id: string) => unit(s, s.models[id]?.unitId ?? id);
const PHASES: Record<Phase, string> = {
  'pre-battle': 'Pre-battle', command: 'Command', movement: 'Movement', psychic: 'Psychic', shooting: 'Shooting', charge: 'Charge', fight: 'Fight', morale: 'Morale', ended: 'End of the game',
};
const STEPS: Record<string, string> = {
  reinforcements: 'Reinforcements step.', 'heroic-interventions': 'Heroic Interventions step.', coherency: 'Unit coherency checks.', 'first-turn': 'Deployment is over: decide who goes first.',
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const bookkeeping = () => null;

const describers: { [T in EventType]: Describer<EventMap[T]> } = {
  diceRolled: (e) => (e.roll.context ? `${e.roll.context}: rolled ${e.roll.dice.map((d) => d.value).join(', ')}.` : null),
  phaseChanged: (e, s) => {
    if (e.phase === s.phase && e.round === s.round && e.turn === s.turn) return STEPS[e.step] ?? null;
    return `Battle round ${e.round}: ${possessive(army(s, e.active))} ${PHASES[e.phase]} phase.`;
  },
  turnStarted: bookkeeping,
  gameEnded: (e, s) =>
    e.reason === 'concede' ? `${army(s, e.winner === 'A' ? 'B' : 'A')} conceded: ${army(s, e.winner!)} wins.` : e.winner ? `The game is over: ${army(s, e.winner)} wins.` : 'The game is over: a draw.',
  cpChanged: (e, s) => {
    const now = Math.max(0, s.cp[e.player] + e.delta);
    if (e.delta === 0) return `${army(s, e.player)}: ${e.reason}.`;
    return `${army(s, e.player)} ${e.delta > 0 ? 'gained' : 'lost'} ${e.delta > 0 ? e.delta : -e.delta} CP (${e.reason}): now ${now}.`;
  },
  roundCpReset: bookkeeping,
  vpScored: (e, s) => `${army(s, e.player)} scored ${plural(e.amount, 'VP')} (${e.category === 'secondary' ? e.name : e.category === 'painted' ? 'painted army' : e.reason}).`,
  objectiveSet: (e, s) => `Objective ${objectiveName(s.setup.objectives.find((o) => o.id === e.objectiveId) ?? { id: e.objectiveId })} is now ${e.owner ? `held by ${army(s, e.owner)}${e.sticky ? ' until the opponent takes it' : ''}` : 'nobody\'s'}.`,
  modelsRemoved: (e, s) => `${unitOfModel(s, e.modelIds[0])} lost ${plural(e.modelIds.length, 'model')} (${e.reason}).`,
  reservesDeclared: (e, s) => `${army(s, e.player)} put ${e.unitIds.map((id) => unit(s, id)).join(', ')} in ${e.kind === 'strategic' ? 'Strategic Reserves' : 'reserve to arrive later'}${e.cp ? ` (${e.cp} CP)` : ''}.`,
  unitDeployed: (e, s) => `${army(s, s.units[e.unitId].player)} set up ${unit(s, e.unitId)}${e.embarked.length ? ` with ${e.embarked.map((id) => unit(s, id)).join(', ')} aboard` : ''}.`,
  deploymentEnded: (e, s) => (e.destroyed.length ? `${e.destroyed.map((id) => unit(s, id)).join(', ')} started empty and can't be used.` : 'Deployment is over.'),
  firstTurnRolled: (e, s) => `${army(s, e.winner)} won the roll-off${e.first ? ' and goes first' : ' and chooses who goes first'}.`,
  firstTurnChosen: (e, s) => `${army(s, e.first)} goes first.`,
  pendingSet: bookkeeping,
  pendingCleared: bookkeeping,
  diceRerolled: (e, s) => `Re-rolled ${plural(e.indices.length, 'die').replace('dies', 'dice')}${e.source === 'command-reroll' ? ' (Command Re-roll)' : ''}: now ${s.rolls[e.rollId]?.dice.map((d, i) => (e.indices.includes(i) ? e.values[e.indices.indexOf(i)] : d.value)).join(', ')}.`,
  rollClosed: bookkeeping,
  stratagemUsed: (e, s) => `${army(s, e.player)} used ${e.name} (${e.cp} CP)${e.unitIds.length ? ` on ${e.unitIds.map((id) => unit(s, id)).join(', ')}` : ''}.`,
  effectAdded: (e, s) => `${unit(s, e.effect.unitId)}: ${e.effect.note || e.effect.effect.kind}.`,
  effectsRemoved: bookkeeping,
  activationSet: (e, s) => {
    const a = e.activation;
    if (a.kind === 'move' && a.moveKind === 'advance' && a.rolled) {
      const m = s.units[a.unitId].modelIds.map((id) => s.models[id]).find((x) => !x.destroyed);
      return `${unit(s, a.unitId)} Advanced (rolled ${a.bonus}: up to ${m ? moveInches(s, m) + a.bonus : a.bonus}").`;
    }
    if (a.kind === 'charge' && a.roll !== null) return `${unit(s, a.unitId)} rolled ${a.roll} to charge.`;
    return null;
  },
  activationCleared: bookkeeping,
  unitSelected: bookkeeping,
  attackAllocated: bookkeeping,
  woundsLost: (e, s) => `A model of ${unitOfModel(s, e.modelId)} lost ${plural(e.wounds, 'wound')}${e.mortal ? ' (mortal)' : ''}.`,
  woundIgnored: (e, s) => `A model of ${unitOfModel(s, e.modelId)} ignored a wound (Feel No Pain ${e.fnp}+, rolled ${e.roll}).`,
  unitMoved: (e, s) =>
    `${unit(s, e.unitId)} ${e.moveKind === 'normal' ? 'made a Normal Move' : e.moveKind === 'advance' ? 'made its Advance move' : 'Fell Back'}${e.embarkInto ? ` and embarked in ${unit(s, e.embarkInto)}` : ''}.`,
  unitsStayed: (e, s) => `${e.unitIds.map((id) => unit(s, id)).join(', ')} Remained Stationary.`,
  brokeOut: (e, s) => `${unit(s, e.unitId)} made a Desperate Breakout.`,
  unitDisembarked: (e, s) => `${unit(s, e.unitId)} got out${e.fromDestroyed ? ' of its destroyed transport' : ''}.`,
  placementRequired: (e, s) => `${unit(s, e.request.transportId)} was destroyed: set up ${e.request.unitIds.map((id) => unit(s, id)).join(', ')}.`,
  placementDone: bookkeeping,
  unitArrived: (e, s) => `${unit(s, e.unitId)} arrived on the battlefield${e.countsAsCharged ? ' and counts as having charged' : ''}.`,
  unitLeftBattlefield: (e, s) => `${unit(s, e.unitId)} flew off into Strategic Reserves.`,
  attackStarted: bookkeeping,
  attackUpdated: bookkeeping,
  attackEnded: bookkeeping,
  unitShot: (e, s) => `${unit(s, e.unitId)} shot.`,
  psychicAttempt: (e, s) => `${unit(s, e.unitId)} attempted ${e.power} (warp charge ${e.wc}).`,
  denyUsed: (e, s) => `${unit(s, e.unitId)} tried to Deny the Witch.`,
  powerDenied: (e, s) => `${e.power} was denied by ${unit(s, e.by)}.`,
  powerFailed: (e) => `${e.power} failed: ${e.reason}.`,
  powerManifested: (e, s) => `${unit(s, e.unitId)} manifested ${e.power}${e.targetUnitId ? ` on ${unit(s, e.targetUnitId)}` : ''}.`,
  psychicActionCompleted: (e, s) => `${unit(s, e.unitId)} completed ${e.action}.`,
  psychicReset: bookkeeping,
  chargeDeclared: (e, s) => `${unit(s, e.unitId)} declared a charge against ${e.targetIds.map((id) => unit(s, id)).join(', ')}.`,
  chargeReaction: (e, s) =>
    `${unit(s, e.unitId)} ${e.choice === 'set-to-defend' ? 'Set to Defend' : e.choice === 'hold-steady' ? 'Held Steady and fired Overwatch' : 'fired Overwatch'}.`,
  unitCharged: (e, s) => `${unit(s, e.unitId)} charged successfully.`,
  chargeFailed: (e, s) => `${possessive(unit(s, e.unitId))} charge failed.`,
  heroicIntervened: (e, s) => `${unit(s, e.unitId)} made a Heroic Intervention.`,
  fightStarted: bookkeeping,
  piledIn: (e, s) => (Object.keys(e.positions).length ? `${unit(s, e.unitId)} piled in.` : null),
  consolidated: (e, s) => `${unit(s, e.unitId)} consolidated.`,
  unitFought: (e, s) => `${unit(s, e.unitId)} has fought.`,
  counterOffensive: (e, s) => `${unit(s, e.unitId)} fights next (Counter-offensive).`,
  moraleTested: (e, s) =>
    e.insaneBravery
      ? `${unit(s, e.unitId)} passed its Morale test (Insane Bravery).`
      : `${unit(s, e.unitId)} ${e.passed ? 'passed' : 'failed'} its Morale test (${e.roll} + ${s.units[e.unitId].turn.lostThisTurn} = ${e.result} against Ld ${e.ld}).`,
  moraleStarted: bookkeeping,
  actionStarted: (e, s) => `${unit(s, e.unitId)} started ${e.action.name}.`,
  actionFailed: (e, s) => `${possessive(unit(s, e.unitId))} ${e.name} failed: ${e.reason}.`,
  actionCompleted: (e, s) => `${unit(s, e.unitId)} completed ${e.name}.`,
  actionsRoundReset: bookkeeping,
  modelPlaced: (e, s) => `A model of ${unitOfModel(s, e.modelId)} was moved by hand.`,
  modelAdded: (e, s) => `A model was added to ${unit(s, e.unitId)}.`,
  modelReturned: (e, s) => `A model of ${unitOfModel(s, e.modelId)} returned to the battlefield.`,
  woundsSet: (e, s) => `A model of ${unitOfModel(s, e.modelId)} now has ${plural(e.woundsLeft, 'wound')} left.`,
  dieReplaced: (e) => `A die was changed to ${e.value}.`,
  extraActivationGranted: (e, s) => `${unit(s, e.unitId)} can ${e.kind} again this phase.`,
  casualtyOrderSet: bookkeeping,
  unitFlagSet: (e, s) => `${unit(s, e.unitId)}: ${e.flag === 'objective-secured' ? 'Objective Secured' : 'counts as having Remained Stationary'} ${e.value ? 'on' : 'off'}.`,
};

export const describedEventTypes = (): string[] => Object.keys(describers);

/** One line for an event, worded against the state just before it. */
export function describeEvent(e: GameEvent, before: GameState): string | null {
  const d = describers[e.type as EventType] as Describer<GameEvent> | undefined;
  return d ? d(e, before) : null;
}

export interface LogLine { seq: number; round: number; phase: Phase; text: string }

/** The whole game as plain-English lines (losses by the same cause in one command are merged into one line). */
export function gameLog(game: GameRecord): LogLine[] {
  const s = initialState(game.setup);
  const out: LogLine[] = [];
  for (const b of game.batches) {
    const removed = new Map<string, { unitId: string; reason: string; n: number; round: number; phase: Phase }>();
    for (const e of b.events) {
      if (e.type === 'modelsRemoved') {
        const unitId = s.models[e.modelIds[0]].unitId;
        const key = `${unitId}|${e.reason}`;
        const r = removed.get(key) ?? { unitId, reason: e.reason, n: 0, round: s.round, phase: s.phase };
        r.n += e.modelIds.length;
        removed.set(key, r);
        apply(s, e);
      } else {
        const text = describeEvent(e, s);
        apply(s, e);
        // Tagged with the round and phase the event leads into (so "Battle round 2: …" belongs to round 2).
        if (text) out.push({ seq: b.seq, round: s.round, phase: s.phase, text });
      }
    }
    for (const r of removed.values()) out.push({ seq: b.seq, round: r.round, phase: r.phase, text: `${s.units[r.unitId].name} lost ${plural(r.n, 'model')} (${r.reason}).` });
  }
  return out;
}
