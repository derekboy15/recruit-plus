# Plan E2: Table companion polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Table companion screen has the new page frame. Ending a game hides behind a menu. "Next phase" says why it won't move. Saved games read cleanly at 320px and can be deleted with undo. Stratagems default to the player's actual army. Secondaries and maps explain themselves. The score sheet and odds tool line up. A game can show the player's army from their list.

**Architecture:** Each change stays inside `apps/web/src/table/`, built from the Plan A components in `apps/web/src/ui/` (`PageHeader`, `Menu`, `Sheet`, `InfoButton`, `FactionBadge`, `relativeTime`, `useToast`, icons). There are three new pure modules, each with unit tests:
- `gameRow.ts`: what a saved-game row says;
- `armyGroups.ts`: which stratagem groups belong to an army;
- `armyEntries.ts`: which players have a list to show.

The army filter needs to know a list's choices (dynasty, Army of Renown, detachment). Rather than re-running the roster engine at every phase, `NewGamePage` works out the display names once, when the game starts. It stores them on the player's setup (`PlayerSetup.armyChoices`). Games saved before this change have no `armyChoices` and fall back to the faction's main group plus the Core Book. The last task mounts Plan C's `ArmyDrawer`, after Plan C is merged.

**Tech Stack:** React 19, React Router 6, Vitest 5 + Testing Library, Playwright 1.64, Dexie 4 (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md`: §2 (Undo, not confirm; navigation), §3 (component contracts), §4 (the `ArmyDrawer` contract), §5 (ownership) and §6 (rules). Audit findings: T1–T11, N6, C3 and C6.

**Branch:** `table-polish` in worktree `L:\9th Edition\app-table`, off `main` once Plans A and D are merged (`git -C "L:/9th Edition/app" worktree add "L:/9th Edition/app-table" -b table-polish main`, then `npm ci`, `npm run data:fetch`, `npm run data:build` in the worktree). Task 9 also needs Plan C merged; it says how to check.

## Global Constraints

- **Files:** edit only `apps/web/src/table/*` and `apps/web/e2e/table.spec.ts`. `theme.css`, `layout/*`, `ui/*`, `routes.tsx`, `App.tsx`, `lists/*` and `rules/*` are frozen; import from them freely. New CSS goes in `apps/web/src/table/table.css` only.
- **Plan A components:**
  - Pages use `PageHeader` from `../ui/PageHeader`.
  - Sub-pages use `back={{ to: '/table', label: 'Table games' }}`.
  - `TableHome` uses `variant="top"`.
- **Touch targets:** every control is at least 44px.
- **Width:** there is no horizontal page scroll at 320px or 375px (`e2e/table.spec.ts` `checkScreen`).
- **Copy:**
  - plain words, sentence case, curly apostrophes (’) in UI strings, no emoji;
  - a score line reads `You 13 – 0 Opponent`: player A's name, A's VP, an en dash with spaces, B's VP, B's name, in setup order A then B. This is the format Plan E3 uses for Practice games (audit C6).
- **Deleting:**
  - deleting a game is instant and shows `Game deleted` with **Undo** (6 s toast);
  - ending a game asks once, in a sheet, because only "Undo the end" on the game page brings it back.
- **Names:** anything from BSData shown on screen goes through `optionDisplay`, `displayName` or `factionDisplayName`.
- **Tests:**
  - render through `TestProviders` (from `../rules/__fixtures__/TestProviders`, unchanged);
  - wrap the component in `<ToastProvider>` from `../ui/toast` wherever it calls `useToast`.
- **Commands:**
  - unit tests: `npm test -w @recruit/web -- src/table/<file>` from the worktree root;
  - types: `npm run typecheck`;
  - flows: `cd apps/web && CI=true npx playwright test e2e/table.spec.ts`.

## Review Focus

1. **Games saved before this plan:** a game with no `armyChoices` (and possibly no `listId`) must load, filter stratagems to the main group plus Core Book, and offer no army button. Test in Task 4 and Task 9.
2. **Undo after delete:** Undo must bring back the same game (events, score, setup). If the toast expires first, the game stays gone and does not come back on reload. Test in Task 1.
3. **Long names at 320px:** a 40-character opponent name must not push the games list, the game header or the scoreboard sideways; text truncates with an ellipsis. Test in Task 1 (unit: the CSS class is present) and Task 10 (e2e at 320px with a long name).
4. **Repeated taps on Next phase while a prompt is open:** these must never advance or write events. Each tap only moves focus to the prompt. Test in Task 3.
5. **A list deleted after the game started:** the army button still opens `ArmyDrawer`, which shows its own "isn’t on this device" message, and nothing crashes. Test in Task 9.

---

### Task 1: Saved games list — page frame, clean rows, delete with undo

**Files:**
- Create: `apps/web/src/table/gameRow.ts`, `apps/web/src/table/gameRow.test.ts`, `apps/web/src/table/TableHome.test.tsx`
- Modify: `apps/web/src/table/TableHome.tsx`, `apps/web/src/table/tableStore.ts`, `apps/web/src/table/tableStore.test.tsx` (move its two TableHome tests into `TableHome.test.tsx`), `apps/web/src/table/table.css`

**Interfaces:**
- Consumes: `PageHeader`, `Menu`/`MenuItem`, `useToast`/`ToastProvider`, `relativeTime` (Plan A); `deriveState`, `PlayerTotals` (`game.ts`).
- Produces:
  - `scoreLine(setup: TableSetup, totals: Record<PlayerKey, { total: number }>): string` in `gameRow.ts`, returning `"You 13 – 0 Opponent"`;
  - `gameStatus(state: TableState | null): string` in `gameRow.ts`, returning `"Finished"` when ended or with no position, `"Round 2"` otherwise, and `""` with no state;
  - `deleteTableGame(repo: Repository, id: string): Promise<() => Promise<void>>` in `tableStore.ts`. It reads the doc, deletes it, and returns `restore`, which saves the same id, kind, ownerId and data back.

- [ ] **Step 1: Write the failing tests**

```ts
// gameRow.test.ts
test('scoreLine puts A then B around an en dash', () => {
  expect(scoreLine(testSetup(), { A: { total: 13 }, B: { total: 0 } })).toBe('You 13 – 0 Opponent');
});
test('gameStatus', () => {
  expect(gameStatus(null)).toBe('');
  expect(gameStatus({ ...stateAt({ round: 2, turn: 1, phase: 'movement' }), ended: null })).toBe('Round 2');
  expect(gameStatus({ ...stateAt(null), ended: endEvent })).toBe('Finished');
});
```

```tsx
// TableHome.test.tsx (renders /table inside TestProviders + ToastProvider, games seeded with createTableGame)
test('a row is one link with the mission, the score, the status and when it was played', async () => {
  const link = await screen.findByRole('link', { name: /Cleanse the Land/ });
  expect(link).toHaveTextContent('You 0 – 0 Opponent');
  expect(link).toHaveTextContent('Round 1');
  expect(link).toHaveTextContent(/just now/);
  expect(link).toHaveAttribute('href', `/table/${id}`);
  expect(screen.queryByText('Resume')).toBeNull(); // the old pill is gone
});
test('Delete removes the game and Undo brings it back', async () => {
  await u.click(screen.getByRole('button', { name: 'Actions for Cleanse the Land' }));
  await u.click(screen.getByRole('menuitem', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByRole('link', { name: /Cleanse the Land/ })).toBeNull());
  expect(screen.getByRole('status')).toHaveTextContent('Game deleted');
  await u.click(screen.getByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('link', { name: /Cleanse the Land/ })).toHaveTextContent('You 0 – 0 Opponent');
  expect((await repo.getDoc<TableGameData>(id))!.data.events).toHaveLength(1);
});
test('a finished game says Finished', async () => { /* seed with an end event */ expect(link).toHaveTextContent('Finished'); });
test('empty state', async () => expect(await screen.findByText('No games yet. Start one when you sit down to play.')).toBeVisible());
test('the header is the top-level page header with New game', async () => {
  expect(await screen.findByRole('heading', { level: 1, name: 'Table companion' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'New game' })).toHaveAttribute('href', '/table/new');
  expect(screen.queryByRole('link', { name: /^Back/ })).toBeNull();
});
```

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/gameRow src/table/TableHome`. Expected: FAIL, with `scoreLine` and `gameStatus` not exported and the menu missing.

- [ ] **Step 3: Implement.**
  - `gameRow.ts`: as in Interfaces.
  - `deleteTableGame` in `tableStore.ts`: as in Interfaces.
  - `TableHome`:
    - `<PageHeader variant="top" title="Table companion" subtitle="Run a real game from one phone: phases, CP, VP, the mission and stratagems." actions={<Link className="btn btn--primary" to="/table/new">New game</Link>} />`;
    - each row is `<li className="game-row">`, holding a `<Link className="game-row__main">` (`<strong className="game-row__title">` mission name, `<span>` `scoreLine`, `<span className="muted">` `${gameStatus} · ${relativeTime(g.updatedAt)}`) and a `<Menu label={`Actions for ${missionName}`} items={[{ label: s?.ended ? 'View' : 'Resume', to: `/table/${g.id}` }, { label: 'Delete', danger: true, onSelect }]} />`;
    - `onSelect` awaits `deleteTableGame`, then calls `show({ message: 'Game deleted', action: { label: 'Undo', onAction: restore } })`.
  - CSS: `.game-row` is a flex row; `.game-row__main` gets `flex: 1; min-width: 0; display: grid; gap: 2px`; `.game-row__title` gets `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.

- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command plus `npm test -w @recruit/web -- src/table/tableStore`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/table/gameRow.ts apps/web/src/table/gameRow.test.ts apps/web/src/table/TableHome.tsx apps/web/src/table/TableHome.test.tsx apps/web/src/table/tableStore.ts apps/web/src/table/tableStore.test.tsx apps/web/src/table/table.css
git commit -m "feat(table): saved games as clean rows with a menu; delete with undo"
```

---

### Task 2: Game screen frame — header, sticky scoreboard, End the game in the menu

**Files:**
- Modify: `apps/web/src/table/GamePage.tsx`, `apps/web/src/table/GamePage.test.tsx`, `apps/web/src/table/SummaryPage.tsx`, `apps/web/src/table/SummaryPage.test.tsx`, `apps/web/src/table/table.css`

**Interfaces:**
- Consumes: `PageHeader`, `Menu`, `Sheet` (Plan A).
- Produces:
  - `GamePage` renders `<div className="game__top">` holding `<PageHeader back={{ to: '/table', label: 'Table games' }} title={mission.name} subtitle={pack.name} actions={…} />` and `<Scoreboard>`.
  - `actions` holds a `<Menu label="Game actions">`. For a live game it has the item `End the game…` (danger). For an ended game it has `See the summary` and `Undo the end`.
  - `EndGameSheet({ setup, pos, append, onEnded, onClose })` (a file-local component) is a `<Sheet kind="sheet" title="End the game">` with the same three choices as before and the concede sub-step.

- [ ] **Step 1: Write the failing tests** in `GamePage.test.tsx`:

```tsx
test('the game has a header with Back to Table games and the mission name', async () => {
  renderGame(await seed(testSetup()));
  expect(await screen.findByRole('heading', { level: 1, name: 'Cleanse the Land' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Back to Table games' })).toHaveAttribute('href', '/table');
});
test('End the game lives in the menu and asks once', async () => {
  const u = userEvent.setup();
  renderGame(await seed(testSetup()));
  expect(screen.queryByRole('button', { name: 'End the game' })).toBeNull();
  await u.click(await screen.findByRole('button', { name: 'Game actions' }));
  await u.click(screen.getByRole('menuitem', { name: 'End the game…' }));
  const sheet = screen.getByRole('dialog', { name: 'End the game' });
  await u.click(within(sheet).getByRole('button', { name: 'We agreed to stop early' }));
  expect(await screen.findByText('Summary page')).toBeVisible();
});
test('a player concedes from the sheet', async () => { /* … 'A player concedes' → 'Opponent concedes' → end event { reason: 'concede', concededBy: 'B' } */ });
test('an ended game offers Undo the end from the menu', async () => {
  /* seed with an end event; menu → 'Undo the end' → the paragraph 'This game is over.' goes */
});
```

In `SummaryPage.test.tsx`, assert the `heading` level 1 is still the headline (`'You win, 13 to 0.'` style), that `link 'Back to Table games'` has href `/table`, and that `link 'New game'` has href `/table/new`. "Back to games" is gone.

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/GamePage src/table/SummaryPage`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `GamePage`: build the header as in Interfaces and delete the inline `EndGame` button. The "not on this device" and "mission isn't in the data" states also get the `PageHeader` (title `Game not found`).
  - `SummaryPage`: `<PageHeader back={{ to: '/table', label: 'Table games' }} title={s.headline} subtitle={`${mission.name} · ${pack.name}`} />`. The actions row becomes `View log` and `New game` (primary).
  - CSS:
    - `.game__top { position: sticky; top: 0; z-index: 6; background: var(--bg) }`;
    - `.game__top .page-head { position: static }`;
    - `.scoreboard` loses its own `position: sticky` and `top`;
    - `.scoreboard__name` keeps its ellipsis.

- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command. Expected: PASS.

- [ ] **Step 5: Update the e2e flow.** In `e2e/table.spec.ts`:
  - the old `.topbar` overlap check is replaced: after `scrollBy(0, 400)`, `.scoreboard`'s bounding box has `top >= 0` and `bottom <= 220`. In other words, the sticky header still shows it;
  - "End early" opens `Game actions` → `End the game…` → `We agreed to stop early`;
  - after the summary, click `Back to Table games`.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/table/GamePage.tsx apps/web/src/table/GamePage.test.tsx apps/web/src/table/SummaryPage.tsx apps/web/src/table/SummaryPage.test.tsx apps/web/src/table/table.css apps/web/e2e/table.spec.ts
git commit -m "feat(table): game and summary page headers; End the game moves into the menu"
```

---

### Task 3: Next phase stays enabled and says why it can't move yet (T2)

**Decision:** while a CP or score prompt is open, `Next phase` / `End turn` stays enabled. It is disabled only while a change is being saved (the existing `locked`). It carries `aria-describedby` pointing at a visible hint: **`Answer the question above first.`** Tapping it writes nothing; it moves focus to the open prompt's heading.

**Files:**
- Modify: `apps/web/src/table/TurnPanel.tsx`, `apps/web/src/table/CpPrompt.tsx`, `apps/web/src/table/ScorePrompt.tsx` (each prompt's `<h2>` gets `tabIndex={-1}`), `apps/web/src/table/GamePage.test.tsx`, `apps/web/src/table/table.css` (`.turn__hint`).

**Interfaces:**
- Consumes: none new.
- Produces: `TurnPanel` wraps the prompt in `<div ref={promptRef}>`. `onNext` returns early when `blocked`, after `promptRef.current?.querySelector('h2')?.focus()`.

- [ ] **Step 1: Write the failing tests:**

```tsx
test('Next phase stays enabled during the Warlord question, explains itself and focuses the question', async () => {
  const u = userEvent.setup();
  const id = await seed(testSetup({ missionId: 'aoo-ascension' }));
  renderGame(id, () => 2);
  const q = await screen.findByRole('region', { name: 'Command phase CP: You' });
  const next = screen.getByRole('button', { name: 'Next phase' });
  expect(next).toBeEnabled();
  expect(next).toHaveAccessibleDescription('Answer the question above first.');
  await u.click(next);
  await u.click(next);
  expect(within(q).getByRole('heading', { level: 2 })).toHaveFocus();
  expect(screen.getByText('Round 1 · Your turn · Command phase')).toBeVisible();
  expect((await doc(id)).data.events.filter((e) => e.t === 'advance')).toHaveLength(0);
});
test('with nothing to answer there is no hint', async () => {
  renderGame(await seed(testSetup(), { round: 1, turn: 1, phase: 'movement' }));
  expect(await screen.findByRole('button', { name: 'Next phase' })).not.toHaveAccessibleDescription();
});
```

The existing test "quick taps never act on a stale phase…" must keep passing unchanged: the button is still disabled while `locked`.

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/GamePage`. Expected: FAIL (the button is disabled).

- [ ] **Step 3: Implement:**
  - `disabled={locked}`;
  - when `blocked`, render `<p id={hintId} className="turn__hint">Answer the question above first.</p>` beside the buttons and set `aria-describedby={hintId}`;
  - write `onNext` as in Interfaces.

- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/table/TurnPanel.tsx apps/web/src/table/CpPrompt.tsx apps/web/src/table/ScorePrompt.tsx apps/web/src/table/GamePage.test.tsx apps/web/src/table/table.css
git commit -m "feat(table): Next phase explains what to answer first instead of going grey"
```

---

### Task 4: Stratagems default to the player's real army (T5)

**Files:**
- Create: `apps/web/src/table/armyGroups.ts`, `apps/web/src/table/armyGroups.test.ts`
- Modify: `apps/web/src/table/game.ts` (`PlayerSetup`), `apps/web/src/table/NewGamePage.tsx` (`start`), `apps/web/src/table/NewGamePage.test.tsx`, `apps/web/src/table/StratagemPanel.tsx`, `apps/web/src/table/StratagemPanel.test.tsx`, `apps/web/src/table/stratagemFilter.ts`

**Interfaces:**
- Consumes:
  - `optionDisplay` and `displayName` from `@recruit/data/roster` (Plan D), imported dynamically inside `chosenNames`;
  - `getIndex`, `getPolicy`, `getRosterScope` (`factions/dataClient`);
  - `validate` (`@recruit/data/roster`, dynamic import, as `SharePage` does);
  - `factionDisplayName` (`factions/names`).
- Produces:
  - `PlayerSetup.armyChoices?: string[]`: display names of every selection in the player's list when the game started (sub-faction, Army of Renown, detachment, units). It is absent for faction-only players and for games saved earlier.
  - `chosenNames(roster: Roster, catalogueSlug: string): Promise<string[]>`. It works out the roster's catalogue slugs locally (primary slug, then each force's catalogue slug from the index), validates, and walks `view.forces[].selections` recursively. It collects `optionDisplay(v.name).name`, deduped, in walk order.
  - `mainGroup(stratagems: StratagemOut[]): string | null` returns the most frequent group other than `CORE_GROUP`. A tie goes to the first seen.
  - `armyGroups(groups: string[], factionName: string, chosen: string[]): string[]`. A group belongs to the army when:
    - it equals `factionName`, case-insensitive; or
    - it equals a chosen name, case-insensitive; or
    - it starts with a chosen name followed by `" ("`, as in "Blitz Brigade (Specialist Detachment)".
  - `defaultGroups(all: StratagemOut[], factionName: string, chosen?: string[]): Set<string>` returns `CORE_GROUP` plus `mainGroup(all)` plus `armyGroups(all groups, factionName, chosen ?? [])`.
  - `StratagemPanel` per player: by default it shows only stratagems whose group is in `defaultGroups`. A `<button aria-pressed>` labelled **`Show all stratagems`** switches to every group and brings back the existing group chips. The `<p>` above the cards names what is shown: `Showing Core Book, Necrons and Novokh stratagems.`

- [ ] **Step 1: Write the failing tests:**

```ts
// armyGroups.test.ts — real data via stubGeneratedData()
test('mainGroup is the most frequent non-core group', async () => {
  expect(mainGroup((await getCatalogue('necrons')).stratagems)).toBe('Necrons');
  expect(mainGroup((await getCatalogue('imperium-adeptus-astartes-ultramarines')).stratagems)).toBe('Adeptus Astartes');
});
test('armyGroups matches the faction, chosen names and "(Specialist Detachment)" groups', () => {
  const groups = ['Necrons', 'Novokh', 'Szarekhan', 'Annihilation Legion', 'Blitz Brigade (Specialist Detachment)'];
  expect(armyGroups(groups, 'Necrons', ['Novokh', 'Blitz Brigade'])).toEqual(['Necrons', 'Novokh', 'Blitz Brigade (Specialist Detachment)']);
  expect(armyGroups(groups, 'Necrons', [])).toEqual(['Necrons']);
});
test('chosenNames of a Novokh list includes Novokh', async () => {
  // necronsListData + applyPicks(scope, r, dynasty choice, Novokh option) as in lists/__fixtures__
  expect(await chosenNames(list.roster, 'necrons')).toEqual(expect.arrayContaining(['Novokh']));
});
```

```tsx
// StratagemPanel.test.tsx — Harness gains an `armyChoices` prop for player A (Necrons) at { round: 1, turn: 1, phase: 'shooting' }
test("a Novokh army sees its own and core stratagems, not other dynasties'", async () => {
  render(<Harness pos={shooting} armyChoices={['Novokh']} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  expect(within(mine).getByRole('heading', { name: 'Command Re-roll' })).toBeVisible();
  expect(within(mine).queryByRole('heading', { name: 'Methodical Destruction' })).toBeNull();   // Sautekh
  expect(within(mine).queryByRole('heading', { name: 'Hyperdense Particle Beams' })).toBeNull(); // Cult of the Cryptek
  await u.click(within(mine).getByRole('button', { name: 'Show all stratagems' }));
  expect(within(mine).getByRole('heading', { name: 'Methodical Destruction' })).toBeVisible();
});
test('a game saved before armyChoices existed shows the main group and core only', async () => {
  render(<Harness pos={shooting} />);
  const mine = await screen.findByRole('region', { name: 'You (your turn)' });
  expect(within(mine).getByText('Showing Core Book and Necrons stratagems.')).toBeVisible();
});
```

The existing test "a group chip narrows the faction stratagems" turns on `Show all stratagems` first. In `NewGamePage.test.tsx`, "start creates a game and navigates" also asserts that the list side's `armyChoices` is a non-empty array of strings, and that `armyChoices` is undefined for the faction-only side. The 'Novokh' content is pinned by the `chosenNames` test above.

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/armyGroups src/table/StratagemPanel src/table/NewGamePage`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Put the `armyGroups.ts` functions in place as in Interfaces.
  - `NewGamePage.start` awaits `chosenNames` for each list side, inside try/catch. On failure it logs `console.warn` and omits the field.
  - `StratagemPanel` loads `factionDisplayName(catalogue.name)` for each player's catalogue, which it already has from `getCatalogue`.
  - `stratagemsFor` gains a `groups?: Set<string>` parameter in place of `group?: string`. A chip choice becomes a one-item set plus `CORE_GROUP`.

- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command plus `npm test -w @recruit/web -- src/table/stratagemFilter`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/table/armyGroups.ts apps/web/src/table/armyGroups.test.ts apps/web/src/table/game.ts apps/web/src/table/NewGamePage.tsx apps/web/src/table/NewGamePage.test.tsx apps/web/src/table/StratagemPanel.tsx apps/web/src/table/StratagemPanel.test.tsx apps/web/src/table/stratagemFilter.ts apps/web/src/table/stratagemFilter.test.ts
git commit -m "feat(table): stratagems default to your army's faction, sub-faction and detachments"
```

---

### Task 5: New game wizard — header, list cards for armies, missions and maps that explain themselves (T7, T8)

**Files:**
- Create: `apps/web/src/table/MapLegend.tsx`
- Modify: `apps/web/src/table/NewGamePage.tsx`, `apps/web/src/table/NewGamePage.test.tsx`, `apps/web/src/table/MissionMap.tsx`, `apps/web/src/table/MissionMap.test.tsx`, `apps/web/src/table/TurnPanel.tsx` (the mission card passes `players`), `apps/web/src/table/table.css`

**Interfaces:**
- Consumes: `PageHeader`, `FactionBadge`, `relativeTime` (Plan A); `useLists` (`lists/listStore`, read only).
- Produces:
  - `MapLegend({ players }: { players?: Record<PlayerKey, string> })` renders a `<ul className="map-legend" aria-label="Map key">` with four items: a zone swatch per player (`You (Player A) deploys here` when names are known, else `Player A deployment zone`), `Objective marker`, and `Dashed line: mission area` (only when the map has areas, so it takes `hasAreas: boolean` too).
  - `MissionMap` renders `<figure>` holding the svg and `<MapLegend>` (`legend?: boolean`, default `true`).
  - Wizard armies step:
    - a list side shows `<div role="radiogroup" aria-label="List">` of `<label className="list-pick">` cards;
    - each card holds a radio input, `FactionBadge`, the list name, `${faction} · ${size} · ${points} / ${limit} pts`, the status (`Ready` or `n to fix`) and `Edited ${relativeTime(l.updatedAt)}`;
    - the faction select stays for "Just pick a faction".
  - Mission rows: `<span><strong>{m.roll}</strong> {m.name}</span><span className="muted">Primary: {m.primary.name}</span>`.
  - Header: `<PageHeader back={{ to: '/table', label: 'Table games' }} title="New game" subtitle={`Step ${step + 1} of 6: ${STEPS[step]}`} />`.

- [ ] **Step 1: Write the failing tests:**

```tsx
// MissionMap.test.tsx
test('the key names each zone owner and the objectives', () => {
  render(<MissionMap map={mission('aoo-desperate-raid').map} players={{ A: 'You', B: 'Opponent' }} />);
  const key = screen.getByRole('list', { name: 'Map key' });
  expect(within(key).getByText('You (Player A) deploys here')).toBeVisible();
  expect(within(key).getByText('Opponent (Player B) deploys here')).toBeVisible();
  expect(within(key).getByText('Objective marker')).toBeVisible();
  expect(within(key).queryByText(/mission area/)).toBeNull();
});
test('maps with named areas explain the dashed line', () => {
  render(<MissionMap map={mission('cb-pathway-to-glory').map} />);
  expect(screen.getByText('Dashed line: mission area')).toBeVisible();
});

// NewGamePage.test.tsx
test('the armies step shows your lists as cards with faction, points and when they were edited', async () => {
  // createList(necronsListData()) first; go to step 3
  const yours = screen.getByRole('group', { name: 'Your army' });
  await u.click(within(yours).getByRole('radio', { name: 'Use one of my lists' }));
  const card = within(yours).getByRole('radio', { name: /Necrons Strike Force/ });
  expect(card.closest('label')).toHaveTextContent(/Necrons · Strike Force · [\d,]+ \/ 2,000 pts/);
  expect(card.closest('label')).toHaveTextContent(/Edited just now/);
  await u.click(card);
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled(); // after the opponent picks a faction
});
test('mission rows name the primary objective', async () => {
  expect(screen.getByRole('button', { name: /11 Cleanse the Land/ })).toHaveTextContent(/Primary: /);
});
test('the wizard has Back to Table games', async () => {
  expect(screen.getByRole('link', { name: 'Back to Table games' })).toHaveAttribute('href', '/table');
});
```

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/MissionMap src/table/NewGamePage`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces. Swatch colours reuse `.map-zone--A` and `.map-zone--B` fills through small `<svg aria-hidden="true">` squares, so the key always matches the map.

- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command. Expected: PASS.

- [ ] **Step 5: Update the e2e flow.** In `e2e/table.spec.ts`, replace `selectOption({ index: 1 })` with `yours.getByRole('radio', { name: /Necrons Incursion/ }).check()`.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/table/MapLegend.tsx apps/web/src/table/MissionMap.tsx apps/web/src/table/MissionMap.test.tsx apps/web/src/table/NewGamePage.tsx apps/web/src/table/NewGamePage.test.tsx apps/web/src/table/TurnPanel.tsx apps/web/src/table/table.css apps/web/e2e/table.spec.ts
git commit -m "feat(table): new-game header, list cards for armies, primary on mission rows, a map key"
```

---

### Task 6: Secondaries you can read before you pick them (T6)

**Files:**
- Create: `apps/web/src/table/SecondaryText.tsx`
- Modify: `apps/web/src/table/NewGamePage.tsx`, `apps/web/src/table/NewGamePage.test.tsx`, `apps/web/src/table/table.css`

**Interfaces:**
- Consumes: `InfoButton` (Plan A); `RulesText` (`rules/RulesText`, read only).
- Produces:
  - `SecondaryText({ s }: { s: SecondaryOut & { note?: string } })` renders `<p className="muted">{category} · {TYPE[type]}</p>`, the note as `<p className="note">`, then `<RulesText …>`. Task 7 reuses it, so `TYPE` moves here from `ScoreSheet.tsx` as `export const SECONDARY_TYPE`.
  - Each choice is a `.secondary-pick` row: the existing `chip` toggle (unchanged accessible name and `aria-pressed`, so the e2e "Assassination pressed" assertion still holds), then `<InfoButton label={`About ${x.name}`} title={x.name}><SecondaryText s={x} /></InfoButton>`.
  - Chosen secondaries become a `<ul aria-label={`${name}'s secondaries`}>` of cards. Each card shows the name, category · type, and the same `InfoButton`. They replace the `<details className="secondary-text">` blocks.

- [ ] **Step 1: Write the failing tests:**

```tsx
test('each secondary has an info button with how it scores', async () => {
  // reach the secondaries step
  await u.click(screen.getAllByRole('button', { name: 'About Grind Them Down' })[0]);
  const sheet = screen.getByRole('dialog', { name: 'Grind Them Down' });
  expect(within(sheet).getByText(/Purge the Enemy · /)).toBeVisible();
});
test('chosen secondaries show as cards', async () => {
  const picks = screen.getByRole('list', { name: 'Your secondaries' });
  expect(within(picks).getAllByRole('listitem')).toHaveLength(3);
});
```

Copy rule for the chosen-list label: use `Your secondaries` when the name is `You`, else `${name}’s secondaries`, with the same `turnOf`-style switch as `Scoreboard`.

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/NewGamePage`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command. Expected: PASS. "two secondaries from one category are refused" is unchanged.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/table/SecondaryText.tsx apps/web/src/table/NewGamePage.tsx apps/web/src/table/NewGamePage.test.tsx apps/web/src/table/table.css
git commit -m "feat(table): secondaries explain how they score before and after you pick them"
```

---

### Task 7: Score sheet and odds tool that line up (T9, T10)

**Files:**
- Modify: `apps/web/src/table/ScoreSheet.tsx`, `apps/web/src/table/ScoreSheet.test.tsx`, `apps/web/src/table/OddsCalculator.tsx`, `apps/web/src/table/Stepper.tsx`, `apps/web/src/table/ToolsPanel.test.tsx`, `apps/web/src/table/table.css`

**Interfaces:**
- Consumes: `InfoButton` (Plan A); `SecondaryText` / `SECONDARY_TYPE` (Task 6).
- Produces:
  - **Score sheet:** each secondary is `<div className="score-sheet__secondary">` with two rows:
    - the name line: `<strong>` name, then `<span className="muted">` category · type, one line, ellipsis;
    - the controls line: `−`, `n / 15`, `+`, then `<InfoButton label={`How ${name} scores`} title={name}>`.

    "How it scores" `<details>` goes.
  - **Stepper:** gains `className?: string`.
  - **Odds tool:** every control (Stepper buttons group, select, text input) sits in `.odds__grid`, a two-column grid `minmax(0,1fr) 11rem`. Each control fills the 11rem column. `Stepper` inside `.odds__grid` uses `className="stepper--grid"`.

- [ ] **Step 1: Write the failing tests:**

```tsx
// ScoreSheet.test.tsx
test('a secondary is a name line over a controls line, with its scoring a tap away', async () => {
  const row = screen.getByText('Grind Them Down').closest('.score-sheet__secondary')!;
  expect(row.querySelector('.score-sheet__name')).toHaveTextContent('Grind Them Down');
  expect(within(row as HTMLElement).getByRole('button', { name: 'More VP: Grind Them Down' })).toBeVisible();
  await u.click(within(row as HTMLElement).getByRole('button', { name: 'How Grind Them Down scores' }));
  expect(screen.getByRole('dialog', { name: 'Grind Them Down' })).toBeVisible();
  expect(screen.queryByText('How it scores')).toBeNull();
});
```

The existing "secondary stepper stops at 15 shown" is unchanged. Alignment is checked in e2e (Task 10), since jsdom has no layout.

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/ScoreSheet src/table/ToolsPanel`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/table/ScoreSheet.tsx apps/web/src/table/ScoreSheet.test.tsx apps/web/src/table/OddsCalculator.tsx apps/web/src/table/Stepper.tsx apps/web/src/table/ToolsPanel.test.tsx apps/web/src/table/table.css
git commit -m "feat(table): score sheet names on their own line; odds controls in one aligned column"
```

---

### Task 8: Which players have a list to show (groundwork for the army drawer)

**Files:**
- Create: `apps/web/src/table/armyEntries.ts`, `apps/web/src/table/armyEntries.test.ts`

**Interfaces:**
- Consumes: `TableSetup` (`game.ts`).
- Produces: `armyEntries(setup: TableSetup): { player: PlayerKey; listId: string; label: string }[]`. It follows setup order (`firstTurn` first). It covers only players with a `listId`. The label is `Your army` for the name `You`, else `${name}’s army`.

- [ ] **Step 1: Write the failing tests:**

```ts
test('only players with a list, first turn first', () => {
  const setup = testSetup();
  setup.players.A.listId = 'list-1';
  expect(armyEntries(setup)).toEqual([{ player: 'A', listId: 'list-1', label: 'Your army' }]);
  setup.players.B.listId = 'list-2';
  setup.players.B.name = 'Sam';
  expect(armyEntries(setup).map((e) => e.label)).toEqual(['Your army', 'Sam’s army']);
});
test('no lists, no entries (games set up from factions only, or saved before lists were stored)', () => expect(armyEntries(testSetup())).toEqual([]));
```

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/armyEntries`. Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run the tests and make sure they pass.** Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/table/armyEntries.ts apps/web/src/table/armyEntries.test.ts
git commit -m "feat(table): work out which players' lists the game can show"
```

---

### Task 9: "Your army" opens Plan C's ArmyDrawer (T1) — runs after Plan C is merged

**Precondition:** Plan C is in `main`. Check from the worktree with `git log main --oneline -- apps/web/src/lists/play/ArmyDrawer.tsx`; it must print at least one commit. Then `git merge main` (resolve nothing in `table/`; it is this plan's), followed by `npm ci`. If the check prints nothing, stop and report that this task is waiting on Plan C. Do not stub the drawer.

**Files:**
- Modify: `apps/web/src/table/GamePage.tsx`, `apps/web/src/table/GamePage.test.tsx`, `apps/web/src/table/table.css`

**Interfaces:**
- Consumes:
  - `ArmyDrawer({ listId, onClose })` from `../lists/play/ArmyDrawer` (spec §4);
  - `armyEntries` (Task 8);
  - `IconLists` (Plan A).
- Produces:
  - The game header's `actions` gain, before the menu:
    - one entry: a `<button className="btn btn--small">` with `IconLists` and the entry's label;
    - two entries: a `<Menu label="Armies" trigger={…button "Armies"…} items={entries.map(e => ({ label: e.label, onSelect }))} />`.
  - The open drawer lives in the URL as `?army=A|B`, set with `setSearchParams` (push), so the phone's Back button closes it. `onClose` navigates back.

- [ ] **Step 1: Write the failing tests:**

```tsx
test('Your army opens the list read-only', async () => {
  const listId = await createList(createRepository(db), 'user-1', await necronsListData());
  const setup = testSetup();
  setup.players.A.listId = listId;
  renderGame(await seed(setup));
  await u.click(await screen.findByRole('button', { name: 'Your army' }));
  expect(await screen.findByRole('dialog', { name: 'Necrons Strike Force' })).toBeVisible();
  await u.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
test('a game with no list offers no army button', async () => {
  renderGame(await seed(testSetup()));
  await screen.findByRole('heading', { level: 1 });
  expect(screen.queryByRole('button', { name: /army$/ })).toBeNull();
});
test("a list deleted since the game started still opens the drawer's own message", async () => {
  const setup = testSetup();
  setup.players.A.listId = 'gone';
  renderGame(await seed(setup));
  await u.click(await screen.findByRole('button', { name: 'Your army' }));
  expect(await screen.findByText('This list isn’t on this device any more.')).toBeVisible();
});
```

(The last assertion's copy belongs to Plan C. Match the copy in the merged `ArmyDrawer` if it differs by a character, and note the change in the commit message.)

- [ ] **Step 2: Run them to make sure they fail.** Run `npm test -w @recruit/web -- src/table/GamePage`. Expected: FAIL (no army button).
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run the tests and make sure they pass.** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/table/GamePage.tsx apps/web/src/table/GamePage.test.tsx apps/web/src/table/table.css
git commit -m "feat(table): Your army opens the list's read-only army view during a game"
```

---

### Task 10: Whole-flow check on phones, including 320px and long names

**Files:**
- Modify: `apps/web/e2e/table.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: no app code.

- [ ] **Step 1: Extend the e2e flow.** Add these checks to "short tracked game" (Tasks 2 and 5 already updated its steps):
  - on the armies step, rename the opponent to `Warboss Gutrippa of the Blood Axe Kommandos` (43 characters);
  - after Start game, `checkScreen(page, testInfo, 'turn-long-name')`;
  - set the viewport to `{ width: 320, height: 700 }`, then run `checkScreen` on the turn screen and, after the summary, on the games list;
  - on the Tools → Attack odds tab, assert alignment:

```ts
const lefts = await page.locator('.odds__grid > :nth-child(2n)').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
expect(new Set(lefts).size, 'odds controls share one left edge').toBe(1);
```

  - from the games list, open the game's menu, Delete, then Undo. The row comes back with `You 13 – 0 Warboss Gutrippa…` (assert with a regex on `You 13 – 0`).
  - when the "Your army" button exists (Task 9 merged), open it and check that a dialog named `Necrons Incursion` shows, then close it.

- [ ] **Step 2: Run it.** Run `cd apps/web && CI=true npx playwright test e2e/table.spec.ts`. Expected: PASS on both projects (375×812 phone, 1280×800 desktop).

- [ ] **Step 3: Run the full set for this plan.** From the worktree root, run:
  - `npm test`;
  - `npm run typecheck`;
  - `npm run build`;
  - `npm run budgets -w @recruit/web`;
  - `CI=true npm run e2e -w @recruit/web`.

  Expected: all green. The table chunk stays under the 120 kB chunk budget, because `chosenNames` imports the roster engine dynamically.

- [ ] **Step 4: Commit.**

```bash
git add apps/web/e2e/table.spec.ts
git commit -m "test(table): phone flow at 320px, long names, aligned odds, delete and undo"
```

---

## Self-review notes (done while writing)

- **Scope coverage:** every finding in the brief has a task.
  - Page frame: Tasks 1, 2 and 5.
  - End the game in a menu: Task 2.
  - T2: Task 3.
  - T4, T11 and C6: Task 1.
  - T5: Task 4.
  - T6: Task 6.
  - T7: Task 5.
  - T8: Task 5.
  - T9 and T10: Task 7.
  - T1, the army drawer: Tasks 8 and 9.
  - N6, leaving a game: Task 2.
  - C3, delete exists everywhere: Task 1.
- **Names used across tasks:** `scoreLine`, `gameStatus`, `deleteTableGame`, `chosenNames`, `mainGroup`, `armyGroups`, `defaultGroups`, `armyEntries`, `SecondaryText`, `SECONDARY_TYPE`, `MapLegend` and `PlayerSetup.armyChoices`. Each is defined once and used with the same signature afterwards.
- **Outside this plan, noted only:** Wahapedia's T'au stratagem group name is mis-encoded (`T�au Empire`), so `armyGroups` can't match it to "T'au Empire". This is a data fix for Plan D or later. Until then, "Show all stratagems" covers it.
