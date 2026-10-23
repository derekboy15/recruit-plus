# Milestone 6 (Learn path) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Learn tab at `/learn`: 15 short lessons in order, each a plain-English explanation plus a hands-on drill played on the M5 sandbox board with the real engine, real units and real dice. Progress is saved local-first. Finishing all 15 unlocks "Your first game": a 500-point Combat Patrol sandbox game with hints on, using two ready-made starter lists.

**Architecture:**
- **Lesson text is content, built like the M3 articles.** Each lesson is a Markdown file in `packages/content/lessons/`. `npm run data:build` compiles them to `generated/lessons.json`, using the M3 Markdown compiler. The build checks every link and reference against the built rules articles and glossary. Lessons don't copy the Rules Reference. They are short and point to the article sections. The lesson page shows the "Key words" definitions straight from the glossary data.
- **Drills are code, and the engine is the judge.** A drill is a TypeScript object in `apps/web/src/learn/drills/`:
  - `build(ctx)`: a scripted scenario. It makes a real `GameRecord` from real datasheets, placed at exact positions, and plays scripted engine commands to reach the starting moment.
  - **Stages**, in order:
    - `do` stages: the learner acts on the board through the normal M5 phase panels. A `check` reads the engine state and its log, and says "keep going", "passed (and why)" or "failed (and why)".
    - `ask` stages: a question. Its correct answer is **computed from the engine** (the dice on the table, `woundNeeded`, `objectiveControl`, the datasheet…), never typed in.
  - **Autopilot:** confirms the other side's rolls, answers its reactions and runs any scripted opponent steps.

  A pure controller (`drill/run.ts`) runs all this with no React, so every drill is unit-tested end to end with scripted dice.
- **One board, two screens.** The board wiring in M5's `GameScreen` moves into a hook, `useBoardUi(sb)`. The game screen and the new drill screen both use it.
  - The drill screen gives the panels a `ReadySandbox` built from the drill run, so `act` goes through the drill controller.
  - Panels, the board, gestures and the renderer are reused unchanged.
- **Real dice:**
  - **Drills:** each run is seeded with `crypto.getRandomValues`. "Try again" starts a fresh run with a new seed.
  - **Tests:** a fixed seed, plus `scriptedDice` appended after the dice the scenario itself uses, so both outcomes of every roll are pinned.
- **Progress** is a storage doc of kind `'progress'`, one per user, synced like lists. Saving merges with what is stored (a lesson stays done once done), so two devices never undo each other.
- **Your first game:**
  - **Lists:** two starter lists, Ultramarines and Necrons, built at runtime with the army builder's roster engine from real catalogue data. They are checked by `validate()`.
  - **Mustering:** they go through M5's `loadArmy` and `buildGameSetup`.
  - **Game:** saved as an ordinary sandbox game: Combat Patrol, the Core Book mission "Incisive Attack" (M7 data), hints on. It then opens in `/play/:id`.

**Tech Stack:** unchanged. React 19, TypeScript, Vite, Vitest + Testing Library, Playwright; the workspace packages `@recruit/engine`, `@recruit/data` and `@recruit/content`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-recruit-plus-design.md`, sections 3.1, 3.3, 4, 8 and 10.
- **Engine contract:** `packages/engine/src/index.ts` and `packages/engine/RULINGS.md` (R-1 … R-27).
- **Board and panels:** `apps/web/src/play/**` (M5 plan `docs/superpowers/plans/2026-10-22-m5-sandbox.md`).
- **Articles:** `packages/content/rules/*.md` (M3 plan).

**Branch:** `m6-learn-path` in the worktree `L:\9th Edition\app-m6`, created off `main`. It touches only these:
- `packages/content/lessons/**` (new);
- `packages/data/src/content/**`, `packages/data/src/model/types.ts`, `packages/data/src/build.ts`, plus the data tests;
- `apps/web/src/learn/**` (new);
- `apps/web/src/play/game/GamePage.tsx` and the new `apps/web/src/play/game/useBoardUi.ts`;
- `apps/web/src/factions/dataClient.ts` (`getLessons`);
- `apps/web/src/routes.tsx` (the `/learn` route only);
- `apps/web/e2e/learn.spec.ts` (new);
- this plan file.

## Global Constraints
- **Wrong rules are the worst failure.**
  - Every rules claim in a lesson must agree with the engine and the M3 articles.
  - Source precedence (spec §4): final GW changes > BSData > Wahapedia > research library.
  - Every number a lesson states is pinned by a row in `learn/lessonFacts.test.ts`. A row checks that the number appears in the lesson, appears in the named article section, and is what the engine does.
  - When a lesson and an article disagree, fix the lesson (or report the article to the user). Never fix it by bending the engine.
- **The UI never decides a rule.** It never filters out a legal choice the engine would accept.
  - **Drill refusals:** a drill may refuse a command that is legal but off the drill's path (`guard`), with a drill message such as "In this drill, charge the Necron Warriors." It never claims that such a command breaks the rules.
  - **Rules refusals:** these are always the engine's own `Problem.message`.
- **Answers come from the engine.** An `ask` stage's `answer(w)` and `explain(w)` are computed from the drill's live state, the log or the engine's helpers. A drill test pins each one for at least two dice scripts.
- **Phones first:**
  - Everything works at 375×812.
  - Every tappable control is at least 44 px (`var(--touch)`), and there is no sideways page scroll.
  - The drill screen is full-window, like the game screen.
- **Plain English:** copy follows `packages/content/STYLE.md`. Numbers are digits (`6"`, `2D6`, `4+`), keywords are in CAPITALS, and game terms are named the way the Rules Reference names them. No engine or BattleScribe jargon ("command", "event", "dispatch", "selection") appears in user-facing text.
- **Lessons:**
  - 2–5 minutes each. Front matter `minutes` is 2–5, and the lesson text is at most 600 words (build check).
  - Exactly 15, in the order and with the ids in the lesson table below.
- **Progress is monotonic.** A completed lesson never becomes incomplete through sync or merge. Lesson *n* is unlocked when *n* = 1 or lesson *n − 1* is complete.
- **Bundle:** the Learn pages load lazily from `/learn` routes. The engine and the board load only on the drill screen.
- **Test-only hooks** exist only when `import.meta.env.DEV`:
  - `window.__sandbox` (the board's, as in M5);
  - `window.__learn.completeAll()`: e2e uses it to unlock "Your first game".
- **Engine changes:** none planned. If a drill exposes an engine bug, fix it test-first in `packages/engine` in its own commit (test title with a citation tag), and list it in the hand-over notes.

## Review Focus
1. **Two devices, two progress docs.** Two devices that were offline can each create a progress doc. Expected: progress is the union, a lesson done anywhere stays done, and the next save folds both into one doc and deletes the other. Test: Task 2 `'two progress docs merge into one, keeping every completed lesson'`.
2. **Deep links to locked lessons.** Opening `/learn/fight` or `/learn/fight/drill` before lesson 8 is done shows "Finish ⟨previous lesson⟩ first" with a link to the next open lesson. It never starts the drill. Test: Task 6 `'a locked lesson by URL says what to finish first and starts no drill'`.
3. **Real dice both ways.** Every dice-driven drill must explain both outcomes (a charge made and failed, a Morale test passed and failed, a Psychic test passed, failed or with Perils). It can never get stuck when the dice go against the learner (e.g. zero hits means no wound roll). Test: in each lesson task, every drill with dice has one test per branch (scripted dice), each reaching `done` or `failed` with the lesson's explanation.
4. **Off-path and dead-end actions.**
  - **Off path:** tapping the wrong unit, shooting another target or moving the other squad gets a drill message. Nothing changes.
  - **Dead end:** a move that ends short of the goal, when the unit can't move again this phase, ends the run as `failed`, with the reason and "Try again". It never leaves the learner stuck.

  Tests: Task 4 controller tests, plus Lesson 1's `'a move that ends out of range fails with the reason and can be tried again'`.
5. **Leaving mid-drill.** Reloading, navigating away or going offline after the data loaded must restart the drill cleanly. Drills keep no saved state, and progress changes only on completion. If catalogue data can't load, the screen shows the error and a "Try again" button. Tests: Task 5 `'reloading mid-drill starts it again from the beginning'` and `'a data load failure offers to try again'`.

---

## The 15 lessons

All drills are on a Combat Patrol board (44"×30") unless noted.
- **Players:** the learner commands Player A, the Ultramarines (south edge), and the Necrons are Player B (north edge).
- **"Both":** the learner also plays the Necrons for that step, with the prompt saying so.
- **Units:** all come from the real generated catalogues (`imperium-adeptus-astartes-ultramarines`, `necrons`).
- **Distances:** given between the closest base edges unless they say "centre".

| # | id | Title | Drill (stages: **do** / *ask*) | Key numbers the lesson states (each pinned in `lessonFacts.test.ts`) |
|---|---|---|---|---|
| 1 | `what-is-40k` | What 40k is | Intercessors ×5 in a row centred 7" south of an objective marker (centre); Warriors ×10 far north. **do** Normal Move so you control the marker. *ask* "Who controls the objective?" | 5 battle rounds; 7 phases in order; Combat Patrol 500 pts on 44"×30"; Intercessor M `6"`; marker range `3"` |
| 2 | `datasheets` | Reading a datasheet | Intercessors and Warriors with 18" between them; the drill card shows each unit's `Datasheet`. *ask* M of an Intercessor; *ask* Sv of a Necron Warrior; *ask* shots per bolt rifle at this range (Rapid Fire 1, 30"). **do** Shoot the bolt rifles at the Warriors: passes when the hit roll opens with 5 dice | Intercessor M `6"`, T4, W2, Sv `3+`; Warrior Sv `4+`; bolt rifle 30" Rapid Fire 1; Rapid Fire doubles within half range (15") |
| 3 | `attacks` | The attack sequence and wound table | Intercessors 12" from Warriors, Shooting phase. *ask* wound roll for S4 vs T4; *ask* the Warriors' save against AP −1. **do** Shoot. *ask* "How many of these dice hit?" (live hit roll); **do** Accept; *ask* "How many wound?" (skipped with no wound roll); **do** Accept until the shooting ends. The explanation counts hits, wounds, failed saves and casualties from the log | wound table 2+/3+/4+/5+/6+; unmodified 6 always hits/wounds, 1 always fails; AP −1 turns Sv `4+` into `5+`; 10 shots (Rapid Fire within 15") |
| 4 | `command-phase` | Command phase and CP | Core Book rules, A's Command phase of battle round 2. A holds 2 objectives and B holds 1. *ask* "How many CP do you have?" (from state: 3 + 1 + 1 = 5); *ask* "How many CP did the Necrons gain at the start of your Command phase?" (0, from the log). **do** End your Command phase. *ask* "How many VP did you score?" (15: Take and Hold) | start 3 CP (Combat Patrol); +1 CP in your own Command phase (Core Book); Arks of Omen: both players +1 every Command phase, 6 CP start; primary scored at the end of your Command phase from round 2; 5 VP per condition, 15 per turn |
| 5 | `movement` | Movement | Squad 1 in the open; squad 2 within Engagement Range of Warriors; Movement phase. **do** Advance with squad 1. *ask* "Your Advance roll is X: how far can each model move?" (6 + X). **do** Fall Back with squad 2 (a Normal Move attempt shows the engine's refusal). *ask* "Can squad 2 shoot this turn?" (No). *ask* coherency distance | Normal Move up to M; Advance M + D6, then no charge and Assault weapons only (−1 to hit); Fall Back: end out of Engagement Range, no shoot/charge; Engagement Range `1"`; coherency `2"`, 2 neighbours at 6+ models |
| 6 | `psychic` | Psychic | Librarian 10" from Warriors, Psychic phase. **do** Manifest Smite. *ask* "You rolled T against warp charge 5: does it go off?" **do** Accept until it resolves. *ask* "Did the Warriors get a saving throw?" (No). Branches: success, failure and Perils, each explained | Psychic test 2D6 ≥ warp charge; Smite warp charge 5 (+1 per earlier Smite this phase); closest visible enemy within `18"`; D3 mortal wounds (D6 on 11+); Perils on double 1 or double 6; deny needs a higher 2D6 within `24"` |
| 7 | `shooting` | Shooting | Ruins (Obscuring, 6") hide Warriors B; Warriors A stand in a crater (Light Cover); an Overlord is 2" from Warriors A and further away than them. *ask* "Which Necron unit can't you see?" (engine visibility). **do** Try to shoot the Overlord: passes on the engine's Look Out, Sir refusal. *ask* the crater Warriors' save vs AP −1 in Light Cover (`4+`). *ask* frag grenade Blast shots at 10 models when D6 rolls 2 (3). **do** Shoot the Warriors in the crater | in range and visible; Obscuring ≥ `5"`; Light Cover +1 save vs ranged; Blast 6–10 models min 3, 11+ max; Look Out, Sir: CHARACTER W ≤ 9 within `3"` of the listed friendly units (R-25); hit/wound cap ±1 |
| 8 | `charge` | Charge | Intercessors 6" from Warriors; an Overlord 2" beside the Warriors; Charge phase. **do** Declare a charge on the Warriors. Autopilot: Fire Overwatch (hits on unmodified 6). *ask* "You need X" (live gap − 1"). You rolled T: can you make it?" **do** Make the charge move, or "Charge failed": failed if the choice contradicts the roll. *ask* "Can the Overlord Heroically Intervene?" (engine `eligibleUnits(s, 'heroic')`, skipped if the charge failed) | declare within `12"`; charge roll 2D6; must end within Engagement Range `1"` of every target; Overwatch 1 CP, unmodified 6s; Heroic Intervention: CHARACTER within `3"`, moves up to `3"` |
| 9 | `fight` | Fight | Intercessors have just charged into Warriors (scenario plays the charge with scripted dice), Fight phase. *ask* "Who fights first?" (`fightOrder`). **do** Fight with the Intercessors (pile in, attack, consolidate). *ask* "Who picks the next unit?" (`fightOrder(s).picker`). **do** (both) Fight back with the Warriors | chargers fight first; then alternate, the player whose turn it isn't first; pile in and consolidate `3"`, ending closer to the closest enemy; second rank within `½"` |
| 10 | `morale` | Morale and Combat Attrition | Intercessor Squad ×10 (A) lost 3 models in the Necrons' turn (toolkit, counted as destroyed); B's Morale phase. *ask* "D6 + 3 against Ld 8: which rolls fail?" (computed). **do** Take the Morale test. *ask* "How many more fled to Combat Attrition?" (skipped if passed). Both branches explained | D6 + models destroyed this turn > highest Ld fails; unmodified 1 always passes; one model flees; Combat Attrition: D6 per model left, each 1 flees, −1 if below Half-strength |
| 11 | `objectives` | Objectives and scoring | Core Book Take and Hold on the Practice layout; A holds objective 1, B holds 4; squad 1 is 5" from objective 2; A's Movement phase, round 1. **do** Move squad 1 onto objective 2. *ask* "How many VP will you score next Command phase?" (`min(15, primaryConditions × 5)`). **do** End your turn (autopilot plays the Necrons' turn by ending phases), then end your round-2 Command phase: passes when the VP are scored | marker range `3"` (horizontal) and `5"` vertical; more models in range controls; Objective Secured beats numbers; one marker per model; Take and Hold 1+/2+/more, 5 VP each |
| 12 | `stratagems` | Stratagems | Intercessors 9" from Warriors (need 8"); A has 4 CP; Charge phase; autopilot declines Overwatch. **do** Declare the charge. If the roll is short: **do** Use Command Re-roll (1 CP). *ask* "Could you re-roll just one die?" (No: the whole 2D6). **do** Move or fail. *ask* "Could you use Command Re-roll again this phase?" (from `usedThisPhase`) | Command Re-roll 1 CP; once per phase per stratagem; the 7 core stratagems and costs; a charge re-roll re-rolls both dice |
| 13 | `terrain` | Terrain | A crater (Difficult Ground) in front of squad 2; woods (Dense, 4") between squad 1 and the Warriors. *ask* "How far can squad 2 move across the crater?" (M − 2 = 4"). **do** Move squad 2 across the crater. **do** End phases to Shooting, then shoot the Warriors behind the woods. *ask* (live hit roll) "What does each die need to hit?" (`4+`) | Difficult Ground `-2"` move, −2 charge; Dense ≥ `3"`: −1 to hit; Light Cover +1 save vs ranged; Heavy Cover +1 vs melee (not for chargers); Obscuring ≥ `5"` |
| 14 | `army-building` | Building an army | **List drill** (no board): an Ultramarines Combat Patrol, Patrol Detachment, with a Captain only. *ask* "What does your Patrol still need?" (from `validate()`'s slot-min issue). **do** Add a unit from a short real picker until the Troops slot is filled; an Elites pick shows the evaluator's explanation. *ask* "Can a Strike Force army take 4 Hellblaster Squads?" (No: Rule of Three, from `validate()`). *ask* "4 Intercessor Squads?" (Yes: Troops are exempt) | Battle-forged = every unit in a detachment; Patrol HQ 1–2, Troops 1–3; Patrol 2 CP, +2 back if it has your Warlord; Rule of Three (Rule of Two at Incursion), Troops and Dedicated Transports exempt; 500 pts Combat Patrol |
| 15 | `mission-setup` | Mission setup | The Core Book Combat Patrol mission "Incisive Attack" (M7 map), deploy step; A is the Defender with Intercessors and a Librarian; B has Warriors and an Overlord. *ask* "Who sets up first?" (`currentStep`). **do** Deploy the Intercessors wholly within your zone (autopilot deploys a Necron unit by `formation`). **do** Deploy the Librarian. *ask* "In a Core Book mission, what does the roll-off winner get?" (from `rules.firstTurn`). **do** Roll off (choose first if you win): passes when battle round 1 starts | Defender deploys first, alternating; wholly within your deployment zone; Core Book roll-off winner chooses who goes first (Arks of Omen: winner goes first); mission sequence order |

**Lesson 14 is a list drill, not a board drill.** Army building happens in the list builder, not on the battlefield. Its drill uses the real roster engine (`validate`, `explain`, `addUnit`) the same way board drills use the game engine. Every other lesson's drill is on the board.

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/content/lessons/NN-<id>.md` | lesson text and front matter (15 files) |
| `packages/data/src/content/lessons.ts` | lesson Markdown → `Lesson[]`, with reference checks |
| `packages/data/src/model/types.ts` | `Lesson`, `LessonsData` types (added) |
| `apps/web/src/learn/LearnRoutes.tsx` | `/learn`, `/learn/:lessonId`, `/learn/:lessonId/drill`, `/learn/first-game` |
| `apps/web/src/learn/LearnHome.tsx` | the path, the progress view, the "Your first game" card |
| `apps/web/src/learn/LessonPage.tsx` | explanation, key words, rules links, "Start the drill" |
| `apps/web/src/learn/progress.ts` | progress doc: read, merge, complete, unlock rules, `useProgress` |
| `apps/web/src/learn/drill/types.ts` | `Drill`, `Stage`, `Watch`, `Verdict`, `DrillCtx` |
| `apps/web/src/learn/drill/run.ts` | the pure controller: start, act, answer, autopilot |
| `apps/web/src/learn/drill/sandbox.ts` | a `ReadySandbox` over a drill run (for the M5 panels) |
| `apps/web/src/learn/drill/DrillScreen.tsx`, `DrillCard.tsx`, `ListDrill.tsx` | the drill screen, its card, and the list-drill panel |
| `apps/web/src/learn/drills/scenario.ts` | building scenarios from real datasheets at exact positions |
| `apps/web/src/learn/drills/l01-what-is-40k.ts` … `l15-mission-setup.ts` | one drill per lesson |
| `apps/web/src/learn/drills/index.ts` | `DRILLS: Record<lessonId, Drill>` |
| `apps/web/src/learn/starterLists.ts`, `firstGame.ts` | starter lists and "Your first game" |
| `apps/web/src/learn/__fixtures__/drills.ts` | test-only: `DrillCtx` from the generated data on disk, `play()` helper |
| `apps/web/src/learn/lessonFacts.test.ts` | pins each lesson's numbers against the lesson, the article and the engine |
| `apps/web/src/learn/learn.css` | Learn-only styles |
| `apps/web/src/play/game/useBoardUi.ts` | board wiring shared by the game and drill screens |
| `apps/web/e2e/learn.spec.ts` | phone and desktop e2e |

Tests sit next to their files.

---

### Task 1: Lesson content pipeline

**Files:**
- Create: `packages/data/src/content/lessons.ts`, `packages/content/lessons/01-what-is-40k.md`
- Modify: `packages/data/src/model/types.ts`, `packages/data/src/content/build.ts` (`buildContent` also returns `lessons`), `packages/data/src/build.ts` (write `generated/lessons.json`; add it to the header comment), `apps/web/src/factions/dataClient.ts`
- Test: `packages/data/test/content-lessons.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // model/types.ts
  export interface LessonRef { article: string; section: string; title: string }   // title copied from the built section
  export interface Lesson {
    id: string; title: string; order: number; minutes: number; summary: string;
    drill: string;                     // the drill's id; apps/web checks it exists (Task 12)
    intro: Block[]; sections: RulesSection[];
    rules: LessonRef[];                // "In the Rules Reference"
    glossary: string[];                // glossary term ids ("Key words")
  }
  export interface LessonsData { lessons: Lesson[] }   // sorted by order
  // lessons.ts
  export function buildLessons(dir: string, rules: RulesData): LessonsData;
  // dataClient.ts
  export const getLessons = () => getJson<LessonsData>('/data/lessons.json');
  ```
- **Front matter:** `id`, `title`, `order`, `minutes`, `summary`, `drill`, `rules: [article#section, …]`, `glossary: [term-id, …]`, and `sources` (same format and check as the articles, via `checkSources`).

- [ ] **Step 1: Write the failing tests** in `content-lessons.test.ts`. Use a temp dir of lesson files and the real `buildContent` rules from `packages/content/rules`.
  - `'builds a lesson with its sections, rules links and key words'`: the `rules` entries carry the section titles from the built articles.
  - `'rejects a rules reference to a missing article or section'`: the message names the file and the bad reference.
  - `'rejects an unknown glossary id'`.
  - `'rejects an inline /rules/ link that points nowhere'`, e.g. `[x](/rules/charge-phase#nope)`. `/rules/glossary#id` and `/rules/stratagems…` links are checked too.
  - `'rejects minutes outside 2–5 and text over 600 words'`.
  - `'rejects duplicate ids or orders'`.
  - `'the real lessons build'`: `buildLessons('packages/content/lessons', rules)` gives at least one lesson.
- [ ] **Step 2: Run** `npm test -w packages/data -- content-lessons`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.**
  - `buildLessons` reuses `readSource`, `checkSources` and `compileMarkdown` from `build.ts` (export what's needed).
  - Words are counted with `blocksText` over intro and sections.
  - Write lesson 1 (`what-is-40k`), following `STYLE.md`. Its sections are "The game", "Turns and phases" and "Winning". It links to `basics#the-battle-round`, `basics#units-models-and-datasheets` and `matched-play#battle-sizes`, plus `matched-play#objective-markers`. The facts it must state are in the lesson table.
  - `npm run data:build` writes `lessons.json`.
- [ ] **Step 4: Run** `npm test -w packages/data` and `npm run data:build`. Expected: PASS, and `generated/lessons.json` exists.
- [ ] **Step 5: Commit** `feat(data): build Learn lessons from packages/content/lessons with reference checks`

---

### Task 2: Progress

**Files:**
- Create: `apps/web/src/learn/progress.ts`
- Test: `apps/web/src/learn/progress.test.ts`

**Interfaces:**
- Consumes: `Repository`, `Doc`, `newDocId`, `useAuth`, `useStorage`, `liveQuery` (as `useLists` does).
- Produces:
  ```ts
  export interface LessonDone { completedAt: number; mistakes: number }
  export interface ProgressData { schema: 1; lessons: Record<string, LessonDone>; firstGameId?: string }
  export const EMPTY_PROGRESS: ProgressData;
  /** Union of completions (earliest completedAt wins, fewest mistakes kept); firstGameId from the newest doc that has one. */
  export function mergeProgress(...docs: ProgressData[]): ProgressData;
  export function isUnlocked(order: number, lessonsInOrder: string[], p: ProgressData): boolean;   // order is 1-based
  export function nextLesson(lessonsInOrder: string[], p: ProgressData): string | null;          // first not completed
  export const allDone: (lessonsInOrder: string[], p: ProgressData) => boolean;
  /** Reads every progress doc of the owner, merges, applies `change`, saves into the oldest doc, deletes the others. */
  export async function updateProgress(repo: Repository, ownerId: string, change: (p: ProgressData) => ProgressData): Promise<ProgressData>;
  export const completeLesson = (repo: Repository, ownerId: string, lessonId: string, mistakes: number) => Promise<ProgressData>;
  export function useProgress(): { progress: ProgressData; loading: boolean; error: Error | null };   // live, merged
  ```

- [ ] **Step 1: Write the failing tests** (fake-indexeddb repo, as in `listStore.test.tsx`):
  - `'with no doc progress is empty and only lesson 1 is unlocked'`.
  - `'completing a lesson saves it and unlocks the next'`.
  - `'completing a lesson again keeps the first completedAt'`.
  - `'two progress docs merge into one, keeping every completed lesson'`: two docs with different lessons. After `completeLesson`, one doc is left (the other is `deleted`), and it holds the union plus the new lesson.
  - `'nextLesson and allDone follow the order'`.
  - `'useProgress shows a completion made elsewhere'`: save through the repo, and the hook updates.
- [ ] **Step 2: Run** `npm test -w apps/web -- learn/progress`. Expected: FAIL.
- [ ] **Step 3: Implement** `progress.ts`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learn): local-first lesson progress that merges across devices`

---

### Task 3: Share the board wiring

**Files:**
- Create: `apps/web/src/play/game/useBoardUi.ts`
- Modify: `apps/web/src/play/game/GamePage.tsx` (`GameScreen` uses the hook; its behaviour is unchanged)
- Test: `apps/web/src/play/game/useBoardUi.test.tsx`; the existing `GamePage.test.tsx` must still pass unchanged

**Interfaces:**
- Produces:
  ```ts
  export interface BoardUi {
    ui: PanelProps['ui'];
    scene: BoardScene;
    canDrag(modelId: string): boolean;
    onTap(at: Pt, modelId: string | null): void;
    onDrag(modelId: string, at: Pt, phase: 'start' | 'move' | 'end' | 'cancel'): void;
    /** Clears selection, plan, rings, targets, invalid models and problems (GameScreen's new-step reset). */
    reset(): void;
  }
  export function useBoardUi(sb: ReadySandbox): BoardUi;
  ```
- **Moved from `GameScreen` into the hook, unchanged:**
  - the selection, plan, rings, targets, invalid and problems state;
  - the tap and drag refs;
  - the drag offset;
  - the "a new phase or step starts with a clean board" effect;
  - the DEV `window.__sandbox` state and plan effect.
- **What stays in `GameScreen`:** the hand-over, the overlays, the toolkit, the top bar and undo.

- [ ] **Step 1: Write the failing test** `useBoardUi.test.tsx`, over the `renderPanel`-style in-memory sandbox (`deployedGame()`):
  - `'a tap on a model selects its unit when no panel took the taps'`.
  - `'a finished drag moves the planned model by the drag, keeping the grab offset'`.
  - `'a new phase clears the selection and the plan'`.
- [ ] **Step 2: Run** `npm test -w apps/web -- useBoardUi`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook, and switch `GameScreen` to it.
- [ ] **Step 4: Run** `npm test -w apps/web -- play/` and `npm run typecheck`. Expected: PASS. All M5 play tests are unchanged.
- [ ] **Step 5: Commit** `refactor(play): board wiring in a useBoardUi hook, shared with Learn drills`

---

### Task 4: The drill controller

**Files:**
- Create: `apps/web/src/learn/drill/types.ts`, `apps/web/src/learn/drill/run.ts`, `apps/web/src/learn/__fixtures__/drills.ts`
- Test: `apps/web/src/learn/drill/run.test.ts`

**Interfaces:**
- Consumes: `dispatch`, `stateOf`, `currentStep`, `gameLog`, `Command`, `Problem`, `GameRecord`, `GameState`, `PlayerId`, `Datasheet` (engine); `toDatasheet` (`@recruit/engine/data`).
- Produces:
  ```ts
  // types.ts
  export interface DrillCtx {
    /** A real datasheet from a loaded catalogue. */
    sheet(catalogueSlug: string, unitName: string): Datasheet;
    /** Combat Patrol missions from the generated mission data (lesson 15 only). */
    missions: MissionsOut | null;
    seed: number;
    /** Dice appended after the scenario's own scripted dice (tests only). */
    dice: number[];
  }
  export interface Attempt { cmd: Command; problems: Problem[] | null; drill?: string }   // drill: a guard's message
  export interface Watch {
    start: GameRecord; stageStart: GameRecord; record: GameRecord; state: GameState;
    attempts: Attempt[];              // this stage's, oldest first
    answers: Record<string, string>;  // earlier ask stages' chosen ids
  }
  export type Verdict = { pass: boolean; explain: string };
  export type Stage =
    | { kind: 'do'; id: string; prompt(w: Watch): string; guard?(cmd: Command, w: Watch): string | null; check(w: Watch): Verdict | null; skip?(w: Watch): boolean }
    | { kind: 'ask'; id: string; question(w: Watch): string; choices(w: Watch): { id: string; label: string }[]; answer(w: Watch): string; explain(w: Watch): string; skip?(w: Watch): boolean };
  export interface Drill {
    id: string;                         // = the lesson id
    title: string;                      // e.g. "Charge the Necron Warriors"
    intro: string;                      // one or two sentences shown before the first stage
    catalogues: string[];               // slugs to load
    needsMissions?: true;
    /** Who the learner commands; 'both' lets them act for either side. */
    learner: PlayerId | 'both';
    build(ctx: DrillCtx): GameRecord;
    stages: Stage[];
    /** The other side's moves: return a command, or null to wait for the learner. Default: confirm the other side's open rolls and decline its reactions. */
    auto?(s: GameState, w: Watch): Command | null;
  }
  // run.ts
  export interface DrillRun {
    drill: Drill; seed: number; start: GameRecord; record: GameRecord;
    stage: number; stageStart: GameRecord; attempts: Attempt[]; answers: Record<string, string>;
    results: { stageId: string; explain: string }[];     // passed stages' explanations, in order
    wrong: string | null;                                // the explanation after a wrong answer
    mistakes: number;
    status: 'playing' | 'failed' | 'done';
    failure: string | null;
  }
  export function startRun(drill: Drill, ctx: DrillCtx): DrillRun;
  /** Guard → engine → autopilot → stage check. problems: the engine's (or the guard's) refusal, null when accepted. */
  export function actRun(run: DrillRun, cmd: Command): { run: DrillRun; problems: Problem[] | null };
  export function answerRun(run: DrillRun, choiceId: string): DrillRun;
  export function currentStage(run: DrillRun): Stage | null;
  export function watchOf(run: DrillRun): Watch;
  export const defaultAuto: (learner: PlayerId | 'both') => (s: GameState) => Command | null;
  // __fixtures__/drills.ts (test-only)
  export function diskCtx(o?: { seed?: number; dice?: number[] }): DrillCtx;   // reads packages/data/generated
  /** Runs a script of commands and answers; `'answer'` picks the stage's computed answer; throws on refusal. */
  export function play(drill: Drill, script: (Command | { answer: string | 'answer' } | ((run: DrillRun) => Command))[], ctx?: DrillCtx): DrillRun;
  ```
- **Controller rules:**
  - **Autopilot** runs after `startRun` and after every accepted command, until `auto` returns null (at most 100 steps).
    - The default confirms a pending roll whose `player` isn't the learner and declines a reaction whose `player` isn't the learner.
    - With `learner: 'both'` it does nothing.
  - **Stages:** after autopilot, stages whose `skip(w)` is true are passed over. A current `do` stage is checked; `pass: true` records its explanation and moves on; `pass: false` sets `status: 'failed'`.
  - **Questions:** while the current stage is an `ask`, `actRun` refuses every command with the drill message "Answer the question first." A right answer records its explanation and moves on. A wrong answer sets `wrong` to "Not quite. " plus the explanation and adds a mistake; the learner can answer again.
  - **Guards:** a guard message refuses the command with the code `'drill'` and the rule `''`. The command is recorded in `attempts` either way.
  - When the last stage passes, the status becomes `'done'`. No command is accepted after `done` or `failed`.

- [ ] **Step 1: Write the failing tests** with a tiny test drill: the M5 `deployedGame`-like Combat Patrol game, built through `diskCtx`; one `ask`; and one `do` "end the Command phase".
  - `'the autopilot confirms the other side\'s rolls and declines its reactions'`.
  - `'a do stage passes when its check passes and records why'`.
  - `'an ask stage refuses board actions until answered'`.
  - `'a wrong answer explains, counts a mistake and can be answered again'`.
  - `'a guard refuses an off-path command with the drill\'s message and nothing changes'`.
  - `'a failing check ends the run as failed with the reason'`.
  - `'skipped stages are passed over'`.
  - `'the same seed and dice give the same run'`.
- [ ] **Step 2: Run** `npm test -w apps/web -- learn/drill/run`. Expected: FAIL.
- [ ] **Step 3: Implement** `types.ts`, `run.ts` and the fixture.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learn): drill controller with engine-checked stages and an autopilot`

---

### Task 5: The drill screen

**Files:**
- Create: `apps/web/src/learn/drill/sandbox.ts`, `apps/web/src/learn/drill/DrillScreen.tsx`, `apps/web/src/learn/drill/DrillCard.tsx`, `apps/web/src/learn/learn.css`
- Test: `apps/web/src/learn/drill/DrillScreen.test.tsx`

**Interfaces:**
- Consumes: Task 3 `useBoardUi`; Task 4 `startRun`, `actRun`, `answerRun`, `currentStage`; M5 `BoardCanvas`, `PhasePanel`, `Problems`, `TopBar` styling classes; `getCatalogue`, `getMissions`; `Datasheet` (factions/DatasheetPage).
- Produces:
  ```ts
  // sandbox.ts
  /** The panels' view of a drill run: act goes through actRun; undo is refused ("Use Start again in a drill."). */
  export function drillSandbox(run: DrillRun, onAct: (cmd: Command) => Problem[] | null): ReadySandbox;
  // DrillScreen.tsx
  export interface DrillScreenProps {
    drill: Drill;
    onDone(mistakes: number): void;    // called once when the run is done
    exitTo: string;                    // "Back to the lesson" link
    renderer?: RendererFactory;        // tests
    seed?: number; dice?: number[];    // tests; default crypto seed, no dice
  }
  export function DrillScreen(p: DrillScreenProps): JSX.Element;
  ```
- **Layout:** it reuses the `.game` full-window grid and classes.
  - **Top bar:** the drill title, "Start again" and "Back to the lesson" (each 44 px).
  - **Board:** in the middle.
  - **Panel:** the `DrillCard` (the stage prompt, or the question as 44 px radio buttons with "Check answer", plus feedback and the passed stages' explanations), then `Problems`, then `PhasePanel`.
    - `PhasePanel` is hidden while an `ask` is current and once the run is done or failed.
    - There is no AssistPanel, toolkit or hand-over screen. Hints are off: the card is the guide.
  - **Datasheets:** the card has "See datasheet" for the selected unit. It opens the M2 `Datasheet` component for that unit's catalogue entry, matched by the engine datasheet's name.
- **Ends:**
  - On `done`: "Drill complete", every stage's explanation in order, then "Next lesson" or "Back to Learn". `onDone` is called once.
  - On `failed`: the reason and "Try again", which starts a new seed.
- **Loading:** "Setting up the drill…" while the catalogues (and the missions, if needed) load. On an error: the message and "Try again".

- [ ] **Step 1: Write the failing tests.** Use the Task 4 test drill, a fake renderer and `stubGeneratedData()`.
  - `'shows the intro and the first stage, then the question with 44px choices'`.
  - `'a right answer moves on; a wrong one explains and stays'`.
  - `'the phase panel is hidden while a question is open'`.
  - `'finishing calls onDone once and shows every explanation'`.
  - `'Start again builds a fresh run'`.
  - `'reloading mid-drill starts it again from the beginning'`: unmount and remount gives stage 1.
  - `'a data load failure offers to try again'`: make `fetch` fail once.
- [ ] **Step 2: Run** `npm test -w apps/web -- learn/drill/DrillScreen`. Expected: FAIL.
- [ ] **Step 3: Implement** the three files and the CSS.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learn): drill screen on the sandbox board with a lesson card`

---

### Task 6: Learn home, lesson page and routes

**Files:**
- Create: `apps/web/src/learn/LearnRoutes.tsx`, `apps/web/src/learn/LearnHome.tsx`, `apps/web/src/learn/LessonPage.tsx`, `apps/web/src/learn/drills/index.ts` (registry, initially lesson 1 only)
- Modify: `apps/web/src/routes.tsx`: add `const LearnRoutes = lazy(...)` beside `PlayRoutes`, and replace the `/learn` placeholder route with `path="/learn/*"`, `element={guard(lazyPage(<LearnRoutes />))}`
- Test: `apps/web/src/learn/LearnPages.test.tsx`

**Interfaces:**
- Consumes: `getLessons`, `getRules` (glossary definitions), Task 2's `useProgress` and `completeLesson`, Task 5's `DrillScreen`, the M3 `Blocks`.
- Produces:
  - `export const DRILLS: Record<string, Drill>`.
  - **Routes:**
    - `/learn` → `LearnHome`;
    - `/learn/first-game` → Task 13 (a stub until then);
    - `/learn/:lessonId` → `LessonPage`;
    - `/learn/:lessonId/drill` → `DrillScreen` wrapped with the progress calls.
- **LearnHome:**
  - **Heading:** "Learn to play" and a progress meter (`role="meter"`, `aria-label="Lessons done"`, text "3 of 15 lessons done").
  - **The path:** an ordered list of 15 cards. Each shows the number, title, minutes and a state:
    - "Done" with a tick;
    - "Next", the one `nextLesson` names, with a primary "Start" link;
    - "Locked", not a link, with "Finish lesson N first".
  - **"Your first game" card:**
    - locked text "Finish all 15 lessons to unlock a 500-point game against the Necrons, with hints on.";
    - when unlocked, a "Play your first game" link to `/learn/first-game` ("Continue your first game" once `firstGameId` is set).
  - **DEV hook:** `window.__learn = { completeAll }`, which marks every lesson complete.
- **LessonPage:**
  - "Lesson N of 15 · M minutes", the title, the intro and sections (`Blocks`).
  - **"Key words":** each glossary term's `term` and `blocks` from `rules.json`, with a link to `/rules/glossary#id`.
  - **"In the Rules Reference":** links to `/rules/:article#section` with the section titles.
  - **Drill:** a primary "Start the drill" link to `drill`.
  - **When done:** "You've finished this lesson" and "Next lesson".
- **Locked lessons**, on both the lesson and the drill route: "Finish ⟨previous lesson title⟩ first." plus a link to the next open lesson. There is no drill.
- **Drill route:** `onDone` calls `completeLesson` with the run's mistakes. The "Next lesson" link goes to the next lesson, or to `/learn` after lesson 15.

- [ ] **Step 1: Write the failing tests** (`stubGeneratedData`, fake-indexeddb, dev auth):
  - `'the path lists every lesson in order with Next on lesson 1 and the rest locked'`. Until Task 12 there is 1 lesson; assert against `lessons.json`.
  - `'a finished lesson shows Done and unlocks the next'`.
  - `'the lesson page shows the text, key words from the glossary and rules links'`.
  - `'a locked lesson by URL says what to finish first and starts no drill'`.
  - `'finishing the drill saves the lesson as done'`: drive lesson 1's drill with the fake renderer through its stage actions.
  - `'Your first game stays locked until every lesson is done'`.
  - `'every Learn button and link is at least 44px'`: check the CSS classes carry `min-height: var(--touch)`, as earlier milestones do.
- [ ] **Step 2: Run** `npm test -w apps/web -- learn/LearnPages`. Expected: FAIL.
- [ ] **Step 3: Implement** the pages, the routes and `DRILLS` (lesson 1's drill lands in Task 8; until then the registry is empty and the drill test is skipped with `it.todo` → replace it in Task 8).
- [ ] **Step 4: Run** `npm test -w apps/web` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learn): Learn home with the lesson path and progress, lesson pages and routes`

---

### Task 7: Scenario builder

**Files:**
- Create: `apps/web/src/learn/drills/scenario.ts`
- Test: `apps/web/src/learn/drills/scenario.test.ts`

**Interfaces:**
- Consumes: `newGame`, `dispatch`, `stateOf`, `missionRulesFor`, `BOARD_SIZES`, `TERRAIN_PRESETS`, `unitGap`, `placedModel` (engine); M5 `formation`, `PRACTICE`, `missionLayout` (missionAdapter).
- Produces:
  ```ts
  export const ULTRA = 'imperium-adeptus-astartes-ultramarines';
  export const NECRONS = 'necrons';
  export interface UnitSpec {
    id: string; player: PlayerId; sheet: [catalogueSlug: string, unitName: string];
    models: UnitInput['models'];
    /** Centre of the formation's front row (models in rows of `perRow`, default 5, 1.5" apart centre to centre, rows 1.5" apart behind the front, away from the enemy). */
    at: Pt; perRow?: number;
    warlord?: boolean;
  }
  export interface ScenarioSpec {
    units: UnitSpec[];
    terrain?: TerrainFeature[];
    objectives?: { id: string; pos: Pt }[];          // default: Practice layout's
    layout?: MissionLayout;                          // zones, edges, objectives (lesson 15)
    deploy?: boolean;                                // default true: deployed and battle begun, A's Command phase of round 1
    firstTurn?: PlayerId;                            // default 'A'
    attacker?: PlayerId;                             // default 'A'
    cp?: Partial<Record<PlayerId, number>>;          // starting CP override via setup rules (default Core Book 3)
    setupDice?: number[];                            // dice the scenario's own scripted commands use
  }
  export function scenario(spec: ScenarioSpec, ctx: DrillCtx): GameRecord;
  /** Ends phases and steps (both sides, confirming rolls, declining reactions, taking Morale tests) until round/turn/phase match. */
  export function advanceTo(g: GameRecord, to: { round?: number; active?: PlayerId; phase: Phase }): GameRecord;
  export function must(g: GameRecord, cmd: Command): GameRecord;            // throws with the engine's messages
  export const terrainBox: (preset: TerrainPreset, x0: number, y0: number, x1: number, y1: number, height: number, name: string) => TerrainFeature;
  export const gapBetween: (s: GameState, a: string, b: string) => number;  // engine unitGap of living models
  ```
- **Deploying a scenario:**
  - The zones are each player's half of the board (A south, `y ≤ 15`; B north, `y ≥ 15`), unless a `layout` is given.
  - Units are deployed in the engine's alternating order, the Defender first.
  - Any model whose spot is outside its zone, or that the engine would refuse to deploy there, goes to its spot afterwards with the toolkit's `placeModel`.
  - Then `beginBattle`. The scenario's scripted dice come first in `setup.scriptedDice`, then `ctx.dice`.

- [ ] **Step 1: Write the failing tests:**
  - `'places a unit\'s front row centred on its point, 1.5" apart'`.
  - `'units 6" apart measure 6.0" between their closest bases'` (`gapBetween`).
  - `'a unit inside the enemy half is placed there after deploying'`.
  - `'advanceTo reaches the Charge phase of A\'s turn and the Morale phase of B\'s turn'`.
  - `'scripted dice run before ctx.dice, then the seed takes over'`.
  - `'two seeds give different dice'`.
- [ ] **Step 2: Run** `npm test -w apps/web -- learn/drills/scenario`. Expected: FAIL.
- [ ] **Step 3: Implement** `scenario.ts`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learn): scenario builder for drills from real datasheets`

---

### Lesson tasks (Tasks 8–12): the common shape

Each lesson task writes its lessons and drills and pins them:
- **Lesson text:** `packages/content/lessons/NN-<id>.md`, per `STYLE.md`.
  - 2–4 short sections.
  - Inline links to the article sections named in its `rules`.
  - Every number in the "Key numbers" column of the lesson table. Read the articles before writing, and never contradict them.
- **Drill:** `apps/web/src/learn/drills/lNN-<id>.ts`, as specified in the lesson table, added to `DRILLS`.
- **Drill test:** `apps/web/src/learn/drills/lNN-<id>.test.ts` (with `diskCtx` and `play`):
  - `'the scenario starts where the lesson says'`: the phase and step, plus every distance the lesson or prompt states (`gapBetween`, centre distances to markers).
  - `'the right actions pass with an explanation that states the numbers'`: one test per dice branch (scripted `dice`). The explanation contains the actual dice, totals and targets.
  - **Wrong answers:** for every `ask`, a wrong answer is refused, and the computed answer matches the lesson's claim for that scenario.
  - **Refusals:** for every off-path or illegal action the lesson mentions (e.g. a Normal Move out of Engagement Range), the refusal is the engine's message or the drill's guard message.
- **Facts:** rows in `apps/web/src/learn/lessonFacts.test.ts`, one per key number:
  ```ts
  interface Fact {
    lesson: string;                    // lesson id
    says: string;                      // exact text that must appear in the lesson's text (blocksText)
    article?: [articleIdAndSection: string, text: string];   // must appear in that section's text
    engine?: () => void;               // expect(...) against the engine or real data
  }
  ```
  The test reads `generated/lessons.json` and `generated/rules.json` from disk. A fact with no `article` must have an `engine` check, and the reverse. Engine checks use exported helpers where they exist (`woundNeeded`, `blastShots`, `inEngagementRange`, `inCoherency`, `inRangeOfObjective`, `missionRulesFor`, `BOARD_SIZES`), real data (`realSheet` characteristics) or a small dispatch on a scenario (e.g. a charge declared at 12.1" is refused and at 11.9" is accepted).
- **Steps for each lesson:**
  - [ ] write the failing drill test and fact rows;
  - [ ] run `npm test -w apps/web -- learn/`: they FAIL;
  - [ ] write the lesson and the drill;
  - [ ] run `npm run data:build && npm test -w apps/web -- learn/`: PASS;
  - [ ] commit `feat(learn): lesson N, <title>, with its drill`. Commit each lesson on its own, so each can be reviewed alone.

### Task 8: Lessons 1–3 (What 40k is, Reading a datasheet, The attack sequence)
- **Lesson 1:** the drill test also has `'a move that ends out of range fails with the reason and can be tried again'`. The check reads `objectiveControl(state)` after the move completes. The failure says how far the closest model is from the marker.
- **Lesson 2:** the questions read characteristics from `state.units[id]`'s datasheet profiles, so the answers are the data's. The drill card shows the M2 `Datasheet` for the asked unit. The "how many shots" answer uses the live distance against half the bolt rifle's range.
- **Lesson 3:** the hit and wound counts reuse M5's `rollJudge(state)` (`play/panels/RollPanel`), so the drill agrees with the dice highlights. Scripted branches: some hits; zero hits (the wound question is skipped and the run still finishes).
- Replace Task 6's `it.todo` with the real lesson-1 drill run.

### Task 9: Lessons 4–6 (Command phase and CP, Movement, Psychic)
- **Lesson 4:** the CP and VP answers come from `state.cp` and the `cpChanged`/`vpScored` events in the log since `stageStart`. One fact row checks `missionRulesFor('combat-patrol')` (`startingCp` 3, `cpEveryCommandPhase` 'active') and `missionRulesFor('strike-force')` (6, 'both').
- **Lesson 5:** branches for an Advance roll of 1 and of 6. The test checks that the engine refuses a Normal Move for the engaged squad (its own message is shown), and that in the Shooting phase the engine refuses `shoot` for the squad that Fell Back.
- **Lesson 6:**
  - **Branches** (scripted Psychic test dice): pass [3, 4], fail [1, 2], Perils [6, 6]. The [6, 6] branch passes and the Librarian suffers D3 mortal wounds.
  - **The question answer** is the total ≥ the warp charge the engine used: read it from the roll's context or the log, never a constant 5.
  - **The explanation** names mortal wounds and that no save was rolled.

### Task 10: Lessons 7–9 (Shooting, Charge, Fight)
- **Lesson 7:**
  - **"Can't see":** the answer comes from the engine's visibility helper (`terrain/visibility`).
  - **Look Out, Sir:** the stage passes on the first refused `shoot` at the Overlord whose problem cites Look Out, Sir (match its `rule` tag).
  - **Save:** the answer uses `saveFor`/`bestSave` for an allocated Warrior in the crater.
  - **Blast:** the answer is `blastShots(parseDice('D6')!, 2, 10)`.
  - **Facts:** the Look Out, Sir row cites R-25 and `shooting-phase#look-out-sir`.
- **Lesson 8:**
  - **Branches:** charge dice [2, 2] (short of 5) and [3, 4] (made). Overwatch hit dice are scripted so no Intercessor dies in one branch; in a third branch the closest model dies, and the required distance follows the live gap.
  - **The question:** "can you make it?" is `total ≥ gapBetween − 1` (with the engine's `EPS`).
  - **The do stage** fails when the learner taps "Charge failed" though `total` was enough, or when the engine refuses the move as too long.
  - **The fact row for 12"** dispatches `declareCharge` at 12.1" and at 11.9".
- **Lesson 9:**
  - The scenario's charge uses `setupDice` [6, 6] and declines Overwatch.
  - The fight-order answers come from `fightOrder(state)`.
  - With `learner: 'both'` for the final stage, the prompt says "Now play the Necrons: fight back with the Warriors."
  - Branch: if no Warrior is left in Engagement Range after the Intercessors fight, the last stage is skipped with an explanation.

### Task 11: Lessons 10–13 (Morale, Objectives, Stratagems, Terrain)
- **Lesson 10:**
  - The scenario removes 3 Intercessors with `removeModel { destroyed: true }` in B's Shooting phase, then `advanceTo` B's Morale phase.
  - **Branches:** pass (roll 4: 4 + 3 = 7 ≤ 8); fail with Combat Attrition dice giving one 1; and an unmodified 1.
  - **"Which rolls fail?"** is computed as `{r ∈ 2..6 : r + lost > highest Ld}`.
  - **The Ld** is `leadership(state, unitId)` from the engine.
- **Lesson 11:**
  - The autopilot ends the Necrons' phases and steps only during B's turn.
  - The VP prediction must equal the `vpScored` amount in the final stage's check; the test asserts both are 15.
  - A facts row uses `inRangeOfObjective` for a model whose base is 3.0" from the marker's edge (in range) and one at 3.1" (out).
- **Lesson 12:**
  - **Branches:** roll [3, 4], short of 8, re-rolled to [4, 5]; and roll [5, 5], where the re-roll stage is skipped with "No need to re-roll this time".
  - **Checks:** CP drops by exactly 1. A second `reroll` in the same phase is refused by the engine (asserted in the test).
- **Lesson 13:**
  - **Difficult Ground:** the "how far" answer is the Intercessor M minus 2. The test asserts the engine refuses a 4.2" move through the crater and accepts 3.9".
  - **Dense Cover:** the hit answer comes from `rollJudge` on the live hit roll (`4+`). The test also asserts a shot at an unobstructed target needs `3+`.

### Task 12: Lessons 14–15 (Building an army, Mission setup) and the full set
**Files (beyond the common shape):**
- Create: `apps/web/src/learn/drill/ListDrill.tsx`
- Modify: `apps/web/src/learn/drill/types.ts`, `run.ts`, `DrillScreen.tsx` (the list kind), and `DrillScreen.test.tsx`
- Test: `apps/web/src/learn/lessons.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts additions: a drill whose world is a roster instead of a game.
  export interface ListDrill {
    id: string; title: string; intro: string; kind: 'list';
    catalogues: string[];
    build(ctx: ListCtx): ListWorld;
    stages: ListStage[];               // same do/ask shape, over ListWatch { world: ListWorld; attempts; answers }
  }
  export interface ListCtx { scope: Scope; policy: PolicyData; catalogues: CatalogueSummary[] }
  export interface ListWorld { roster: Roster; scope: Scope; policy: PolicyData; picker: { entryId: string; name: string; role: string }[] }
  export type AnyDrill = Drill | ListDrill;   // DRILLS holds AnyDrill
  export function startListRun(d: ListDrill, ctx: ListCtx): DrillRun;   // DrillRun gains `world?: ListWorld`
  export function addUnitRun(run: DrillRun, entryId: string): { run: DrillRun; problems: Problem[] | null };
  ```
- **The list drill screen:** `ListDrill.tsx` replaces the board with the roster's units, its points out of 500, and its issues. Issues are written with `explain(issue, view, scope)`, as in the builder. A "Add a unit" list of the `picker` entries follows, each a 44 px button. The `DrillCard` works as on the board.
- **Lesson 14:**
  - **Picker:** Intercessor Squad (Troops), Assault Intercessor Squad (Troops) and Hellblaster Squad (Elites), found by name in `availableUnits`.
  - **Rule of Three answers:** computed by building a Strike Force (Arks of Omen) roster with 4 Hellblaster Squads, and one with 4 Intercessor Squads, then calling `validate()`. The answer is "No" when a `rule-of-three` issue exists.
- **Lesson 15:**
  - **Map:** the scenario uses `layout = missionLayout(cb-incisive-attack map, BOARD_SIZES['combat-patrol'])`, `deploy: false`, `attacker: 'B'` and no `firstTurn`.
  - **Autopilot:** deploys B's next unit with `formation(...)` at its zone's centroid (it checks the engine accepts, else nudges toward the centroid in 1" steps), and lets B choose to go first when it wins the roll-off.
  - **Branches:** roll-off won by A, and won by B.
  - **Refusals:** the test asserts a deployment half outside the zone is refused with the engine's message.
- **`lessons.test.ts`:**
  - `'there are exactly 15 lessons, in the spec order, with these ids'`: the ids listed in the lesson table.
  - `'every lesson has a drill and every drill a lesson'`.
  - `'every lesson is 2–5 minutes and has at least one rules link and one key word'`.
  - `'every lesson has at least one fact row'`.

---

### Task 13: Starter lists and "Your first game"

**Files:**
- Create: `apps/web/src/learn/starterLists.ts`, `apps/web/src/learn/firstGame.ts`, `apps/web/src/learn/FirstGamePage.tsx`
- Modify: `apps/web/src/learn/LearnRoutes.tsx` (the `/learn/first-game` route)
- Test: `apps/web/src/learn/starterLists.test.ts`, `apps/web/src/learn/firstGame.test.tsx`

**Interfaces:**
- Consumes: the roster API (`startingRoster`/`listData` from `lists/newListSetup`, `availableUnits`, `addUnit`, `chooseInGroup`, `validate`, `evaluate`, `FORCE`); `getRosterScope`, `getPolicy`, `getIndex`; M5 `loadArmy`, `buildGameSetup`, `setupBlockers`, `createGame`, `TERRAIN_LAYOUTS`; M7 `getMissions`, `toSandboxMission`; Task 2's `updateProgress`.
- Produces:
  ```ts
  // starterLists.ts
  export type StarterId = 'ultramarines' | 'necrons';
  /** A ready-made Combat Patrol list (Patrol Detachment, Warlord chosen), as an unsaved list doc. */
  export async function starterList(id: StarterId): Promise<Doc<ListData>>;   // doc id `starter-${id}`
  // firstGame.ts
  export const FIRST_GAME_MISSION = 'cb-incisive-attack';
  /** Builds both starter armies and saves a sandbox game: Player 1 Ultramarines (Defender), Player 2 Necrons; returns its id. */
  export async function createFirstGame(repo: Repository, ownerId: string, seed: number): Promise<string>;
  ```
- **The game:**
  - Combat Patrol, mission `cb-incisive-attack`, terrain `mixed` ("Ruins and woods"), attacker `'B'`.
  - Roll windows on; `meta` with `hints: true`, `handOver: true` and title "Your first game: Ultramarines vs Necrons".
  - The players roll off for the first turn.
- **FirstGamePage:**
  - When `allDone`: if `firstGameId` points to an existing game it navigates there; otherwise it creates the game, stores `firstGameId` with `updateProgress`, then navigates to `/play/:id`.
  - When not all lessons are done: the locked message and a link to `/learn`.
- **Unit choices:** each list has 1 HQ Warlord, at least 1 Troops, and a few more units, so a newcomer sees shooting, a psyker and melee. The Ultramarines include a Librarian and Intercessors; the Necrons include an Overlord and Necron Warriors. Use the points the data gives. Fix the exact choice in the test, with the total.

- [ ] **Step 1: Write the failing tests:**
  - `'each starter list is a legal Combat Patrol list'`: `validate()` gives no issues; points are between 450 and 500; a Patrol Detachment; one Warlord.
  - `'each starter list musters with no problems'`: `loadArmy` problems are `[]`.
  - `'createFirstGame saves a Combat Patrol game on Incisive Attack with hints on'`: the doc's `meta.hints` is true, the board is 44×30, the zones are the mission's, and the armies are named.
  - `'the first-game page creates the game once and reuses it'`: visit it twice and one game doc exists.
  - `'the first-game page is locked until every lesson is done'`.
- [ ] **Step 2: Run** `npm test -w apps/web -- learn/starterLists learn/firstGame`. Expected: FAIL.
- [ ] **Step 3: Implement** the three files.
- [ ] **Step 4: Run** `npm test -w apps/web` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(learn): starter lists and Your first game`

---

### Task 14: End to end, browser walk and hand-over

**Files:**
- Create: `apps/web/e2e/learn.spec.ts`

- [ ] **Step 1: Write the e2e test**, at the existing `mobile` (375×812) and `desktop` projects:
  - **Lesson 1:** dev sign-in, then `/learn`. Lesson 1 shows "Next" and lesson 2 "Locked". Open lesson 1, then "Start the drill".
  - **Lesson 1 drill:** select the Intercessors, start a Normal Move, and drag one model (the unit moves together) to 3" short of the marker, using `__sandbox.screenOf`/`screenAt`. Confirm, answer "You", and see "Drill complete". Back on `/learn`, lesson 1 is "Done" and lesson 2 is "Next".
  - **Lesson 2:** answer the three questions (6", 4+, 1). Select the Intercessors and shoot the Warriors with bolt rifles. The hit roll shows 5 dice, then "Drill complete".
  - **Your first game:** call `window.__learn.completeAll()`, reload, and click "Play your first game". The URL is `/play/<uuid>`, the status bar says "Deployment", and the hint is visible.
  - **Each screen:** no sideways scroll, and every visible button and link in `.game` and `.learn` is at least 44 px tall (the M5 `touchTargets` helper, extended to links).
- [ ] **Step 2: Run** `npm run e2e`. Expected: every spec passes on both projects. If port 5179 is held by another worktree's dev server, stop it first: `reuseExistingServer` would run against the wrong code.
- [ ] **Step 3: Manual walk** in the built-in browser at 375×812 and desktop, with screenshots: the Learn home; one lesson page; drills 3 (dice), 8 (charge) and 14 (list); a failed run and "Try again"; Your first game. Fix what the walk finds, each fix with a test.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run e2e`. Expected: all green.
- [ ] **Step 5: Commit** `test(learn): end-to-end Learn path at phone and desktop sizes`. Write `m6-status.md` and `m6-ledger.md` (rulings, deferred minors) in the shared notes folder.
