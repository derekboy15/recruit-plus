/** Units and models in the game state, and the helpers every rules module uses to read them. */
import { registerApplier } from '../core/apply';
import type { Ctx } from '../core/context';
import { registerInitialiser, type GameSetup, type GameState, type UnitInput } from '../core/state';
import { other, type Evt, type PlayerId } from '../core/types';
import { currentChars, has } from '../datasheet/profile';
import type { Datasheet, ModelChars, ModelProfile } from '../datasheet/types';
import { inEngagementRange } from '../geometry/measure';
import type { Placed, Pos } from '../geometry/shapes';
import type { ModelView, UnitView } from '../terrain/visibility';

export type ActivationKind = 'move' | 'shoot' | 'fight' | 'psychic' | 'charge';

/** Per-turn facts about a unit, reset at the start of every turn. */
export interface TurnFlags {
  moved: 'none' | 'normal' | 'advance' | 'fall-back' | 'stationary';
  /** Set up this turn as a Reinforcement (TS §3.2). */
  arrived: boolean;
  /** Arrived within 1" of its own edge inside 9" of the enemy: counts as having charged (TS §3.3). */
  countsAsCharged: boolean;
  /** A model too big for the edge rule arrived: it can't act further this turn (TS §3.3). */
  arrivedLarge: boolean;
  disembarked: boolean;
  disembarkedFromDestroyed: boolean;
  embarkedThisPhase: boolean;
  disembarkedThisPhase: boolean;
  brokeOut: boolean;
  shot: boolean;
  charged: boolean;
  chargeTargets: string[];
  heroic: boolean;
  fought: boolean;
  psychicAttempts: number;
  /** Models destroyed this turn (for Morale tests). */
  lostThisTurn: number;
  /** How many times the unit has been selected for each kind of activation this phase, and extra allowances. */
  selected: Partial<Record<ActivationKind, number>>;
  extra: Partial<Record<ActivationKind, number>>;
}

export interface UnitState {
  id: string;
  player: PlayerId;
  name: string;
  modelIds: string[];
  startingStrength: number;
  location: 'deploying' | 'battlefield' | 'reserves' | 'embarked' | 'destroyed';
  embarkedIn: string | null;
  reserveKind: 'strategic' | 'deep-strike' | null;
  casualtyOrder: string[];
  turn: TurnFlags;
  /** Toolkit flags: counts as Remained Stationary this turn; Objective Secured forced on or off. */
  flags: { countsAsStationary?: boolean; objectiveSecured?: boolean };
}

export interface ModelState {
  id: string;
  unitId: string;
  profile: string;
  weapons: string[];
  woundsLeft: number;
  pos: Pos | null;
  destroyed: boolean;
  /** An attack was allocated to it this phase (TS §5.6). */
  allocatedThisPhase: boolean;
}

declare module '../core/types' {
  interface EventMap {
    modelsRemoved: Evt<'modelsRemoved'> & { modelIds: string[]; reason: string; lost: boolean };
  }
}

declare module '../core/state' {
  interface GameState {
    units: Record<string, UnitState>;
    models: Record<string, ModelState>;
    cp: Record<PlayerId, number>;
    deploy: { next: PlayerId };
  }
}

export function freshTurnFlags(): TurnFlags {
  return {
    moved: 'none', arrived: false, countsAsCharged: false, arrivedLarge: false, disembarked: false, disembarkedFromDestroyed: false,
    embarkedThisPhase: false, disembarkedThisPhase: false, brokeOut: false, shot: false, charged: false, chargeTargets: [],
    heroic: false, fought: false, psychicAttempts: 0, lostThisTurn: 0, selected: {}, extra: {},
  };
}

const indexes = new WeakMap<GameSetup, Map<string, UnitInput>>();
export function unitInputOf(state: GameState, unitId: string): UnitInput {
  let idx = indexes.get(state.setup);
  if (!idx) {
    idx = new Map(state.setup.armies.flatMap((a) => a.units.map((u) => [u.id, u] as const)));
    indexes.set(state.setup, idx);
  }
  const u = idx.get(unitId);
  if (!u) throw new Error(`Unknown unit ${unitId}`);
  return u;
}
export const sheetOf = (state: GameState, unitId: string): Datasheet => unitInputOf(state, unitId).datasheet;
export const unitHas = (state: GameState, unitId: string, kw: string) => has(sheetOf(state, unitId), kw);

export function profileOf(state: GameState, m: ModelState): ModelProfile {
  const ds = sheetOf(state, m.unitId);
  return ds.models.find((p) => p.name === m.profile) ?? ds.models[0];
}
export const charsOf = (state: GameState, m: ModelState): ModelChars => currentChars(m, profileOf(state, m));

export const livingModels = (state: GameState, unitId: string): ModelState[] =>
  state.units[unitId].modelIds.map((id) => state.models[id]).filter((m) => !m.destroyed);
export const onBoard = (state: GameState, unitId: string): ModelState[] => livingModels(state, unitId).filter((m) => m.pos);
export const unitsOf = (state: GameState, p: PlayerId): UnitState[] => Object.values(state.units).filter((u) => u.player === p);
export const enemiesOf = (state: GameState, p: PlayerId): UnitState[] => unitsOf(state, other(p));
export const isOnBattlefield = (u: UnitState) => u.location === 'battlefield';

export function placedModel(state: GameState, m: ModelState, pos: Pos | null = m.pos): Placed {
  if (!pos) throw new Error(`Model ${m.id} is not on the battlefield`);
  return { id: m.id, base: sheetOf(state, m.unitId).base, pos };
}
export function modelView(state: GameState, m: ModelState, pos: Pos | null = m.pos): ModelView {
  const ds = sheetOf(state, m.unitId);
  return { ...placedModel(state, m, pos), keywords: [...ds.keywords, ...ds.factionKeywords], wounds: profileOf(state, m).chars.W };
}
export function unitView(state: GameState, unitId: string): UnitView {
  const ds = sheetOf(state, unitId);
  return { id: unitId, keywords: [...ds.keywords, ...ds.factionKeywords], models: onBoard(state, unitId).map((m) => modelView(state, m)) };
}

/** Every model of the unit, in order, with ids `<unitId>.m<n>`. */
export function expandModels(u: UnitInput): { id: string; profile: string; weapons: string[]; W: number }[] {
  const out: { id: string; profile: string; weapons: string[]; W: number }[] = [];
  for (const stack of u.models) {
    const profile = u.datasheet.models.find((p) => p.name === stack.profile);
    for (let i = 0; i < stack.count; i++) out.push({ id: `${u.id}.m${out.length + 1}`, profile: stack.profile, weapons: [...stack.weapons], W: profile?.chars.W ?? 1 });
  }
  return out;
}

registerInitialiser((s, setup) => {
  s.units = {};
  s.models = {};
  for (const army of setup.armies)
    for (const u of army.units) {
      const models = expandModels(u);
      const aircraft = setup.rules.aircraftStartInReserves && has(u.datasheet, 'AIRCRAFT');
      s.units[u.id] = {
        id: u.id,
        player: army.player,
        name: u.datasheet.name,
        modelIds: models.map((m) => m.id),
        startingStrength: models.length,
        location: aircraft ? 'reserves' : 'deploying',
        embarkedIn: null,
        reserveKind: aircraft ? 'strategic' : null,
        casualtyOrder: u.casualtyOrder ?? models.map((m) => m.id).reverse(),
        turn: freshTurnFlags(),
        flags: {},
      };
      for (const m of models)
        s.models[m.id] = { id: m.id, unitId: u.id, profile: m.profile, weapons: m.weapons, woundsLeft: m.W, pos: null, destroyed: false, allocatedThisPhase: false };
    }
  s.cp = { A: 0, B: 0 };
  for (const army of setup.armies) s.cp[army.player] = Math.max(0, setup.rules.startingCp - army.cpSpentPreBattle);
  s.deploy = { next: other(setup.attacker) };
});

/** Removes models from the battlefield as destroyed; `lost` counts them toward this turn's Morale test. */
registerApplier('modelsRemoved', (s, e) => {
  for (const id of e.modelIds) {
    const m = s.models[id];
    m.destroyed = true;
    m.pos = null;
    m.woundsLeft = 0;
    const u = s.units[m.unitId];
    if (e.lost) u.turn.lostThisTurn += 1;
    if (u.modelIds.every((x) => s.models[x].destroyed)) {
      u.location = 'destroyed';
      u.embarkedIn = null;
    }
  }
});

type RemovedHook = (ctx: Ctx, modelIds: string[], reason: string) => void;
const removedHooks: RemovedHook[] = [];
/** Runs after models are removed as destroyed (e.g. a transport's passengers must get out, Task 10). */
export function registerRemovedHook(fn: RemovedHook): void {
  removedHooks.push(fn);
}

/** Removes models as destroyed and runs the hooks. `lost`: counts toward this turn's Morale test (TS §8.1). */
export function removeModels(ctx: Ctx, modelIds: string[], reason: string, lost = true): void {
  const ids = modelIds.filter((id) => !ctx.state.models[id].destroyed);
  if (!ids.length) return;
  ctx.emit({ type: 'modelsRemoved', modelIds: ids, reason, lost });
  for (const h of removedHooks) h(ctx, ids, reason);
}

export const isEngagedWith = (s: GameState, a: ModelState, b: ModelState): boolean =>
  !!a.pos && !!b.pos && inEngagementRange(placedModel(s, a), placedModel(s, b));
