# Milestone 7 (Table Companion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One phone runs a real tabletop game of 9th Edition from setup to summary. It covers:
- mission and secondaries;
- a phase checklist with beginner prompts;
- CP and VP for both players, with each mission's own scoring;
- stratagems for the current phase;
- rules search, dice, attack odds and a game log.

Games are saved local-first and work offline.

**Architecture:**
- **Mission data is authored JSON plus Wahapedia secondaries.**
  - `packages/data/missions/*.json` holds 24 missions transcribed from Wahapedia's 9th Edition mission pages and maps:
    - 18 Arks of Omen GT missions (Incursion and Strike Force);
    - 6 Core Book Eternal War missions (Combat Patrol and Onslaught).

    Each mission carries its official text, structured scoring, CP rules and map geometry in inches.
  - The build checks these files, joins the secondaries from the Wahapedia `Secondaries.csv` snapshot and the plain English, and writes `generated/missions.json`.
  - Pure scoring and geometry functions live in a new `@recruit/data/missions` export, so the M5 sandbox can reuse them.
- **The companion is an event log.** A saved game (`kind: 'game'`, `data.mode: 'table'`) is its setup plus an append-only list of events: phase changes, CP, VP, stratagems, rolls and notes.
  - A pure reducer derives everything shown: position, CP, capped VP and the log.
  - Undo removes the last event. Every change saves the document through the existing local-first repository, which already syncs.
- **The engine is reused, not duplicated.** It gets two side-effect-free subpath exports, `./dice` and `./attack-math`, which the dice roller and the attack-odds calculator build on.
- **UI** lives in `apps/web/src/table/**`, with a two-line change to the existing `/table` route.

**Tech Stack:** unchanged. Node 24, npm workspaces, TypeScript 7, Vitest 5, Vite 8, React 19, React Router 6, Dexie 4, Playwright. No new dependencies. `apps/web` gains the workspace dependency `@recruit/engine`.

**Spec:** `docs/superpowers/specs/2026-10-20-recruit-plus-design.md` (§3.4, §4, §6, §8, §10). The Milestone 1–4 plans in `docs/superpowers/plans/` describe the code this builds on.

**Branch:** `m7-table-companion` in worktree `L:\9th Edition\app-m7`, off `main`.

**Scope notes (decisions for the user's review):**
1. **Board size correction.**
   - Spec §4 and the engine's `BOARD_SIZES` give Incursion 44"×60". The rules say **44"×30"**: Wahapedia Matched Play "Battlefields" (Combat Patrol/Incursion 44"×30") and Arks of Omen GT step 6 (Incursion 44"×30", Strike Force 44"×60").
   - Mission maps carry their own board size, and Task 8 fixes the one engine value.
   - M5 has been told (shared notes, `m7-planning-findings.md`).
2. **Plain English.**
   - Plain English is written and checked for every mission rule, every primary, every mission secondary and the 28 universal secondaries (11 Arks of Omen, 17 Core Book).
   - **The ~170 faction secondaries** (85 Arks of Omen, 85 Core Book) show their official wording with the existing fallback label `Official wording (plain-English version not ready yet)`. They are a named follow-up.
3. **Secondary scoring is manual.** Each secondary shows its text and a capped VP stepper (max 15). Only primaries and mission secondaries get structured prompts that add up the VP for you.
4. **Stratagems are filtered by phase and by the list's faction**, not by individual units. The data has no reliable stratagem-to-unit link. A group chip (subfaction) narrows the list further.
5. **Starting CP** defaults to the pack value: 6 for Arks of Omen; 3 for Combat Patrol and 18 for Onslaught. The player can edit it before the game, because Core Book detachment costs and pre-battle Requisition Stratagems change it.
6. **Rules flagged unverified, not guessed.** Anything a source doesn't pin down is stored with `verified: false` and a note, and shown as `Not confirmed:`. This covers map distances that the image implies but doesn't print, and the April 2023 v1.1 pack errata if GW's document can't be read.

## Global Constraints
- **Everything in the Milestone 1–4 Global Constraints still applies:**
  - source precedence, with overrides carrying a `source` note;
  - 375×812 first, touch targets ≥ 44px, no horizontal page scroll;
  - dark theme, footer disclaimer and the Wahapedia credit;
  - no BattleScribe jargon;
  - never copy GW wording into plain English (copy check: no run of 12+ consecutive words, and for 20+ word texts no ≥50% shared word 4-grams);
  - every number, dice expression and keyword survives (`checkPlain`).
- **Source precedence** (spec §4): final GW changes (13 Apr 2023 Dataslate, final points, the GT pack errata) > BSData v9.8.0 > Wahapedia > research library (`L:\9th Edition\02_Missions_and_Game_Modes`). Where the library disagrees with Wahapedia, Wahapedia wins and the disagreement is written to the shared notes for a library fix. The library itself isn't edited in M7.
- **Rules version:** final 9th Edition (Arks of Omen GT pack v1.1; Core Book Eternal War as on Wahapedia).
- **Wrong rules are the worst failure.** Every scoring number, CP rule and beginner prompt carries a citation (Wahapedia URL with anchor or mission name, or a library file and section). Every mission's VP numbers are unit-tested against its official text.
- **Shared files** (M5 is building in parallel):
  - `apps/web/src/routes.tsx` gets only the two existing `/table` route lines changed, plus one lazy import placed directly above `export function AppRoutes`.
  - `packages/engine` gets two `exports` entries and the one `BOARD_SIZES` value.
  - `packages/data/package.json` gets one `exports` entry.
  - `packages/data/src/build.ts` gets one call (`writeMissions(...)`) and its file-list comment.
  - `apps/web/package.json` gets one dependency.
  - Everything else is new files.
- **UI copy** (exact strings):
  - page title `Table companion`; buttons `New game`, `Resume`;
  - setup steps `Battle size`, `Mission`, `Armies`, `Attacker and Defender`, `Secondary objectives`, `Ready`;
  - army choice `Use one of my lists` / `Just pick a faction`;
  - roll buttons `Roll for mission` and `Roll off`;
  - `Next phase`, `End turn`, `Undo`, `End the game`;
  - end choices `We've finished all 5 rounds`, `We agreed to stop early`, `A player concedes`;
  - tabs `Turn`, `Score`, `Stratagems`, `Tools`, `Log`;
  - tools `Dice`, `Attack odds`, `Rules search`;
  - not-confirmed prefix `Not confirmed:`;
  - stratagem button `Use (n CP)`; warning `Already used this phase`.
- **Storage:** games are `kind: 'game'` docs with `data.mode === 'table'` and `data.schema === 1`. Lists show only `mode === 'table'` docs.

## Review Focus
1. **Round 5 scoring order (Arks of Omen).**
   - The first player scores the hold part at the end of their Command phase.
   - The second player scores it at the end of their turn, not in their Command phase, and must still be prompted.
   - Pinned by Task 1 test `round 5: second player's hold is due at end of turn, not end of Command phase`, and Task 13 test `round 5 second player is prompted for the hold at End turn`.
2. **VP that can go down** (Sacred Ground, Conversion: "Loses 1VP").
   - A score never drops below 0.
   - Undoing a clamped loss restores the exact earlier total.
   - The 45 primary, 15 per secondary and 10 Battle Ready caps apply to the totals shown, while the raw events are kept.
   - Pinned by Task 9 tests `a loss never takes the total below 0`, `undo of a clamped loss restores the total`, `primary over 45 is capped in the total`.
3. **CP never goes below 0, and the CP bonus follows the mission.**
   - Both players get the bonus in every Command phase in Arks of Omen; only the active player in the Core Book.
   - Secret Intel Inbound: no bonus in rounds 1–2, +1 extra for the active player in rounds 4–5.
   - A "roll D6, 1–3 lose it" gate rolls a die and logs it.
   - Pinned by Task 1 `cpBonus` tests and Task 13 test `Secret Intel Inbound gives no CP in round 1`.
4. **Resuming after the app is closed or offline.**
   - Reloading mid-phase returns to the same round, turn, phase, CP and VP.
   - A game started offline stays dirty and syncs later.
   - Pinned by Task 10 test `a game saved offline stays dirty and is listed`, and Task 18 e2e `reload mid-game resumes at the same phase`.
5. **Odd attack inputs in the odds calculator:**
   - `D6+1` and `2D3` attacks, Blast against 6 and 11 models;
   - no armour save (`-`) with a 5++ invulnerable;
   - FNP 5+, AP-6, 1 model left.

   It never shows NaN, and probabilities stay within [0, 1]. Pinned by Task 16 tests `odd inputs never give NaN` and `blast minimum 3 against 6 models`.

---

## File Structure
```
packages/engine/
  package.json                          + exports "./dice", "./attack-math"
  src/setup/mission.ts                  BOARD_SIZES.incursion -> 44x30
  test/setup/board-sizes.test.ts        NEW
packages/data/
  package.json                          + exports "./missions"
  missions/core-book.json               NEW  6 Core Book missions (Combat Patrol, Onslaught)
  missions/arks-of-omen-incursion.json  NEW  9 missions
  missions/arks-of-omen-strike-force.json NEW 9 missions
  missions/packs.json                   NEW  pack rules: CP, caps, defaults, setup sequence
  overrides/secondary-factions.json     NEW  catalogue -> Wahapedia secondary faction names
  overrides/mission-amendments.json     NEW  final GW errata the page missed
  src/missions/types.ts                 NEW  MissionOut, MissionMap, ScoringComponent, CpRule, SecondaryOut, MissionsOut
  src/missions/geometry.ts              NEW  areaContains, objectiveArea, validateMap
  src/missions/score.ts                 NEW  scoreComponent, dueComponents, cpBonus
  src/missions/index.ts                 NEW  public barrel (browser-safe: types + geometry + score)
  src/missions/build.ts                 NEW  loadMissions, extractSecondaries, writeMissions (node)
  src/build.ts                          + writeMissions(...)
  test/missions-geometry.test.ts  test/missions-score.test.ts  test/missions-data.test.ts
  test/missions-secondaries.test.ts  test/missions-plain.test.ts
packages/content/
  missions/plain.json                   NEW  plain English keyed by textKey(official)
apps/web/
  package.json                          + "@recruit/engine"
  src/routes.tsx                        /table -> /table/* (TableRoutes)
  src/table/missionData.ts              getMissions()
  src/table/game.ts                     TableGameData, TableEvent, deriveState, nextPos, undo
  src/table/tableStore.ts               useTableGames, createTableGame, appendEvents
  src/table/setupModel.ts               secondary rules, defaults, eligibility, startingCp
  src/table/checklist.ts                phase prompts (data + selector)
  src/table/stratagemFilter.ts          phase -> Wahapedia phase strings
  src/table/odds.ts                     attackOdds (exact distributions)
  src/table/dice.ts                     rollDice (engine seeded dice)
  src/table/TableRoutes.tsx  TableHome.tsx  NewGamePage.tsx  GamePage.tsx  SummaryPage.tsx
  src/table/MissionMap.tsx  MissionRules.tsx  Scoreboard.tsx  TurnPanel.tsx  ScorePrompt.tsx
  src/table/ScoreSheet.tsx  StratagemPanel.tsx  ToolsPanel.tsx  DiceRoller.tsx  OddsCalculator.tsx
  src/table/LogPanel.tsx  table.css
  src/table/*.test.ts(x)                unit tests beside the code
  e2e/table.spec.ts                     NEW
```

---

## Mission data model (Tasks 1–7 share it)

All in `packages/data/src/missions/types.ts`. Coordinates are inches. The origin is the top-left corner of the map as Wahapedia draws it, with x to the right and y down.

```ts
export type Pack = 'core-book' | 'arks-of-omen';
export type PlayerKey = 'A' | 'B';                       // "Player A/B" exactly as the map labels them
export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'polygon'; points: [number, number][] }
  | { kind: 'circle'; cx: number; cy: number; r: number };
export interface Area { include: Shape[]; exclude?: Shape[] }
export interface MapObjective { id: string; x: number; y: number; label?: string; in: PlayerKey | 'nml' }
export interface MissionMap {
  board: { width: number; height: number };
  edges: Record<PlayerKey, 'top' | 'bottom' | 'left' | 'right'>;
  zones: Record<PlayerKey, Area>;
  territories?: Record<PlayerKey, Area>;
  areas?: { id: string; name: string; area: Area }[];    // e.g. Pathway to Glory "search-area"
  objectives: MapObjective[];
  symmetry: 'rotate180' | 'mirror' | 'none';
  verified: boolean; notes: string[];                     // what was implied rather than printed
  image: string;                                          // Wahapedia map URL, the transcription source
}
export interface RulesText { id: string; name: string; text: string; plain?: string }
export type When = 'end-of-command-phase' | 'end-of-turn' | 'end-of-round' | 'end-of-battle' | 'on-action';
type Label = string | Record<PlayerKey, string>;        // plain-English prompt (ours), per player when it differs
export type ScoreLine =
  | { kind: 'flag'; id: string; label: Label; vp: number; gate?: true }   // gate: component scores 0 unless set
  | { kind: 'count'; id: string; label: Label; vpEach: number | Record<string, number> }  // record keyed by round
  | { kind: 'table'; id: string; label: Label; vpByCount: number[] }
  | { kind: 'pick'; id: string; label: Label; options: { id: string; label: string; vp: Record<PlayerKey, number | null> }[] };
interface ComponentBase { id: string; when: When; rounds: number[]; who: 'active' | 'each'; max?: number; source: string }
export type ScoringComponent = ComponentBase & (
  | { kind: 'hold'; mode: 'take-and-hold' | 'domination'; vpPerCondition: number; round5SecondPlayer?: 'end-of-turn' }
  | { kind: 'lines'; lines: ScoreLine[]; combine: 'sum' | 'max' | { byCount: number[] } });
export interface CpRule {
  who: 'both' | 'active';
  gates: { id: string; rounds?: number[]; question?: string; onNo: 'lose' | 'roll-1-3-lose' }[];  // no question: always loses
  extras: { id: string; rounds?: number[]; question?: string; cp: number }[];                     // active player only
  source: string;
}
export interface SecondaryOut {
  id: string; name: string; category: string; type: 'progressive' | 'end-game' | 'progressive-and-end-game';
  faction?: string; text: string; plain?: string; components?: ScoringComponent[];   // components: mission secondaries only
}
export interface MissionOut {
  id: string; name: string; pack: Pack; battleSize: BattleSizeId; roll: string;      // '11' (D33) or '1-2' (D6)
  rules: RulesText[]; primary: RulesText & { components: ScoringComponent[] };
  missionSecondary?: SecondaryOut; cp: CpRule; map: MissionMap;
  verified: boolean; unverified: string[]; source: { url: string; retrieved: string };
}
export interface PackOut {
  id: Pack; name: string; battleSizes: BattleSizeId[]; startingCp: Partial<Record<BattleSizeId, number>>;
  caps: { primary: 45; secondaryEach: 15; secondaryTotal: 45; battleReady: 10 };
  defaultSecondaries: string[]; maxPerCategory: 1; secondaryCount: 3;
  firstTurn: 'winner-takes-first' | 'winner-chooses';
  concede: 'opponent-wins' | 'conceder-scores-0';
  setupSteps: RulesText[]; secondaries: SecondaryOut[]; source: string;
}
export interface MissionsOut { generatedAt: string; packs: PackOut[]; missions: MissionOut[]; secondaryFactions: Record<string, { faction: string; note?: string }[]> }
```
`BattleSizeId` is imported from `../roster/types`.

**Mission inventory and primary encoding** (the numbers come from the Wahapedia text quoted in the scratch transcription; Task 1 tests use them).
- `H4` = `{kind:'hold', vpPerCondition:4, max:12, when:'end-of-command-phase', rounds:[2,3,4,5], who:'active', round5SecondPlayer:'end-of-turn'}`. `H5` = `{kind:'hold', vpPerCondition:5, max:15, when:'end-of-command-phase', rounds:[2,3,4,5], who:'active'}`.
- `T&H` conditions: 1+, 2+, more than the opponent. `Dom` conditions: 2+, 3+, more than the opponent.
- "Every round" means rounds [1–5].

| id | Size · roll | Hold | Mission component(s) |
|---|---|---|---|
| `cb-incisive-attack` | CP · 1-2 | H5 T&H | rule Sweep and Clear; mission secondary Surgical Assault: flag 5, end-of-turn, every round |
| `cb-outriders` | CP · 3-4 | H5 T&H | Survey: flag 5, end-of-command-phase, rounds 2–5 |
| `cb-encircle` | CP · 5-6 | H5 T&H | Encircle: flag 3 (gate) + flag 2 ("…one of them wholly within opponent's DZ"), sum, end-of-turn |
| `cb-lines-of-battle` | Onslaught · 1-2 | none | Unified Advance: 3 flags × 5, sum, max 15, end-of-command-phase, rounds 2–5. Hold the Centre: flag 5, end-of-command-phase, rounds 2–5 |
| `cb-all-out-war` | Onslaught · 3-4 | H5 Dom | Surround Them: two components (end-of-command-phase; end-of-battle), flags 4 and 8, combine max |
| `cb-pathway-to-glory` | Onslaught · 5-6 | H5 Dom | rule Secure the Search Area; Search for the Portal: on-action, flag 1 (gate) + count "A objectives you control" × 1, max 5 |
| `aoo-cleanse-the-land` | Inc · 11 | H4 T&H | Direct Assault: 2 flags, byCount [0,2,3], end-of-turn, every round |
| `aoo-deliverance` | Inc · 12 | H4 T&H | count "NML objectives you control", vpEach {3:2,4:3,5:4}, end-of-turn, rounds 3–5 |
| `aoo-desperate-raid` | Inc · 13 | H4 Dom | flag 3 "an objective in opponent's DZ", end-of-turn, every round; CP extra Desperate Raiders +1 |
| `aoo-sacred-ground` | Inc · 21 | H4 T&H | sum: flag 2 (B for A / A for B), flag −1 (lose own), count × 1 "other objectives"; end-of-turn; CP gate Secure the Rear (roll) |
| `aoo-ascension` | Inc · 22 | H4 T&H | byCount [0,2,2] end-of-turn every round; end-of-battle 2 flags × 3, who each; CP gate Leading From the Front (roll) |
| `aoo-surge-of-faith` | Inc · 23 | H4 T&H | pick on-action: A {A:null,B:4}, B {2,3}, C {3,2}, D {4,null} |
| `aoo-rise-of-the-machine-spirit` | Inc · 31 | H4 T&H | flag gate "completed Inload Data-psalm this turn" + count × 1, max 3, end-of-turn |
| `aoo-display-of-spiritual-might` | Inc · 32 | H4 T&H | count "enemy units destroyed this round" × 1, max 3, end-of-round, who each; CP Secret Intel Inbound |
| `aoo-reconnaissance-mission` | Inc · 33 | H4 T&H | table [0,3,6,10,15], end-of-battle, who each |
| `aoo-recover-the-relics` | SF · 11 | H4 T&H | as Display of Spiritual Might's count; CP gate Recover Relics (question, lose) + extra +1 |
| `aoo-tear-down-their-icons` | SF · 12 | H4 T&H | count "Primed Explosives in opponent's territory" × 4, max 15, end-of-battle, who each |
| `aoo-data-scry-salvage` | SF · 13 | H4 Dom | on-action count "NML objectives you control" × 1, max 3 |
| `aoo-abandoned-sanctuaries` | SF · 21 | H4 T&H | 2 flags byCount [0,2,3], end-of-turn, every round |
| `aoo-conversion` | SF · 22 | H4 T&H | sum: flag 4, flag 2, flag −1; end-of-turn; CP gate Leading From the Front |
| `aoo-the-scouring` | SF · 23 | H4 T&H | count "objectives scanned" × 3, end-of-battle, who each |
| `aoo-tide-of-conviction` | SF · 31 | H4 Dom | flag 2 end-of-turn rounds 1–4; count × 3 end-of-battle who each; CP gate Supply Lines (roll) |
| `aoo-death-and-zeal` | SF · 32 | H4 T&H | as Cleanse the Land |
| `aoo-secure-missing-artefacts` | SF · 33 | H4 T&H | flag 3 "Priority objective in your own territory", end-of-turn, every round |

**CP rules:**
- Arks of Omen base is `{who:'both'}` (the Battle-forged CP Bonus).
- Core Book is `{who:'active'}` with no gates.
- "Roll" gates are `onNo:'roll-1-3-lose'`.
- Secret Intel Inbound is a gate `{rounds:[1,2], onNo:'lose'}` with no question, plus an extra `{rounds:[4,5], cp:1}`.

---

### Task 1: Mission types, scoring and CP rules (pure)

**Files:**
- Create: `packages/data/src/missions/types.ts`, `packages/data/src/missions/score.ts`, `packages/data/src/missions/index.ts`
- Modify: `packages/data/package.json` (add `"./missions": "./src/missions/index.ts"`)
- Test: `packages/data/test/missions-score.test.ts`

**Interfaces:**
- Produces:
  - `scoreComponent(c: ScoringComponent, input: ComponentInput, ctx: { round: number; player: PlayerKey }): number`, where `ComponentInput = { controlled?: number; opponentControlled?: number; flags?: Record<string, boolean>; counts?: Record<string, number>; pick?: string }`.
  - `dueComponents(components: ScoringComponent[], moment: { at: When; round: number; activeIsFirst: boolean }): ScoringComponent[]`
  - `cpBonusPlan(rule: CpRule, ctx: { round: number; player: PlayerKey; active: PlayerKey }): { base: number; gates: CpRule['gates']; extras: CpRule['extras'] }`, which lists the base CP (1 or 0) and the gates and extras that apply to this player in this round.
  - `holdConditions(mode, controlled, opponentControlled): number`

- [ ] **Step 1: Write the failing tests** (`missions-score.test.ts`):
  - `holdConditions`: take-and-hold (2, 1) → 3; (1, 1) → 1; (0, 0) → 0. Domination (2, 2) → 1; (3, 1) → 3.
  - `H4 scores 4 per condition, max 12`: controlled 3, opponent 1 → 12.
  - `H5 scores 5 per condition`: (2, 1) → 15.
  - `byCount [0,2,3]`: one flag → 2, both → 3.
  - `gate flag zero unless set`: Inload with gate unset and count 3 → 0; with gate set → 3; count 5 → 3 (max).
  - `count vpEach by round`: Deliverance count 2 → 4 in round 3, 6 in round 4, 8 in round 5.
  - `table lookup clamps to the last entry`: Recon count 4 → 15; count 6 → 15.
  - `pick per player`: Surge of Faith C → A gets 3, B gets 2; A picking A → 0 (null).
  - `negative flag`: Conversion flags −1 only → −1 (clamping to the total happens in the game reducer).
  - `combine max`: Surround Them, both flags → 8.
  - `round 5: second player's hold is due at end of turn, not end of Command phase`:
    - `dueComponents([H4], {at:'end-of-command-phase', round:5, activeIsFirst:false})` → `[]`;
    - with `at:'end-of-turn'` → `[H4]`;
    - first player in round 5 is due at end-of-command-phase.
  - `H5 has no round-5 exception`: due at end-of-command-phase for the second player in round 5.
  - `round 1 hold is never due`.
  - `cpBonusPlan`:
    - both → base 1 for the non-active player too;
    - active → base 0 for the non-active player;
    - Secret Intel Inbound round 1 → base 0, round 4 active → extras `[+1]`, round 4 non-active → no extras.

- [ ] **Step 2: Run, expect FAIL.** Run `npm test -w packages/data -- missions-score`; it should fail with "Cannot find module '../src/missions/score'".
- [ ] **Step 3: Implement** `types.ts` (the model above) and `score.ts`. Rules for `score.ts`:
  - `lines` with `sum` adds the flag VP and the counts. A gate flag that is unset makes the component score 0.
  - `max` caps the result.
  - A hold component's own `max` is `vpPerCondition*3`.
  - `index.ts` re-exports `types`, `score` and (from Task 2) `geometry`. No `node:` imports anywhere under `src/missions` except `build.ts`.
- [ ] **Step 4: Run, expect PASS**, then run `npm run typecheck -w packages/data`.
- [ ] **Step 5: Commit** with `feat(data): mission scoring model and pure scoring rules`.

### Task 2: Mission geometry (pure)

**Files:**
- Create: `packages/data/src/missions/geometry.ts`
- Test: `packages/data/test/missions-geometry.test.ts`

**Interfaces:**
- Consumes: `Shape`, `Area`, `MissionMap` (Task 1).
- Produces:
  - `shapeContains(s: Shape, p: {x,y}): boolean` (a point on the boundary counts as inside);
  - `areaContains(a: Area, p): boolean`;
  - `objectiveArea(map, p): PlayerKey | 'nml'`;
  - `validateMap(map): string[]`, which returns a list of problems (empty when valid).

`validateMap` checks:
1. every objective is on the board;
2. each objective's declared `in` equals `objectiveArea`;
3. the zones don't overlap, by sampling a 0.5" grid;
4. every zone point is on the board;
5. `rotate180` symmetry: (x, y) → (W−x, H−y) maps zone A samples into zone B and the set of objectives onto itself (within 0.01");
6. `mirror`: the reflection across the centre line between the two edges does the same.

- [ ] **Step 1: Failing tests:**
  - `rect contains its corner`;
  - `polygon contains a diagonal-zone point and not its mirror`;
  - `circle exclude removes the centre`: a quarter-rect minus a 9" circle at (22,15) excludes (20,14) and includes (40,2);
  - `validateMap flags an objective declared in A that lies in no man's land`;
  - `validateMap flags broken rotate180 symmetry`;
  - `valid fixture map returns []`, using a 44×30 Incisive Attack-like fixture in the test.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the functions. Use ray casting for polygons.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(data): mission map geometry and validation`.

### Task 3: Pack rules and secondaries from Wahapedia

**Files:**
- Create: `packages/data/missions/packs.json`, `packages/data/overrides/secondary-factions.json`, `packages/data/overrides/mission-amendments.json`, `packages/data/src/missions/build.ts` (just `extractSecondaries` and `loadPacks` in this task)
- Test: `packages/data/test/missions-secondaries.test.ts`

**Interfaces:**
- Consumes: `loadWahapedia` (`src/wahapedia/load.ts`), `htmlToText`, `titleCase` and `slugify` (`src/text.ts`).
- Produces:
  - `extractSecondaries(w: Wahapedia, game: 'Arks of Omen: Grand Tournament' | 'Matched Play'): SecondaryOut[]`
    - `id` = `slugify(game short id + name)`, e.g. `aoo-grind-them-down`, `cb-attrition`;
    - `type` is mapped from the CSV `type`;
    - `faction` comes from `faction_name`, or is left out when empty;
    - `text` = `htmlToText(description)`;
    - `legend` is dropped as flavour.
  - `loadPacks(dir: string): Omit<PackOut, 'secondaries'>[]`
  - `secondaryFactionsFor(slug: string): {faction, note?}[]`, read from `secondary-factions.json`.

**Pack values** (`packs.json`, each with a `source` URL):
- **arks-of-omen:**
  - battle sizes incursion and strike-force; startingCp 6 for both;
  - defaults `aoo-assassination`, `aoo-grind-them-down`, `aoo-behind-enemy-lines`;
  - firstTurn `winner-takes-first`; concede `opponent-wins`;
  - `setupSteps`: the 16-step sequence from the pack page, steps 1–16, written as plain text in our own words with the step names.
- **core-book:**
  - battle sizes combat-patrol and onslaught; startingCp 3 and 18;
  - no defaults;
  - firstTurn `winner-chooses`; concede `conceder-scores-0`;
  - Eternal War steps 1–16.
- Both packs: caps 45 / 15 / 45 / 10.

**Faction mapping** (`secondary-factions.json`): one entry per playable catalogue, giving the `faction_name` values its player may pick. Examples:
- `Imperium - Blood Angels` → Space Marines + Blood Angels;
- `Chaos - Chaos Space Marines` → Chaos Space Marines + each Legion, with `note: "Only if every unit in your army is from this Legion"`;
- `Aeldari - Craftworlds` → Aeldari.

Each entry has a `source` (the pack's "Space Marines and Chaos Space Marines" and successor rules). A test fails on any unmapped playable catalogue.

**Amendments:**
- Search GW's downloads and Warhammer Community for the Arks of Omen GT v1.1 errata and the April 2023 updates. Record every mission or secondary change that the Wahapedia text lacks as `{target, field, text, source}`.
- If the document can't be found or read, write `[]` with a top-level `"note"` saying so. Every mission then gets `unverified: ["Arks of Omen GT v1.1 errata not checked against GW's document"]`.

- [ ] **Step 1: Failing tests:**
  - `11 universal Arks of Omen secondaries in 5 categories`: names exactly Retrieve Battlefield Data, Raise the Banners High, Engage on All Fronts, Behind Enemy Lines, Psychic Interrogation, Warp Ritual, No Prisoners, Grind Them Down, Bring It Down, Assassination, Abhor the Witch.
  - `Abhor the Witch is Purge the Enemy in Arks of Omen`.
  - `17 universal Core Book secondaries`, matching the 17 names in the library's corrected table.
  - `defaults exist and are universal`.
  - `every faction secondary's faction is mapped from at least one catalogue`.
  - `every playable catalogue has a faction mapping`.
  - `texts have no HTML`.
  - `grind them down text keeps "3 victory points"`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, and write the JSON files.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(data): mission packs and secondaries from Wahapedia`.

### Task 4: Core Book missions (Combat Patrol and Onslaught)

**Files:**
- Create: `packages/data/missions/core-book.json`
- Test: `packages/data/test/missions-data.test.ts` (generic checks for every mission file, plus a per-mission VP table)

**How to transcribe** (this procedure applies to Tasks 4–6):
1. Fetch the page HTML (Wahapedia `the-rules/matched-play/` for the Core Book, `the-rules/arks-of-omen-grand-tournament/` for Arks of Omen) and each map PNG into the scratchpad. Each download goes in its own folder, and a converter script outside it is run with `python -I`.
2. **Official text:**
   - Copy it from the page text: mission rules (one `RulesText` each, actions included), the primary (the full text, flavour paragraph dropped) and the mission secondary.
   - Normalise curly quotes the way `normaliseRulesText` does.
3. **Map:**
   - Read every printed dimension off the image. Board: 44×30 for Combat Patrol and Incursion; 60×44 for Strike Force (drawn landscape); 90×44 for Onslaught.
   - Put objectives exactly where the printed distances say.
   - A position the image only implies (not printed) goes into `map.notes`, and sets `verified:false` with an `unverified` entry.
4. **Scoring:** encode it per the inventory table. `source` = the mission URL plus the mission name.
5. **Library check:** compare the mission names, roll numbers and rule names with `Grand_Tournament_Mission_Packs.md` and `Combat_Patrol_and_Boarding_Actions.md`. Write each disagreement to the shared notes as `library fix:`.

- [ ] **Step 1: Failing tests.** Generic, for every mission in every file:
  - `validateMap(map)` is `[]`;
  - `roll` is unique within pack + size;
  - every `RulesText.text` is non-empty;
  - `every VP number in components appears in the official primary or secondary text`: each absolute `vp`, `vpEach`, `vpByCount` entry, `vpPerCondition` and `max` must be among the numbers `extractTokens` finds in the text;
  - `components only use rounds 1–5`.

  Core Book VP table (`it.each`):
  - Incisive Attack H5 (1, 0) round 2 → 10, and Surgical Assault → 5;
  - Lines of Battle all three flags → 15;
  - All-out War Dom (3, 3) → 10;
  - Pathway: gate + 2 A objectives → 3, and with 6 A objectives → 5;
  - objective counts: Incisive Attack 4, Outriders 4, Encircle 4, Lines of Battle 6, All-out War 6, Pathway to Glory 6, as read off the maps. Correct these numbers to what the images show while transcribing; the test then pins them.
- [ ] **Step 2: Run, expect FAIL** ("ENOENT core-book.json").
- [ ] **Step 3: Transcribe** the 6 missions.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(data): Core Book Combat Patrol and Onslaught missions`.

### Task 5: Arks of Omen Incursion missions

**Files:** Create `packages/data/missions/arks-of-omen-incursion.json`. Modify `packages/data/test/missions-data.test.ts`, adding the Incursion VP table.

- [ ] **Step 1: Failing tests** (VP table, round 3, active = A unless noted):
  - Cleanse the Land: both flags → 3.
  - Deliverance: 2 NML objectives in round 4 → 6.
  - Desperate Raid: Dom (3, 0) → 12, and the flag → 3.
  - Sacred Ground for A: flag B + 2 others → 4; lose-home only → −1.
  - Ascension: end-of-battle both flags → 6.
  - Surge of Faith: B picks A → 4.
  - Rise of the Machine Spirit: gate + 4 held → 3.
  - Display of Spiritual Might: 5 destroyed → 3.
  - Reconnaissance Mission: 3 → 10.
  - CP:
    - Display of Spiritual Might round 2 → base 0;
    - Sacred Ground has a `roll-1-3-lose` gate;
    - Desperate Raid has a +1 extra.
  - All 9 have `pack:'arks-of-omen'`, `battleSize:'incursion'` and board 44×30.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Transcribe** the 9 missions (Task 4 procedure).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(data): Arks of Omen Incursion missions`.

### Task 6: Arks of Omen Strike Force missions

**Files:** Create `packages/data/missions/arks-of-omen-strike-force.json`. Modify `missions-data.test.ts`, adding the Strike Force VP table.

- [ ] **Step 1: Failing tests:**
  - Recover the Relics: 2 destroyed → 2. CP gate with a question and `onNo:'lose'`, plus a +1 extra.
  - Tear Down Their Icons: 4 markers → 15 (max).
  - Data Scry-salvage: 2 NML → 2. Dom (2, 1) → 8.
  - Abandoned Sanctuaries: one flag → 2.
  - Conversion: all three flags (4 + 2 − 1) → 5.
  - The Scouring: 5 scanned → 15.
  - Tide of Conviction: the flag is not due in round 5; end-of-battle 2 → 6.
  - Death and Zeal: equals Cleanse the Land's components except for ids.
  - Secure Missing Artefacts: flag → 3.
  - All 9 have board 60×44.
  - Data Scry-salvage zones are polygons, and it keeps the designer's note ("approximately 44" x 60"") in `map.notes`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Transcribe** the 9 missions.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(data): Arks of Omen Strike Force missions`.

### Task 7: Build output and plain English for missions

**Files:**
- Create: `packages/content/missions/plain.json`
- Modify: `packages/data/src/missions/build.ts` (add `loadMissions`, `applyMissionPlain`, `writeMissions`), `packages/data/src/build.ts` (call `writeMissions(opts)` after the core stratagems; update the file-list comment)
- Test: `packages/data/test/missions-plain.test.ts`, `packages/data/test/missions-build.test.ts`

**Interfaces:**
- Consumes: `textKey`, `officialFor` (`plain/collect.ts`), `checkPlain` (`plain/check.ts`), Tasks 3–6.
- Produces:
  - `writeMissions(opts: BuildOptions): { written: number; total: number; flagged: string[] }`. It writes `generated/missions.json` (`MissionsOut`) and `generated/missions-report.json`.
  - Amendments are applied before plain English (`officialFor(text, amended)`).
  - A plain text that fails `checkPlain` is left off and listed in `flagged`.

**Content:**
- Plain English for every `RulesText` and primary, every mission secondary, the 28 universal secondaries, and each pack's `setupSteps`.
- It follows `packages/content/STYLE.md`.
- The format is `{ "<textKey>": { "name": "...", "kind": "mission" | "secondary", "plain": "..." } }`.

- [ ] **Step 1: Failing tests:**
  - `missions-build`: on a fixture run, `missions.json` has 24 missions and 2 packs; `secondaryFactions` has every playable slug.
  - `missions-plain`:
    - `every mission and universal-secondary text has checked plain English`: `flagged` is `[]` and `written === total` over the non-faction texts;
    - `faction secondaries may lack plain English`;
    - `no orphan plain entries`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the build. Then write the plain English, running `npm run data:build` and fixing each flag until clean.
- [ ] **Step 4: Run** `npm test -w packages/data` and expect PASS. Then run `npm run data:build` and expect the line `Missions: 24 missions, N secondaries, plain M of M`.
- [ ] **Step 5: Commit** with `feat(data): missions.json with plain English`.

### Task 8: Engine exports, board size fix, web wiring

**Files:**
- Modify: `packages/engine/package.json` (exports `"./dice": "./src/core/dice.ts"`, `"./attack-math": "./src/attack/resolve.ts"`), `packages/engine/src/setup/mission.ts` (`incursion: { w: 44, h: 30 }`), `apps/web/package.json` (`"@recruit/engine": "^0.1.0"`), `package-lock.json` (via `npm install`), `apps/web/src/routes.tsx`
- Create: `packages/engine/test/setup/board-sizes.test.ts`, `apps/web/src/table/TableRoutes.tsx`, `apps/web/src/table/TableHome.tsx` (stub heading `Table companion`), `apps/web/src/table/missionData.ts`
- Test: `apps/web/src/table/missionData.test.ts`

**Interfaces:**
- Produces:
  - `getMissions(): Promise<MissionsOut>` (cached fetch of `/data/missions.json`, same pattern as `dataClient.getJson`);
  - `missionById(all: MissionsOut, id): MissionOut | undefined`;
  - `TableRoutes`: `/table` → TableHome, `/table/new` → NewGamePage, `/table/:id` → GamePage, `/table/:id/summary` → SummaryPage.
- `routes.tsx`:
  - `path="/table"` becomes `path="/table/*"`, and `element` becomes `guard(lazyPage(<TableRoutes />))`;
  - one `const TableRoutes = lazy(...)` line goes directly above `export function AppRoutes`.

- [ ] **Step 1: Failing tests:**
  - `[Matched Play: Battlefields] Incursion is 44x30, Strike Force 44x60, Onslaught 44x90, Combat Patrol 44x30` in the engine test;
  - `getMissions caches one fetch`;
  - `/table renders "Table companion" behind sign-in` (`routes` test pattern from `RulesPages.test.tsx`).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Run `npm install` from the root to link the workspace dependency.
- [ ] **Step 4: Run** `npm test -w packages/engine`, `npm test -w apps/web` and `npm run typecheck`. Expect all PASS. Grep for engine tests that pin `BOARD_SIZES.incursion` and update them in the same commit.
- [ ] **Step 5: Commit** with `fix(engine): Incursion battlefield is 44x30; feat(web): table routes and mission data client`.

### Task 9: Game model and reducer

**Files:** Create `apps/web/src/table/game.ts` and `apps/web/src/table/game.test.ts`.

**Interfaces:**
- Consumes: `MissionOut`, `PackOut`, `PlayerKey` (`@recruit/data/missions`).
- Produces:
```ts
export type TablePhase = 'command' | 'movement' | 'psychic' | 'shooting' | 'charge' | 'fight' | 'morale';
export interface Pos { round: number; turn: 1 | 2; phase: TablePhase }
export interface PlayerSetup { name: string; listId?: string; catalogueSlug: string; secondaries: string[]; battleReady: boolean; startingCp: number; group?: string }
export interface TableSetup { battleSize: BattleSizeId; pack: Pack; missionId: string; players: Record<PlayerKey, PlayerSetup>; attacker: PlayerKey; firstTurn: PlayerKey }
export type TableEvent = { id: string; at: string; pos: Pos | null } & (
  | { t: 'start' } | { t: 'advance'; to: Pos }
  | { t: 'cp'; player: PlayerKey; delta: number; reason: 'bonus' | 'mission' | 'stratagem' | 'manual'; note?: string }
  | { t: 'vp'; player: PlayerKey; category: 'primary' | 'secondary'; sourceId: string; vp: number; detail: string }
  | { t: 'stratagem'; player: PlayerKey; stratagemId: string; name: string; cp: number }
  | { t: 'roll'; label: string; sides: 3 | 6; dice: number[] }
  | { t: 'note'; text: string }
  | { t: 'end'; reason: 'complete' | 'agreed' | 'concede'; concededBy?: PlayerKey });
export interface TableGameData { mode: 'table'; schema: 1; setup: TableSetup; events: TableEvent[] }
export interface PlayerTotals { cp: number; primary: number; secondary: Record<string, number>; battleReady: number; total: number }
export interface TableState { pos: Pos | null; started: boolean; ended: TableEvent | null; active: PlayerKey | null; players: Record<PlayerKey, PlayerTotals>; stratagemsThisPhase: { player: PlayerKey; name: string }[] }
export function deriveState(g: TableGameData, pack: PackOut): TableState;
export function nextPos(p: Pos): Pos | null;            // null after round 5, turn 2, morale
export function activePlayer(setup: TableSetup, p: Pos): PlayerKey;
export function undo(g: TableGameData): TableGameData;  // drops the last event (not 'start')
export function makeEvent<E>(body: E, pos: Pos | null): TableEvent; // id + ISO time
```
**Reducer rules:**
- CP starts at `startingCp` and never goes below 0. A negative `cp` event is clamped.
- VP is applied in event order. A primary event can't take the player's running total below 0: a loss is clamped to `-total`.
- Shown primary = min(45, sum). Each secondary = min(15, its sum). Secondary total ≤ 45 (it's already bounded by 3 × 15). Battle Ready adds 10.
- `total` = shown primary + shown secondaries + battle ready.
- In the `concede` case under the core-book pack, the conceding player's total is shown as 0.

- [ ] **Step 1: Failing tests:**
  - `nextPos walks command → morale, then turn 2, then round +1; null after the last`;
  - `activePlayer follows firstTurn`;
  - `startingCp then stratagem spends`;
  - `cp never below 0`;
  - `a loss never takes the total below 0`;
  - `undo of a clamped loss restores the total`;
  - `primary over 45 is capped in the total`;
  - `secondary capped at 15 each`;
  - `battle ready adds 10`;
  - `concede under core-book shows 0 for the conceder`;
  - `stratagemsThisPhase resets on advance`;
  - `undo never removes start`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): table game event model`.

### Task 10: Saved games and the games list

**Files:** Create `apps/web/src/table/tableStore.ts` and `tableStore.test.tsx`. Modify `apps/web/src/table/TableHome.tsx`.

**Interfaces:**
- Consumes: `useStorage()`, `useAuth()`, `newDocId()`, `Repository.saveDoc/getDoc/listDocs`, `liveQuery`. Copy the `listStore.ts` pattern.
- Produces:
  - `useTableGames(): { games: Doc<TableGameData>[]; loading: boolean }` (filtered to `data.mode === 'table'`);
  - `createTableGame(repo, ownerId, setup): Promise<string>`;
  - `useTableGame(id): { game: Doc<TableGameData> | null; append(events: TableEvent[]): Promise<void>; replace(data): Promise<void> }`. `append` saves the whole document, marked dirty.
- **TableHome:**
  - title `Table companion`, a `New game` button, and a list of games, newest first.
  - Each game shows the mission name, the round (or `Finished`), and `A 34 – 28 B`, with a `Resume` link.
  - Empty state: `No games yet. Start one when you sit down to play.`

- [ ] **Step 1: Failing tests:**
  - `sandbox-mode game docs are not listed`;
  - `append keeps order and marks dirty`;
  - `a game saved offline stays dirty and is listed` (no remote configured);
  - `TableHome shows Resume for an unfinished game`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): saved table games`.

### Task 11: Game setup wizard

**Files:** Create `apps/web/src/table/setupModel.ts`, `setupModel.test.ts`, `NewGamePage.tsx` and `NewGamePage.test.tsx`.

**Interfaces:**
- Consumes: `useLists()`, `getIndex()` (playable catalogues), `getMissions()`, `rollDice` (Task 16 defines it; in this task, use `Math.random`-free injection: `roll: () => number` prop defaulting to `rollD6`).
- Produces:
  - `missionsFor(all, size): MissionOut[]`, sorted by roll;
  - `missionForRoll(all, size, d1: number, d2?: number): MissionOut`. D33 means two D3s read as tens and units; D6 matches the ranges `1-2`, `3-4`, `5-6`.
  - `secondaryChoices(all, pack, catalogueSlug, missionId): { universal: SecondaryOut[]; faction: (SecondaryOut & { note?: string })[]; mission?: SecondaryOut }`
  - `secondaryProblems(pack, chosen: SecondaryOut[]): string[]`, which gives plain-language problems:
    - `Pick exactly 3 secondary objectives.`
    - `You can only pick one from {category}.` (a mission secondary has no category limit);
  - `defaultSetup(pack, size): Pick<PlayerSetup, 'secondaries' | 'startingCp'>`.
- **Wizard steps** (exact titles from Global Constraints), one screen each:
  1. **Battle size:** the four sizes, each with its points, board and pack. Example: `Strike Force · 2,000 pts · 44" × 60" · Arks of Omen GT missions`.
  2. **Mission:** a list with roll numbers, a `Roll for mission` button, and a `MissionMap` preview (Task 12).
  3. **Armies:** for each player, `Use one of my lists` / `Just pick a faction`. At least one of the two must use a list (spec: "both lists, or your list plus the opponent's faction"). Name fields default to `You` / `Opponent`.
  4. **Attacker and Defender:** a `Roll off` helper, then "Who is the Defender?". Then "The Defender picks a deployment zone: Player A or Player B", and the map highlights the zones. Then the first turn: `Roll off`, with the pack rule shown (Arks of Omen: winner takes the first turn; Core Book: winner chooses).
  5. **Secondary objectives:** for each player, chips grouped by category, with the defaults preselected for Arks of Omen. Faction ones carry their `note`. Problems show inline.
  6. **Ready:** Battle Ready toggles and starting CP steppers, each with a hint. Arks of Omen hint: `Arks of Omen: 6 CP. Take off any CP you spent on Warlord Traits, Relics or Heroic Support.` Core Book hint: `Take off CP spent on detachments and upgrades.` Then a `Start game` button, which creates the doc with the `start` event and navigates to `/table/:id`.

  The pack `setupSteps` show as a collapsible "What happens before the battle" list on the Ready step.

- [ ] **Step 1: Failing tests:**
  - `missionForRoll D33 2,3 → aoo-surge-of-faith (Incursion)`;
  - `D6 4 → cb-all-out-war (Onslaught)`;
  - `two from Purge the Enemy is a problem`;
  - `mission secondary doesn't count against categories`;
  - `Blood Angels list sees Space Marines and Blood Angels faction secondaries`;
  - `defaults are the three Arks of Omen defaults`;
  - NewGamePage: `both players on factions only can't continue`, `start creates a game and navigates`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): table game setup`.

### Task 12: Mission map and mission rules display

**Files:** Create `apps/web/src/table/MissionMap.tsx`, `MissionRules.tsx` and `MissionMap.test.tsx`.

**Interfaces:**
- Produces:
  - `MissionMap({ map, highlight?: PlayerKey, players?: Record<PlayerKey,string> })`: an inline SVG `viewBox="0 0 W H"`, width 100%. Zones are tinted (A steel, B red, as on the Wahapedia maps). Objectives are circles of radius 1 plus label text, and `areas` are drawn as dashed outlines. It has `role="img"` and an `aria-label` listing the objectives and zones in words.
  - `MissionRules({ mission })`: cards for each rule and the primary, using `RulesText` (plain by default, official toggle). Mission `unverified` items show as `Not confirmed: …`.
- [ ] **Step 1: Failing tests:**
  - `renders one circle per objective`;
  - `aria-label names zones and objective count`;
  - `circle exclude renders as an SVG mask`, for Cleanse the Land-style zones;
  - `MissionRules shows Not confirmed notes`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): mission map and rules cards`.

### Task 13: Game screen, phase checklist, CP bonus and scoring prompts

**Files:** Create `apps/web/src/table/checklist.ts`, `checklist.test.ts`, `GamePage.tsx`, `Scoreboard.tsx`, `TurnPanel.tsx`, `ScorePrompt.tsx`, `GamePage.test.tsx` and `table.css`.

**Interfaces:**
- Consumes: `deriveState`, `nextPos`, `activePlayer` (Task 9), `useTableGame` (Task 10), `dueComponents`, `scoreComponent`, `cpBonusPlan` (Task 1), `rollDice` (Task 16).
- Produces:
  - `prompts(ctx: { pack: Pack; pos: Pos; mission: MissionOut }): { id: string; text: string; source: string }[]`
  - `GamePage` with tabs `Turn` `Score` `Stratagems` `Tools` `Log`. Only `Turn` is built in this task; the other tabs come in Tasks 14–17.
- **Scoreboard (sticky):** each player's name, CP and VP total, plus `Round n · {player}'s turn · {Phase}`.
- **TurnPanel:**
  - a collapsible `Mission` card at the top with `MissionMap` and `MissionRules` (Task 12), so the mission rules are always one tap away;
  - the prompts as a checklist; ticks aren't saved;
  - at the bottom, `Next phase`, or `End turn` in Morale;
  - `Undo` (disabled when only `start` is left).
- **Flow:**
  - **On entering Command:** `CpBonus` runs for both players, using `cpBonusPlan`.
    - Base and extras without a question are added automatically as `cp` events (`reason: 'bonus'`/`'mission'`), shown as a toast line.
    - A gate or extra with a question asks Yes/No.
    - A `roll-1-3-lose` gate on "No" rolls a D6 and logs a `roll` event; on 1–3 the base is not added.
  - **On `Next phase` out of Command:** due `end-of-command-phase` components open `ScorePrompt` for the active player.
  - **On `End turn`:** `end-of-turn` components open for the active player, then `end-of-round` for both if this was turn 2.
  - **After round 5, turn 2:** `end-of-battle` components open for both players, then the game moves to the summary.
  - **`ScorePrompt`:**
    - shows each component's plain inputs: for hold, two steppers `Objectives you control` / `Objectives your opponent controls`; otherwise flags, counts or picks;
    - shows a live VP total and `Score n VP` / `Skip`;
    - writes `vp` events with `detail` = the inputs in words.
  - **`on-action` components:** a `Score an action` button in TurnPanel during the active player's turn.
- **Prompt content** (`checklist.ts`): every item has `source` = a library file and section, or a Wahapedia core-rules anchor. Before committing, check each item's wording against that source, and drop any you can't confirm. Minimum items:
  - **Command:**
    - "Both players gain 1 CP" (AoO) / "You gain 1 CP" (Core Book);
    - "Use any start-of-Command-phase abilities";
    - round ≥ 2: "Score the primary objective at the end of this phase" (except the second player in AoO round 5: "This round you score the primary at the end of your turn").
  - **Movement:**
    - "Move each unit: Normal Move, Advance, Fall Back or Remain Stationary";
    - "Units in Engagement Range can only Fall Back or Remain Stationary";
    - round 1: "No units can arrive from Strategic Reserves or Deep Strike in the first battle round";
    - rounds 2–3: "Any units arriving from Strategic Reserves this turn?" with the arrival-edge rule for that round;
    - round 3: "Units not on the battlefield by the end of this battle round count as destroyed".
  - **Psychic:** "Each PSYKER can try to manifest powers; your opponent can try to Deny the Witch".
  - **Shooting:** "Pick units to shoot one at a time"; "Units that Advanced can only fire Assault weapons; units that Fell Back can't shoot".
  - **Charge:** "Declare charges against units within 12"; your opponent can Fire Overwatch"; "Then your opponent may Heroically Intervene".
  - **Fight:** "Units that charged fight first; then players alternate, starting with your opponent".
  - **Morale:** "Units that lost models this turn take a Morale test"; "Remove models out of unit coherency".
- [ ] **Step 1: Failing tests:**
  - checklist: `round 1 movement says no reserves arrive`, `round 3 movement warns reserves are destroyed at end of round`, `every prompt has a source`;
  - GamePage:
    - `Arks of Omen Command phase adds 1 CP to both players`;
    - `Core Book adds 1 CP to the active player only`;
    - `Secret Intel Inbound gives no CP in round 1`;
    - `a Leading From the Front "No" rolls a die and logs it` (injected roll 2 → no CP);
    - `leaving Command in round 2 opens the hold prompt and 2 controlled vs 1 scores 12 in AoO`;
    - `round 5 second player is prompted for the hold at End turn`;
    - `Undo removes the last score`;
    - `End turn of turn 2 asks Break Them for both players` (Recover the Relics).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** All buttons are `.btn` (44px). The score steppers are `−`/`+` buttons of at least 44×44 with `aria-label`s.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): table turn flow, CP bonus and primary scoring`.

### Task 14: Score sheet, manual adjustments and log

**Files:** Create `apps/web/src/table/ScoreSheet.tsx`, `LogPanel.tsx`, `ScoreSheet.test.tsx` and `LogPanel.test.tsx`.

**Interfaces:**
- Produces:
  - `ScoreSheet`, the `Score` tab, for each player:
    - primary so far `/45`, plus a per-round breakdown;
    - each secondary with its name, category, type, text (`RulesText`), score `/15` and `−`/`+` steppers. A step writes a `vp` event with `category:'secondary'`;
    - CP `−`/`+` (`reason:'manual'`);
    - a warning when manual CP gains this round exceed 1: `Most rules can only give a player 1 extra CP per battle round. Check the rule you're using.` (cite the library CP section; show it only if the source confirms it, otherwise drop it).
  - `LogPanel`: events newest first, in words, e.g.:
    - `Round 2 · A · Command: +1 CP (bonus)`;
    - `Round 2 · A: Primary 8 VP (2 controlled, opponent 1)`;
    - `B used Fire Overwatch (1 CP)`;
    - `Rolled 3D6: 6 4 1`.

    It also has `Add a note`.
- [ ] **Step 1: Failing tests:**
  - `secondary stepper stops at 15 shown`;
  - `manual CP minus never below 0`;
  - `log lists events newest first in words`;
  - `note is saved`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): score sheet and game log`.

### Task 15: Stratagems for the current phase

**Files:** Create `apps/web/src/table/stratagemFilter.ts`, `stratagemFilter.test.ts`, `StratagemPanel.tsx` and `StratagemPanel.test.tsx`.

**Interfaces:**
- Consumes: `getCatalogue(slug).stratagems`, `getCoreStratagems()`, `StratagemCard`, and the wording toggle.
- Produces:
  - `phaseStrings(phase: TablePhase, side: 'active' | 'reacting', ctx: { firstCommandOfRound: boolean; endOfTurn: boolean }): string[]`
    - active: `"<Phase> phase"`, `"Any phase"`, `"Any of your phases"`, `"Any time"`;
    - plus `"At the start of battle round"` when `firstCommandOfRound`;
    - plus `"End of your turn"` in Morale;
    - reacting: `"Enemy <Phase> phase"`, `"Any phase"`, `"Any time"`.
    - `Being targeted`, `Taking casualties` and `Enemy taking casualties` are always returned under a separate `reactions` list. Signature: `phaseFilter(...): { main: string[]; reactions: string[] }`.
  - `stratagemsFor(all: StratagemOut[], filter, group?: string): { main: StratagemOut[]; reactions: StratagemOut[] }`
  - `StratagemPanel`:
    - two sections, `{active player} (their turn)` and `{other player} (reacting)`, each with group chips (`All` + each `group`);
    - core stratagems are always included;
    - `Use (n CP)` writes `stratagem` and `cp` events;
    - it is disabled when CP < cost, and shows `Already used this phase` when the same name was used this phase (allowed only after a confirm, for rules that say otherwise);
    - the cost `"1/2"` asks which cost applies.
- [ ] **Step 1: Failing tests:**
  - `active Shooting includes "Shooting phase" and "Any phase"`;
  - `reacting Shooting includes "Enemy Shooting phase"`;
  - `start of round only in the first Command phase of the round`;
  - `reactions always listed`;
  - `Use spends CP and logs`;
  - `same stratagem twice in a phase warns`;
  - `"1/2" cost asks`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): phase-filtered stratagems in the table companion`.

### Task 16: Tools: dice roller, attack odds, rules search

**Files:** Create `apps/web/src/table/dice.ts`, `dice.test.ts`, `odds.ts`, `odds.test.ts`, `ToolsPanel.tsx`, `DiceRoller.tsx`, `OddsCalculator.tsx` and `ToolsPanel.test.tsx`.

**Interfaces:**
- Consumes:
  - `seedDice`, `nextD6`, `d3FromD6` and `parseDice` from `@recruit/engine/dice`;
  - `woundNeeded`, `capMod`, `hitSucceeds`, `woundSucceeds`, `saveSucceeds`, `blastShots` and `bestSave` from `@recruit/engine/attack-math`;
  - `searchDocs`, `search` (`rules/search.ts`), `getRules`, `getCoreStratagems`.
- Produces:
  - `rollDice(n: number, sides: 3 | 6, seed?: number): number[]`. With no seed it seeds from `crypto.getRandomValues`.
  - `rollD6(): number`
  - `attackOdds(i: OddsInput): OddsResult`, where:
```ts
export interface OddsInput { attacks: string; blast: boolean; targetModels: number; skill: number | 'auto'; hitMod: number; rerollHits: 'none' | 'ones' | 'failed';
  strength: number; toughness: number; woundMod: number; rerollWounds: 'none' | 'ones' | 'failed'; ap: number;
  save: number | null; invuln: number | null; saveMod: number; damage: string; fnp: number | null; woundsPerModel: number }
export interface OddsResult { hits: number; wounds: number; unsaved: number; damage: number; kills: number; atLeast: number[] /* P(≥k kills), k = 1..targetModels */ }
```
**Odds rules:**
- Exact distributions, no simulation.
- Per-die success probability comes from enumerating faces 1–6 through the engine predicates. Modifiers go through `capMod` for hit and wound.
- Re-rolls follow the engine's ruling: "failed" is judged the way `src/interact/windows.ts` judges it (find and match the engine's re-roll-failed rule; M4 test `[TS §1.6] … judges failure before modifiers`).
- The attack count distribution comes from `parseDice`, then Blast via `blastShots`.
- The save uses `bestSave` with a minimal `ModelChars` (`Sv: save, invuln`), and `saveMod` goes into `allMods`.
- Damage: a per-attack distribution from `parseDice(damage)`, each wound point ignored by FNP with probability `(7-fnp)/6`.
- Kills use a DP over attacks with the state (models killed, wounds left on the current model). Excess damage is lost (it doesn't spill over to the next model).
- `atLeast` is clamped to [0, 1].
- **UI:** `Dice`: count stepper, D6/D3, `Roll`, the results sorted and shown as pips, `Count n+` buttons, and `Re-roll 1s` / `Re-roll fails below n+`. Each roll is logged. `Attack odds` and `Rules search` are on the same panel.

- [ ] **Step 1: Failing tests:**
  - `10 shots BS3+ S4 T4 Sv3+ AP0 D1: expected unsaved 10*(4/6)*(3/6)*(2/6)`;
  - `wound table via engine: S8 vs T4 needs 2+`;
  - `re-roll 1s to hit at BS3+ gives 4/6 + 1/6*4/6 per shot`;
  - `invuln used when better than armour after AP`: Sv3+ AP−3 with 5++ uses 5+;
  - `blast minimum 3 against 6 models`: D3 attacks → expected ≥ 3;
  - `FNP 5+ removes a third of damage`;
  - `D3 damage vs W2 models never kills two models with one attack`;
  - `odd inputs never give NaN`: `2D3`, `D6+1`, `save null` with `invuln 5`, `ap -6`, 1 model;
  - `rollDice with a seed is repeatable`;
  - `search finds "overwatch"`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): dice roller, attack odds and rules search tools`.

### Task 17: Ending the game and the summary

**Files:** Create `apps/web/src/table/SummaryPage.tsx` and `SummaryPage.test.tsx`. Modify `GamePage.tsx` (the `End the game` dialog).

**Interfaces:**
- Produces:
  - **`End the game` dialog** with the three exact choices. `A player concedes` asks who. Each writes an `end` event; "all 5 rounds" is written automatically after the last end-of-battle scoring.
  - **SummaryPage:**
    - the winner (or `Draw`) and the final totals;
    - each player's primary /45, each secondary /15, Battle Ready, CP left and stratagems used (count and names);
    - VP by round, as a simple table;
    - the mission and secondaries;
    - concede wording: AoO `"{x} conceded, so {y} wins."`; Core Book `"{x} conceded and scores 0 VP."`;
    - buttons `Back to games` and `View log`.
- [ ] **Step 1: Failing tests:**
  - `winner is the higher total`;
  - `tie shows Draw`;
  - `AoO concession: opponent wins whatever the score`;
  - `Core Book concession shows 0 for the conceder`;
  - `VP by round sums to the total primary`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** with `feat(web): end of game and summary`.

### Task 18: End-to-end tests and manual check

**Files:** Create `apps/web/e2e/table.spec.ts`.

- [ ] **Step 1: Write the e2e test** (both Playwright projects, `mobile` 375×812 and `desktop`). The `short tracked game` test:
  1. Dev sign-in, then create a list through the UI (the `lists.spec.ts` steps).
  2. `/table` → `New game` → Incursion → `aoo-cleanse-the-land` → your list vs `Just pick a faction` (Orks).
  3. Pick A as the Defender, zone A, first turn A, with default secondaries → `Start game`.
  4. Check that the Command phase shows both players at 7 CP.
  5. Walk round 1 to round 2: open Stratagems in Shooting and use one, so CP drops by its cost.
  6. Roll 3D6 in Tools; it shows in the log.
  7. Run Attack odds with the defaults and expect a number.
  8. Round 2, A's Command: score the hold with 2 vs 1, so A has 12 VP.
  9. `Undo`, so A has 0. Score again.
  10. Reload the page: `reload mid-game resumes at the same phase`.
  11. `context.setOffline(true)`, add a secondary VP, reload, and the change is kept.
  12. `End the game` → `We agreed to stop early`. The summary shows A ahead.
  13. On every screen: no horizontal scroll (`scrollWidth - innerWidth <= 0`), and every visible button has `boundingBox().height >= 44`. With `SHOT_DIR` set, take screenshots.
- [ ] **Step 2: Run** `npm run e2e`. Expect every test PASS in both projects. Fix any failures through the units they reveal, test-first.
- [ ] **Step 3: Manual check.** Run the dev server via `preview_start` and walk setup → turn → score → stratagems → tools → summary in the built-in browser at 375×812. Take screenshots for the report.
- [ ] **Step 4: Full verification.** Run `npm test`, `npm run typecheck` and `npm run e2e`, all green. Also run `npm run data:build`, which must report missions with no flags.
- [ ] **Step 5: Commit** with `test(web): table companion e2e at phone and desktop sizes`. Then update the shared notes `m7-status.md`: touched paths, the interface for M5, and the follow-ups (faction-secondary plain English; any `library fix:` items).

---

## After the tasks
- **Whole-branch review** on the most capable model (superpowers:requesting-code-review). It focuses on:
  - rules correctness of the missions, scoring, CP and prompts;
  - the Review Focus list;
  - merge safety with `m5-sandbox`.
- **One fix pass,** test-first for each Important or Critical finding. Then re-run `npm test` and `npm run e2e`.
- **Report** to the parent session: the branch, commits, test counts and the follow-ups. Don't merge or push.
