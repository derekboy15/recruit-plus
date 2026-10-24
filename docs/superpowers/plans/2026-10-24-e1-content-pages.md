# Plan E1: Learn, Rules, Factions, Home and Sign-in: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every content page gets the new page frame, and the pages a newcomer reads most stop fighting them:
- a signed-in home that picks up where you left off;
- every lesson open, with a recommended next one;
- a drill button that is always on screen;
- rules articles with contents and tables that fit a phone;
- one report button per page;
- a glossary with an A–Z jump;
- a faction finder that understands "space marines";
- tidy guides;
- Google sign-in first.

**Architecture:**
- **Consumes Plan A's components:** `PageHeader`, `Sheet`, `FactionBadge`, `relativeTime`, `keyStats`, `sizeLabel` and the icons.
- **Changes only E1-owned files.** New page-level CSS goes in:
  - `rules/rules.css`, imported by `rules/Blocks.tsx`, so every page that renders blocks gets it;
  - `learn/learn.css`;
  - `pages/pages.css`, new and imported by `pages/Home.tsx`.
- **Home dashboard data:** it reads the local database directly through `repo.listDocs`, so the main bundle never pulls in the engine, the roster engine or PixiJS. A new import-graph test pins that.
- **Report button:** it becomes page-level. It takes optional `parts` and the sheet asks which one, so each page renders it once.

**Tech Stack:** unchanged: React 19, React Router 6, Vitest 5 with Testing Library, Playwright 1.64, Dexie 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md` (§2 Navigation and Copy, §3 components, §5 ownership, §6 rules for every plan). Audit codes: LE1, LE3, LE4, LE8, R3, R6, R8, R9, R10, N5, V5, S1, S3.

**Branch:** `content-pages` in worktree `L:\9th Edition\app-content`, off `main` after Plans A and D have merged.

**Scope notes (decisions for the owner's review):**
1. **Lessons are all open.** Each lesson shows "Recommended next" on the first one not done. **"Your first game" keeps its gate** (finish every lesson), because that gate was part of the approved learning design. Its card says exactly what is left.
2. **Lesson key words.** Each key word is plain bold text, not a link; one "All key words in the glossary" link closes the box (LE4).
3. **Not in this plan:**
   - drill feedback (LE6, LE7);
   - first-game objective labels (LE9): the labels come from `play/setup/missionAdapter.ts`, Plan E3's area;
   - backticks (Plan D, data);
   - global search (spec §7).
4. **The datasheet page** (`factions/DatasheetPage.tsx`, moved onto `DatasheetView` by Plan A) gets its single page-level report button here (Task 6).

## Global Constraints

- **Ownership:** edit only:
  - `apps/web/src/learn/*`, `rules/*`, `factions/*`, `pages/*`;
  - `apps/web/e2e/learn.spec.ts`, `apps/web/e2e/rules.spec.ts`;
  - `apps/web/e2e-prod/sign-in.spec.ts`;
  - new files under those folders, including `apps/web/e2e/home.spec.ts`.

  `theme.css`, `layout/*`, `ui/*`, `App.tsx` and `routes.tsx` are frozen.
- **Exports used by other plans keep their signatures.** Additive optional props are allowed:
  - `FactionPicker({ to?, onPick?, selected? })`, used by Plan B's wizard;
  - `RulesText`, `Blocks`, `InlineText` (gains optional `links?: boolean`, default `true`);
  - `WordingToggle`, `useWording`;
  - everything in `factions/dataClient.ts`, `useAsync` and `factionDisplayName`;
  - `useScrollToHash`;
  - `ReportButton` (gains optional `parts`).
- **The main bundle stays light.** `pages/Home.tsx` must not reach `@recruit/engine`, `@recruit/engine/data`, `@recruit/data/roster` or `pixi.js` through static imports. The Learn routes keep their existing rule (no engine or board).
- **Copy, exact:**

  | Where | Text |
  |---|---|
  | Report button | `Report a problem` |
  | Report sheet title | `Report a problem` |
  | Parts picker label | `Which part?` |
  | Report thanks (unchanged) | `Thanks. We've saved your report.` |
  | Lesson badge | `Recommended next`, `Done` |
  | Lesson buttons | `Start`, `Replay drill` |
  | Start bar | `Start the drill · {minutes} min`, `Do the drill again`, `Next lesson` |
  | Table of contents | `On this page` |
  | Glossary jump nav label | `Jump to letter` |
  | Rules home card | `Factions and datasheets`, blurb `Every army’s units, datasheets and stratagems.` |
  | Sign-in divider | `or use your email` |
  | Faction search label | `Search factions`, placeholder `e.g. Necrons, Space Marines` |
  | Guide section | `Army rules in full` |

- **Phone width:** no horizontal page scroll at 320px or 375px on any page this plan changes.
- **Touch targets:** at least 44px for every button and link this plan adds.
- **Commits:** only to `content-pages`. No merge, push or deploy.

## Review Focus

1. **Lessons data won't load** (offline, never fetched). The Home "Continue learning" card must still offer a way in (`Go to Learn` → `/learn`), not spin forever or crash.
   - Pinned by Task 1 test `home falls back to Go to Learn when the lessons can't load`.
2. **A glossary filter that empties some letters.**
   - The A–Z jump must list only letters that still have terms.
   - With nothing left there is no report button.
   - Deep links (`/rules/glossary#<term-id>`, used by lessons) must still land, because term ids are unchanged.
   - Pinned by Task 7 tests `the A–Z jump lists only letters with matching terms`, `no terms, no report button` and `term anchors keep their ids`.
3. **Faction search with apostrophes, case and partial words:** "tau", "T'AU", "space mar", "guard".
   - Pinned by Task 8 tests in `factionSearch.test.ts`.
4. **Long list and faction names on the Home dashboard at 320px.** They must truncate, not push the page sideways.
   - Pinned by Task 10 e2e `home dashboard has no sideways scroll at 320px`.
5. **Choosing a part in the report sheet.** The saved report must carry the chosen part's name and text, not the page's.
   - Pinned by Task 5 test `a page-level report saves the part chosen`.

---

## File Structure

```
apps/web/src/
  pages/
    Home.tsx                 signed-out landing with real feature links; signed-in dashboard
    homeData.ts        NEW   useHomeData(), useNextLesson(), toHomeList(), toHomeGame()
    home.test.tsx      NEW   dashboard + landing tests (replaces Home.test.tsx)
    Home.test.tsx            deleted (its two tests move into home.test.tsx, updated)
    bundle.test.ts     NEW   Home stays out of the engine, the roster engine and PixiJS
    __fixtures__/importGraph.ts  NEW  heavyImports(entry, heavy) shared with learn/bundle.test.ts
    pages.css          NEW   home dashboard styles
    SignIn.tsx               Google first, with the Google mark; PageHeader
    ResetPassword.tsx Legal.tsx Privacy.tsx Terms.tsx   PageHeader (back to Home)
  learn/
    progress.ts              isUnlocked removed
    useLessons.ts            lockOf removed
    LearnHome.tsx            open path: Recommended next, Done, Replay drill, summaries kept
    LessonPage.tsx           PageHeader, no lock gate, sticky start bar, key words plain
    learn.css                .learn-start-bar, 70ch measure, path item states
    bundle.test.ts           uses pages/__fixtures__/importGraph.ts
  rules/
    ReportButton.tsx         page-level: parts + "Which part?", Sheet instead of lists/Panel
    Blocks.tsx               data-label on table cells (stacked on narrow screens); InlineText links?: boolean; imports rules.css
    rules.css          NEW   stacked tables, contents, A–Z jump, chip row, faction unit rows, guide
    ArticleContents.tsx NEW  "On this page" navigation
    RulesHome.tsx            PageHeader (top); Factions and datasheets card first
    RulesArticlePage.tsx     PageHeader; contents; one report button
    GlossaryPage.tsx         PageHeader; letters; one report button
    CoreStratagemsPage.tsx GuidesIndexPage.tsx ReportsPage.tsx   PageHeader; one report button where there are texts
  factions/
    factionSearch.ts   NEW   factionMatches(), factionLabel()
    phases.ts          NEW   phaseRank(), sortPhases()
    guideText.ts       NEW   capitalised()
    FactionPicker.tsx        FactionBadge rows, aliases, Legends badge, chapter line (props unchanged)
    FactionsPage.tsx FactionPage.tsx StratagemsPage.tsx FactionGuidePage.tsx   PageHeader and the fixes below
    StratagemCard.tsx        no report button of its own
    DatasheetPage.tsx        one page-level report button (after Plan A's rewrite)
apps/web/e2e/
  learn.spec.ts rules.spec.ts   updated
  home.spec.ts       NEW
apps/web/e2e-prod/sign-in.spec.ts   Google-first order checked
```

---

### Task 1: Home: signed-in dashboard and real feature links

**Files:**
- Create: `apps/web/src/pages/homeData.ts`, `apps/web/src/pages/home.test.tsx`, `apps/web/src/pages/pages.css`, `apps/web/src/pages/bundle.test.ts`, `apps/web/src/pages/__fixtures__/importGraph.ts`
- Modify: `apps/web/src/pages/Home.tsx`, `apps/web/src/learn/bundle.test.ts` (use the shared helper)
- Delete: `apps/web/src/pages/Home.test.tsx` (its tests move into `home.test.tsx`)

**Interfaces:**
- Consumes:
  - Plan A: `PageHeader`, `FactionBadge`, `relativeTime`, `IconPlay`;
  - `useProgress()` and `nextLesson()` from `learn/progress.ts`;
  - `getLessons()` from `factions/dataClient.ts`;
  - `ListData` (type only) from `lists/listStore.ts`;
  - `GameData` (type only) from `play/store/gameStore.ts`;
  - `TableGameData` (type only) from `table/game.ts`.
- Produces (`pages/homeData.ts`):
  ```ts
  export interface HomeList { id: string; name: string; faction: string; slug: string; size: string; points: number; pointsLimit: number; issueCount: number; updatedAt: number }
  export interface HomeGame { id: string; kind: 'practice' | 'table'; title: string; status: string; to: string; updatedAt: number }
  export type NextLesson = { status: 'loading' } | { status: 'error' } | { status: 'next'; id: string; title: string; order: number; total: number } | { status: 'done'; total: number };
  export const SIZE_NAMES: Record<string, string>; // 'combat-patrol' → 'Combat Patrol', incursion, 'strike-force', onslaught
  export function toHomeList(doc: Doc<ListData>): HomeList;          // name falls back to 'Untitled list' when blank
  export function toHomeGame(doc: Doc<unknown>): HomeGame | null;    // null when the game has ended
  export function useHomeData(): { lists: HomeList[]; games: HomeGame[]; loading: boolean }; // newest first; games: unfinished only
  export function useNextLesson(): NextLesson;
  ```
  - **Practice games:**
    - `title` = `data.meta.title`;
    - `status` = `Setting up` when `summary.phase === 'pre-battle'`, else `Round {round}`;
    - `to` = `/play/{id}`;
    - ended = `summary.ended`.
  - **Table games** (`data.mode === 'table'`):
    - `title` = `{players.A.name} vs {players.B.name}`;
    - `status` = `In progress`;
    - `to` = `/table/{id}`;
    - ended = any event with `t === 'end'`.
  - **`pages/__fixtures__/importGraph.ts`:** `export function heavyImports(entry: string, heavy: string[]): string[]`. It is the walker from `learn/bundle.test.ts`, with the heavy list passed in.

- [ ] **Step 1: Write the failing tests** in `home.test.tsx`. Use `TestProviders` with a fresh `openDb`, seed docs through `createRepository(db).saveDoc`, and stub `fetch` for `/data/lessons.json`.
  - `signed out, the landing page invites you to sign in`:
    - link `Sign in to start` → `/sign-in`;
    - each feature card is a link: `getByRole('link', { name: /^Learn/ })` → `/learn`, `/^Lists/` → `/build`, `/^Practice/` → `/play`, `/^Table/` → `/table`, `/^Rules/` → `/rules`.
  - `signed in, home picks up your next lesson`:
    - progress has lesson 1 done (3-lesson fixture);
    - heading `Continue learning`;
    - link `Lesson 2: Reading a datasheet` → `/learn/datasheets`;
    - link `All lessons` → `/learn`;
    - no link matching `/sign in/i`.
  - `with every lesson done, home offers the first game`: link `Play your first game` → `/learn/first-game`.
  - `home falls back to Go to Learn when the lessons can't load`: fetch rejects; link `Go to Learn` → `/learn`.
  - `your three most recent lists, each with Play`:
    - seed 4 lists with increasing `updatedAt`;
    - `getAllByRole('link', { name: /^Play / })` has length 3;
    - the first is named `Play Newest list` with href `/build/{id}/play`;
    - the list-name link `Newest list` → `/build/{id}`;
    - the text `Necrons · Incursion · 885 / 1,000 pts` is shown;
    - link `All lists` → `/build`.
  - `no lists yet offers to build one`: link `Build your first army` → `/build/new`.
  - `games in progress list unfinished practice and table games only`:
    - seed an unfinished sandbox doc (`summary: { round: 2, phase: 'shooting', ended: false }`);
    - seed an ended sandbox doc;
    - seed a table doc with no `end` event;
    - heading `Games in progress`;
    - links `Ultramarines vs Necrons` → `/play/{id}` and `Alice vs Bob` → `/table/{id}`;
    - texts `Practice · Round 2` and `Table · In progress`;
    - the ended game's title is absent.
- [ ] **Step 2: Write the failing import-graph test** `pages/bundle.test.ts`: `test('the home page loads without the engine, the roster engine or the board')` expects `heavyImports(join(__dirname, 'Home.tsx'), ['@recruit/engine', '@recruit/engine/data', '@recruit/data/roster', 'pixi.js'])` toEqual `[]`.
- [ ] **Step 3: Run** `npm test -w @recruit/web -- src/pages`. Expected: FAIL. The links and headings above don't exist, and `homeData.ts` and `importGraph.ts` are missing.
- [ ] **Step 4: Implement** `homeData.ts`, then `Home.tsx`, then the helper.
  - **Live data:** `useHomeData` live-queries `repo.listDocs('list', ownerId)` and `repo.listDocs('game', ownerId)` with Dexie `liveQuery`, the same pattern as `useLists`.
  - **Signed-in layout** (`PageHeader variant="top" title="Welcome back"`):
    1. `Continue learning`;
    2. `Your lists`: rows with `FactionBadge`, a name link, the meta line `{faction} · {size} · {points} / {limit} pts`, and `edited {relativeTime}` on a second line; a `Play` link (aria-label `Play {name}`); `All lists` and `New list` links;
    3. `Games in progress`, only when there are any: up to 3 rows.
  - **Signed-out landing:** keep the hero copy and turn the four cards into five `Link` cards: Learn, Lists, Practice, Table, Rules. Each card has its one-line blurb:
    - `The core rules, one phase at a time.`
    - `Legal lists for every 9th Edition faction, with plain-English help.`
    - `Play on screen, two players on one device.`
    - `Run a real game step by step: CP, VP, missions, stratagems.`
    - `Search the core rules, glossary and every faction’s datasheets.`
  - **Styles:** `pages.css` holds `.home-section`, `.home-row` (with `min-width: 0` and ellipsis on the name) and `.home-cards`.
  - **Shared walker:** point `learn/bundle.test.ts` at the shared `heavyImports`.
- [ ] **Step 5: Run** `npm test -w @recruit/web -- src/pages src/learn/bundle.test.ts`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** with `feat(web): a signed-in home that picks up your lesson, lists and games`.

### Task 2: Sign-in with Google first; page headers on the account and legal pages

**Files:**
- Modify: `apps/web/src/pages/SignIn.tsx`, `ResetPassword.tsx`, `Legal.tsx`, `Privacy.tsx`, `Terms.tsx`, `apps/web/src/pages/SignIn.test.tsx`, `apps/web/src/pages/legal.test.tsx`, `apps/web/e2e-prod/sign-in.spec.ts`

**Interfaces:**
- Consumes: `PageHeader` (Plan A).
- Produces: `function GoogleMark(): JSX.Element`, private to `SignIn.tsx`. It is an inline 18×18 SVG of the four-colour "G" (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`), `aria-hidden="true"`.

- [ ] **Step 1: Write the failing tests:**
  - **`SignIn.test.tsx`, `Google comes first, then email`:**
    - in sign-in mode, `screen.getByRole('button', { name: 'Continue with Google' }).compareDocumentPosition(screen.getByLabelText('Email')) & Node.DOCUMENT_POSITION_FOLLOWING` is truthy;
    - the text `or use your email` is present;
    - the Google button contains an `svg[aria-hidden="true"]`.
  - **`SignIn.test.tsx`, `the reset form has no Google button`** (forgot mode): `queryByRole('button', { name: 'Continue with Google' })` is null.
  - **`legal.test.tsx`, `legal pages have a Back link to Home`:** for each of `/legal`, `/privacy`, `/terms`, `getByRole('link', { name: 'Back to Home' })` → `/`.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/pages`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes.
  - **Sign-in, reset and legal pages:** `SignIn` and `ResetPassword` render `PageHeader` with `back={{ to: '/', label: 'Home' }}` and the existing titles. Legal, Privacy and Terms do the same.
  - **Sign-in order:**
    1. the dev card (sign-in mode only);
    2. `Continue with Google` with `GoogleMark`;
    3. the divider `or use your email`;
    4. the form.
  - **Forgot mode:** keeps the form only.
  - **Unchanged:** existing copy and behaviour.
- [ ] **Step 4: Update** `e2e-prod/sign-in.spec.ts`. Add one assertion in the existing first test: the Google button's bounding box `y` is less than the Email field's.
- [ ] **Step 5: Run** `npm test -w @recruit/web -- src/pages`, then `npm run typecheck`. Expected: PASS. The prod e2e runs in Task 10.
- [ ] **Step 6: Commit** with `feat(web): Google sign-in first, and Back on the account and legal pages`.

### Task 3: An open lesson path

**Files:**
- Modify: `apps/web/src/learn/progress.ts`, `useLessons.ts`, `LearnHome.tsx`, `learn.css`, `progress.test.tsx`, `LearnPages.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `IconCheck` (Plan A).
- Produces:
  - `isUnlocked` and `lockOf` are deleted;
  - `nextLesson(order, progress): string | null` is unchanged and is the "recommended" lesson.

- [ ] **Step 1: Write the failing tests:**
  - **`progress.test.tsx`:** replace `with no doc progress is empty and only lesson 1 is unlocked` with `with no doc progress the recommended lesson is the first`: `nextLesson(order, EMPTY_PROGRESS)` is `order[0]`.
  - **`LearnPages.test.tsx`, replacing the "locked" tests:**
    - `every lesson is open: each title links to its lesson`: the links `1. What 40k is`, `2. Reading a datasheet` and `3. The attack sequence` go to `/learn/{id}`; `queryByText(/Locked/)` is null; each item shows its summary.
    - `the first lesson not done is the recommended one`: with lesson 1 done, item 2 contains `Recommended next` and a link `Start` → `/learn/datasheets`; item 1 contains `Done` and a link `Replay the What 40k is drill` → `/learn/{id1}/drill`, whose visible text is `Replay drill`.
    - `a lesson opened by URL before the one before it is done shows the lesson`: `/learn/attacks` with no progress shows the heading `The attack sequence` (level 1) and a link named `/^Start the drill/`.
    - `a drill opened by URL starts even if earlier lessons aren't done`: `/learn/attacks/drill` renders the drill region `Drill`.
    - Keep `Your first game stays locked until every lesson is done` and `with every lesson done, Your first game can be played` as they are.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/learn`. Expected: FAIL.
- [ ] **Step 3: Implement** the open path.
  - **Remove the locks:** delete `isUnlocked` and `lockOf`. `Gate` keeps only the loading, error and unknown-lesson branches.
  - **`LearnHome`:**
    - renders `PageHeader variant="top" title="Learn to play"`;
    - its intro reads `Short lessons, each with a drill on a real battlefield with real dice. Take them in order, or start anywhere.`;
    - every item is `<li>` → a title `Link` (`{order}. {title}`) with the summary and meta below, plus an actions row: `Start` (primary) on the recommended item, `Replay drill` on done items.
  - **`learn.css`:** `.learn-path__item--recommended` gets the brass border. The locked styles go.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/learn`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(web): every lesson open, with the next one recommended`.

### Task 4: Lesson page: header, a start bar that stays on screen, readable width

**Files:**
- Modify: `apps/web/src/learn/LessonPage.tsx`, `learn.css`, `LearnPages.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Plan A).
- Produces: CSS `.learn-start-bar`. It is sticky above the tab bar, at `bottom: calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))`, and at `bottom: 0` from 768px, like `.wizard-actions`. Also `.learn-lesson { max-width: 70ch }`.

- [ ] **Step 1: Write the failing tests** in `LearnPages.test.tsx`:
  - `the lesson page has a Back link to Learn and the lesson number`: link `Back to Learn` → `/learn`; text `Lesson 1 of 3 · {minutes} min`.
  - `the drill button sits in the start bar`: `getByRole('link', { name: \`Start the drill · ${minutes} min\` })` is inside `.learn-start-bar`. After completing the lesson, the bar holds `Do the drill again` and `Next lesson`.
  - `key words are plain text with one glossary link`:
    - inside region `Key words`, the term is not a link (`queryByRole('link', { name: term })` is null);
    - one link `All key words in the glossary` → `/rules/glossary`.
  - Update the touch-target CSS test (`every Learn button and link is at least 44px`) to include `.learn-start-bar a`.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/learn/LearnPages.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the lesson page.
  - **`LessonPage`:**
    - `PageHeader back={{ to: '/learn', label: 'Learn' }} title={lesson.title} subtitle={\`Lesson ${order} of ${n} · ${minutes} min\`}`;
    - the old `← Learn` link and the "Lesson n of m" paragraph are removed;
    - `play-row` becomes the start bar.
  - **Key words:** `dt` holds plain text.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/learn`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(web): lesson pages keep the drill button in reach, at a readable width`.

### Task 5: One report button per page

**Files:**
- Modify: `apps/web/src/rules/ReportButton.tsx`, `apps/web/src/rules/ReportButton.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (Plan A). This replaces `lists/Panel`, which Plan B deletes.
- Produces:
  ```ts
  export interface ReportPart { name: string; text: string }
  export function ReportButton(props: {
    target: Omit<RulesReport['target'], 'path'>;   // kind + the page's name
    text: string;                                  // used when there are no parts
    /** Several items on one page: the sheet asks "Which part?"; the saved target name and text are the chosen part's. */
    parts?: ReportPart[];
  }): JSX.Element | null;                          // null when signed out, or when parts is an empty array
  ```

- [ ] **Step 1: Write the failing tests** in `ReportButton.test.tsx`. Rename the existing button and sheet strings to `Report a problem`, then add:
  - `a page-level report saves the part chosen`:
    - parts `[{ name: 'Shooting: Look Out, Sir', text: 'A' }, { name: 'Shooting: Blast', text: 'B' }]`;
    - open, select `Shooting: Blast` in combobox `Which part?`, send;
    - the saved report's `target.name` is `Shooting: Blast` and its `text` is `B`.
  - `with no parts there is no Which part question`: `queryByRole('combobox', { name: 'Which part?' })` is null.
  - `an empty parts list renders nothing`: `container` is empty.
  - `the report sheet closes with Cancel and saves nothing` (rename of `Cancel saves nothing`): the `Sheet`'s close button has aria-label `Cancel`.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/rules/ReportButton.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the page-level report button.
  - Render `<Sheet title="Report a problem" kind="sheet" closeLabel="Cancel" footer={<button className="btn btn--primary">Send report</button>}>`.
  - The parts `<select>` comes first, labelled `Which part?`, with the first part preselected.
  - Then the existing problem radios and note.
  - The trigger is a tertiary button `Report a problem`.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/rules`, then `npm run typecheck`. Expected: PASS. Other rules page tests that still click `Report a rules error` are updated in Tasks 6–7.
- [ ] **Step 5: Commit** with `feat(web): report a problem once per page, choosing which part`.

### Task 6: Rules home and articles: page frame, contents, tables that fit a phone

**Files:**
- Create: `apps/web/src/rules/ArticleContents.tsx`, `apps/web/src/rules/rules.css`
- Modify: `apps/web/src/rules/RulesHome.tsx`, `RulesArticlePage.tsx`, `Blocks.tsx`, `CoreStratagemsPage.tsx`, `GuidesIndexPage.tsx`, `ReportsPage.tsx`, `RulesPages.test.tsx`, `apps/web/src/factions/StratagemCard.tsx`, `apps/web/src/factions/DatasheetPage.tsx`, `apps/web/src/factions/DatasheetPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Plan A); `ReportButton` with `parts` (Task 5).
- Produces:
  ```ts
  // rules/ArticleContents.tsx — rendered only when there are 3 or more sections
  export function ArticleContents(props: { sections: { id: string; title: string }[] }): JSX.Element | null;
  // <nav aria-label="On this page">: a toggle button "On this page" (aria-expanded) and an <ol hidden={!open}> of #id links.
  // From 1024px rules.css shows the list whatever `hidden` says, and the toggle is hidden: the article becomes a two-column grid with the contents sticky.
  export function InlineText(props: { c: Inline[]; links?: boolean }): JSX.Element; // links=false renders an 'a' node's children as text
  ```
  - Every `<td>` and `<th scope="row">` in a `Blocks` table gets `data-label` = that column's header text.
  - Below 600px `rules.css` turns `table.blocks__table` rows into stacked cards: each cell shows `attr(data-label)` before its value.

- [ ] **Step 1: Write the failing tests** in `RulesPages.test.tsx`:
  - **`the rules home lists the articles and the other sections`:**
    - add `['Factions and datasheets', '/factions']`;
    - assert it is the first link under heading `More`;
    - heading `Rules` level 1 comes from `PageHeader`.
  - **`an article has Back, contents and one report button`** (replaces the per-section one):
    - link `Back to Rules` → `/rules`;
    - `getByRole('navigation', { name: 'On this page' })` holds one link per section, each `#${section.id}`;
    - exactly one button `Report a problem` (`getAllByRole(...).length === 1`).
  - **`the contents toggle opens and closes the list`:** click `On this page`; `aria-expanded` goes `false` → `true`, and the list loses `hidden`.
  - **`Blocks labels each table cell with its column`:** render a 2×2 table block; each `td` has `data-label` equal to its header.
  - **`core stratagems have Back and one report button`:**
    - link `Back to Rules`;
    - one `Report a problem`;
    - no `Report a rules error` anywhere.
  - **`DatasheetPage.test.tsx`, `a datasheet has one report button for the page`:**
    - exactly one `Report a problem`;
    - opening it lists combobox `Which part?` with option `Reanimation Protocols` (from the fixture's abilities).
    - If Plan A's `DatasheetView` renders report buttons itself, stop and tell the parent: `ui/` is frozen in wave 2.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/rules src/factions/DatasheetPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the rules pages.
  - **`PageHeader` everywhere:**
    - `RulesHome` uses `variant="top"`;
    - the article, core stratagems, guides index and reports pages use `back={{ to: '/rules', label: 'Rules' }}`.
  - **Rules home:** `MORE` gains the Factions card first.
  - **Articles:** render `ArticleContents`, then one `ReportButton` at the end:
    - target `{ kind: 'rules-section', name: article.title }`;
    - parts = sections as `{ name: \`${article.title}: ${s.title}\`, text: s.text }`.
  - **Stratagems:** `StratagemCard` drops its `ReportButton`. `CoreStratagemsPage` renders one, with parts = stratagems.
  - **Datasheet page:** gets one `ReportButton`:
    - target `{ kind: 'datasheet', name: unit.name }`;
    - parts = `[{ name: unit.name, text: unit.name }, ...abilities.map((a) => ({ name: a.name, text: a.text }))]`.
  - **`rules.css`:** add the stacked-table, contents and two-column article rules. `Blocks.tsx` imports `./rules.css`.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/rules src/factions`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(web): rules pages get Back, contents, phone-sized tables and one report button`.

### Task 7: Glossary with an A–Z jump

**Files:**
- Modify: `apps/web/src/rules/GlossaryPage.tsx`, `rules.css`, `RulesPages.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Plan A); `ReportButton` with `parts` (Task 5).
- Produces: `export function letterOf(term: string): string` in `GlossaryPage.tsx`. It returns the upper-cased first letter A–Z, else `#`.

- [ ] **Step 1: Write the failing tests** in `RulesPages.test.tsx`:
  - **`the A–Z jump lists only letters with matching terms`:**
    - `getByRole('navigation', { name: 'Jump to letter' })` links equal the distinct first letters of the fixture's terms, each → `#letter-X`;
    - type a filter that keeps one term: the nav holds one link.
  - **`terms sit under their letter and keep their ids`:**
    - heading `A` (level 2) has id `letter-A`;
    - each term is a level-3 heading whose `id` is the term's id, so `/rules/glossary#<id>` deep links still work.
  - **`no terms, no report button`:** a filter matching nothing shows `No terms match.` and no `Report a problem`.
  - **Update `the glossary lists terms A to Z and filters them`:** terms are now level 3.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/rules/RulesPages.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the glossary.
  - **Header:** `PageHeader back={{ to: '/rules', label: 'Rules' }} title="Glossary"`.
  - **Order:** the filter input, then the jump nav, as one scrolling row (`.rules-chips`), then the letter sections.
  - **Report button:** one, with `parts` = the filtered terms.
  - **CSS:** `.rules-chips` (no wrap, `overflow-x: auto`, 44px chips) goes in `rules.css`.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/rules`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(web): glossary with an A–Z jump and term anchors kept`.

### Task 8: Finding a faction

**Files:**
- Create: `apps/web/src/factions/factionSearch.ts`, `apps/web/src/factions/factionSearch.test.ts`
- Modify: `apps/web/src/factions/FactionPicker.tsx`, `FactionsPage.tsx`, `apps/web/src/rules/GuidesIndexPage.tsx` (header only, if Task 6 hasn't already), `FactionPicker.test.tsx`

**Interfaces:**
- Consumes: `FactionBadge`, `PageHeader` (Plan A).
- Produces:
  ```ts
  export function factionMatches(c: Pick<CatalogueSummary, 'name'>, query: string): boolean;
  export function factionLabel(c: Pick<CatalogueSummary, 'name'>): { name: string; legends: boolean; family: 'Space Marines' | null };
  ```
- **Matching:**
  - lower-case, strip apostrophes and collapse spaces on both sides;
  - match when the query is in the full catalogue name or the display name;
  - or when an alias key starts with the query (query ≥ 3 characters) and that alias's target is in the full name.
- **Aliases** (`ALIASES` const in the file):
  - `space marines`, `space marine`, `marines`, `astartes` → `adeptus astartes`;
  - `imperial guard`, `guard` → `astra militarum`;
  - `sisters of battle`, `sisters` → `adepta sororitas`;
  - `admech`, `ad mech` → `adeptus mechanicus`;
  - `eldar` → `aeldari`;
  - `dark eldar` → `drukhari`;
  - `demons` → `daemons`;
  - `squats` → `leagues of votann`.
- **`factionLabel`:**
  - strips `[LEGENDS]` (case-insensitive) from `factionDisplayName(c.name)` and sets `legends`;
  - `family` is `Space Marines` when the full name contains `Adeptus Astartes`.

- [ ] **Step 1: Write the failing tests** (`factionSearch.test.ts`):
  - `space marines finds every chapter and Chaos Space Marines`: true for `Imperium - Adeptus Astartes - Ultramarines` and `Chaos - Chaos Space Marines`; false for `Necrons`.
  - `a partial alias works from three letters`: `space mar` and `ast` match Ultramarines; `as` does not.
  - `apostrophes and case don't matter`: `tau` and `T'AU` match `T'au Empire`.
  - `guard finds the Astra Militarum and the Raven Guard`.
  - `eldar finds Craftworlds and Drukhari`.
  - `factionLabel drops the Legends tag and names chapters`:
    - `Chaos - Renegades & Heretics [LEGENDS]` → `{ name: 'Renegades & Heretics', legends: true, family: null }`;
    - Ultramarines → `family: 'Space Marines'`.

  **`FactionPicker.test.tsx`:**
  - `each faction row shows its badge, name and unit count`:
    - add `{ slug: 'imperium-adeptus-astartes-ultramarines', name: 'Imperium - Adeptus Astartes - Ultramarines', group: 'Imperium', unitCount: 87, … }` to the test's index fixture;
    - each row holds the element `FactionBadge` renders (query it by the class Plan A gives it);
    - the Ultramarines row reads `Ultramarines` and `Space Marines chapter · 87 units`.
  - `a Legends faction shows a Legends badge, not the tag`: the text `[LEGENDS]` is absent and `Legends` is present.
  - `searching "space marines" lists the chapters`: type into `Search factions`; the Ultramarines row is visible.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/factions`. Expected: FAIL.
- [ ] **Step 3: Implement** the faction finder.
  - **`FactionPicker`:**
    - the visible label `Search factions`;
    - the placeholder `e.g. Necrons, Space Marines`;
    - rows = `FactionBadge` + name (+ Legends badge) + muted line (`Space Marines chapter · ` when there is a family, then the unit count);
    - props unchanged.
  - **`FactionsPage`:** `PageHeader back={{ to: '/rules', label: 'Rules' }} title="Factions"`.
  - **CSS:** `.faction-row` styles go in `rules.css`, which `FactionPicker` imports.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/factions`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(web): find factions by everyday names, with crests and Legends badges`.

### Task 9: Faction units, stratagems and guide pages

**Files:**
- Create: `apps/web/src/factions/phases.ts`, `apps/web/src/factions/guideText.ts`
- Modify: `apps/web/src/factions/FactionPage.tsx`, `StratagemsPage.tsx`, `FactionGuidePage.tsx`, `FactionPages.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `keyStats`, `sizeLabel` (Plan A); `ReportButton` with `parts` (Task 5); `InlineText links={false}` (Task 6).
- Produces:
  ```ts
  // factions/phases.ts
  export function phaseRank(phase: string): number;   // game order, then "Enemy …" in game order, then the rest A–Z
  export function sortPhases(phases: string[]): string[];
  // order: Before battle, During deployment, At the start of battle round, Command, Movement, Psychic, Shooting, Charge,
  // Fight, Morale (each "… phase"), End of your turn, then the same phases prefixed "Enemy ", then Being targeted,
  // Taking casualties, Enemy taking casualties, Any phase, Any of your phases, Any time, then anything else A–Z.
  // factions/guideText.ts
  export function capitalised(c: Inline[]): Inline[];  // upper-cases the first letter of the first text node
  ```

- [ ] **Step 1: Write the failing tests** in `FactionPages.test.tsx`:
  - **`the units page has Back to Factions and key stats on each unit`:**
    - link `Back to Factions` → `/factions`;
    - the Necron Warriors row text contains `10–20 models · M5" T4 W1 Sv4+` (from `sizeLabel` and `keyStats` on the fixture).
  - **`phase chips follow the game's order in one row`:**
    - the chip names in order start `All phases`, `Before battle`, … with `Command phase` before `Fight phase`, and `Fight phase` before `Enemy Fight phase`;
    - the chip container has class `rules-chips`.
  - **`the stratagems page has one report button`:** exactly one `Report a problem`.
  - **`the guide shows the short army rules, then the full ones folded away`:**
    - heading `Army rules` present;
    - `getByText('Army rules in full')` is a `summary` inside a closed `details`;
    - no `.card .card` nesting (`container.querySelector('.card .card')` is null).
  - **`each key unit card is one link with a capitalised blurb`:**
    - change the test's guide fixture `why` to `[{ t: 'text', v: 'each Command phase, ' }, { t: 'a', href: '/rules/glossary#core', c: [{ t: 'text', v: 'CORE' }] }]`;
    - `getByRole('link', { name: /^Necron Warriors/ })` → `/factions/necrons/units/necron-warriors`, and its text contains `Each Command phase, CORE`;
    - `link.querySelector('a')` is null (no nested links).
  - **Update `the guide page shows the three guide sections and links key units to their datasheets`** for the new structure.
- [ ] **Step 2: Run** `npm test -w @recruit/web -- src/factions`. Expected: FAIL.
- [ ] **Step 3: Implement** the faction pages.
  - **Units, stratagems and guide pages:** `PageHeader back={{ to: '/factions', label: 'Factions' }} title={name}`, then `FactionTabs`.
  - **Unit rows:** name, badges and the meta line `{sizeLabel} · M{M} T{T} W{W} Sv{Sv}`, with points on the right.
  - **Stratagems:**
    - phase chips in `.rules-chips`, sorted with `sortPhases`;
    - one `ReportButton` with parts = the shown stratagems.
  - **Guide:**
    - `How this army plays`, `Army rules` (the guide's short version), then `Key units` as whole-card links (`InlineText links={false}`, `capitalised`);
    - then `<details><summary>Army rules in full</summary>` with `WordingToggle` and each rule as a plain section (h3 + `RulesText`), no cards;
    - one `ReportButton`, with parts = `[guide, ...rules]`.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/factions src/rules`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(web): faction pages with key stats, ordered phases and a tidier guide`.

### Task 10: End-to-end flows and the final checks

**Files:**
- Create: `apps/web/e2e/home.spec.ts`
- Modify: `apps/web/e2e/learn.spec.ts`, `apps/web/e2e/rules.spec.ts`

- [ ] **Step 1: Update and add the e2e specs:**
  - **`learn.spec.ts`:**
    - item 1 contains `Recommended next`; item 2 does not contain `Locked`;
    - after lesson 1, item 2 contains `Recommended next`;
    - the `Start` and `Start the drill` clicks are unchanged (substring names);
    - add an assertion that the `.learn-start-bar` link is in the viewport before scrolling: `toBeInViewport()`.
  - **`rules.spec.ts`:**
    - the datasheet report flow clicks the page's single `Report a problem`, chooses `Reanimation Protocols` in `Which part?`, then sends; it expects `Thanks. We've saved your report.`;
    - add a Glossary jump (`Jump to letter` → `L`) and an article's `On this page` link;
    - add Factions search `space marines` → link `Ultramarines` visible;
    - keep the no-sideways-scroll checks.
  - **New `home.spec.ts`** (both projects):
    - sign in through `Continue (dev)`;
    - create a list through the existing `lists.spec.ts` steps, or seed through the UI;
    - go to `/`: heading `Welcome back`, link `Play {name}` visible, `Continue learning` visible;
    - `home dashboard has no sideways scroll at 320px`: `page.setViewportSize({ width: 320, height: 720 })`, then `scrollWidth - innerWidth <= 0`.
- [ ] **Step 2: Run the whole plan's checks** from the repo root:
  - `npm test`;
  - `npm run typecheck`;
  - `npm run build`;
  - `npm run budgets -w @recruit/web`;
  - `CI=true npm run e2e -w @recruit/web`.

  Expected: all PASS. The budgets stay within limits (CSS ≤ 25 kB gzip). `e2e-prod/a11y.spec.ts` reports no new violations.
- [ ] **Step 3: Commit** with `test(web): e2e for the home dashboard, open lessons, rules navigation and faction search`.

---

## Self-review

- **Spec coverage:**
  - Home dashboard and feature links: Task 1.
  - Sign-in Google first (S3): Task 2.
  - PageHeader on every E1 page: Tasks 1, 2, 3, 4, 6, 7, 8, 9.
  - Open lessons (LE1): Task 3.
  - Sticky drill start (LE3): Task 4.
  - 70ch measure: Task 4.
  - Done lessons keep summary and Replay (LE8): Task 3.
  - One report per page (R3): Tasks 5, 6, 7, 9.
  - Contents (R6): Task 6.
  - Stacked tables: Task 6.
  - Glossary A–Z (R8): Task 7.
  - Factions entry (N5): Task 6.
  - Phase chip row (R9): Task 9.
  - Faction search, crests and grouping: Task 8 (grouping already exists and is kept).
  - Guide tidy (R10): Task 9.
  - LE9 is explicitly handed to Plan E3 (scope note 3).
- **Interfaces:**
  - `ReportButton.parts` (Task 5) is used in Tasks 6, 7 and 9.
  - `InlineText.links` (Task 6) is used in Task 9.
  - `heavyImports(entry, heavy)` (Task 1) is used by both bundle tests.
  - Every Plan A name matches spec §3: `PageHeader`, `Sheet`, `FactionBadge`, `relativeTime`, `keyStats`, `sizeLabel`, `IconCheck`, `IconPlay`.
- **Exports used by other plans keep their signatures:**
  - `FactionPicker`;
  - `RulesText`;
  - `Blocks` (`InlineText` only gains an optional prop);
  - `ReportButton` (only gains `parts`).
