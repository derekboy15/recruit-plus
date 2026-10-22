# Milestone 4 (Rules Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure TypeScript package, `@recruit/engine`, that plays a whole game of final-state 9th Edition 40k between two armies built from our data, with every core rule enforced, faction rules assisted, every action an undoable logged event, and every rule covered by a test that cites it.

**Architecture:**
- **Event-sourced core.** A game is `GameRecord = { setup, batches }`. Each player command goes to `dispatch(game, command)`. A handler validates it against the current state; it either returns `Rejected` with plain-English problems, or emits events. Events are applied to a draft state as they are emitted, so a handler can roll, read the result and carry on. Each command's events form one batch.
  - Dice values live inside events, so replay never re-rolls.
  - Undo drops the last batch, and replaying the record rebuilds the state exactly.
- **Determinism.** Dice come from a seeded `sfc32` generator whose state lives in the game state, plus an optional queue of scripted values (used by tests, lessons and real-dice entry in the companion). There's no `Math.random`, no clock and no `crypto` anywhere in `src/`.
- **Interrupts.** The game pauses on one `Pending` item at a time:
  - a **roll window** after each roll on the Command Re-roll list (re-roll, replace a die, confirm);
  - a **reaction** offered to the other player (Cut Them Down, Fire Overwatch / Hold Steady / Set to Defend, Counter-offensive);
  - a **placement** (passengers of a destroyed transport).

  Settings can turn windows and reactions off, so automated tests and fast play run straight through.
- **Rule modules** each own one phase or concept. They share three pure helper layers: `geometry/` (bases, distances, coherency), `terrain/` (visibility, cover, movement over terrain) and `attack/` (the attack sequence).
- **Data adapter.** `@recruit/engine/data` turns the generated `UnitOut` JSON into engine `Datasheet`s and musters an army from a saved army-builder list. It is the only part that imports `@recruit/data`.

**Tech Stack:** TypeScript 7, Vitest 5, npm workspaces (unchanged from Milestones 1–2). No runtime dependencies other than the workspace package `@recruit/data`.

**Spec:** `docs/superpowers/specs/2026-10-20-recruit-plus-design.md`, sections 3.3, 4, 5, 8 and 10. Rules come from the research library at `L:\9th Edition\` (see Sources below). Unit data comes from `packages/data/generated/catalogues/*.json` (`UnitOut`, `packages/data/src/model/types.ts`).

**Branch:** `m4-rules-engine` in the worktree `L:\9th Edition\app-m4`, created off `main`. Milestone 3 is being built in parallel on `m3-rules-reference`. To keep the merge clean, this plan touches only `packages/engine/**`, the root `package-lock.json` (new workspace) and this plan file.

## Sources and citation tags
Every rules test title starts with a citation tag in square brackets. Task 1 adds a meta-test that fails on any test in `test/rules/**` without one. The tags are:

| Tag | Source |
|---|---|
| `TS §n` | `01_Core_Rules/Core_Rules_Turn_Sequence.md` |
| `TR §n` | `01_Core_Rules/Terrain_Rules.md` |
| `PP §n` | `01_Core_Rules/Psychic_Phase.md` |
| `CS §n` | `01_Core_Rules/Core_Stratagems.md` |
| `GL §n` | `01_Core_Rules/Glossary_and_Keywords.md` |
| `BD §n` | `05_Balance_Errata_and_Points/Balance_Dataslates.md` |
| `FAQ §n` | `05_Balance_Errata_and_Points/FAQs_Errata_and_Rules_Commentary.md` |
| `MP §n` | `02_Missions_and_Game_Modes/Matched_Play_Overview.md` |
| `GT §n` | `02_Missions_and_Game_Modes/Grand_Tournament_Mission_Packs.md` |
| `WCR` | Wahapedia 9th Core Rules page (final FAQ'd text), used where the library is silent |
| `R-n` | A numbered ruling in `packages/engine/RULINGS.md` (our interpretation, with its reasoning and sources) |

## Global Constraints
- **Rules version:** the final 9th Edition state (Arks of Omen, 13 Apr 2023 Balance Dataslate). Source precedence, from spec §4: final GW changes > BSData v9.8.0 > Wahapedia snapshot > research library.
- **Wrong rules are the worst failure.** Never invent a rule the sources don't state. When the sources are silent or ambiguous:
  - add a numbered ruling to `RULINGS.md` (the decision, why, and sources);
  - cite it as `[R-n]`;
  - keep it out of the core automation if it is really a faction rule. It goes through the assistance hooks instead.
- **Purity:** `src/` imports no `node:` modules, `Math.random`, `Date`, `crypto` or globals. A test in Task 1 greps `src/` for them. Only `src/data/**` may import `@recruit/data`.
- **Serialisable:** every Command, Event, GameState and GameRecord is plain JSON (`JSON.parse(JSON.stringify(x))` deep-equals `x`).
- **Units:** distances are inches (`number`), and mm are converted with `/ 25.4`. The tolerance is `EPS = 1e-6`.
  - `within(d, x)` is `d <= x + EPS`.
  - `moreThan(d, x)` is `d > x + EPS`.
  - So "exactly 9 inches" is *not* "more than 9 inches".
- **Ids:** unit and model ids come from the setup; models are named `<unitId>.m<n>`. Roll ids are `r<n>` and batch sequence numbers are integers, both counted inside the state. Never use random ids.
- **Messages:** every `Problem.message` is plain English for a newcomer, names the unit, says what's wrong and what to do (e.g. `"Intercessor Squad Advanced this turn, so it can't charge."`), and carries `rule` (a citation tag). No BattleScribe or engine jargon ("selection", "event", "batch").
- **Assisted, not automated:** these are never coded per faction.
  - datasheet ability text (Explodes, Deep Strike permission, auras, bodyguards, Reanimation, Miracle dice, faction CP generation);
  - faction stratagems;
  - psychic power effects other than Smite;
  - transport keyword restrictions;
  - Dakka and HunTR weapon types (see R-12).

  They go through the one-tap effects (Task 8) and the manual toolkit (Task 19). The engine still enforces everything core about them, such as CP, once per phase, test rolls and deny.
- **Mission presets** (Task 7). Board sizes come from spec §4: Combat Patrol 44"×30", Incursion 44"×60", Strike Force 44"×60", Onslaught 44"×90".

| | `CORE_BOOK` (Combat Patrol, Onslaught) | `ARKS_OF_OMEN` (Incursion, Strike Force) |
|---|---|---|
| Starting CP | 3 / 18 | 6 |
| Battle-forged CP each Command phase | active player only | both players, every Command phase |
| Strategic Reserves CP | by Power Rating table | 0 |
| Primary | Take and Hold 5 VP per condition | hold 4 VP per condition, max 12 per turn |
| Round 5, second player | scores in Command phase | scores at end of their turn |
| First turn | roll-off winner chooses | roll-off winner goes first |
| Empty Dedicated Transports | allowed | destroyed (can't be used) |
| Both | reserves can't arrive in round 1; not-arrived by end of round 3 destroyed; Aircraft start in Strategic Reserves; ≤ half units and < half points off-table; 5 battle rounds; VP caps primary 45, each secondary 15, painted 10 |

## Review Focus
1. **Undo after a roll, then the same command again.** The dice state is restored, so repeating the command gives the same dice. A newcomer can't "re-roll by undo", and replay stays exact. *Task 1 test `undo restores the dice: repeating a command rolls the same values`.*
2. **The target dies part-way through a unit's shooting.** Later attacks on it are lost (logged "no models left"), the remaining targets still resolve, and nothing crashes. *Task 13 test `attacks at a target destroyed earlier in the same shooting are lost`.*
3. **A saved game from an unknown or corrupt record.** `loadGame` rejects a wrong schema or an unknown event type with a clear error before replaying, and never leaves a half-built state. *Task 20 test `loadGame refuses an unknown event type without throwing mid-replay`.*
4. **A model that already overlaps another, or sits on the board edge** (placed by the toolkit). Movement validation still runs: it may move away, but may not end overlapping. *Task 9 test `a model that starts overlapping may move clear but not stay`.*
5. **Exact boundary distances** (exactly 1" Engagement Range, 2" coherency, 9" set-up, 12" charge). Floating-point noise from a drag never flips the answer. *Task 3 test `boundaries: exactly 1" is within Engagement Range; exactly 9" is not more than 9"`.*

---

## File Structure
```
package-lock.json                       updated by npm install (new workspace)
packages/engine/
  package.json                          @recruit/engine; exports "." and "./data"; deps @recruit/data
  tsconfig.json  vitest.config.ts
  RULINGS.md                            numbered interpretations R-1… (each: decision, why, sources)
  src/
    index.ts                            public API (everything except src/data)
    core/
      types.ts                          ids, PlayerId, Problem, Rejected, Command/Event unions (re-exported)
      rules.ts                          citation constants used by Problem.rule
      dice.ts                           sfc32, DiceExpr, parseDice, roll helpers, scripted queue
      record.ts                         GameRecord, dispatch, undo, replay, loadGame, saveGame
      apply.ts                          apply(state, event): the single reducer (switch over event types)
      state.ts                          GameState, UnitState, ModelState, initialState(setup)
      context.ts                        HandlerCtx { state, emit, roll, reject } used by every handler
    geometry/
      shapes.ts                         Footprint (circle | oval | rect), polygonOf, bounds
      measure.ts                        edgeDistance, horizontalDistance, within, moreThan, whollyWithin
      coherency.ts                      inCoherency, coherentGroups, coherencyRemovals
      path.ts                           pathLength, sweep samples, segment/polygon intersection
    terrain/
      types.ts                          TerrainFeature, TerrainCategory, TerrainTrait
      visibility.ts                     canSee(model, model), unitVisible, denseCoverPenalty
      cover.ts                          coverFor(model, attack) -> { light, heavy } and Exposed Position
      movement.ts                       terrainMoveCost, crossesDifficultGround, canEndOn
      ld.ts                             inspiringBonus
    datasheet/
      types.ts                          Datasheet, ModelProfile, WeaponProfile, Bracket, Move, StrengthExpr
      profile.ts                        currentProfile(model) (degrading brackets), keywords helpers
    setup/
      mission.ts                        MissionRules, CORE_BOOK, ARKS_OF_OMEN, BOARD_SIZES, starting CP
      setup.ts                          GameSetup, ArmyInput, UnitInput, validateSetup
      deploy.ts                         deploy, declareReserves, first-turn roll-off, begin battle
    turn/
      phases.ts                         Phase/Step order, endStep/endPhase, battle rounds, end of game
      command.ts                        Command phase CP, CP cap
      objectives.ts                     objective control, ObSec, scoring presets, VP and caps
    interact/
      windows.ts                        roll windows, Command Re-roll, ability re-roll, replaceDie, confirmRoll
      effects.ts                        one-tap Effect store, expiry, queries (hitMods, rerolls, fnp…)
      stratagems.ts                     CP spend, once-per-phase, useStratagem (generic), core stratagem ids
      reactions.ts                      reaction windows (offer, decline, resolve)
    move/
      movement.ts                       beginMove/completeMove/remainStationary, path validation
      transports.ts                     embark, disembark, destroyed transport + Emergency Disembarkation
      reserves.ts                       arrivals, Aircraft leave/return, end-of-round-3 destruction
      breakout.ts                       Desperate Breakout, Cut Them Down
    attack/
      sequence.ts                       AttackSequence state machine: attacks→hit→wound→save→damage
      resolve.ts                        pure maths: hitNeeded, woundNeeded, saveNeeded, caps, blastShots
      allocate.ts                       allocation order, damage, Feel No Pain, mortal wounds, brackets
    phases/
      psychic.ts                        manifest, Smite, Perils, Deny, psychic actions
      shooting.ts                       eligibility, targeting, weapon-type rules, Look Out Sir, BGNT
      charge.ts                         declare, overwatch, charge roll/move, Heroic Interventions
      fight.ts                          fight order, pile in, melee attacks, consolidate
      morale.ts                         Morale tests, Combat Attrition, coherency checks
      actions.ts                        start/fail/complete actions
    toolkit/
      toolkit.ts                        manual adjustments
    log/
      describe.ts                       plain-English line per event
      queries.ts                        currentStep, eligible units per phase, helpers for UI/lessons
    data/
      index.ts                          @recruit/engine/data entry
      parse.ts                          characteristic/weapon/base string parsers
      adapter.ts                        toDatasheet(UnitOut) -> { datasheet, issues }
      muster.ts                         musterFromRoster(view, units) -> { army, problems }
  test/
    helpers/game.ts                     newTestGame, play, expectRejected, at(x,y), autoConfirm
    helpers/realData.ts                 load generated catalogues (node:fs; tests only)
    fixtures/units.ts                   hand-built datasheets: marines(n), guardsmen(n), character(), tank(), knight(), flyer(), psyker(), transport()
    meta/purity.test.ts  meta/citations.test.ts
    core/*.test.ts  geometry/*.test.ts  data/*.test.ts
    rules/<area>.test.ts                every rules test (citation tag required)
    scenario/full-game.test.ts
```

---

### Task 1: Package scaffold, dice and the event-sourced core

**Files:**
- Create: `packages/engine/{package.json,tsconfig.json,vitest.config.ts,RULINGS.md}`, `src/index.ts`, `src/core/{types,rules,dice,record,apply,state,context}.ts`
- Test: `test/core/dice.test.ts`, `test/core/record.test.ts`, `test/meta/purity.test.ts`, `test/meta/citations.test.ts`

**Interfaces:**
- Produces, in `core/types.ts`. This is the contract every task uses; copy it exactly:
```ts
export type PlayerId = 'A' | 'B';
export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');
export interface Problem { code: string; message: string; rule: string; unitId?: string; modelIds?: string[] }
export interface Rejected { ok: false; problems: Problem[] }
export interface Accepted { ok: true; game: GameRecord; events: GameEvent[] }
export type DispatchResult = Accepted | Rejected;
export interface Cmd<T extends string> { type: T; by: PlayerId }   // every Command extends this
```
- Produces, in `core/dice.ts`:
```ts
export interface DiceExpr { n: number; sides: 3 | 6; plus: number }      // "2D6"→{2,6,0}, "D3+3"→{1,3,3}, "4"→{0,6,4}
export function parseDice(s: string): DiceExpr | null;                   // "D6","2D3","D6+2","3","2d6","D3 + 1"; else null
export interface DiceState { s: [number, number, number, number]; queue: number[] }
export function seedDice(seed: number): DiceState;
export function nextD6(d: DiceState): { value: number; next: DiceState }; // queue first (values 1..6), then sfc32
export const d3FromD6 = (v: number) => Math.ceil(v / 2);                  // TS §1.6
export interface Die { value: number; sides: 3 | 6; rerolled?: true; replaced?: true }
```
- Produces, in `core/record.ts`:
```ts
export interface Batch { seq: number; command: Command; events: GameEvent[] }
export interface GameRecord { schema: 1; setup: GameSetup; batches: Batch[] }
export function newGame(setup: GameSetup): GameRecord;               // Task 6 adds: throws when validateSetup finds problems
export function stateOf(game: GameRecord): GameState;                 // memoised replay
export function dispatch(game: GameRecord, command: Command): DispatchResult;
export function undo(game: GameRecord): DispatchResult;               // Rejected 'undo-phase-start' if last batch began the current phase/step, 'nothing-to-undo'
export function saveGame(game: GameRecord): string;                   // JSON
export function loadGame(json: string): GameRecord;                   // throws EngineLoadError with a plain message
```
- Produces, in `core/context.ts`, the handler contract:
```ts
export interface Ctx {
  state: GameState;                                  // the draft, already updated by every emitted event
  emit(e: GameEvent): void;                          // apply(draft, e) then record it
  rollD6(count: number, kind: RollKind, player: PlayerId): Die[];   // emits 'diceRolled' (values + dice state after)
  reject(code: string, message: string, rule: string, extra?: Partial<Problem>): never;
}
export type Handler<C extends Command> = (ctx: Ctx, cmd: C) => void;
export function registerHandler<T extends Command['type']>(type: T, h: Handler<Extract<Command, { type: T }>>): void;
```
- `apply(state, event)` mutates a draft. `dispatch` clones the state once per command (`structuredClone`) and throws away the draft when a command is rejected.
- `GameEvent` and `Command` are discriminated unions assembled in `core/types.ts` from per-module type files. Each later task adds its own members.

- [ ] **Step 1: Scaffold the package**
  - `package.json`: name `@recruit/engine`, `"type": "module"`, exports `{ ".": "./src/index.ts", "./data": "./src/data/index.ts" }`, scripts `test` (`vitest run`) and `typecheck` (`tsc --noEmit`).
  - Dependencies: `"@recruit/data": "^0.1.0"`. Dev dependencies: `typescript ^7.0.2`, `vitest ^5.0.5`, `@types/node ^26.6.5` (tests only).
  - `tsconfig.json` extends `../../tsconfig.base.json` and includes `src` and `test`. `vitest.config.ts` copies `packages/data`'s.
  - Run `npm install` at the root so the workspace links and `package-lock.json` updates.
  - Start `RULINGS.md` with its format header and these rulings:
    - **R-1:** Indirect Fire worsens BS by 1 and gives +1 to armour saves. It is not cover and not capped (BD §3, TS §5.1).
    - **R-2:** Coherency means a single group and the per-model neighbour count (WCR "as a single group"; TS §1.2).
- [ ] **Step 2: Write the failing tests**
  - `dice.test.ts`:
    - `parseDice('D3+3')` gives `{n:1,sides:3,plus:3}`;
    - `parseDice('2D6')`, `parseDice('3')`, `parseDice('x2')` gives null;
    - seed 42 yields the same 20 values twice;
    - values are in 1..6;
    - a queue `[6,1]` is drawn before the generator;
    - `[TS §1.6] D3 is a D6 halved, rounded up`: `d3FromD6` maps 1..6 to 1,1,2,2,3,3.
  - `record.test.ts`, using a stub command `{type:'noteTest'}` registered only in the test:
    - `dispatch then replay gives an equal state`;
    - `a rejected command leaves the record unchanged`;
    - `undo removes exactly the last batch`;
    - `undo restores the dice: repeating a command rolls the same values` (Review Focus 1);
    - `saveGame/loadGame round-trips`;
    - `loadGame refuses schema 2` (message "This saved game was made by a newer version of the app.").
  - `purity.test.ts`: no file under `src/` (except `src/data/`) contains `from 'node:`, `Math.random`, `Date.`, `new Date`, `crypto.` or `@recruit/data`.
  - `citations.test.ts`: every `test(` / `it(` title in `test/rules/**/*.test.ts` and `test/scenario/**` starts with `[` and contains a tag that matches `/^\[(TS|TR|PP|CS|GL|BD|FAQ|MP|GT) §[\d.]+|^\[WCR|^\[R-\d+/`.
- [ ] **Step 3:** Run `npm test -w packages/engine`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement** `core/*` to the interfaces above.
  - `sfc32` with a splitmix32 seed expansion.
  - `stateOf` memoises on the record object (a `WeakMap`).
  - `dispatch` looks up the handler and runs it with a `Ctx` over a draft.
  - The handler's emitted events become the new batch. `seq` is the previous batch's seq + 1.
- [ ] **Step 5:** Run `npm test -w packages/engine && npm run typecheck -w packages/engine`. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(engine): package scaffold, seeded dice and event-sourced core`.

### Task 2: Datasheet types and test fixtures

**Files:**
- Create: `src/datasheet/types.ts`, `src/datasheet/profile.ts`, `test/fixtures/units.ts`
- Test: `test/core/profile.test.ts`

**Interfaces:**
- Produces, in `datasheet/types.ts`:
```ts
export type Move = { kind: 'fixed'; inches: number } | { kind: 'range'; min: number; max: number } | { kind: 'none' }; // "–": can't move
export type StrengthExpr = { kind: 'user' } | { kind: 'fixed'; v: number } | { kind: 'add'; v: number } | { kind: 'mul'; v: number };
export type WeaponType = 'Melee' | 'Assault' | 'Heavy' | 'Rapid Fire' | 'Grenade' | 'Pistol' | 'Dakka' | 'Other';
export interface WeaponProfile {
  name: string; type: WeaponType; range: number | null /* null = melee */; minRange: number | null;
  shots: DiceExpr; dakkaShort?: DiceExpr;           // Dakka X/Y: shots = Y (long), dakkaShort = X (within half range)
  s: StrengthExpr; ap: number; d: DiceExpr;
  blast: boolean; autoHit: boolean; indirect: boolean; text: string;
}
export interface ModelChars { M: Move; WS: number | null; BS: number | null; S: number; T: number; W: number; A: DiceExpr; Ld: number; Sv: number | null; invuln: number | null }
export interface Bracket { minW: number; maxW: number; chars: Partial<ModelChars> }   // degrading profile row
export interface ModelProfile { name: string; chars: ModelChars; brackets: Bracket[] }
export type BaseShape = { kind: 'circle'; d: number } | { kind: 'oval'; w: number; h: number } | { kind: 'rect'; w: number; h: number }; // inches
export interface PsykerProfile { cast: number; deny: number; powers: { name: string; wc: number | null; smite?: true }[] }
export interface Datasheet {
  id: string; name: string; role: string | null; keywords: string[] /* UPPER CASE */; factionKeywords: string[];
  models: ModelProfile[]; weapons: WeaponProfile[]; base: BaseShape; baseEstimated: boolean;
  transportCapacity: number | null; psyker: PsykerProfile | null; objectiveSecured: boolean; ocPerModel: number;
  powerRating: number; points: number;
}
```
- Produces, in `datasheet/profile.ts`:
  - `has(ds: Datasheet | UnitState, kw: string): boolean` (case-insensitive);
  - `currentChars(model: ModelState, profile: ModelProfile): ModelChars`, which applies the bracket that contains `woundsLeft`;
  - `CLOSE_COMBAT_WEAPON: WeaponProfile` (S User, AP 0, D 1, TS §7.3).
- Produces, in `test/fixtures/units.ts`, builders that return `Datasheet` with exact values:

| Builder | Values |
|---|---|
| `marines()` | M6 WS3 BS3 S4 T4 W2 A2 Ld7 Sv3; bolt rifle 30" Rapid Fire 1 S4 AP-1 D1; bolt pistol 12" Pistol 1 S4 AP0 D1; 32mm base |
| `guardsmen()` | M6 WS4 BS4 S3 T3 W1 A1 Ld6 Sv5; lasgun 24" Rapid Fire 1 S3 AP0 D1; frag grenade 6" Grenade D6 S3 AP0 D1 Blast; 25mm |
| `captain()` | CHARACTER INFANTRY; W5 Sv3 invuln 4; master-crafted bolter, power sword S+1 AP-3 D1; 40mm |
| `tank()` | VEHICLE; M10 BS3 T7 W11 Sv3; 60x35mm oval; Heavy D6 Blast lascannon-like weapon; brackets W11–6 full, 5–3 BS4, 2–1 BS5 |
| `knight()` | VEHICLE TITANIC; W24; 130mm; ocPerModel 10 |
| `flyer()` | VEHICLE AIRCRAFT FLY; M 20–50" |
| `psyker()` | CHARACTER INFANTRY PSYKER; cast 2 deny 1; powers Smite plus one WC 6 power |
| `rhino()` | VEHICLE TRANSPORT; capacity 10 |
| `heavyTeam()` | INFANTRY; Heavy 1 weapon |

- [ ] **Step 1: Write the failing tests:**
  - `[TS §1.1] degrading profile`: the tank on 4 wounds uses BS4;
  - `currentChars` with no brackets returns the profile unchanged;
  - `has(captain(),'character')` is true.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the types, the helpers and the fixtures.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): datasheet model and fixtures`.

### Task 3: Geometry — bases, distances, coherency

**Files:**
- Create: `src/geometry/{shapes,measure,coherency,path}.ts`
- Test: `test/rules/geometry.test.ts`

**Interfaces:**
- Produces:
```ts
export interface Pos { x: number; y: number; z: number; rot: number }   // z = elevation (floors), rot radians
export function polygonOf(base: BaseShape, p: Pos): Pt[];               // oval/circle as 64-gon (circle distance is exact, see below)
export function horizontalGap(a: Placed, b: Placed): number;            // closest base-to-base, 0 when touching/overlapping
export function distance3d(a: Placed, b: Placed): number;               // sqrt(gap² + dz²)
export function inEngagementRange(a: Placed, b: Placed): boolean;       // gap ≤ 1 && |dz| ≤ 5  (TS §1.3)
export function within(d: number, x: number): boolean; export function moreThan(d: number, x: number): boolean;
export function whollyWithinPolygon(m: Placed, poly: Pt[]): boolean; export function anyPartWithin(m: Placed, poly: Pt[]): boolean;
export function overlaps(a: Placed, b: Placed): boolean;                // gap < -EPS (touching allowed)
export function inCoherency(models: Placed[]): boolean;                 // R-2: per-model 1 (or 2 at 6+) neighbours ≤2"h/5"v AND a single connected group
export function coherencyRemovals(models: Placed[], casualtyOrder: string[]): string[]; // TS §8.3; keep the largest connected group, then drop the fewest-neighbour model (ties: casualty order) until coherent
export type Placed = { id: string; base: BaseShape; pos: Pos };
```
- Circle–circle gap is computed exactly (centre distance − radii). Every other pair uses convex polygon distance (minimum vertex–edge distance, or 0 if they intersect).

- [ ] **Step 1: Write the failing tests:**
  - `[TS §1.4] measure base to base`: two 32mm bases with centres 3" apart have a gap of 3 − 32/25.4 ≈ 1.740;
  - `[TS §1.3] Engagement Range is 1" horizontally and 5" vertically`: gap 1, dz 5 is in range; gap 1.01 is not; dz 5.01 is not;
  - `[TS §1.4] boundaries: exactly 1" is within Engagement Range; exactly 9" is not more than 9"` (Review Focus 5), with gaps built as `1 + 1e-9` and `9 - 1e-9`;
  - `[TS §1.2] 5-model unit: each model needs one neighbour within 2"`;
  - `[TS §1.2] 6+ models need two neighbours`: a 6-model line 1.9" apart fails, because the end models have one neighbour;
  - `[R-2] two separate coherent clumps are not in coherency`;
  - `[TS §1.2] vertical 5" counts for coherency`;
  - `[TS §8.3] coherency removals keep the largest group`: 7 models (5 together, 2 far away) give the 2 far ones;
  - oval vs circle: a 60×35mm oval rotated 90° has its gap measured along the short axis.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): bases, base-to-base measurement and coherency`.

### Task 4: Terrain — visibility, cover, movement costs

**Files:**
- Create: `src/terrain/{types,visibility,cover,movement,ld}.ts`; add rulings R-3 to R-6 to `RULINGS.md`
- Test: `test/rules/terrain.test.ts`

**Interfaces:**
- Produces:
```ts
export type TerrainCategory = 'hill' | 'obstacle' | 'area';    // Buildings are units, not terrain (TR §2)
export type TerrainTrait = 'light-cover' | 'heavy-cover' | 'dense-cover' | 'exposed-position' | 'breachable' | 'scaleable'
  | 'difficult-ground' | 'unstable-position' | 'obscuring' | 'defensible' | 'defence-line' | 'inspiring';
export interface TerrainFeature { id: string; name: string; category: TerrainCategory; footprint: Pt[]; height: number; traits: TerrainTrait[]; inspiringKeywords?: string[] }
export const TERRAIN_PRESETS: Record<'ruins'|'craters'|'woods'|'industrial'|'containers'|'barricades'|'debris'|'statuary'|'ruined-walls', { category: TerrainCategory; traits: TerrainTrait[] }>; // TR §4 table, exact
export function canSee(from: ModelView, to: ModelView, terrain: TerrainFeature[]): boolean;
export function unitVisibleTo(from: ModelView, target: UnitView, terrain: TerrainFeature[]): boolean;
export function denseCoverPenalty(firer: ModelView, target: UnitView, terrain: TerrainFeature[]): boolean;
export function coverFor(model: ModelView, firer: ModelView | null, attack: 'ranged' | 'melee', terrain: TerrainFeature[]): { light: boolean; heavy: boolean };
export function crossesDifficultGround(path: Pt[], base: BaseShape, terrain: TerrainFeature[]): boolean;
export function climbCost(path: Pt[], endZ: number, terrain: TerrainFeature[], mover: { canBreach: boolean; fliesOverTerrain: boolean }): number;
export function canEndOn(feature: TerrainFeature, ds: Datasheet, z: number): boolean;
export function inspiringBonus(unit: UnitView, terrain: TerrainFeature[]): number;   // +1 if wholly within 6" (TR §3.3)
```
- `ModelView` is `Placed` plus its keywords and current W.
- **Visibility (R-3)** is a 2D footprint sampling model. It samples 16 boundary points plus the centre of each base. A line is blocked when it crosses an `obscuring` feature that is at least 5" tall, unless:
  - the observer or the target has any part within that feature;
  - the target is AIRCRAFT or has W ≥ 18.

  Models never block sight.
- **Dense Cover (R-4):** the −1 applies unless:
  - from one sample point on the firer's base, lines reach every sample point of at least one target model's base without crossing a `dense-cover` feature that is at least 3" tall;
  - or the firer has any part within that Dense feature (area terrain), or within 3" of it (obstacle);
  - or the target is AIRCRAFT or has any model with W ≥ 18.
- **Cover** applies only to INFANTRY, BEAST and SWARM:
  - Area Terrain: any part of the base within the footprint;
  - Obstacle: within 3", unless from one firer point every target sample point is reachable without crossing it (TR §2).
  - A model with `z > 0` on an `exposed-position` feature gets no cover (TR §3.1).
- **Climbing (R-5):** crossing a non-hill feature taller than 1" costs 2 × height (up and over), or `endZ` when ending on it. It costs nothing if the mover can breach (INFANTRY/BEAST/SWARM on a `breachable` feature), or if it is FLY on a Normal Move, Advance or Fall Back (TR §1, TS §3.1).
- **Defence Line (R-6):** two models within 2" horizontally, whose closest-point line crosses a `defence-line` feature, count as within Engagement Range of each other for charging and fighting (TR §3.3).

- [ ] **Step 1: Write the failing tests** (one per row; titles start with the tag):

| Tag | Case |
|---|---|
| `[TR §3.3]` | a 5"-tall obscuring ruin between two units blocks sight |
| `[TR §3.3]` | a 4"-tall obscuring feature does not |
| `[TR §3.4]` | a model within the ruin's footprint can see out and be seen |
| `[TR §3.3]` | a knight (W24) is visible through obscuring; the knight still can't see through it to infantry |
| `[TR §3.3]` | an AIRCRAFT is visible through obscuring |
| `[TR §3.1]` | dense cover between firer and target gives −1 |
| `[TR §3.1]` | no penalty when the firer is inside the woods |
| `[TR §3.1]` | no penalty against a W18+ model |
| `[TR §2]` | infantry within ruins footprint get light cover; a tank within ruins does not |
| `[TR §2]` | infantry 2" behind a barricade get cover; the attacker with a clear line to the whole base denies it |
| `[TR §3.1]` | Exposed Position: on top of containers, no cover |
| `[TR §3.2]` | path over craters crosses Difficult Ground; a 0.5"-tall feature still counts |
| `[R-5]` | climbing a 3" wall costs 6" for a tank, 0 for infantry through a breachable ruin, 0 for a jump unit's Normal Move |
| `[TR §3.2]` | Unstable Position: can't end on top |
| `[TR §3.2]` | only INFANTRY/BEAST/SWARM/FLY can end on an upper floor of scaleable ruins |
| `[TR §3.3]` | Inspiring (IMPERIUM): +1 Ld wholly within 6", 0 for a CHAOS unit |
| `[TR §4]` | presets match the Core Book table, e.g. ruins = Scaleable, Breachable, Light Cover, Defensible, Obscuring |

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Segment–polygon intersection lives in `geometry/path.ts`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): terrain categories, traits, visibility and cover`.

### Task 5: Data adapter — UnitOut to Datasheet for every catalogue

**Files:**
- Create: `src/data/{index,parse,adapter}.ts`, `test/helpers/realData.ts`, `test/data/adapter-baseline.json`; add rulings R-7 to R-12 (R-11: any weapon type other than the six core types and Dakka becomes `Other` with no type rule, flagged)
- Test: `test/data/parse.test.ts`, `test/data/adapter.test.ts`

**Interfaces:**
- Consumes: `UnitOut` from `@recruit/data/model`.
- Produces:
```ts
export type AdapterIssue = { kind: 'unparsed-char' | 'unparsed-weapon' | 'estimated-base' | 'starred-weapon' | 'unknown-capacity' | 'no-models'; detail: string };
export function toDatasheet(u: UnitOut, catalogueName: string): { datasheet: Datasheet; issues: AdapterIssue[] };
export function parseMove(s: string): Move | null;            // '6"', '20-60"', '-' → none, '12+D6"' → unparsed
export function parseTarget(s: string): number | null;        // '3+' → 3, '-' → null
export function parseWeaponType(s: string): { type: WeaponType; shots: DiceExpr; dakkaShort?: DiceExpr } | null; // 'Rapid fire 1', 'Asssault D6', 'Dakka 3/2'
export function parseStrength(s: string): StrengthExpr | null;  // 'User','+1','x2','X2','8'
export function parseBase(s: string | null): { base: BaseShape; estimated: boolean } | null;
```
- **Brackets:** model profiles named `"<Name> [n] (13+ Wounds Remaining)"` merge into one `ModelProfile`. Bracket ranges come from the parentheses: `13+` means 13..W, `7-12` means 7..12. Row 1 holds W. A `woundTrack` table maps its columns, in order, to the profile's `*` characteristics in the order M, WS, BS, S, T, A, Ld, Sv.
- **Invulnerable save (R-7):** read from an ability whose text matches `/has an? (\d)\+ invulnerable save\.?$/im` with no "against", "while" or "if" in the sentence. Any other invulnerable save is assisted (one-tap). The `"3+/5++"` Save format also sets the invulnerable save.
- **Other datasheet fields:**
  - **Auto-hit and Indirect:** `autoHit` comes from `/automatically hits the target/i`. `indirect` comes from `/can target units that are not visible/i`.
  - **Bases (R-8):**
    - `"Nmm"` and `"Nmm flying base"` become circles; `"A x Bmm"` becomes an oval.
    - `"Use model"` and `null` are estimated: VEHICLE 3"×5" rect; TITANIC 5"×9" rect; MONSTER 60mm circle; otherwise 32mm circle. Each estimate adds an `estimated-base` issue.
  - **Objective control:**
    - `objectiveSecured` is set when the unit has an ability named "Objective Secured".
    - `ocPerModel` is 10 for TITANIC VEHICLE units in the Imperial Knights and Chaos Knights catalogues, 5 for ARMIGER or WAR DOG units there, and 1 otherwise. That's R-9, citing BD §2 "Knight vehicles count as 10 models … Armigers/War Dogs count as 5".
  - **Transport capacity (R-10):** from `/transport capacity of (\d+)/i`. Keyword restrictions are assisted.
  - **Psyker:** comes from the `Cast/Deny` profile. Datasheet powers come from `Warp Charge` profiles. Smite (WC 5) is always added (PP §3).
  - **Weapon types:**
    - Dakka is parsed (R-12). It is treated as Assault-free and not usable after Advancing (assisted).
    - `HunTR` becomes `Other` with an `unparsed-weapon` issue.

- [ ] **Step 1: Write the failing tests**
  - `parse.test.ts` uses every format from the survey: `'Heavy 2D6+1'`, `'Asssault D6'`, `'Rapid fire 2'`, `'Assault D6 + 1'`, `'Grenade D6'`, `'Dakka 3/2'`, `'Melee'`, `'-'`; strengths `'User'`, `'+2'`, `'x2'`, `'X2'`; `'20-60"'`; `'60 x 35.5mm flying base'`.
  - `adapter.test.ts`, which needs `npm run data:build`:
    - `Necron Warriors`: BS 3, Gauss Flayer Rapid Fire 1 S4 AP −1, ObSec true, 32mm-class circle from the data;
    - `Monolith`: brackets 13–24 / 7–12 / 1–6 with BS 3/4/5 and A 6/D6/D3; Particle Whip Heavy D6 Blast; Portal of Exile auto-hit;
    - every unit in all 52 catalogues converts without throwing;
    - the per-kind issue counts are ≤ `adapter-baseline.json` (record it on first green run, commit it, and print the units for each kind). This guards against data regressions.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `realData.ts` reads `packages/data/generated/catalogues/*.json` with `node:fs`.
- [ ] **Step 4:** Run, then write the baseline. Expected: PASS. Note the baseline counts in the commit message.
- [ ] **Step 5:** Commit: `feat(engine): datasheet adapter for all catalogues`.

### Task 6: Game setup, deployment, reserves declaration, first turn

**Files:**
- Create: `src/setup/{mission,setup,deploy}.ts`, `src/core/state.ts` (full shapes), `test/helpers/game.ts`
- Test: `test/rules/setup.test.ts`

**Interfaces:**
- Produces:
```ts
export interface MissionRules {
  pack: 'core-book' | 'arks-of-omen'; battleRounds: 5; startingCp: number; cpEveryCommandPhase: 'active' | 'both';
  strategicReservesFree: boolean; reservesFromRound: 2; reservesDeadlineRound: 3; aircraftStartInReserves: true;
  primary: { kind: 'take-and-hold' | 'domination'; vpPerCondition: 5 | 4; maxPerTurn: 15 | 12 };
  secondPlayerRound5: 'command-phase' | 'end-of-turn'; firstTurn: 'winner-chooses' | 'winner-first';
  emptyDedicatedTransportsDestroyed: boolean; vpCaps: { primary: 45; secondary: 15; painted: 10 };
}
export type BattleSizeId = 'combat-patrol' | 'incursion' | 'strike-force' | 'onslaught';   // same values as @recruit/data/roster; redeclared because the core can't import @recruit/data
export function missionRulesFor(size: BattleSizeId): MissionRules;   // CORE_BOOK for combat-patrol/onslaught, ARKS_OF_OMEN otherwise
export const BOARD_SIZES: Record<BattleSizeId, { w: number; h: number }>;   // 44×30, 44×60, 44×60, 44×90
export interface UnitInput { id: string; datasheet: Datasheet; models: { profile: string; weapons: string[]; count: number }[]; warlord?: boolean; casualtyOrder?: string[] }
export interface ArmyInput { player: PlayerId; name: string; units: UnitInput[]; cpSpentPreBattle: number; battleForged: true }
export interface GameSetup {
  seed: number; scriptedDice?: number[]; battleSize: BattleSizeId; rules: MissionRules; board: { w: number; h: number };
  armies: [ArmyInput, ArmyInput]; terrain: TerrainFeature[]; objectives: { id: string; pos: Pt }[];
  zones: Record<PlayerId, Pt[]>; edges: Record<PlayerId, 'north' | 'south' | 'east' | 'west'>; attacker: PlayerId;
  settings: { rollWindows: boolean; reactions: boolean };
}
export function validateSetup(s: GameSetup): Problem[];
```
- `GameState` (in `core/state.ts`) holds everything later tasks read:
  - `round`, `turn` (`first` | `second`), `active: PlayerId`, `phase`, `step`, `firstPlayer`;
  - `cp: Record<PlayerId, number>` and `cpGainedThisRound`;
  - `vp: Record<PlayerId, { primary; secondary: Record<string, number>; painted }>`;
  - `units: Record<string, UnitState>`, `models: Record<string, ModelState>`;
  - `rolls`, `pending: Pending | null`, `effects`, `stratagemsUsed`, `attack`, `activation`, `fight`, `objectivesHeld`, `dice: DiceState`, `nextRoll`, `ended`.
- `UnitState` holds:
  - `id`, `player`, `datasheet`, `modelIds`, `startingStrength`, `location` (`'battlefield' | 'deploying' | 'reserves' | 'embarked' | 'destroyed'`), `embarkedIn`, `reserveKind` (`'strategic' | 'deep-strike'`), `casualtyOrder`;
  - `turn`, a `TurnFlags` record reset at each turn start: `moved: 'none' | 'normal' | 'advance' | 'fall-back' | 'stationary'`, `arrived`, `disembarked`, `disembarkedFromDestroyed`, `embarked`, `shot`, `charged`, `chargeTargets`, `heroic`, `fought`, `psychicAttempts`, `cast`, `lostThisTurn`, `selected: Record<'move'|'shoot'|'fight'|'psychic'|'charge', number>`;
  - `round`, a `RoundFlags` record reset each battle round: `smited`, `action`;
  - `battle`, a `BattleFlags` record: `insaneBraveryUsed` is tracked per player in state instead.
- `ModelState` holds `id`, `unitId`, `profile`, `weapons: string[]`, `woundsLeft`, `pos: Pos | null`, `destroyed`, `allocatedThisPhase`.
- Commands:
  - `{type:'declareReserves', by, unitIds, kind}`
  - `{type:'deploy', by, unitId, positions: Record<modelId, Pos>, embarked?: string[]}`
  - `{type:'endDeployment', by}`
  - `{type:'rollOffFirstTurn', by}`
  - `{type:'chooseFirstTurn', by, first: PlayerId}`
  - `{type:'beginBattle', by}`
- Test helper `test/helpers/game.ts`:
```ts
export function newTestGame(o: { a: UnitInput[]; b: UnitInput[]; terrain?: TerrainFeature[]; size?: BattleSizeId; dice?: number[]; windows?: boolean }): GameRecord; // board 44×60, zones = 12" strips at y<12 (A) and y>48 (B)
export function placeAll(game: GameRecord, positions: Record<string, Pos[]>): GameRecord;   // deploys every unit, skips to battle round 1 Command phase, A first
export function play(game: GameRecord, ...cmds: Command[]): GameRecord;   // throws with the problems on rejection; auto-confirms windows unless windows:true
export function expectRejected(game: GameRecord, cmd: Command, code: string): void;
export const at = (x: number, y: number, z = 0): Pos => ({ x, y, z, rot: 0 });
export function unitInput(id: string, ds: Datasheet, count?: number): UnitInput;
```

- [ ] **Step 1: Write the failing tests**
  - `[MP §2] starting CP by battle size`: Combat Patrol 3, Onslaught 18, Incursion 6, Strike Force 6. Starting CP minus `cpSpentPreBattle`.
  - `[MP §4] deployment alternates one unit at a time starting with the Defender` (the Defender is the non-attacker).
  - `[MP §4] a player who has finished lets the other deploy the rest`.
  - `[MP §4] models must be wholly within their deployment zone`.
  - `[TS §1.3] can't be set up within Engagement Range of enemy models`.
  - `[TS §1.2] a unit must be set up in coherency`.
  - `[TS §3.3] Strategic Reserves cost by combined Power Rating`: PR 9 costs 1, 10 costs 2, 25 costs 3, 41 costs 5; free under Arks of Omen.
  - `[TS §3.3] Fortifications can never go into Strategic Reserves`.
  - `[MP §4] no more than half the units and less than half the points off the table`.
  - `[BD §6] Aircraft must start in Strategic Reserves`: deploying a flyer is rejected.
  - `[GT §5] a Dedicated Transport deployed empty counts as destroyed`: Arks of Omen yes, Core Book no.
  - `[MP §4] Core Book: roll-off winner chooses first turn`; `[GT §2] Arks of Omen: roll-off winner goes first`.
  - `beginBattle puts round 1, first player, Command phase`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `validateSetup` checks two different players, unique ids, every model profile and weapon name present on its datasheet, and an objective inside the board.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): game setup, deployment and reserves declaration`.

### Task 7: Turn structure, Command phase, objectives and VP

**Files:**
- Create: `src/turn/{phases,command,objectives}.ts`; add ruling R-13
- Test: `test/rules/turn.test.ts`, `test/rules/objectives.test.ts`

**Interfaces:**
- Produces:
```ts
export type Phase = 'pre-battle' | 'command' | 'movement' | 'psychic' | 'shooting' | 'charge' | 'fight' | 'morale' | 'ended';
export type Step = 'deploy' | 'first-turn' | 'main' | 'move-units' | 'reinforcements' | 'charges' | 'heroic-interventions' | 'morale-tests' | 'coherency';
export const PHASE_STEPS: Record<Phase, Step[]>;
export function objectiveControl(state: GameState): Record<string, PlayerId | null>;   // TS §9
export function primaryConditions(state: GameState, p: PlayerId): number;              // conditions met now
```
- Commands:
  - `{type:'endStep', by}` and `{type:'endPhase', by}`, both by the active player. Each phase's own task adds "can't end yet" checks through `registerEndCheck(phase, (state) => Problem | null)`.
  - `{type:'scoreVp', by, player, category: 'secondary' | 'painted', name?: string, amount}` (secondaries are entered manually).
  - `{type:'concede', by}` and `{type:'endGame', by}` (an agreed stop).
- **Turn order:** first player's turn, then second; 5 rounds. At the end of round 5's second turn, `ended`, and the winner is the player with most VP or a draw (MP §4.16).
- **Phase entry and turn start:**
  - Entering the Command phase gains +1 CP for the active player, or for both players under Arks of Omen (TS §2). These gains are exempt from the cap.
  - The start of each turn resets `TurnFlags`, clears `allocatedThisPhase` at each phase, and expires effects.
- **Primary scoring:**
  - At the end of the Command phase from round 2, the active player scores `vpPerCondition` × conditions.
  - Take and Hold conditions: hold 1+ objectives; hold 2+; hold more than the opponent. Domination: 2+, 3+, more.
  - Under Arks of Omen in round 5, the second player scores at the end of their turn instead.
- **VP caps:** primary capped at 45; each secondary name at 15; painted at 10.
- **Objective control:**
  - A model is in range within 3" horizontally and 5" vertically of the 40mm marker. Measure to the marker's edge, so 3 + 20/25.4 from its centre to the base edge.
  - Count models × `ocPerModel`. AIRCRAFT and FORTIFICATION units (role or keyword) never count.
  - Objective Secured: holds the marker if any ObSec model is in range, unless the enemy also has an ObSec model in range. Then count models.
  - A model in range of two markers counts only for the nearest. Ties go to the first in setup order (R-13: TS §9 "each model counts toward only one marker").
  - A toolkit-set sticky owner (Task 19) holds until the opponent controls it.
- **Reserves deadline:** at the end of round 3, units still in reserves are destroyed (TS §3.2, MP §4). At game end, units still off the table count as destroyed.

- [ ] **Step 1: Write the failing tests:**
  - `[TS §1.9] phase order Command→Movement→Psychic→Shooting→Charge→Fight→Morale`;
  - `[TS §2] Core Book: +1 CP to the active player only`;
  - `[GT §5] Arks of Omen: both players gain 1 CP every Command phase`;
  - `[MP §5] Take and Hold scores 5 per condition from round 2`: round 1 scores nothing; holding 2 of 4 against 1 scores 15;
  - `[GT §5] Arks of Omen hold component 4 per condition`;
  - `[GT §5] round 5 second player scores at end of their turn`;
  - `[MP §5] primary capped at 45`;
  - `[TS §9] more models in range controls`;
  - `[TS §9] Aircraft never control`;
  - `[TS §9] ObSec beats more models`;
  - `[TS §9] both sides ObSec: count models`;
  - `[BD §2] a Knight counts as 10 models`;
  - `[TS §9] range is 3" horizontally and 5" vertically to the marker edge`;
  - `[R-13] a model counts toward only its nearest marker`;
  - `[TS §3.2] reserves not arrived by end of round 3 are destroyed`;
  - `[MP §4] the game ends after 5 rounds and most VP wins`;
  - `[MP §4] a player who concedes loses`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): battle rounds, Command phase, objectives and VP`.

### Task 8: Roll windows, re-rolls, effects, CP and stratagems

**Files:**
- Create: `src/interact/{windows,effects,stratagems,reactions}.ts`
- Test: `test/rules/rerolls.test.ts`, `test/rules/effects.test.ts`, `test/rules/stratagems.test.ts`

**Interfaces:**
- Produces:
```ts
export type RollKind = 'hit' | 'wound' | 'save' | 'damage' | 'attacks' | 'advance' | 'charge' | 'psychic' | 'deny'   // windowed (CS §2 Command Re-roll list)
  | 'fnp' | 'morale' | 'attrition' | 'perils' | 'smite' | 'transport' | 'roll-off' | 'other';
export const WINDOWED: RollKind[];
export interface RollRecord { id: string; kind: RollKind; player: PlayerId; dice: Die[]; whole: boolean /* 2D6-style: re-rolled together */; context: string }
export type Pending =
  | { kind: 'roll'; rollId: string; player: PlayerId }
  | { kind: 'reaction'; reaction: ReactionKind; player: PlayerId; subjectUnitId: string; options: string[] }
  | { kind: 'placement'; player: PlayerId; transportId: string; unitIds: string[] };
export type EffectKind =
  | { kind: 'reroll'; roll: 'hit' | 'wound' | 'save'; which: 'ones' | 'failed' }
  | { kind: 'mod'; roll: 'hit' | 'wound' | 'save' | 'charge' | 'advance' | 'psychic'; value: number; armourOnly?: true }
  | { kind: 'ap'; value: number } | { kind: 'damage'; value: number } | { kind: 'attacks'; value: number }
  | { kind: 'fnp'; value: number } | { kind: 'invuln'; value: number } | { kind: 'ignore-cover' }
  | { kind: 'fights-first' } | { kind: 'fights-last' } | { kind: 'objective-secured'; value: boolean };
export interface Effect { id: string; unitId: string; side: 'attacking' | 'defending' | 'self'; effect: EffectKind; until: 'next-activation' | 'phase' | 'turn' | 'round' | 'battle'; note: string }
export function effectsFor(state: GameState, unitId: string, side: Effect['side']): EffectKind[];
```
- Commands:
  - `{type:'confirmRoll', by}`.
  - `{type:'reroll', by, dice: number[], source: 'command-reroll' | 'ability', note?}`.
    - `command-reroll` costs 1 CP and counts as the Command Re-roll stratagem (once per phase).
    - It re-rolls one die, or the whole roll when `whole` is set.
    - It may target only `WINDOWED` kinds.
  - `{type:'addEffect', by, effect: Omit<Effect,'id'>}` and `{type:'removeEffect', by, effectId}`.
  - `{type:'useStratagem', by, name, cp, unitIds, note}`: a generic faction stratagem (CP and once-per-phase only).
  - `{type:'gainCp', by, amount, source: 'ability'}`: capped at 1 per battle round across all `ability` gains (TS §2). Stratagem refunds use `source:'stratagem'`, which is uncapped (FAQ §2.1).
  - `{type:'respond', by, choice}` for reactions.
- Handler helper used by later tasks:
```ts
export function rollWindowed(ctx: Ctx, n: number, kind: RollKind, player: PlayerId, o: { whole?: boolean; context: string; then: Continuation }): void;
```
  - It rolls, then applies automatic `reroll` effects for hit/wound/save (TS §1.6: before modifiers, once per die).
  - If settings allow, it opens the window. Otherwise it resolves at once.
  - `Continuation` is a serialisable `{ module: string; step: string; data: unknown }`. `confirmRoll` resolves it through `registerContinuation(module, step, fn)`, so the work after a window survives save/load.
- `spendCp(ctx, player, name, cp, phaseScoped = true)` rejects:
  - `'not-enough-cp'`: "You need 1 CP and have 0.";
  - `'stratagem-once-per-phase'`: "You've already used Command Re-roll this phase." Matched by case-insensitive name.

- [ ] **Step 1: Write the failing tests:**
  - `[CS §2] Command Re-roll costs 1 CP and re-rolls one hit die`;
  - `[CS §2] Command Re-roll re-rolls both dice of a charge roll`;
  - `[TS §1.6] a die can never be re-rolled twice`: an ability re-roll, then Command Re-roll on the same die, is rejected `already-rerolled`;
  - `[CS §1] the same stratagem only once per phase`;
  - `[CS §1] can't use a stratagem without the CP`;
  - `[CS §2] Command Re-roll can't target a Morale test` (kind not windowed);
  - `[TS §1.6] re-roll effects happen before modifiers`: re-roll 1s, a die of 1 then 3 with +1 to hit becomes 4;
  - `[TS §2] ability CP gains capped at 1 per battle round`;
  - `[FAQ §2.1] CP from stratagems is not capped`;
  - `effects expire`: a `phase` effect is gone after `endPhase`, a `next-activation` one after that unit's activation;
  - `with rollWindows off, rolls resolve without a pending window`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): roll windows, re-rolls, one-tap effects and stratagem CP`.

### Task 9: Movement phase

**Files:**
- Create: `src/move/movement.ts`, `src/move/breakout.ts`
- Test: `test/rules/movement.test.ts`

**Interfaces:**
- Commands:
  - `{type:'beginMove', by, unitId, kind: 'normal' | 'advance' | 'fall-back'}`. An Advance rolls its D6 in a window (`advance`).
  - `{type:'completeMove', by, unitId, moves: Record<modelId, { to: Pos; path?: Pt[] }>, embarkInto?: string}`.
  - `{type:'cancelMove', by, unitId}`: Normal or Fall Back only, before completing.
  - `{type:'remainStationary', by, unitId}`.
  - `{type:'desperateBreakout', by, unitId}`.
- Produces `moveAllowance(state, modelId, kind): { max: number; min?: number }`:
  - M, or M + Advance roll;
  - −2 Difficult Ground when any model's path crosses it;
  - for Aircraft, max = M max and min = M min.
- **Validation** (each failure is a `Problem` naming the models):
  1. In the Movement phase, move-units step, own unit, on the battlefield, not yet selected this phase (TS §3.1). Toolkit extra activations reset that.
  2. A unit that starts within Engagement Range may only Fall Back or remain. The exceptions are AIRCRAFT units and units engaged only with AIRCRAFT (TS §3.1).
  3. Path length plus climb cost ≤ allowance for each model. A model's path defaults to the straight line. FLY on Normal/Advance/Fall Back ignores vertical (TS §3.1).
  4. No model passes through another model's base. Path samples are taken every 0.25" (TS §3.1). FLY on Normal/Advance/Fall Back may pass over models, but can't end on one. Anything may pass over AIRCRAFT (TS §3.5).
  5. Normal and Advance: no model may come within Engagement Range of an enemy model at any sample (TS §3.1). Fall Back may, but must end outside. Ending within Engagement Range of an enemy AIRCRAFT is never allowed (TS §3.5).
  6. Every model stays wholly on the board, and the unit ends in coherency (TS §1.2).
  7. `canEndOn` holds for z > 0 positions (Task 4).
  8. AIRCRAFT: each model's displacement ≥ min (TS §3.5).
- **Consequences:**
  - Advance: the unit can't shoot (except Assault), charge or start actions.
  - Fall Back: can't charge; can't shoot or manifest unless TITANIC.
  - These are flags on `TurnFlags.moved` that the later tasks read. Any unit still unmoved when the step ends is `stationary`.
- **End-of-step check:** an AIRCRAFT that hasn't moved its minimum blocks `endStep`, with "Stormtalon must move at least 20" or leave the battlefield." (TS §3.5).
- **Cut Them Down:** `beginMove` Fall Back opens a reaction for the opponent when they have ≥1 CP and models within Engagement Range. On `respond 'cut-them-down'`, roll a D6 per such model; each 6 is 1 mortal wound on the falling-back unit (CS §2).
- **Desperate Breakout (CS §2):**
  - 2 CP, for an engaged unit that hasn't moved.
  - Roll a D6 per model; each 1 destroys a model, in casualty order.
  - The survivors then make a Fall Back that may pass through enemy models. Any model that ends within Engagement Range is destroyed.
  - The unit can do nothing else this turn (`TurnFlags.brokeOut`).

- [ ] **Step 1: Write the failing tests:**
  - `[TS §3.1] Normal Move up to M`: 6.0" passes, 6.1" fails;
  - `[TS §3.1] Advance adds a D6` (scripted 4: 10" passes, 10.1" fails);
  - `[TS §3.1] Normal Move can't pass within Engagement Range`;
  - `[TS §3.1] a unit starting engaged can only Fall Back or remain stationary`;
  - `[TS §3.1] Fall Back may cross Engagement Range but must end outside it`;
  - `[TS §3.1] models can't move through other models`;
  - `[GL §2] FLY moves over models on a Normal Move`;
  - `[TS §3.1] each unit can be selected to move once per phase`;
  - `[TR §3.2] Difficult Ground: −2" to Move`;
  - `[TR §3.2] Difficult Ground ignored if every model can FLY`;
  - `[TR §3.2] TITANIC ignore Difficult Ground under 3" tall`;
  - `[R-5] climbing counts vertical distance`;
  - `[TS §1.2] a move that breaks coherency is rejected`;
  - `[TS §3.5] Aircraft must move at least its minimum`;
  - `[TS §3.5] other models may move over Aircraft but not end within its Engagement Range`;
  - `[TS §3.1] can't move off the battlefield`;
  - `a model that starts overlapping may move clear but not stay` (Review Focus 4; tag `[TS §3.1]`);
  - `[CS §2] Cut Them Down: each 6 is a mortal wound`;
  - `[CS §2] Desperate Breakout: 1s die, models still engaged at the end die, unit does nothing else`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): Movement phase moves, terrain and aircraft limits`.

### Task 10: Transports

**Files:**
- Create: `src/move/transports.ts`
- Test: `test/rules/transports.test.ts`

**Interfaces:**
- Commands:
  - `completeMove` with `embarkInto`.
  - `{type:'disembark', by, unitId, positions: Record<modelId, Pos>}`.
  - `{type:'placePassengers', by, transportId, placements: Record<unitId, Record<modelId, Pos>>, emergency: boolean}`. This answers the `placement` pending.
- **Embark (TS §3.4):**
  - Every model ends a Normal Move, Advance or Fall Back within 3" of a friendly TRANSPORT that isn't in enemy Engagement Range.
  - The unit didn't disembark this phase, and the capacity (models) isn't exceeded. With an unknown capacity, the count isn't checked.
  - Models leave the board. The unit's `location` becomes `embarked`, and it counts as having made the transport's move type (TS §3.4).
- **Disembark (WCR "has not yet made a Normal Move"; TS §3.4):**
  - The unit started the phase embarked, and the transport hasn't moved yet this phase.
  - Models are set up wholly within 3" of the transport, not in enemy Engagement Range, in coherency.
  - A model that can't fit wholly within 3" may be set up with its base within 1" instead. That is the large-model rule (TS §3.4), allowed only when its base is wider than 6".
  - `moved = 'normal'` for Heavy purposes, never stationary. The unit may then `beginMove` as normal (TS §3.4).
- **Destroyed transport:** when a TRANSPORT model's last wound goes with units embarked, set `pending: placement` for the owner.
  - `placePassengers` checks wholly within 3", or 6" with `emergency`, which costs 1 CP for Emergency Disembarkation (CS §2). It also checks no enemy Engagement Range.
  - Omitted models are destroyed.
  - Then roll a D6 per placed model. Each 1, or 1–2 with emergency, destroys one model in casualty order.
  - Units get `disembarkedFromDestroyed`: they can't charge or Heroically Intervene this turn.

- [ ] **Step 1: Write the failing tests:**
  - `[TS §3.4] embark when every model ends within 3"`;
  - `[TS §3.4] can't embark into a transport in enemy Engagement Range`;
  - `[TS §3.4] capacity limits models`;
  - `[TS §3.4] can't disembark after the transport moved`;
  - `[TS §3.4] disembark wholly within 3" then still move`;
  - `[TS §3.4] can't embark in the phase it disembarked`;
  - `[TS §3.1] a unit that disembarked never counts as Remained Stationary` (Heavy −1 in Task 13 reads this; here assert `moved !== 'stationary'`);
  - `[TS §3.4] destroyed transport: each 1 kills a passenger`;
  - `[CS §2] Emergency Disembarkation: 6", 1–2 kill, 1 CP`;
  - `[TS §3.4] passengers of a destroyed transport can't charge this turn`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): transports, disembarking and destroyed transports`.

### Task 11: Reinforcements, Strategic Reserves and Aircraft

**Files:**
- Create: `src/move/reserves.ts`
- Test: `test/rules/reserves.test.ts`

**Interfaces:**
- Commands:
  - `{type:'arrive', by, unitId, positions: Record<modelId, Pos>}`: Reinforcements step only.
  - `{type:'aircraftLeave', by, unitId}`: Movement phase. The unit goes to Strategic Reserves free (TS §3.5).
- **Arrival rules:**
  - No arrival before `rules.reservesFromRound` (TS §3.3).
  - Every arrival is more than 9" horizontally from every enemy model (TS §1.4 horizontal; FAQ §2.3).
  - `deep-strike` units: anywhere wholly on the battlefield.
  - Strategic Reserves in round 2: wholly within 6" of any edge except the enemy's, and no part in the enemy deployment zone. Round 3+: wholly within 6" of any edge except the enemy's (TS §3.3).
  - Own-edge exception: every model within 1" of its own edge and wholly in its own deployment zone may ignore the 9". It may even arrive in Engagement Range, and then counts as having charged (no Overwatch) (TS §3.3).
  - A model whose smallest base dimension exceeds 6" must touch its own edge. That unit can't move, manifest, shoot, charge, Heroically Intervene or act that turn (TS §3.3).
  - AIRCRAFT from Strategic Reserves: anywhere more than 9" from enemies; they can't charge that turn (TS §3.5).
- **After arriving:** `arrived = true`, `moved = 'normal'`. The unit counts as having moved its full M (TS §3.2) and can't make another move this phase.

- [ ] **Step 1: Write the failing tests:**
  - `[TS §3.3] no arrivals in battle round 1`;
  - `[TS §3.3] round 2 Strategic Reserves: within 6" of an edge, not the enemy edge, not in the enemy zone`;
  - `[TS §3.3] round 3: enemy zone allowed if near a non-enemy edge`;
  - `[FAQ §2.3] exactly 9" horizontally is not "more than 9""`;
  - `[TS §1.4] a model on an upper floor still denies arrival in a horizontal circle`;
  - `[TS §3.3] own-edge arrival inside 9" counts as having charged`;
  - `[TS §3.2] arrived units count as having moved`: Heavy −1 for infantry, asserted through the flag;
  - `[TS §3.5] Aircraft can leave to Strategic Reserves and return anywhere more than 9" away`;
  - `[TS §3.5] Aircraft can't charge the turn they arrive`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): reinforcements, Strategic Reserves and aircraft`.

### Task 12: The attack sequence

**Files:**
- Create: `src/attack/{resolve,allocate,sequence}.ts`, the toolkit command `inflictMortalWounds` in `src/attack/allocate.ts`; add rulings R-14 and R-15
- Test: `test/rules/attack-maths.test.ts`, `test/rules/attack-sequence.test.ts`

**Interfaces:**
- Produces, in `resolve.ts` (pure):
```ts
export function strengthOf(model: ModelChars, w: WeaponProfile): number;   // set → ÷ → × → + → −, round up, min 1 (TS §1.6)
export function woundNeeded(s: number, t: number): 2 | 3 | 4 | 5 | 6;     // TS §5.6 table
export function capMod(sum: number): -1 | 0 | 1;                           // TS §5.6 hit and wound net cap
export function hitSucceeds(unmodified: number, needed: number, mod: number): boolean;  // 6 always, 1 never
export function saveSucceeds(unmodified: number, needed: number, mod: number): boolean; // 1 always fails
export function blastShots(expr: DiceExpr, rolled: number, targetModels: number): number; // 6–10 ⇒ ≥3, 11+ ⇒ max (TS §5.5)
export function bestSave(chars: ModelChars, invulnFx: number | null, ap: number, armourMods: number, allMods: number): { needed: number; mod: number; kind: 'armour' | 'invuln' } | null;
```
- Produces, in `sequence.ts`:
```ts
export interface AttackGroup { attackerUnitId: string; modelIds: string[]; weapon: WeaponProfile; targetUnitId: string; attacksFixed?: number; overwatch?: { needs: 5 | 6 }; melee: boolean; hitModParts: { source: string; value: number }[]; heavyBgnt?: boolean; requiresClear?: string[] }
export interface AttackSequence { id: string; groups: AttackGroup[]; index: number; stage: 'attacks' | 'hit' | 'wound' | 'save' | 'damage' | 'mortals' | 'done'; tally: { attacks: number; hits: number; wounds: number; failed: number; destroyed: string[] }; pendingMortals: Record<string, number> }
export function startAttacks(ctx: Ctx, groups: AttackGroup[], onDone: Continuation): void;
```
- **Stage rules**, each stage being one windowed roll:
  1. `attacks`: a random shots/A roll per model's weapon, Blast floor/ceiling against the model count fixed at targeting (TS §5.5).
  2. `hit`: per attack, needed = BS (Overwatch: 6, or 5 with Hold Steady), or WS. Modifiers:
     - the sum of group `hitModParts` plus hit effects (attacking and defending), capped at ±1 (TS §5.6);
     - Indirect worsens BS by 1 as a characteristic change, not a modifier (R-1);
     - auto-hit skips the roll (CS §2: auto-hit Overwatch too).
  3. `wound`: from S vs T, with effects capped at ±1; 6 always wounds, 1 always fails (TS §5.6).
  4. `save`: allocate per R-14, then roll one save per wound.
     - The roll is batched only when every model that could receive it has the same save target and FNP. Otherwise it rolls one at a time (each its own window).
     - Armour modifiers include Light Cover (ranged) and Heavy Cover (melee, unless the allocated model charged this turn) (TR §3.1), Indirect +1 (R-1), and AP improvement effects.
     - Invulnerable saves ignore AP and cover (TS §5.7). The engine picks the better save for the defender (R-15).
  5. `damage`: roll D per failed save in one window.
     - Apply each attack's damage to its allocated model, with Feel No Pain per wound lost (one rule only, the best value, TS §5.9).
     - Excess damage is lost (TS §5.6), and brackets update as wounds drop.
     - Destroyed models are recorded in `lostThisTurn`.
  6. `mortals`: mortal wounds queued by this activation are applied after all of its normal damage (FAQ §2.1). One at a time, excess carries over, FNP applies (TS §5.8).
- **Allocation (R-14).** The defender's choice is expressed in advance through the unit's `casualtyOrder`. The default is the reverse of the model list, so the first-listed (sergeant / special) models go last. `setCasualtyOrder` is a Task 19 toolkit command, callable any time by the owner.
  - If any model in the unit has lost wounds or had an attack allocated this phase, the attack must go to it (TS §5.6).
  - Otherwise the attack goes to the next living model in casualty order.
  - The defender doesn't adapt allocation after seeing each save. That's equivalent under the rules, because each attack still goes to the forced model first.

- [ ] **Step 1: Write the failing tests:**
  - **Maths:**
    - `[TS §5.6] wound table`: S8 vs T4 → 2, S5 vs T4 → 3, 4/4 → 4, 3/4 → 5, S4 vs T8 → 6, S4 vs T9 → 6;
    - `[TS §1.6] strength x2 and +1 apply together: S4, x2 weapon, +1 buff = 9`;
    - `[TS §5.6] hit modifiers cap at +1/−1`: −2 total behaves as −1;
    - `[TS §5.6] unmodified 6 always hits even at −1 with BS 6+`;
    - `[TS §5.6] unmodified 1 always fails`;
    - `[TS §5.6] save unmodified 1 always fails even with +2`;
    - `[TS §5.7] invulnerable ignores AP; cover doesn't improve it`;
    - `[TS §5.6] saves are not capped`: Light Cover +1 and a +1 effect make a 3+ save become 1+ while 1 still fails;
    - `[TS §5.5] Blast vs 6–10 models makes at least 3 attacks per weapon`;
    - `[TS §5.5] Blast vs 11+ makes the maximum`.
  - **Sequence**, with scripted dice and a 10-marine target:
    - `[TS §5.6] an attack must go to the already-wounded model`;
    - `[TS §5.6] a model that saved an allocated attack keeps receiving attacks`;
    - `[TS §5.6] excess damage from one attack is lost`: D3 roll of 3 on a W2 model kills one only;
    - `[TS §5.8] mortal wounds carry over`: 3 MW kill one W2 model and wound the next;
    - `[FAQ §2.1] mortal wounds are applied after the activation's normal damage`;
    - `[TS §5.9] only one Feel No Pain per wound lost`: 5+ and 6+ effects use 5+;
    - `[TS §1.1] a vehicle's profile degrades as it loses wounds`: the tank at 5 W uses BS4 for its next attack;
    - `[CS §2] Command Re-roll on a save is the defender's`: the window `player` is the defender;
    - `[TS §1.6] re-roll failed wounds effect`;
    - `[TR §3.1] Heavy Cover: no bonus for a model that charged this turn`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): attack sequence, allocation, damage and mortal wounds`.

### Task 13: Shooting phase

**Files:**
- Create: `src/phases/shooting.ts`; add ruling R-16
- Test: `test/rules/shooting.test.ts`

**Interfaces:**
- Commands: `{type:'shoot', by, unitId, assignments: { modelId: string; weapon: string; targetUnitId: string }[]}`. This builds groups (same weapon profile + target per firing model set) ordered by target as first assigned, then calls `startAttacks`.
- Produces `shootingProblems(state, cmd): Problem[]` (used by `shoot` and the UI) and `eligibleTargets(state, unitId, modelId, weapon): string[]`.
- **Unit-level rules:**
  - Once per phase per unit (TS §5.1).
  - Not if Advanced, except Assault weapons only. Not if it Fell Back, unless TITANIC (TS §3.1).
  - Not embarked.
  - Not while engaged, except Pistols and Big Guns Never Tire (TS §5.1, 5.2).
- **Per-assignment rules:**
  - Range: closest models within range. A weapon's minimum range can't target a unit wholly within it (TS §1.1).
  - Visible from that model (Task 4), unless the weapon is `indirect`. Then Indirect applies (R-1).
  - The target is not within Engagement Range of a friendly unit, unless it is engaged with the firer's own unit and the weapon is a Pistol or the model is BGNT (TS §5.1).
  - Look Out, Sir: the target unit contains a CHARACTER with W ≤ 9 and is within 3" of a qualifying friendly unit. It is then targetable only if visible and the closest enemy unit to that firing model, ignoring other such character units (WCR; TS §5.3).
  - Blast never targets a unit within Engagement Range of the firer's unit (TS §5.5).
- **Per-model weapon rules:**
  - Pistol: a model fires either its Pistols or its other ranged weapons.
  - Grenade: one model per unit throws a grenade, and doesn't fire its other weapons (TS §5.4).
  - Rapid Fire: shots double against a target within half range of that model (TS §5.4).
  - Dakka: X within half range, else Y (R-12).
- **Hit modifier parts:**
  - Heavy −1 for INFANTRY models when their unit moved for any reason this turn (WCR; TS §5.4). That includes arrived, disembarked, normal, advance and fall-back. "Counts as stationary" flags via toolkit cover the special cases.
  - Assault −1 after Advancing (WCR).
  - BGNT Heavy −1 while enemies are in Engagement Range (TS §5.2).
  - Dense Cover −1 (Task 4).
  - The cap applies in the sequence.
- **BGNT and engaged firers:** a VEHICLE or MONSTER model may declare targets outside combat. Those groups are ordered last, with `requiresClear` = the engaged enemy units. They resolve only if all of those were destroyed first, otherwise they're logged as lost (TS §5.2).
- **Lost attacks:** attacks at a target with no models left are lost and logged. This is Review Focus 2.
- **Ruling R-16:** a model with several profiles of one weapon (e.g. "Plasma gun – standard / supercharge") picks exactly one profile per shooting, by profile name. Two profiles of the same weapon in one shooting are rejected (TS §5.1 "choose weapon profile").

- [ ] **Step 1: Write the failing tests:**
  - `[TS §5.1] can't shoot after Advancing except Assault weapons, at −1`;
  - `[TS §3.1] can't shoot after Falling Back unless TITANIC`;
  - `[TS §5.1] out of range is rejected`;
  - `[TS §5.1] not visible is rejected`;
  - `[BD §3] Indirect Fire at a hidden target: BS worse by 1 and +1 armour save; stacks with Light Cover`;
  - `[TS §5.1] can't target a unit engaged with a friendly unit`;
  - `[TS §5.4] Pistol can shoot while engaged at the engaged enemy`;
  - `[TS §5.4] a model fires its Pistol or its other weapons, not both`;
  - `[TS §5.2] a tank shoots while engaged, Heavy at −1`;
  - `[TS §5.2] BGNT targets outside combat resolve only if the engaged enemy is destroyed`;
  - `[TS §5.5] Blast can't target a unit in Engagement Range of the firer`;
  - `[TS §5.5] Blast model count is fixed at targeting`;
  - `[TS §5.4] Rapid Fire doubles within half range per model`;
  - `[TS §5.4] Heavy −1 for infantry that moved; no penalty for a vehicle that moved`;
  - `[TS §5.4] Grenade: one model per unit`;
  - `[TS §5.3] Look Out, Sir: a W5 character near a 3-model squad can't be shot unless closest`;
  - `[FAQ §2.1] a W10+ monster shields; a 2-model non-character vehicle unit with W9 doesn't`;
  - `[TS §5.3] when judging closest, ignore other protected characters`;
  - `[TS §1.1] minimum range: can't target a unit wholly within it`;
  - `[TS §5.1] each unit shoots once per phase`;
  - `attacks at a target destroyed earlier in the same shooting are lost` (tag `[TS §5.1]`; Review Focus 2);
  - `[R-16] one profile of a multi-profile weapon per shooting`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): Shooting phase targeting and weapon rules`.

### Task 14: Psychic phase

**Files:**
- Create: `src/phases/psychic.ts`
- Test: `test/rules/psychic.test.ts`

**Interfaces:**
- Commands:
  - `{type:'manifest', by, unitId, power: string, wc?: number, targetUnitId?: string}`. `wc` is required when the unit's profile doesn't know it (assisted power). Smite has no target, because it picks the closest.
  - `{type:'deny', by, unitId | null}`: answers the `deny` reaction. `null` declines.
  - `{type:'psychicAction', by, unitId, action: string, wc: number}`.
- **Eligibility:**
  - A PSYKER on the battlefield, not embarked, didn't Fall Back unless TITANIC (PP §2).
  - Selected once per phase, and all its attempts are made before the next psyker (PP §2). A second `manifest` by another psyker locks the first.
  - Attempts ≤ `cast` per phase.
  - A non-Smite power once per battle round per army (PP §4).
  - Smite once per round per psyker (PP §5).
- **Psychic test:** 2D6 window (`psychic`, whole) against WC plus psychic `mod` effects. Smite is WC 5 + the number of other Smite attempts by this army this phase (PP §5). Passes on total ≥ WC.
- **Perils:** a double 1 or double 6 inflicts D3 mortal wounds on the psyker (PP §6).
  - If that destroys the psyker, the power fails.
  - If the unit is destroyed by Perils, every unit within 6" (friend and foe) suffers D3 mortal wounds, each rolled separately.
- **Deny the Witch:** if the test passed, offer a `deny` reaction to the opponent. The denier is a PSYKER within 24" with denies left (PP §4). It rolls a 2D6 window (`deny`) and must beat the test total. One attempt per power.
- **Resolution:**
  - Smite: D3 mortal wounds to the closest visible enemy unit within 18", or D6 if the test total was 11+ (PP §5).
  - Other powers log "succeeded". Their effects are assisted.
- **Psychic actions:** replace manifesting for that psyker this phase. They use the same test, Perils and deny, and count as manifesting for interactions (PP §7, Jan 2021).

- [ ] **Step 1: Write the failing tests:**
  - `[PP §4] passes on 2D6 ≥ warp charge`;
  - `[PP §5] Smite WC rises by 1 per other Smite attempt this phase`;
  - `[PP §5] each psyker Smites once per battle round`;
  - `[PP §4] a power can be attempted once per battle round by the army`;
  - `[PP §2] can't manifest after Falling Back unless TITANIC`;
  - `[PP §2] resolve all of one psyker's attempts before the next`;
  - `[PP §4] Deny needs to beat the test total`: equal fails;
  - `[PP §4] Deny only within 24"`;
  - `[PP §6] Perils on double 1 and double 6: D3 mortal wounds`;
  - `[PP §6] a psyker killed by Perils fails the power and hits units within 6"`;
  - `[PP §5] Smite: D3 to the closest visible enemy within 18", D6 on 11+`;
  - `[CS §2] Command Re-roll a psychic test re-rolls both dice`;
  - `[PP §7] a psychic action can be denied`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): Psychic phase, Smite, Perils and Deny the Witch`.

### Task 15: Charge phase and Heroic Interventions

**Files:**
- Create: `src/phases/charge.ts`; add ruling R-17 (Hold Steady means an unmodified 5+, like Overwatch's unmodified 6; CS §2 notes the ambiguity)
- Test: `test/rules/charge.test.ts`

**Interfaces:**
- Commands:
  - `{type:'declareCharge', by, unitId, targetIds: string[]}`.
  - Reactions: `respond` with `'fire-overwatch' | 'hold-steady' | 'set-to-defend' | 'decline'` and an optional `overwatchUnitId`.
  - `{type:'chargeMove', by, unitId, moves: Record<modelId, { to: Pos; path?: Pt[] }>}`.
  - `{type:'failCharge', by, unitId}`.
  - `{type:'heroicIntervention', by, unitId, moves}`, valid in the `heroic-interventions` step for the non-active player.
- **Declare (TS §6.1):**
  - The unit is within 12" of an enemy unit, didn't Advance or Fall Back, isn't engaged, didn't arrive as an AIRCRAFT this turn, and didn't disembark from a destroyed transport this turn.
  - Every target is within 12" of the charging unit (closest models). Targets needn't be visible.
- **Reaction for each target's owner** (one window listing every option):
  - **Fire Overwatch:** 1 CP, once per phase (CS §2). One target unit not in Engagement Range shoots the charger out of phase, hitting only on unmodified 6s, with auto-hit unchanged and no Look Out, Sir (TS §6.1).
  - **Defensible (TR §3.3).** The target is INFANTRY with every model within Defensible Area Terrain, or within 3" of a Defensible Obstacle with the line between the closest models crossing it. It may choose:
    - Hold Steady: Overwatch hits on an unmodified 5+, R-17;
    - Set to Defend: no Overwatch, +1 to hit in melee until the end of the next Fight phase. This is added as an `Effect` on the unit, `until: 'turn'`, extended to the next Fight phase.
- **Charge roll:** 2D6 `charge` window, whole.
- **`chargeMove` validation:**
  - Each model moves ≤ roll − 2 if any path crosses Difficult Ground (TR §3.2).
  - FLY may pass over models but climbs terrain (GL §2).
  - The unit ends in coherency.
  - Every target has at least one charging model within its Engagement Range. Defence Line counts (R-6).
  - No model ends within Engagement Range of a non-target enemy unit (TS §6.1).
  - No model ends within an enemy AIRCRAFT's Engagement Range unless the charger can FLY (TS §3.5).
  - On success: `charged = true`, `chargeTargets`.
  - A rejected `chargeMove` can be resubmitted. `failCharge` ends it with no models moved (TS §6.1: impossible means it fails).
- **Heroic Intervention (TS §6.2; WCR):**
  - A CHARACTER unit not in Engagement Range, within 3" horizontally and 5" vertically of an enemy unit, that hasn't disembarked from a destroyed transport.
  - Once per enemy Charge phase.
  - Each model moves ≤ 3" and ends closer to the closest enemy model (ignoring AIRCRAFT unless it can FLY), in coherency. Difficult Ground doesn't apply (TR §3.2).

- [ ] **Step 1: Write the failing tests:**
  - `[TS §6.1] can't charge after Advancing or Falling Back`;
  - `[TS §6.1] targets must be within 12"`;
  - `[TS §6.1] targets needn't be visible`;
  - `[CS §2] Fire Overwatch costs 1 CP and hits only on unmodified 6s`;
  - `[CS §2] auto-hit weapons hit in Overwatch`;
  - `[TS §6.1] Overwatch ignores Look Out, Sir`;
  - `[WCR] can't fire Overwatch while engaged`;
  - `[CS §1] only one Overwatch per phase`;
  - `[TR §3.3] Hold Steady: Overwatch hits on 5+`;
  - `[TR §3.3] Set to Defend: no Overwatch, +1 to hit in melee`;
  - `[TS §6.1] charge must reach every target`;
  - `[TS §6.1] charge can't end in Engagement Range of a non-target`;
  - `[TR §3.2] Difficult Ground: −2 to the charge roll`;
  - `[GL §2] FLY charging must still climb terrain`;
  - `[TS §6.2] Heroic Intervention: 3", ending closer, characters within 3"`;
  - `[WCR] no Heroic Intervention in your own Charge phase`;
  - `[TS §6.2] a unit that disembarked from a destroyed transport can't intervene`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): Charge phase, Overwatch and Heroic Interventions`.

### Task 16: Fight phase

**Files:**
- Create: `src/phases/fight.ts`; add ruling R-18
- Test: `test/rules/fight.test.ts`

**Interfaces:**
- Commands:
  - `{type:'selectFighter', by, unitId}`.
  - `{type:'pileIn', by, unitId, moves}`. Empty `moves` means no model moves.
  - `{type:'fightAttacks', by, unitId, assignments: { modelId: string; weapon: string; attacks: number; targetUnitId: string }[]}`.
  - `{type:'consolidate', by, unitId, moves}`.
  - Reaction `respond 'counter-offensive'`, with `unitId` given via `respond.choice = 'counter-offensive:<unitId>'`.
- Produces `fightOrder(state): { picker: PlayerId; selectable: string[] }`.
- **Eligible to fight:** within Engagement Range of an enemy unit, or made a charge move this turn (TS §7.1).
- **Order (R-18, WCR and TS §7.1–7.2):**
  - Tiers: net fights-first (charged or a `fights-first` effect, not cancelled by any `fights-last` effect), normal, then net fights-last.
  - A normal-tier unit can't be selected while any fights-first-tier unit (either player) is eligible and hasn't fought. A fights-last unit of a player can't be selected while that player has other eligible unfought units.
  - Players alternate, starting with the player whose turn it isn't. If the picker has no selectable unit, the other picks.
  - Counter-offensive (2 CP, CS §2): offered after each enemy unit fights. The chosen eligible unit fights next, then alternation continues from the player after it.
- **Pile in and consolidate (WCR; TS §7.3):**
  - Each model moves ≤ 3" and ends closer to the closest enemy model at the start of its move, ignoring AIRCRAFT unless it can FLY. "Closer" means strictly less distance to that model.
  - Models in base contact can't move.
  - The unit ends in coherency.
- **Which models fight:** within Engagement Range of an enemy unit, or within ½" of a friendly model of their unit that is itself within ½" of an enemy model (TS §7.3). The same test defines each model's allowed targets.
- **Charging units** may only target units they charged or that Heroically Intervened (TS §7.3).
- **Attacks:** the attacks per model sum to A (+ `attacks` effects; random A rolls in the `attacks` window). They split across that model's melee weapons, and a model with no melee weapon uses the close combat weapon (TS §7.3). The sequence comes from Task 12 with `melee: true`.
- Fighting doesn't need attacks: a unit counts as fought after its consolidate.
- `endPhase` is blocked while eligible unfought units remain.

- [ ] **Step 1: Write the failing tests:**
  - `[TS §7.1] charging units fight first`;
  - `[WCR] after the chargers, the player whose turn it isn't picks first`;
  - `[TS §7.1] if one player has no eligible units, the other fights the rest`;
  - `[TS §7.2] fights first and fights last cancel out`;
  - `[TS §7.2] a fights-last unit waits for its army's other units`;
  - `[CS §2] Counter-offensive: 2 CP, fights next`;
  - `[TS §7.3] pile in up to 3", ending closer to the closest enemy model`;
  - `[TS §7.3] models in base contact can't pile in`;
  - `[TS §7.3] second-rank models within ½" fight`: a model 1.5" away whose neighbour is within ½" of the enemy fights; one 0.6" from that neighbour doesn't;
  - `[TS §7.3] attacks equal A, split across weapons`;
  - `[TS §7.3] no melee weapon: close combat weapon S User AP0 D1`;
  - `[TS §7.3] a charging unit can only attack units it charged or that intervened`;
  - `[TR §3.3] Set to Defend +1 to hit applies in the next Fight phase`;
  - `[TS §7.3] consolidate can move into a new combat`;
  - `[TS §7.1] a unit that becomes engaged after an enemy consolidates becomes eligible`;
  - `[TS §7.1] every eligible unit must fight before the phase ends`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): Fight phase order, pile in, melee attacks and consolidate`.

### Task 17: Morale phase

**Files:**
- Create: `src/phases/morale.ts`
- Test: `test/rules/morale.test.ts`

**Interfaces:**
- Commands: `{type:'moraleTest', by, unitId, insaneBravery?: boolean}`. Fleeing models follow `casualtyOrder`.
- **Who tests and in what order:** units that lost models this turn. Players alternate, starting with the active player. When one player has none left, the other continues (TS §8.1). `endStep` is blocked until all have tested.
- **Morale test:**
  - D6 + models destroyed this turn, passed if ≤ the unit's highest Ld (+ Inspiring). An unmodified 1 always passes (WCR; TS §8.1).
  - Fail: one model flees. It counts as destroyed, and as destroyed by the enemy (TS §8.1).
- **Combat Attrition:** roll a D6 per remaining model, −1 if the unit is now below Half-strength. Each result ≤ 1 flees one more model (WCR; TS §8.2).
- **Insane Bravery:** 2 CP, once per battle per player, auto-pass with no Combat Attrition (CS §2).
- **Coherency step (TS §8.3):** on entry, every unit not in coherency loses `coherencyRemovals` (Task 3). These count as destroyed, with no Morale test and no "when destroyed".
- **Turn end:** after the coherency step, `endPhase` ends the turn. That runs round-5 scoring (Task 7), action completion (Task 18) and effect expiry.

- [ ] **Step 1: Write the failing tests:**
  - `[TS §8.1] only units that lost models test`;
  - `[TS §8.1] D6 + models lost vs highest Ld`;
  - `[WCR] an unmodified 1 always passes`;
  - `[TS §8.1] players alternate starting with the active player`;
  - `[TS §8.2] Combat Attrition: 1s flee, 1–2 when below Half-strength`;
  - `[TS §1.5] 10 of 20 is not below Half-strength`;
  - `[CS §2] Insane Bravery once per battle, 2 CP, skips attrition`;
  - `[TR §3.3] Inspiring +1 Ld`;
  - `[TS §8.3] out-of-coherency models are removed until one coherent group remains`;
  - `[TS §8.3] coherency removals don't cause a Morale test`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): Morale phase, Combat Attrition and coherency checks`.

### Task 18: Actions

**Files:**
- Create: `src/phases/actions.ts`
- Test: `test/rules/actions.test.ts`

**Interfaces:**
- Commands: `{type:'startAction', by, unitId, action: { name: string; startPhase: Phase; completes: 'end-of-turn' | 'end-of-phase' | 'immediately' }}`.
- **Can start (TS §10; WCR):**
  - The unit isn't within Engagement Range (AIRCRAFT excepted).
  - It didn't Advance or Fall Back.
  - It isn't AIRCRAFT or a FORTIFICATION.
  - It hasn't started an action this battle round (`round.action`).
- **Fails** when, before completion, the unit:
  - is destroyed;
  - makes a Normal Move, Advances or Falls Back;
  - attempts a psychic power;
  - declares a charge;
  - Heroically Intervenes;
  - shoots;
  - or is repositioned by the toolkit (Jan 2021, TS §10).

  Each of those handlers calls `failActionIfAny(ctx, unitId, reason)`.
- Completion emits `actionCompleted` (scoring is manual; Milestone 7 maps it to secondaries).

- [ ] **Step 1: Write the failing tests:**
  - `[TS §10] can't start an action while engaged or after Advancing`;
  - `[TS §10] Aircraft can't perform actions`;
  - `[TS §10] one action per unit per battle round`;
  - `[TS §10] shooting fails the action`;
  - `[TS §10] being destroyed fails the action`;
  - `[TS §10] an end-of-turn action completes at the end of the turn`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): actions`.

### Task 19: Manual adjust toolkit

**Files:**
- Create: `src/toolkit/toolkit.ts`; add ruling R-19 (manual adjustments are always allowed, logged and undoable; undo and replay are exact; spec §3.3 and §5)
- Test: `test/rules/toolkit.test.ts`

**Interfaces:**
- Commands. Each is valid at any time after setup (including pre-battle redeploys and scout moves), by either player, and is logged with a `note`:
  - `{type:'placeModel', by, modelId, pos}`: move or redeploy, on the board, not overlapping. It fails the unit's action.
  - `{type:'addModel', by, unitId, profile, weapons, pos}`.
  - `{type:'returnModel', by, modelId, pos, countsAsDestroyed: boolean}`: brings it back with full wounds. `countsAsDestroyed: false` takes it out of `lostThisTurn`, as with Reanimation (TS §1.5 note).
  - `{type:'removeModel', by, modelId, destroyed: boolean}`.
  - `{type:'setWounds', by, modelId, woundsLeft}`.
  - `{type:'replaceDie', by, rollId, index, value}`: only on the open window's roll. Marks `replaced`.
  - `{type:'extraActivation', by, unitId, kind: 'move' | 'shoot' | 'fight' | 'psychic' | 'charge'}`: lets the unit be selected again for that kind this phase.
  - `{type:'adjustCp', by, player, delta}`: not capped, never below 0.
  - `{type:'adjustVp', by, player, category: 'primary' | 'secondary' | 'painted', name?, delta}`: caps still apply.
  - `{type:'setObjective', by, objectiveId, owner: PlayerId | null, sticky: boolean}`.
  - `{type:'setCasualtyOrder', by, unitId, modelIds}`: owner only.
  - `{type:'setUnitFlag', by, unitId, flag: 'counts-as-stationary' | 'objective-secured', value: boolean}`.
  - `inflictMortalWounds` comes from Task 12: `{type:'inflictMortalWounds', by, unitId, count}`.

- [ ] **Step 1: Write the failing tests:**
  - `toolkit moves are logged and undoable`;
  - `[TS §5.8] inflictMortalWounds carries over`;
  - `replaceDie only on the open roll`;
  - `extraActivation lets a unit shoot again`;
  - `returnModel with countsAsDestroyed false lowers the Morale test`;
  - `adjustVp still respects the 45 primary cap`;
  - `setObjective sticky holds until the opponent controls it`.
  - Tag the rule-bearing ones `[TS …]` or `[R-n]`. File it under `test/rules/`, so every title carries a tag; generic toolkit behaviour uses `[R-19]`, a ruling that says manual adjustments are always allowed and logged (spec §3.3).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): manual adjust toolkit`.

### Task 20: Game log, queries and saved games

**Files:**
- Create: `src/log/{describe,queries}.ts`; finish `src/index.ts` exports
- Test: `test/core/log.test.ts`, `test/core/save.test.ts`

**Interfaces:**
- Produces:
```ts
export function describeEvent(e: GameEvent, before: GameState): string | null;   // plain English, e.g. "Intercessor Squad Advanced 4\"." ; null for bookkeeping events
export function gameLog(game: GameRecord): { seq: number; round: number; phase: Phase; text: string }[];
export function currentStep(state: GameState): { round: number; active: PlayerId; phase: Phase; step: Step; pending: Pending | null; actingPlayer: PlayerId; involvedUnitIds: string[] };
export function eligibleUnits(state: GameState, kind: 'move' | 'shoot' | 'charge' | 'fight' | 'psychic' | 'morale' | 'heroic'): string[];
export function validateRecord(raw: unknown): string | null;   // null = ok; else plain reason (schema, unknown event type, missing setup)
```
- `currentStep.involvedUnitIds` lists the units in the current activation, attack, reaction or pending item. Milestone 5 shows those units' faction abilities and stratagems (spec §3.3 faction assistance).
- `loadGame` calls `validateRecord` first. It then replays with a try/catch, which rethrows as `EngineLoadError("This saved game couldn't be opened: …")`.

- [ ] **Step 1: Write the failing tests:**
  - every event type has a `describeEvent` case: list the type names from `GameEvent` and assert non-throwing for a sample of each;
  - `gameLog of a short scripted game reads in order`;
  - `currentStep names the pending roll's player`;
  - `eligibleUnits('charge') excludes Advanced units`;
  - `loadGame refuses an unknown event type without throwing mid-replay` (Review Focus 3);
  - `loadGame refuses a record without setup`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): game log, step queries and safe loading`.

### Task 21: Muster an army from a saved list

**Files:**
- Create: `src/data/muster.ts`, `test/data/muster-baseline.json`; add ruling R-20
- Test: `test/data/muster.test.ts`

**Interfaces:**
- Consumes: `RosterView`, `SelView` from `@recruit/data/roster` (`evaluate`), and `toDatasheet` (Task 5).
- Produces:
```ts
export type MusterProblem = { kind: 'unknown-unit' | 'unmatched-model' | 'unmatched-weapon'; unit: string; detail: string };
export function musterFromRoster(view: RosterView, units: Map<string, { unit: UnitOut; catalogueName: string }>, player: PlayerId): { army: ArmyInput; problems: MusterProblem[] };
```
- **Rules** (R-20, a heuristic, every miss reported, never guessed):
  - A unit is each visible `unit`-type `SelView` × `sel.count` copies. `UnitOut` is matched by `merged.id`, the entry id. Unit ids are `<selId>` or `<selId>#<n>`.
  - **Models:**
    - Children of type `model` give a model stack each: the profile is the `ModelProfile` whose name equals the selection name, case- and whitespace-insensitive, ignoring a trailing `[n] (…)` bracket suffix.
    - A `unit` with no model children is one model of the first profile.
    - A model stack that matches no profile uses the first profile and reports `unmatched-model`.
  - **Weapons:** each upgrade name in the model's subtree (and the unit's own upgrades, shared by every model) matches the weapon profiles whose name equals it, or starts with it followed by `,`, ` -`, ` –`, ` (` or ` [`. An upgrade with no match and a name that looks like a weapon (`/gun|rifle|cannon|blade|sword|axe|claw|pistol|bolter|launcher|flamer|melta|las|spear|staff|fist|hammer/i`) reports `unmatched-weapon`. Others (e.g. Warlord, relics) are ignored.
  - `warlord` is set when a `Warlord` upgrade is in the unit.
  - Points and PR come from `total`.

- [ ] **Step 1: Write the failing tests:**
  - a hand-built Necron list (the web fixture approach: `createRoster` + `addUnit`) musters Necron Warriors with 10 models, each with a Gauss Flayer and no problems;
  - **corpus coverage:** for every legal list in `packages/data/test/corpus/**` (imported relatively, like `roster-corpus.test.ts`), muster succeeds;
  - every musted unit passes `validateSetup` checks for profiles and weapons;
  - per-kind problem counts ≤ `muster-baseline.json` (recorded on the first green run, listing the misses in the test output).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run, then record the baseline. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(engine): muster an engine army from a saved list`.

### Task 22: Full-game scenario and replay

**Files:**
- Create: `test/scenario/full-game.test.ts`
- Test: same

**Interfaces:**
- Consumes everything.

- [ ] **Step 1: Write the scenario tests**. Each title is tagged with the main rule it exercises.
  - **Main scenario.** A scripted-dice game between two small real armies, built with `toDatasheet` from the generated Necron and Space Marine data, on a Strike Force board with two ruins and four objectives. It runs two full battle rounds through every phase:
    - deploy, with one unit in Strategic Reserves;
    - Command CP;
    - move, advance and fall back;
    - arrive in round 2;
    - Smite;
    - shoot with Rapid Fire and Blast;
    - charge with Overwatch;
    - fight with Counter-offensive;
    - Morale and Combat Attrition;
    - primary scoring in round 2.
  - **Assertions on the main scenario:**
    - the final CP, VP, models remaining and the exact game log lines for round 2;
    - `stateOf(loadGame(saveGame(g)))` deep-equals the live state (`[R-19] replay equals live`);
    - undoing the last 5 batches and replaying the same 5 commands gives an identical record.
  - **Determinism:** the same seed and the same commands give identical events (`[TS §1.6]`).
  - **Speed:** a 5-round game of 40 random-but-legal commands per turn, from a scripted generator, finishes in under 2 s. It guards replay speed on phones.
- [ ] **Step 2:** Run. Expected: PASS, apart from bugs found. Fix any bug with a failing rules test in the owning task's file first (superpowers:systematic-debugging), then rerun.
- [ ] **Step 3:** Run `npm test` at the root and `npm run typecheck`. Expected: data, web and engine all green.
- [ ] **Step 4:** Commit: `test(engine): full-game scenario, replay and determinism`.

---

## Notes for Milestone 5 (not built here)
- **Board UI:** `moveAllowance`, `eligibleTargets`, `eligibleUnits`, `currentStep.involvedUnitIds` and `Problem.message` are the hooks for live rulers, hard limits and faction-assist prompts.
- **Mission maps:** mission geometry JSON (Milestone 7) feeds `GameSetup.objectives` and `zones`.
- **Lessons and the companion:** both use `scriptedDice` and `queue` for drills and real-dice entry.
