# E3. Practice (sandbox) polish: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The on-screen sandbox, now the **Practice** tab, gets three things. A page frame with a way out. A screen where you always know which phase you are in and what to press next. Dice, map and log that explain themselves on a phone.

**Architecture:** All changes live in `apps/web/src/play/`. The game screen keeps its `.game` grid and class names, because the Learn drills render the same panels inside the same classes. New behaviour is therefore opt-in:
- **The pinned action bar is a portal.** It shows only where `GamePage` provides a slot. In a drill, which has no slot, panels render their buttons inline exactly as today.
- **The board's no-black-bands sizing is a modifier class** that only `GamePage` sets.
- **New logic sits in small pure helpers, each unit-tested:** `objectiveLabels`, `logGroups`, `rollTally`, `listWarning`, `scoreLine`.
- **The overlays move onto Plan A's shared components.** The log, score and menu overlays move onto Plan A's `Sheet`. Game deletion uses Plan A's `Menu` and `useToast`.

**Tech Stack:** unchanged. React 19, React Router 6, Vitest 5 with Testing Library, Playwright 1.64. Plan A's `ui/*` components and icons are used by the names in spec §3.

**Spec:** `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md` (§2 navigation and undo, §3 components, §5 ownership, §6 rules). The audit findings are P1–P9, N6, N7 and C6 in the session scratchpad's `ux-audit/AUDIT.md`. The visual reference is the mockup canvas linked in the spec.

**Branch:** `practice-polish` in worktree `L:\9th Edition\app-practice`, off `main` after Plans A and D have merged.

## Global Constraints

- **Files:** edit only `apps/web/src/play/**` and `apps/web/e2e/sandbox.spec.ts`.
  - The following are frozen in wave 2: `theme.css`, `App.tsx`, `main.tsx`, `layout/*`, `ui/*` and `routes.tsx`.
  - The following belong to other plans; **import from them, never edit them:** `learn/*`, `lists/*`, `table/*` and `factions/*`.
- **CSS:** new CSS goes in `apps/web/src/play/play.css` only.
- **Kept names:** these class names stay, with the same meaning, because `learn/drill/DrillScreen.tsx` and `e2e/learn.spec.ts` use them: `.game`, `.game__top`, `.game__where`, `.game__tools`, `.game__board`, `.game__panel` and `.play-row`. `.die` and `.dice` also stay.
- **Kept props:** shared components keep their current props working unchanged: `DiceTray`, `PhasePanel` with every panel, `Problems`, `BoardCanvas`, `useBoardUi`, `boardNames` and `rollJudge`.
  - New props are optional.
  - The return types gain fields only; none are removed.
- **Tab name:** the tab is called **Practice** (routes stay `/play`). Back controls inside it say `Back to Practice games` and go to `/play`.
- **Copy:** sentence case, curly apostrophes (’) in new UI strings, no emoji.
- **Touch targets:** every new button or link is at least 44px.
- **Phone width:** no horizontal scroll at 320px or 375px.
- **Shared components:** use `PageHeader`, `Sheet`, `Menu`, `useToast`, `FactionBadge`, `relativeTime` and the icons exactly as spec §3 names them. Never import `lucide-react` directly.
- **Undo, not confirm:** deleting a game happens at once and shows a toast, `Game deleted`, with **Undo** for 6 seconds (the `useToast` default).
- **Tests:** component tests that use `useToast` render inside Plan A's `ToastProvider`.

## Review Focus

1. **The Learn drill screens share this code.**
   - What the drills render: `DrillScreen` renders `.game`, `PhasePanel`, `DiceTray`, `useBoardUi` and `boardNames` with no action-bar slot and no board-fit class.
   - Expected: drills look and behave exactly as before.
   - Pinned by: Task 7's "PinAction without a slot renders inline" test, and by running `src/learn` unit tests and `e2e/learn.spec.ts` in Tasks 7 and 10.
2. **Sorted dice must still pick the right die.**
   - With `order="high-first"`, tapping the die shown first must toggle the die at its original index. A re-roll would otherwise change the wrong die.
   - Pinned by Task 8's "sorted dice toggle their original index" test.
3. **Undo after a delete must bring the whole game back, even after sync has sent the deletion.**
   - `deleteDoc` wipes `data` and sets `deleted: true`.
   - Undo re-saves the captured doc with a newer `updatedAt`, so the restore wins last-write-wins.
   - Pinned by Task 2's "Undo restores a deleted game with its data" test.
4. **Rolls with no target number, and dice that aren't D6.**
   - The rolls: charge 2D6, Morale D6, psychic tests and D3s.
   - Expected: the tally shows a total, not "0 hits".
   - Expected: sorting works for any number of sides.
   - Pinned by Task 8's `rollTally` cases.
5. **Missions whose objectives already have real labels.**
   - Turned compass labels such as "North" must keep them. Only id-only objectives ("a", "n1") are renumbered 1–n.
   - The legend omits deployment zones once they stop showing (after deployment).
   - Pinned by Task 4's labelled-objective case and Task 6's no-zones case.

---

### Task 1: Seed a list without the builder UI (e2e decoupled from Plan B)

Plan B rewrites the builder screens in the same wave. The sandbox e2e currently builds its list through those screens (`+ Add unit`, `Done`, the Points meter), so it would break when B merges. A DEV-only hook seeds the same one-unit list directly.

**Files:**
- Create: `apps/web/src/play/devSeed.ts`
- Create: `apps/web/src/play/devSeed.test.ts`
- Modify: `apps/web/src/play/GamesPage.tsx` (register the hook in DEV)
- Modify: `apps/web/e2e/sandbox.spec.ts` (`buildList` → `seedList`)

**Interfaces:**
- Consumes (import only):
  - `getIndex`, `getRosterScope` and `getPolicy` from `../factions/dataClient`;
  - `startingRoster` and `listData` from `../lists/newListSetup` (learn/starterLists.ts uses the same two, so Plan B keeps them);
  - `createList` from `../lists/listStore`;
  - `slugsFor` from `../lists/useRosterEditor`;
  - `availableUnits`, `addUnit` and `FORCE` from `@recruit/data/roster`.
- Produces:
  - `export interface SeedSpec { catalogue: string; name: string; size: BattleSizeId; units: string[] }`
  - `export async function seedPracticeList(repo: Repository, ownerId: string, spec: SeedSpec): Promise<string>`, which returns the new list id.
  - In DEV only, `window.__practice = { seedList(spec: SeedSpec): Promise<string> }`, set by `GamesPage` while a user is signed in.

- [ ] **Step 1: Write the failing test** `devSeed.test.ts`. Use `stubGeneratedData()` and fake-indexeddb, the way `learn/starterLists.test.ts` does.

```ts
test('seeds a Combat Patrol list with the named units, saved under the owner', async () => {
  const id = await seedPracticeList(repo, 'u1', { catalogue: 'necrons', name: 'Necrons Combat Patrol', size: 'combat-patrol', units: ['Necron Warriors'] });
  const doc = await repo.getDoc<ListData>(id);
  expect(doc?.ownerId).toBe('u1');
  expect(doc?.data.roster.name).toBe('Necrons Combat Patrol');
  expect(doc?.data.summary).toMatchObject({ faction: 'Necrons', battleSize: 'combat-patrol', pointsLimit: 500 });
  expect(doc?.data.summary.points).toBeGreaterThanOrEqual(100);
});
test('an unknown unit name fails with its name', async () => {
  await expect(seedPracticeList(repo, 'u1', { catalogue: 'necrons', name: 'x', size: 'combat-patrol', units: ['Nope'] })).rejects.toThrow('Nope');
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npm test -w @recruit/web -- src/play/devSeed.test.ts` → FAIL, "seedPracticeList is not a function" or "cannot find module".
- [ ] **Step 3: Implement `seedPracticeList`.** Use the Patrol Detachment (`FORCE.patrol`), then `addUnit` for each name found by `availableUnits(...).find(u => u.name === name)`. Save with `createList(repo, ownerId, listData(scope, policy, roster, catalogue))`. In `GamesPage`, inside `useEffect` and only when `import.meta.env.DEV && user`, set `window.__practice`; delete it on cleanup. Declare the global in `devSeed.ts`.
- [ ] **Step 4: Run the test and confirm it passes.**
- [ ] **Step 5: Rewrite `buildList(page)` in `e2e/sandbox.spec.ts` as `seedList(page)`.**
  1. `page.goto('/play')`, which redirects to sign-in.
  2. Click `Continue (dev)` and wait for `/play`.
  3. `await page.evaluate(() => window.__practice.seedList({ catalogue: 'necrons', name: 'Necrons Combat Patrol', size: 'combat-patrol', units: ['Necron Warriors'] }))`.
  4. Reload, then `expect(page.getByRole('link', { name: 'New game' })).toBeVisible()`.

  Both tests call `seedList` instead of `buildList`. The rest of the flow is unchanged.
- [ ] **Step 6:** Run `cd apps/web && CI=true npx playwright test e2e/sandbox.spec.ts`. Expected: both tests pass on both projects.
- [ ] **Step 7: Commit.** `test(practice): seed the sandbox e2e's list directly instead of through the builder`

---

### Task 2: Practice games page (P9, C6)

**Files:**
- Modify: `apps/web/src/play/GamesPage.tsx`, `apps/web/src/play/GamesPage.test.tsx`, `apps/web/src/play/play.css`

**Interfaces:**
- Consumes:
  - `PageHeader`, `Menu`, `useToast`, `FactionBadge` and `relativeTime` (Plan A);
  - `IconPlay` and `IconDelete`.
- Produces:
  - `export function scoreLine(g: GameData): string`, for example `Necrons 10 – 5 Ultramarines`. This is exactly the Table's game-card format, `You 13 – 0 Opponent`: label, score, spaced en dash, score, label. Both Practice players sit at this device, so the army names (from `meta.armies` by player) take the place of `You` and `Opponent`. Relative time comes from `relativeTime`, as on the Table.
  - `export function statusLine(g: GameData): string`, which is the current `status()`, renamed and exported.
  - `PHASE_NAMES` stays exported from `GamesPage.tsx`, because `game/names.ts` re-exports it.

- [ ] **Step 1: Update `GamesPage.test.tsx`, wrapping the page in `ToastProvider`.** Make the tests fail first.

```ts
test('the page is the Practice tab: title, intro and New game', async () => {
  page();
  expect(await screen.findByRole('heading', { level: 1, name: 'Practice' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'New game' })).toHaveAttribute('href', '/play/new');
});
// 'lists saved games newest first…': replace the VP assertion with
expect(cards[0]).toHaveTextContent('Necrons 10 – 5 Ultramarines');
expect(cards[0]).toHaveTextContent(/ago|just now|yesterday/);
test('Delete removes the game at once and Undo brings it back with its data', async () => {
  // seed g1, open its menu
  await userEvent.click(within(item).getByRole('button', { name: 'Actions for Necrons vs Ultramarines' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(await screen.findByText('No games yet.')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Game deleted');
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('link', { name: /Necrons vs Ultramarines/ })).toHaveAttribute('href', '/play/g1');
  expect((await repo.getDoc<GameData>('g1'))?.data.meta.title).toBe('Necrons vs Ultramarines');
});
```

  Delete the old `'deleting a game asks first'` test.
- [ ] **Step 2: Run the tests and confirm they fail.** `npm test -w @recruit/web -- src/play/GamesPage.test.tsx`.
- [ ] **Step 3: Implement the page.**
  - `PageHeader`:
    - `variant="top"`;
    - title `Practice`;
    - subtitle `Two players, one device: the app runs the core rules for you.`;
    - `actions`: the `New game` link, styled `btn btn--primary`.
  - **Each card** has a link to `/play/:id`. It shows:
    - `FactionBadge` for army A (slug `meta.armies[0].catalogueSlugs[0]`);
    - the title;
    - `statusLine`;
    - `scoreLine · relativeTime(doc.updatedAt)`.
  - **Each card's `Menu`** has `label="Actions for {title}"` and two items:
    - `Resume` (or `View` when ended), with `to`;
    - `Delete`, `danger`.
  - **Delete:**
    1. Capture `doc`.
    2. Call `repo.deleteDoc(id)`.
    3. Show the toast `Game deleted`, with action `Undo`, which calls `repo.saveDoc({ id, kind: 'game', ownerId, data })`.
  - **CSS:** remove the `.play-game__confirm` rules from `play.css` and add card rules.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(practice): Practice games page with crests, scores, last played and delete with undo`

---

### Task 3: New game setup (P8)

**Files:**
- Modify: `apps/web/src/play/setup/NewGamePage.tsx`, `apps/web/src/play/setup/NewGamePage.test.tsx`, `apps/web/src/play/play.css`

**Interfaces:**
- Consumes: `PageHeader`, `FactionBadge` and `ListData` (import only).
- Produces: `export function listWarning(l: Doc<ListData>): string | null`, which returns:
  - points 0 → `This list has no units yet.`
  - points over `pointsLimit` → `Over its points limit: 520 / 500 pts.` (numbers through `fmt`)
  - `issueCount > 0` → `2 problems to fix in the builder.` (or `1 problem…`), shown but not blocking
  - otherwise `null`

- [ ] **Step 1: Write the failing tests.**

```ts
test('listWarning explains empty, over-limit and unfinished lists', () => {
  expect(listWarning(doc({ points: 0 }))).toBe('This list has no units yet.');
  expect(listWarning(doc({ points: 520, pointsLimit: 500 }))).toBe('Over its points limit: 520 / 500 pts.');
  expect(listWarning(doc({ points: 480, issueCount: 2 }))).toBe('2 problems to fix in the builder.');
  expect(listWarning(doc({ points: 480, issueCount: 0 }))).toBeNull();
});
test('each list option shows faction, size and points, and its warning', async () => {
  // two lists, one empty
  const p1 = await screen.findByRole('group', { name: 'Player 1' });
  expect(within(p1).getByRole('radio', { name: /Empty list/ })).toBeInTheDocument();
  expect(within(p1).getByText('This list has no units yet.')).toBeInTheDocument();
  expect(within(p1).getByText(/Necrons · Combat Patrol · 115 \/ 500 pts/)).toBeInTheDocument();
});
test('with no lists: one message and a way to the builder', async () => {
  expect(await screen.findByText('You need a list to play. Both players can use the same one.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build a list' })).toHaveAttribute('href', '/build/new');
  expect(screen.getByRole('link', { name: 'Back to Practice games' })).toHaveAttribute('href', '/play');
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement the setup page.**
  - `PageHeader` with `back={{ to: '/play', label: 'Practice games' }}` and title `New game`. This applies to the empty state too.
  - **List options:** `ListPicker` options become radio cards. Each card is a `label` holding the radio, then:
    - `FactionBadge` (slug `summary.catalogueSlug`);
    - the name;
    - `Faction · Size · pts / limit pts`;
    - the `listWarning` line in `--warn` colour.

    The radio stays a real `<input type="radio">`, so `getByRole('group', { name }).getByRole('radio')` keeps working.
- [ ] **Step 4: Run the tests and confirm they pass.** Also run `CI=true npx playwright test e2e/sandbox.spec.ts`; it should still pass. The test still checks no sideways scroll on setup.
- [ ] **Step 5: Commit.** `feat(practice): clearer new-game setup with list cards and warnings`

---

### Task 4: Objectives are numbered 1–n when they have no real label (P4, also the audit's LE9)

**Files:**
- Create: `apps/web/src/play/game/objectives.ts`, `apps/web/src/play/game/objectives.test.ts`
- Modify:
  - `apps/web/src/play/board/scene.ts` (objective `name`);
  - `apps/web/src/play/game/ScoreSheet.tsx`;
  - `apps/web/src/play/game/names.ts` (`boardNames` gains `objective`);
  - `apps/web/src/play/board/scene.test.ts`.

**Interfaces:**
- Produces: `export function objectiveLabels(objectives: { id: string; label?: string }[]): Map<string, string>`.
  - It returns the `label` where the objective has one.
  - Otherwise it returns its 1-based position in setup order.
- `boardNames(s)` now also returns `objective: (id) => labels.get(id) ?? id`. The signature is unchanged, and `learn/` callers get the new field for free.

- [ ] **Step 1: Write the failing tests.**

```ts
test('id-only objectives are numbered in setup order', () => {
  expect([...objectiveLabels([{ id: 'a' }, { id: 'b' }, { id: 'n1' }, { id: 'n2' }]).values()]).toEqual(['1', '2', '3', '4']);
});
test('real labels are kept; only unlabelled ones are numbered', () => {
  expect([...objectiveLabels([{ id: 'o1', label: 'North' }, { id: 'n2' }]).values()]).toEqual(['North', '2']);
});
// scene.test.ts: a state whose objectives are {id:'a'},{id:'b'} → buildScene(...).objectives.map(o => o.name) equals ['1','2']
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** In `buildScene`, compute labels once per call and set `name` from them. Use the same map for `ScoreSheet`'s `Objective {name}: …` and for `boardNames`.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/play src/learn` → PASS.
- [ ] **Step 5: Commit.** `fix(practice): number objectives 1–n instead of showing internal ids`

---

### Task 5: Game header with a way out and a phase strip (N6, P2)

**Files:**
- Create: `apps/web/src/play/game/PhaseStrip.tsx`, `apps/web/src/play/game/PhaseStrip.test.tsx`
- Modify:
  - `apps/web/src/play/game/TopBar.tsx`;
  - `apps/web/src/play/game/GamePage.tsx` (the missing and unreadable states);
  - `apps/web/src/play/panels/GameOverPanel.tsx`;
  - `apps/web/src/play/panels/CommandPanel.test.tsx` (the GameOverPanel assertions);
  - `apps/web/src/play/game/GamePage.test.tsx`;
  - `apps/web/src/play/play.css`.

**Interfaces:**
- Consumes: `IconBack`, `IconUndo`, `IconMore` and `PageHeader`.
- Produces: `export function PhaseStrip({ phase }: { phase: Phase }): JSX.Element | null`.
  - It returns `null` for `pre-battle` and `ended`.
  - Otherwise it renders `<ol aria-label="Phases">`, one `<li>` per phase in order: Command, Movement, Psychic, Shooting, Charge, Fight, Morale.
  - The current phase gets `aria-current="step"`; earlier phases get `data-done="true"`.
- `TopBar`'s props are unchanged.

- [ ] **Step 1: Write the failing tests.**

```ts
test('the strip shows all seven phases and marks the current one', () => {
  render(<PhaseStrip phase="shooting" />);
  const items = within(screen.getByRole('list', { name: 'Phases' })).getAllByRole('listitem');
  expect(items.map((i) => i.textContent)).toEqual(['Command', 'Movement', 'Psychic', 'Shooting', 'Charge', 'Fight', 'Morale']);
  expect(items[3]).toHaveAttribute('aria-current', 'step');
  expect(items[1]).toHaveAttribute('data-done', 'true');
});
test('no strip before the battle or after it', () => {
  const { container } = render(<PhaseStrip phase="pre-battle" />);
  expect(container).toBeEmptyDOMElement();
});
// GamePage.test.tsx
test('the game header links back to the Practice games', async () => {
  expect(await screen.findByRole('link', { name: 'Back to Practice games' })).toHaveAttribute('href', '/play');
});
test('a missing game offers the way back', async () => {
  expect(await screen.findByText('This game no longer exists.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Practice games' })).toHaveAttribute('href', '/play');
});
// CommandPanel.test.tsx: 'Back to games' → 'Back to Practice games'
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement the header and its pages.**
  - **`TopBar`, row 1:**
    - a 44px `Link` to `/play` (`IconBack`, `aria-label="Back to Practice games"`);
    - `game__where`;
    - tools: an `Undo` icon button (`IconUndo`, `aria-label="Undo"`), a `Log` text button and a `Menu` icon button (`IconMore`, `aria-label="Menu"`).

    These accessible names are what `e2e/sandbox.spec.ts` and `GamePage.test.tsx` already use.
  - **`TopBar`, row 2:** the armies as today. Keep `VP n` in each army button.
  - **`TopBar`, row 3:** `<PhaseStrip phase={state.phase} />`.
  - **Missing and unreadable states:** use `PageHeader` with `back={{ to: '/play', label: 'Practice games' }}`.
  - **`GameOverPanel`:** its link reads `Back to Practice games`.
  - **Phase strip styling:** a single line, each item 12px in the display font. The current item is `--brass-strong` with an underline; done items are `--text-muted`. It must not wrap at 320px.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/play` → PASS.
- [ ] **Step 5: Commit.** `feat(practice): game header with Back to Practice games and a phase strip`

---

### Task 6: Map key (P4)

**Files:**
- Create: `apps/web/src/play/board/colours.ts`, `apps/web/src/play/game/MapKey.tsx`, `apps/web/src/play/game/MapKey.test.tsx`
- Modify:
  - `apps/web/src/play/board/pixiRenderer.ts` (import `TERRAIN_COLOURS` from `colours.ts`, unchanged values);
  - `apps/web/src/play/game/GamePage.tsx`;
  - `apps/web/src/play/play.css`.

**Interfaces:**
- Produces:
  - `export const TERRAIN_COLOURS = { ruin: '#77736b', woods: '#3e6b3a', crater: '#6b4f35', other: '#5b5b5b' } as const` (CSS hex). `pixiRenderer` converts it with `parseInt(hex.slice(1), 16)`. This keeps pixi out of the game chunk.
  - `export const TERRAIN_NAMES = { ruin: 'Ruins: block sight', woods: 'Woods: dense cover', crater: 'Craters: difficult ground', other: 'Other terrain' } as const`
  - `export function MapKey({ scene, names }: { scene: BoardScene; names: BoardNames }): JSX.Element`. This is a 44px toggle button `Map key` (`aria-expanded`) over the board's top-left corner. It opens a small panel listing:
    - each zone in `scene.zones`, as `{army} deployment zone`;
    - each terrain look present, once;
    - `Objectives {first}–{last}: hold within 3"`, using the objective names.

    A swatch precedes each entry: zone colours are `var(--brass)` for A and `var(--red-strong)` for B, terrain uses `TERRAIN_COLOURS`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('the key lists zones, the terrain kinds on the board and the objectives', async () => {
  render(<MapKey scene={sceneWith({ zones: ['A', 'B'], terrain: ['ruin', 'ruin', 'woods'], objectives: ['1', '2', '3', '4'] })} names={names} />);
  await userEvent.click(screen.getByRole('button', { name: 'Map key' }));
  const key = screen.getByRole('region', { name: 'Map key' });
  expect(within(key).getByText('Necrons deployment zone')).toBeInTheDocument();
  expect(within(key).getAllByText('Ruins: block sight')).toHaveLength(1);
  expect(within(key).getByText('Woods: dense cover')).toBeInTheDocument();
  expect(within(key).getByText('Objectives 1–4: hold within 3"')).toBeInTheDocument();
});
test('after deployment no zones are listed', async () => {
  render(<MapKey scene={sceneWith({ zones: [], terrain: [], objectives: ['1'] })} names={names} />);
  await userEvent.click(screen.getByRole('button', { name: 'Map key' }));
  expect(screen.queryByText(/deployment zone/)).toBeNull();
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** Mount `<MapKey scene={scene} names={boardNames(state)} />` inside `.game__board`, absolutely positioned top-left (`play.css`). Escape and a second tap close it.
- [ ] **Step 4: Run the tests and confirm they pass.** Also run `npm test -w @recruit/web -- src/play/board` (the renderer import change).
- [ ] **Step 5: Commit.** `feat(practice): a map key for zones, terrain and objectives`

---

### Task 7: Phone layout: pinned action bar, board without black bands, clear panel toggle (P1, P5, P6)

**Files:**
- Create: `apps/web/src/play/game/actionBar.tsx`, `apps/web/src/play/game/actionBar.test.tsx`
- Modify:
  - every panel in `apps/web/src/play/panels/` that renders a `btn--primary`: `ChargePanel`, `CommandPanel`, `DeployPanel`, `FightPanel`, `FirstTurnPanel`, `HeroicPanel`, `MoralePanel`, `MovementPanel`, `PlacementPanel`, `PlanMove`, `PsychicPanel`, `ReactionPanel`, `ReinforcementsPanel`, `RollPanel` and `ShootingPanel`;
  - `apps/web/src/play/game/GamePage.tsx`;
  - `apps/web/src/play/toolkit/Toolkit.tsx`;
  - `apps/web/src/play/play.css`.

**Interfaces:**
- Produces:
  - `export function ActionSlotProvider({ children }: { children: ReactNode }): JSX.Element`.
    - It renders `children`, then `<div className="game__actions" role="group" aria-label="Actions">`.
    - That bar holds two fixed containers, in this order: `<div className="game__actions-main">` and `<div className="game__actions-end">`.
    - It provides both containers through context.
  - `export function PinAction({ slot, children }: { slot: 'main' | 'end'; children: ReactNode }): JSX.Element`.
    - With a provider, it portals `children` into the container for its slot, so `main` always comes before `end` in the DOM.
    - With none (Learn drills), it renders `children` in place, unwrapped.
- **Rules for panels:**
  - **`slot="end"`:** the button that moves the game on (`End … phase`, `End Movement`, `No more Heroic Interventions`, `Start the battle`, `Roll off`).
  - **`slot="main"`:** the button that commits what you just set up (`Accept`, `Deploy {unit}`, `Confirm move`, `Shoot`, `Fight`, `Declare charge`, the reaction choices).
  - **Bar order:** the bar shows `main` before `end`.
  - **Styling:** with a `main` present, `end` is styled as a secondary button. This uses CSS `.game__actions-main:not(:empty) ~ .game__actions-end .btn--primary`. The accessible names don't change.
- **`GamePage` layout:**
  - **Wrapping:** `GamePage` wraps the panel and the bar in `ActionSlotProvider`, so the bar sits inside `.game__panel`, at its bottom (sticky). `.game__panel` locators in e2e keep finding the buttons.
  - **Board sizing:** `.game__board` gains `game__board--fit` and the inline style `{ '--board-w': w, '--board-h': h }`.
  - **Board CSS (phone):** at under 768px, `.game__board--fit` has `aspect-ratio: var(--board-w) / var(--board-h)`, `height: min(50dvh, calc(100vw * var(--board-h) / var(--board-w)))` and `justify-self: center`. The grid row becomes `auto`.
  - **Panel toggle:** the `.game__handle` text becomes `Bigger panel` / `Bigger board` (`aria-expanded` unchanged).
  - **Toolkit:** opening the Toolkit scrolls the panel to the top and focuses the Toolkit's `h2` (`tabIndex={-1}`). Its title row (`Toolkit` plus a `Close the toolkit` button) is sticky at the panel's top.

  **The Toolkit stays in the panel rather than becoming a Sheet.** Its tools work on the board (placing and returning models), which a sheet would cover.

- [ ] **Step 1: Write the failing tests.**

```ts
test('PinAction without a slot renders inline (Learn drills)', () => {
  render(<div data-testid="panel"><PinAction slot="end"><button>End Command phase</button></PinAction></div>);
  expect(within(screen.getByTestId('panel')).getByRole('button', { name: 'End Command phase' })).toBeInTheDocument();
});
test('with a slot, pinned buttons go to the Actions bar, main first', () => {
  render(<ActionSlotProvider><PinAction slot="end"><button>End Shooting phase</button></PinAction><PinAction slot="main"><button>Shoot</button></PinAction></ActionSlotProvider>);
  const bar = screen.getByRole('group', { name: 'Actions' });
  expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Shoot', 'End Shooting phase']);
});
// GamePage.test.tsx
test('the current primary action is in the Actions bar', async () => {
  // seeded deployed game in the Command phase
  expect(within(await screen.findByRole('group', { name: 'Actions' })).getByRole('button', { name: 'End Command phase' })).toBeInTheDocument();
});
test('the panel toggle says what it does', async () => {
  expect(await screen.findByRole('button', { name: 'Bigger panel' })).toHaveAttribute('aria-expanded', 'false');
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement `actionBar.tsx` and the layout.**
  - Wrap each listed panel button in `PinAction` per the rules above. Keep each button's markup, class and handler.
  - Add the `GamePage` layout, Toolkit and CSS changes described in the Interfaces block.
  - **Desktop (768px and up):** the bar sits at the bottom of the side panel.
- [ ] **Step 4: Run unit tests across both areas.** `npm test -w @recruit/web -- src/play src/learn` → PASS. The `src/learn` drill tests prove the inline fallback.
- [ ] **Step 5: Extend `e2e/sandbox.spec.ts`.**
  - After `Round 1 · Command` appears: at the phone project, `End Command phase` is inside the viewport with no scrolling, `(await btn.boundingBox())!.y + h <= 812`.
  - The board box's width/height ratio is within 2% of 44/30 for Combat Patrol (read `setup.board`).
  - `noSidewaysScroll` passes.

  Then run `CI=true npx playwright test e2e/sandbox.spec.ts e2e/learn.spec.ts` → PASS.
- [ ] **Step 6: Commit.** `feat(practice): pinned action bar, board sized to the map, clearer panel toggle`

---

### Task 8: Dice sorted and tallied, re-rolls explained (P3)

**Files:**
- Create: `apps/web/src/play/panels/diceTally.ts`, `apps/web/src/play/panels/diceTally.test.ts`
- Modify:
  - `apps/web/src/play/panels/DiceTray.tsx`, `DiceTray.test.tsx`;
  - `apps/web/src/play/panels/RollPanel.tsx`, `RollPanel.test.tsx`.

**Interfaces:**
- **`DiceTray` gains `order?: 'rolled' | 'high-first'`**, default `'rolled'`, which is the current behaviour, so Learn's `DrillCard` is unchanged.
  - With `'high-first'`, dice are shown by value, high to low, ties in rolled order.
  - Each die keeps its rolled index in its aria-label (`Die {i+1}: …`) and in `onToggle(i)`.
- **`rollJudge(s)`** now returns `{ label: string; passes(d: Die): boolean; noun: 'hit' | 'wound' | 'save' } | null`. Only the field `noun` is new.
- **New:** `export function rollTally(dice: Die[], judge: { passes(d: Die): boolean; noun: 'hit' | 'wound' | 'save' } | null): string`.
  - With a judge: `7 hits of 10`, `1 wound of 3`, `4 saves of 6` (singular when 1).
  - Without one: `Total 9`.
- **New:** `export function rerollHelp(picked: number, whole: boolean): string`. It returns:
  - 0 picked, not whole: `Tap a die to pick it for a re-roll or a change.`
  - 1 picked: `1 die picked.`
  - n > 1: `{n} dice picked. A Command Re-roll needs exactly one.`
  - whole roll (`roll.whole`): `A Command Re-roll re-rolls all of these dice.`

- [ ] **Step 1: Write the failing tests.**

```ts
test('rollTally counts successes against the noun, or totals an unjudged roll', () => {
  const d = (v: number) => ({ value: v, sides: 6 as const });
  const hits = { passes: (x: Die) => x.value >= 3, noun: 'hit' as const };
  expect(rollTally([d(1), d(3), d(6)], hits)).toBe('2 hits of 3');
  expect(rollTally([d(5)], { ...hits, noun: 'wound' })).toBe('1 wound of 1');
  expect(rollTally([d(4), d(5)], null)).toBe('Total 9');
  expect(rollTally([{ value: 2, sides: 3 }], null)).toBe('Total 2');
});
test('sorted dice toggle their original index', async () => {
  const onToggle = vi.fn();
  render(<DiceTray dice={[{ value: 2, sides: 6 }, { value: 6, sides: 6 }]} rollKey="r" order="high-first" onToggle={onToggle} />);
  const shown = within(screen.getByRole('group', { name: 'Dice' })).getAllByRole('button');
  expect(shown[0]).toHaveAccessibleName('Die 2: 6');
  await userEvent.click(shown[0]);
  expect(onToggle).toHaveBeenCalledWith(1);
});
// RollPanel.test.tsx: in a hit roll window the tally reads e.g. /^\d+ hits? of \d+$/ next to the "3+ needed" label,
// and with nothing picked the help line reads 'Tap a die to pick it for a re-roll or a change.'; Command Re-roll and
// "Re-roll selected" carry aria-describedby pointing at that help line.
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** `RollPanel` passes `order="high-first"`. Show `{rollTally(...)} · {judge.label}` (or the tally alone) as one line above the tray. Replace the fixed help line with `rerollHelp(picked.length, roll.whole)` (`id` used by `aria-describedby`).
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/play/panels src/learn` → PASS.
- [ ] **Step 5: Commit.** `feat(practice): dice sorted high to low with a tally, and re-roll help`

---

### Task 9: Log, score and menu as sheets; log newest first (P7)

**Files:**
- Create: `apps/web/src/play/game/logGroups.ts`, `apps/web/src/play/game/logGroups.test.ts`
- Modify:
  - `apps/web/src/play/game/Overlays.tsx` (`GameLog` and `GameMenu` onto `Sheet`; `Dialog` and `HandOver` stay);
  - `apps/web/src/play/game/ScoreSheet.tsx` (onto `Sheet`);
  - `apps/web/src/play/game/GamePage.test.tsx`, `apps/web/src/play/game/ScoreSheet.test.tsx`;
  - `apps/web/src/play/play.css`.

**Interfaces:**
- Produces:
  - `export interface LogGroup { key: string; title: string; lines: { key: string; text: string }[] }`
  - `export function logGroups(lines: LogLine[]): LogGroup[]`, newest group first and newest line first within each group.
    - A new group starts at each engine line matching `/^Battle round (\d+): (.+) phase\.$/`. Its title is `Round {n} · {captured} phase`, for example `Round 2 · Necrons' Movement phase` (the captured text is kept as is). The heading line itself is dropped.
    - Lines before the first such line are grouped under `Before the battle`.
    - Each line's text goes through `sentenceCase`.
  - `export const sentenceCase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)`
- `GameLog`, `GameMenu` and `ScoreSheet` keep their props. Each now renders `<Sheet kind="sheet" title="Game log" | "Menu" | "Score" onClose={onClose}>`.
  - Sheet's close button has the accessible name `Close`, as the e2e expects.
  - `GameMenu`'s `Back to games` link becomes `Back to Practice games`.

- [ ] **Step 1: Write the failing tests.**

```ts
const line = (seq: number, round: number, text: string): LogLine => ({ seq, round, phase: 'movement', text });
test('groups by phase start, newest first, sentence case, headings dropped', () => {
  const groups = logGroups([
    line(1, 0, 'first turn: rolled 4.'),
    line(2, 1, "Battle round 1: Necrons' Command phase."),
    line(3, 1, 'Necrons gained 1 CP (Command phase): now 4.'),
    line(4, 1, "Battle round 1: Necrons' Movement phase."),
    line(5, 1, 'Necron Warriors made a Normal Move.'),
    line(6, 1, 'Necron Warriors Remained Stationary.'),
  ]);
  expect(groups.map((g) => g.title)).toEqual(["Round 1 · Necrons' Movement phase", "Round 1 · Necrons' Command phase", 'Before the battle']);
  expect(groups[0].lines.map((l) => l.text)).toEqual(['Necron Warriors Remained Stationary.', 'Necron Warriors made a Normal Move.']);
  expect(groups[2].lines[0].text).toBe('First turn: rolled 4.');
});
```

```ts
// GamePage.test.tsx: open Log → getByRole('dialog', { name: 'Game log' }) shows the newest group's heading first;
// Close (button named 'Close') closes it. Menu → dialog 'Menu' has link 'Back to Practice games' → /play.
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** Render groups as `h3` plus an `ol`.
  - **Stacking:** the sheets must render above the fixed game screen (`.game` is `z-index: 20`). Check `ui/Sheet.tsx` and `theme.css`.
  - **If Plan A's sheet layer is lower:** lower `.game`'s own `z-index` in `play.css` so it sits below the sheet layer but above the app's nav (`.nav` is `z-index: 10`). Never edit `theme.css`.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- src/play` → PASS. Then run `CI=true npx playwright test e2e/sandbox.spec.ts` → PASS. The log assertion `Necron Warriors made a Normal Move.` still holds.
- [ ] **Step 5: Commit.** `feat(practice): log newest first by phase; log, score and menu as sheets`

---

### Task 10: Finish: styling pass, full checks, screenshots

**Files:**
- Modify: `apps/web/src/play/play.css`, `apps/web/e2e/sandbox.spec.ts`

- [ ] **Step 1: Styling pass against the mockups' system.**
  - The game top bar uses `--surface`, the display font for `game__where`, and army chips with the zone colours.
  - Dice use `--surface-2` fail / `--ok` pass, keeping the existing `.die--pass` and `.die--fail` names.
  - Remove the now-unused `.play-game__confirm` rules (Task 2) and `.game__close`, if no Dialog uses it any more. `HandOver` has no close button.
- [ ] **Step 2: Add the 320px check to `e2e/sandbox.spec.ts`.** In a second test, set the viewport to 320×700 on `/play` and `/play/new`, then run `noSidewaysScroll`.
- [ ] **Step 3: Run the full set.**
  - `npm test`;
  - `npm run typecheck`;
  - `npm run build`;
  - `npm run budgets -w @recruit/web`;
  - `CI=true npm run e2e -w @recruit/web`.

  Expected: all green. `learn.spec.ts` passes untouched.
- [ ] **Step 4: Save screenshots for the owner.** Run with `SHOT_DIR` set: `CI=true SHOT_DIR=<scratchpad>/practice-shots npx playwright test e2e/sandbox.spec.ts`. That captures setup, deploy, dice, move and game over at 375×812 and 1280×800.
- [ ] **Step 5: Commit.** `style(practice): Practice screens on the new visual system`

---

## Self-review notes

- **Spec coverage:** every audit finding is covered.
  - P1: Task 7 (bar, board fit).
  - P2: Task 5.
  - P3: Task 8.
  - P4: Tasks 4 and 6.
  - P5: Task 7.
  - P6: Task 7 (Toolkit focus and sticky title; kept in the panel, rationale given).
  - P7: Task 9.
  - P8: Task 3.
  - P9: Task 2.
  - N6: Task 5.
  - N7: Task 5 (the header Back; the drill title is Plan E1's).
  - C6: Task 2. `Necrons 10 – 5 Ultramarines` uses exactly the Table's `You 13 – 0 Opponent` format, with army names in place of You/Opponent, and `relativeTime`.
- **Plan A's contracts relied on (confirmed by the coordinator):**
  - Sheet names its dialog by its title;
  - Menu items are `role="menuitem"`;
  - the Menu trigger's accessible name equals `label`.
- **Type consistency:** `rollJudge`'s new `noun` is used by `rollTally`. `boardNames` gains `objective`, which `BoardNames` already declares as optional. `PinAction` and `ActionSlotProvider` are only used inside `play/`.
- **Outside `play/`:** read-only imports only, from `lists/newListSetup`, `lists/listStore`, `lists/useRosterEditor` and `factions/dataClient` in Task 1. No edits.
