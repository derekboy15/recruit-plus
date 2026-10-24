# Plan B: Army builder overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Building a list works like the approved mockups (Your lists, List editor, Choose a dynasty, Add a unit):
- **Lists overview:** lists can be duplicated, renamed and deleted, with undo.
- **Editor header:** Back, Play, undo/redo and the list's choices as chips.
- **Role sections:** collapsible, with their own +.
- **Unit rows:** show wargear, the Warlord and problems.
- **Choices:** every choice says what it does before you pick it.
- **Units:** can be previewed before they are added.
- **Undo:** every destructive edit can be undone.

**Architecture:**
- **Data:**
  - The editor's state hook gains an undo/redo history.
  - List-level operations (duplicate, delete, restore, unique names) go in `listStore.ts`.
- **Layout:**
  - The builder moves from `lists/Panel.tsx` to Plan A's `Sheet`.
  - The army options card and the bottom "Battle size / + Add detachment" block are replaced by chips in the header strip, each opening a sheet.
- **Choices and descriptions:**
  - One `ChoiceList` component (radio or checkbox rows with a one-line effect and an ⓘ) serves the editor's army-choice sheets and the new-list wizard.
  - Descriptions come from Plan D's `loadEntryInfo` / `entryInfo` / `summaryLine`. Names come from `optionDisplay`.
- **Unit rows and the unit editor:** rows read `unitSummary`. The unit editor shows weapon profile lines from entry info (`weaponLine`) and opens datasheets in a nested sheet (`DatasheetView`), so you never leave the list.

**Tech Stack:** unchanged, with no new dependencies.

**Spec:**
- `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md` §2 ("Undo, not confirm", "Descriptions everywhere", "Display names"), §3 and §4 (all consumed by exact name), §5 (ownership) and §6.
- The mockups `Lists.dc.html`, `Main.dc.html`, `Dynasty.dc.html` and `UnitPicker.dc.html` in this session's scratchpad `redesign/project/`. Copy their layout, copy and sizes.

**Branch:** `builder-overhaul` in worktree `L:\9th Edition\app-builder`, off `main` after Plans A and D are merged. Runs alongside C, E1, E2 and E3.

## Global Constraints

- **Files B may touch:**
  - `apps/web/src/lists/*`, except `lists/play/**` and `lists/SharePage.tsx` (Plan C's);
  - `e2e/builder.spec.ts`, `e2e/editor.spec.ts` and `e2e/lists.spec.ts`;
  - `packages/data/src/roster/explain.ts` (Task 12 only; no other plan edits `packages/data` in wave 2).

  `theme.css`, `ui/*`, `layout/*`, `App.tsx` and `routes.tsx` are frozen. New CSS goes in `lists/lists.css`, imported by `ListsPage.tsx`, `ListEditorPage.tsx` and `NewListPage.tsx`.
- **Exports kept stable for Plans C, E1, E2 and E3.** Keep these signatures, and add new exports beside them:
  - `editorView.ts`: `unitsByRole`, `isArmyOption`, `isAutoManaged`, `unitName`, `fmt`, `plural`, `problemsLabel`;
  - `useRosterEditor.ts`: `slugsFor`;
  - `unitIndex.ts`: `loadUnitIndex`, `unitInfo`;
  - `newListSetup.ts`: `armyChoices`, `startingRoster`, `listData`;
  - `listStore.ts`: `createList`, `useLists`, `ListData`;
  - `ExportSheet.tsx`: `CopyButton`.
- **Labels other plans' tests use (spec §5) stay as they are:**
  - wizard: `New list`, `Next`, `Back`, `Decide later`, `Create list`, and the faction rows' names;
  - editor: the `role="meter"` named `Points`.
- **The production-suite specs** (`e2e-prod/a11y.spec.ts`, `offline.spec.ts` and `harness.spec.ts`) drive the builder. Update them where they use labels this plan changes (`+ Add unit` becomes `Add unit`). Only Plan B edits them in wave 2.
- **Undo toasts:** 6 s, with the action labelled `Undo` (A's default).
- **Sizes and width:** touch targets are at least 44px. There is no horizontal scroll at 320px or 375px on `/build`, `/build/new` or `/build/:id` with any sheet open.
- **Names:** every option, choice and unit name on screen goes through `optionDisplay` or `unitName`. No `<Custom>`, `[LEGENDS]`, `Warlord Trait (…):` or `Stratagem:` prefix appears.
- **Descriptions:** the plain text is shown when `useWording().wording === 'plain'` and plain exists, otherwise the official text. An official text shown while plain is chosen is labelled `Official wording` (`rules-text__label`, as `RulesText` does).
- **The Play link:** points to `/build/:id/play`. Plan C adds that route; until C merges, the link lands on Plan A's Page not found, which is acceptable inside the wave.

## Review Focus

1. **Undoing a delete after the deletion has synced:** restoring re-saves the document with a newer `updatedAt`, so last-write-wins brings it back on every device. Pinned in Task 2 (the restore sets `deleted: false` and a newer `updatedAt`).
2. **The toast's Undo after a further edit:** a removed unit's toast Undo, pressed after another change, must not undo that other change. Pinned in Task 1 (version guard) and Task 7.
3. **An army choice whose info file failed to load,** or an option with no info: it shows its name with no summary and no ⓘ, never "undefined" or an empty sheet. Pinned in Task 6.
4. **A list with an allied detachment:** rows, sections and the + per role stay per detachment. The Play and status chips count across the whole army. Pinned in Task 7 (two-detachment fixture).
5. **Typing a list name:** each keystroke must not create an undo step. Renames merge into one history entry until another kind of edit happens or a second passes. Pinned in Task 1.

---

### Task 1: Undo and redo in the editor

**Files:**
- Create: `apps/web/src/lists/history.ts`, `apps/web/src/lists/history.test.ts`
- Modify: `apps/web/src/lists/useRosterEditor.ts`, `apps/web/src/lists/useRosterEditor.test.tsx`

**Interfaces:**
- Produces (pure), in `history.ts`:
  - `interface History { past: Roster[]; present: Roster; future: Roster[]; lastKind: string | null; lastAt: number }`
  - `push(h: History, next: Roster, kind: string, at: number): History`: caps `past` at 50. A `rename` within 1000 ms of the previous `rename` replaces `present` without pushing.
  - `undo(h)`, `redo(h)`, `canUndo(h)`, `canRedo(h)`
- Produces, on `ReadyEditor`: `undo(): void`, `redo(): void`, `canUndo: boolean`, `canRedo: boolean`, and `version: number`, which goes up by one on every committed change, undo and redo included.
- Keyboard: `useEditorShortcuts(editor)` binds Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z and Ctrl+Y (redo). It ignores events whose target is an `input`, `textarea`, `select` or `[contenteditable]`.

- [ ] **Step 1: Write the failing tests.** In `history.test.ts`:
  - `push`, then `undo`, then `redo` returns to the pushed roster;
  - past is capped at 50;
  - three `rename` pushes 200 ms apart make one undo step;
  - a rename after 1200 ms is a new step;
  - a `remove` after a rename is a new step;
  - pushing after an undo clears `future`.

  In `useRosterEditor.test.tsx`:
  - dispatch `add-unit` then `undo()`: the roster equals the original, `canRedo` is true, and the undo is saved after the 600 ms debounce;
  - `version` increments on dispatch, undo and redo.
- [ ] **Step 2: Run them and check they fail.** Run: `npm test -w @recruit/web -- history useRosterEditor`.
- [ ] **Step 3: Implement.** `commit(next, kind)` pushes onto history. `undo`/`redo` set the roster through the same save path. `useEditorShortcuts` lives in `history.ts` or a sibling file.
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(builder): undo and redo for list edits`.

### Task 2: Duplicate, delete with undo, and unique names

**Files:**
- Modify: `apps/web/src/lists/listStore.ts`, `apps/web/src/lists/listStore.test.tsx`, `apps/web/src/lists/newListSetup.ts` (`defaultListName` gains uniqueness)

**Interfaces:**
- Produces:
  - `uniqueListName(base: string, taken: string[]): string`. Examples: `'Necrons Combat Patrol'` with one taken gives `'Necrons Combat Patrol 2'`; with `…`, `… 2` and `… 3` taken, it gives `… 4`.
  - `duplicateList(repo: Repository, ownerId: string, id: string, taken: string[]): Promise<string>`. The new id holds the same data with `roster.name = uniqueListName(`${name} (copy)`, taken)`, and `isPublic: false`.
  - `deleteList(repo, id): Promise<Doc<ListData>>` returns the doc as it was, for undo.
  - `restoreList(repo, doc: Doc<ListData>): Promise<void>` saves it again with a fresh `updatedAt`. It is not `deleted` and keeps its `isPublic`.

- [ ] **Step 1: Write the failing tests** for each example above, plus:
  - delete then restore: `listDocs` contains it again, `deleted === false`, and the `updatedAt` is later than the deletion's;
  - a duplicate is private even when the original is shared.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement**, using `repo.saveDoc` and `repo.deleteDoc`.
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(builder): duplicate, delete and restore lists; unique default names`.

### Task 3: Your lists

**Files:**
- Create: `apps/web/src/lists/lists.css`, `apps/web/src/lists/RenameSheet.tsx`
- Modify: `apps/web/src/lists/ListsPage.tsx`, `apps/web/src/lists/ListsPage.test.tsx`, `apps/web/e2e/lists.spec.ts`

**Interfaces:**
- Consumes: `PageHeader`, `Menu`, `useToast`, `FactionBadge`, `relativeTime` and `IconPlus` (A); Task 2's functions.
- Produces: `RenameSheet({ name, onSave, onClose }: { name: string; onSave: (name: string) => void; onClose: () => void })`. It is a `Sheet` titled `Rename list`, with an input labelled `List name` and a `Save` button. Saving an empty or whitespace name is refused with `Give the list a name.`
- **Page copy** (exact):
  - Header: `PageHeader variant="top" title="Your lists"`, with the action `New list` (a primary link to `/build/new`).
  - Card: the `FactionBadge`, the name, then `${faction} · ${size} · ${pts} / ${limit} pts`, then a status line.
  - Status: `Ready` (`--ok`, `IconCheck`) or `${n} to fix` (`--warn`, `IconWarning`), followed by ` · Edited ${relativeTime(updatedAt)}`.
  - Menu: labelled `Actions for ${name}`, with the items `Play` (to `/build/:id/play`), `Edit` (to `/build/:id`), `Duplicate`, `Rename`, `Export or share` (to `/build/:id?export=1`) and `Delete` (danger).
- **Toasts:**
  - Delete: `Deleted “${name}”` with Undo, which runs `restoreList`.
  - Duplicate: `Duplicated as “${newName}”`.
- **Search:** shown only with 6 or more lists, labelled `Search your lists`, and matching name or faction. With no matches it says `No lists match “${q}”.`.

- [ ] **Step 1: Write the failing tests.** In `ListsPage.test.tsx`, with three seeded lists:
  - the cards show `Necrons · Incursion · 885 / 1,000 pts` and `Edited` text;
  - the menu shows the six items;
  - Delete removes the card and shows the toast, and Undo brings it back;
  - Duplicate adds `Necrons Combat Patrol (copy)`;
  - Rename to `Novokh Incursion` updates the card;
  - an empty rename shows `Give the list a name.`

  In `lists.spec.ts` (phone and desktop):
  - delete with undo;
  - duplicate;
  - no horizontal scroll at 320px.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement** to the Lists artboard. Cards are `<li>`, each holding a `<Link>` (the whole card except the menu) and the `Menu`.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- ListsPage listStore` and `CI=true npx playwright test -c apps/web/playwright.config.ts lists`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(builder): Your lists with crests, edited times and a ⋯ menu`.

### Task 4: The builder moves onto Sheet, with a wider side panel

**Files:**
- Delete: `apps/web/src/lists/Panel.tsx`
- Modify:
  - `UnitPicker.tsx`, `UnitEditor.tsx`, `IssuesPanel.tsx`, `ExportSheet.tsx` (use `Sheet`)
  - `ListEditorPage.tsx` (the main column is `max-width: 760px`; at 768px and up the sheets are Plan A's 480px drawer; Problems is `Sheet inline` on wide screens)
  - `lists.css`, `ListEditorPage.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (A).
- Panels keep their URL params (`?unit=`, `?add=`, `?issues=1`, `?export=1`, `?share=1`). Phone Back still closes them.

- [ ] **Step 1: Update the tests.** The existing `ListEditorPage.test.tsx` panel tests look sheets up by `getByRole('dialog', { name: 'Add a unit' })` and close with `getByRole('button', { name: 'Close' })`. The unit editor closes with `Done`, which keeps `closeLabel="Done"`. Add: at 1280px the Problems region is visible beside the list, with no dialog.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** Swap `Panel` for `Sheet` with the same `kind`s. Remove `.backdrop` usage, since `Sheet` draws its own.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- lists`. Expected: PASS.
- [ ] **Step 5: Commit** with `refactor(builder): panels become sheets; a 480px side drawer on desktop`.

### Task 5: The editor header and summary strip

**Files:**
- Modify:
  - `apps/web/src/lists/EditorHeader.tsx` (rewritten), `ListEditorPage.tsx`
  - `Detachments.tsx` (`ArmySetup` is replaced by `DetachmentSheet` and `SizeSheet`)
  - `lists.css`, `ListEditorPage.test.tsx`
- Create: `apps/web/src/lists/SummarySheets.tsx` (`SizeSheet`, `DetachmentSheet`)

**Interfaces:**
- Consumes: `PageHeader`, `Menu`, `IconUndo`, `IconRedo`, `IconPlay` and `useToast` (A); Task 1 (`undo`, `redo`, `canUndo`, `canRedo`); Task 2 (`duplicateList`, `deleteList`); `RenameSheet` (Task 3).
- Produces:
  - `EditorHeader({ editor, listId, onOpen }: { editor: ReadyEditor; listId: string; onOpen: (p: Record<string, string>) => void })`.
  - It renders `PageHeader` with:
    - back `{ to: '/build', label: 'Your lists' }`;
    - the title `roster.name.trim() || UNTITLED_LIST`;
    - the subtitle `${faction} · ${size.name}`.
  - The actions, in order:
    - icon buttons `Undo` and `Redo`, disabled when they can't act;
    - `Menu label="List actions"` with `Rename`, `Duplicate list`, `Export`, `Share link` and `Delete list` (danger: it deletes, navigates to `/build` and shows the Task 3 toast with Undo);
    - a primary `Play` link to `/build/${listId}/play`.
  - Below the header, the summary strip:
    - the points meter (keep the `role="meter"` attributes and `aria-valuetext`);
    - `${remaining} pts left`, or `${over} pts over` in `--danger-text`;
    - a `.chip-row` of: army-choice chips (Task 6), the size chip `${size.name} · ${fmt(points)} pts` (opens `SizeSheet`), the detachment chip (the single detachment's name via `stripCpSuffix`, or `${n} detachments`; opens `DetachmentSheet`) and the status chip (`All checks pass`, or `${n} to fix`; opens `?issues=1`).
- `SizeSheet`: the battle sizes as radio rows with their points. Choosing one dispatches `battle-size` and closes.
- `DetachmentSheet`: each detachment with `Remove` (behind the existing two-step confirm), then `Add detachment`, which lists `detachmentChoices` as `ArmySetup` did (allies grouped by faction).

- [ ] **Step 1: Write the failing tests.**
  - The header has `Back to Your lists`, the h1 list name, the subtitle `Necrons · Incursion` and a `Play` link to `/build/<id>/play`.
  - Undo is disabled on load. After adding a unit it is enabled, and pressing it removes the unit.
  - `List actions`, then `Delete list`, navigates to `/build` and shows `Deleted “…”` with Undo.
  - The size chip opens `Battle size`, and choosing Strike Force updates the meter to `/ 2,000 pts`.
  - The status chip reads `All checks pass` for a legal list and `2 to fix` for the invalid fixture.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement** to the Main artboard.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- ListEditorPage`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(builder): editor header with Back, Play and undo; size, detachment and status chips`.

### Task 6: Army choices with descriptions

**Files:**
- Create: `apps/web/src/lists/ChoiceList.tsx`, `apps/web/src/lists/ChoiceList.test.tsx`, `apps/web/src/lists/ArmyChoiceSheet.tsx`, `apps/web/src/lists/useEntryInfo.ts`
- Modify: `apps/web/src/lists/ArmyOptions.tsx` (becomes `ArmyChoiceChips` plus the toggles list inside a sheet), `EditorHeader.tsx` (renders the chips), `lists.css`

**Interfaces:**
- Consumes:
  - from D: `loadEntryInfo`, `entryInfo`, `summaryLine` and `optionDisplay`;
  - from A: `InfoButton`, `Sheet` and `useWording`;
  - from elsewhere: `RulesText` (rules/, read-only use).
- Produces:
  - `useEntryInfo(slugs: string[]): EntryInfoIndex | null` (memoised per slugs).
  - `ChoiceList` props:

    ```ts
    ChoiceList(props: {
      name: string;                       // radio group name
      legend: string;                     // fieldset legend (visually hidden in sheets)
      multi: boolean;                     // checkboxes (Pick 2) vs radios
      options: { id: string; label: string; summary: string | null; info: EntryInfo | undefined }[];
      selected: string[];
      noneOption?: boolean;               // shows "None" first (optional groups)
      onPick(id: string | null): void;    // null = None
      disabledIds?: string[];
    }): JSX.Element
    ```

  - Each row is a radio or checkbox `<label>` (44px or more) with the name in 600 weight and the summary under it (`--text-soft`, 13px). Next to it sits an `InfoButton` (`label={`About ${label}`}`, `title={label}`) whose sheet shows every rule and ability profile in `info` through `RulesText`, plus weapon profiles through `WeaponCard`. The selected row has a `--brass` border.
  - Option labels come from `optionDisplay(o.name).name`.
  - `ArmyChoiceSheet({ choice, roster, … })`: a `Sheet kind="full"` titled `Choose: ${choice.title}` (e.g. `Choose: Dynasty`), with intro copy from the choice's own entry info `summaryLine` when there is one, then `ChoiceList`, and a footer button `Done`.
  - Chips: for each `ArmyChoice`, `${cleanTitle}: ${current}`, where `cleanTitle` drops trailing `Choice`/`Selection` (`Dynasty Choice` becomes `Dynasty`). A required choice that is still empty reads `${cleanTitle}: choose` in `.status--warn` style.
  - The remaining toggles (`ArmyOptions`' checkbox options, e.g. `Stratagem: …` upgrades) move into a chip `More options`, which opens a sheet listing them as `ChoiceList multi` with descriptions.

- [ ] **Step 1: Write the failing tests.** With the Necrons fixture and a stubbed info file for Novokh:
  - The `Dynasty: Novokh` chip opens `Choose: Dynasty`.
  - The Novokh row shows the summary `+1 to charge rolls.` (or the official first sentence when no plain exists, under `Official wording`).
  - `About Novokh` opens a sheet with `Awakened By Murder`.
  - Picking Szarekhan dispatches `army-choice` and the chip updates.
  - An option with no info shows no ⓘ and no summary.
  - An optional group (Army of Renown) shows `None`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement** to the Dynasty artboard.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- ChoiceList ListEditorPage`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(builder): army choices as chips; each option says what it does`.

### Task 7: Role sections and unit rows

**Files:**
- Create: `apps/web/src/lists/UnitRow.tsx`, `apps/web/src/lists/RoleSection.tsx`, and tests for each
- Modify: `Detachments.tsx` (`DetachmentSection` uses them), `editorView.ts` (`article(role)`, `roleTotals(group)`), `lists.css`

**Interfaces:**
- Consumes: `unitSummary` (D); `Menu`, `useToast` and `IconWarlord`/`IconWarning`/`IconPlus`/`IconExpand` (A); Task 1 (`version`, `undo`).
- Produces:
  - `article(role: string): 'a' | 'an'` (`HQ` and `Elites` take `an`, everything else `a`).
  - `roleTotals(units: SelView[]): { count: number; points: number }`.
  - `RoleSection({ role, units, collapsed, onToggle, onAdd, children })`: an `<h2>` with a `<button aria-expanded>` (`IconExpand` rotates), the `role` in `.label-caps`, `${count} unit(s) · ${pts} pts`, and an icon `+` button labelled `Add ${article(role)} ${role} unit` that opens the picker with `role=` set. Collapsed state is kept per list in `sessionStorage` (`builder:collapsed:${listId}`), with try/catch.
  - `UnitRow({ v, issues, onOpen, onDuplicate, onRemove, onDatasheet })`. The row shows:
    - the name, plus ` · ${models}` when more than one model;
    - `summary.gear.join(' · ')`, at most 2 lines with clamp;
    - when `warlord`, `IconWarlord` + `Warlord`, plus ` · ${traits[0]}` when there is a trait;
    - `relics.join(' · ')`, behind a relic marker (`Relic:` prefix in the muted line);
    - when it has issues, `IconWarning` + the first sentence of `explain(issue).text` in `--warn`;
    - the points on the right.
  - The row's `Menu label={`Options for ${name}`}` has `Duplicate`, `Remove` and `View datasheet`.
    - `Remove` shows `Removed ${name}` with an Undo that calls `undo()` only if `version` still equals the one captured after the removal. Otherwise it shows `Can’t undo that now: the list has changed since. Use Undo at the top.`
    - `Duplicate` shows `Duplicated ${name}` with the same guard.
- Several detachments: the detachment name heads each group of sections. With one detachment there is no detachment heading.
- **The `Add unit` bar** (Main artboard):
  - **Phones:** a bar fixed above the tab bar holds `Add unit` (`IconPlus`, secondary style, full width). It opens the picker for the first detachment, or with several detachments a small sheet `Add to which detachment?` listing them. An icon button `Export or share this list` sits beside it and opens `?export=1`.
  - **768px and up:** each detachment ends with an `Add unit` button instead.
  - The old `+ Add unit` text is gone.

- [ ] **Step 1: Write the failing tests.**
  - The Overlord row reads `Warlord · Blood-Fuelled Fury` (fixture with trait).
  - The Immortals row reads `5x Gauss Blaster`.
  - Collapsing HQ hides its rows and keeps the header count `2 units · 160 pts`.
  - `Add an HQ unit` opens the picker filtered to HQ.
  - Remove then Undo restores the unit.
  - Remove, another edit, then Undo shows the "Can’t undo that now" message and leaves the other edit in place.
  - The two-detachment fixture shows both detachment headings, each with its own sections.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement** to the Main artboard.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- UnitRow RoleSection ListEditorPage`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(builder): collapsible role sections; rows show wargear, Warlord and problems`.

### Task 8: Add a unit, with a preview

**Files:**
- Modify: `apps/web/src/lists/UnitPicker.tsx` (rewritten), `ListEditorPage.tsx` (`role` param), `lists.css`
- Test: `apps/web/src/lists/UnitPicker.test.tsx` (new)

**Interfaces:**
- Consumes: `Sheet`, `DatasheetView`, `keyStats`, `sizeLabel` and `IconPlus` (A); `UnitIndex` and `unitInfo` (existing).
- Produces: `UnitPicker(props)`, which keeps the current props and adds `role?: string` (the initially selected chip).
  - A `Sheet kind="full"` titled `Add a unit` holds:
    - a search box labelled `Search units`, with placeholder `Search ${faction} units`;
    - a `.chip-row` of `<button aria-pressed>` chips: `All`, then each role present as `${role} ${count}`.
  - Each row is a button that opens the preview. It shows the name with Legends/FW badges, `${sizeLabel} · M${M} T${T} W${W} Sv${Sv}`, and `from ${points}` (aria `from ${points} points`), plus an icon button `Add ${name}` that adds and opens the unit editor, as now.
  - The preview is a `Sheet kind="sheet"` titled with the unit name, holding `DatasheetView headingLevel={2} hideName`, with the footer button `Add to list · ${points} pts`.
  - Unavailable units: catalogue units in `unitIndex` for this faction that `availableUnits` doesn't return are listed after the rest under `Not available with this army’s current choices`, with the note `Changing your dynasty, detachment or Army of Renown may make these available.`. They show no add button, but their preview opens.

- [ ] **Step 1: Write the failing tests.**
  - The Elites chip filters to Elites and shows `Elites 15`-style counts from the fixture.
  - Tapping `Skorpekh Destroyers` opens a dialog named `Skorpekh Destroyers` with the stat grid, and `Add to list · 90 pts` adds it.
  - `Add Lychguard` adds without a preview.
  - A unit hidden by the dynasty (Imotekh, in a Szarekhan fixture) is listed under `Not available…`.
  - The `only` filter ("Units that fix this problem" plus `Show all units`) still works.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement** to the UnitPicker artboard.
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(builder): unit picker with role filters, key stats and a datasheet preview`.

### Task 9: The unit editor explains its options

**Files:**
- Modify: `apps/web/src/lists/UnitEditor.tsx`, `apps/web/src/lists/OptionControls.tsx`, `lists.css`
- Test: `apps/web/src/lists/UnitEditor.test.tsx` (new)

**Interfaces:**
- Consumes: `optionDisplay`, `entryInfo` and `summaryLine` (D); `weaponLine`, `DatasheetView`, `InfoButton`, `Sheet` and `useToast` (A); `useEntryInfo` (Task 6).
- Produces: `OptionCtx` gains `info: EntryInfoIndex | null`.
  - Every option name uses `optionDisplay(name).name`.
  - Options whose `heading` repeats within a group are listed under that heading in `.label-caps`, e.g. `Warlord trait · Novokh` and `Relic · Szarekhan`.
  - Under each option name:
    - with a Weapon profile in its info: `weaponLine(profile)`, and one line per profile for multi-profile weapons;
    - otherwise with a rule or ability text: `summaryLine(info, wording)` plus an `InfoButton` labelled `About ${name}`.
  - **Requisition hint:** when the unit holds `Warlord`, the battle size is Arks of Omen (`BATTLE_SIZES[size].mode === 'aoo'`) and no Warlord trait is chosen, a note under the Warlord option reads exactly `In Arks of Omen games your Warlord only gets a Warlord trait if you pay 1 CP for it. Tick Warlord trait (1 CP) below to choose one.` (spec §4).
  - **Datasheet:** `View datasheet` opens a nested `Sheet kind="full"` titled with the unit's name, holding `DatasheetView headingLevel={2} hideName`, with `taken` set to `unitSummary(v).gear` names without counts. Closing it returns to the unit editor and never leaves `/build/:id`.
  - **Toasts:** `Duplicate unit` shows `Duplicated ${name}` (with the Task 7 guard) and keeps the editor open on the original. `Remove unit` closes and shows `Removed ${name}` with Undo.

- [ ] **Step 1: Write the failing tests.**
  - The Overlord's weapon options show `18" · Assault 3 · S5 · AP -2 · D1` under Staff of Light (from the info fixture).
  - `Warlord Trait (Novokh): Blood-Fuelled Fury` is shown as `Blood-Fuelled Fury` under `Warlord trait · Novokh`.
  - At Strike Force, Warlord taken and no trait chosen: the requisition note is shown.
  - At Combat Patrol, no note.
  - `View datasheet` opens a dialog named `Overlord`, and the URL path is unchanged.
  - Remove, then the toast's Undo, brings the unit back.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w @recruit/web -- UnitEditor lists`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(builder): options show profiles and effects; datasheets open in place`.

### Task 10: The new-list wizard

**Files:**
- Modify: `apps/web/src/lists/NewListPage.tsx`, `apps/web/src/lists/newListSetup.ts` (`sizeCards` copy, `detachmentCards` adds `summary`), `NewListPage.test.tsx`, `apps/web/e2e/builder.spec.ts`

**Interfaces:**
- Consumes: `PageHeader` (A); `ChoiceList` and `useEntryInfo` (Task 6); `uniqueListName` (Task 2).
- Produces:
  - The header: `PageHeader title="New list" back={{ to: '/build', label: 'Your lists' }} subtitle={`Step ${n} of 4: ${STEPS[step]}`}`.
  - `SizeCard` gains `recommended: boolean`, true only for `combat-patrol`. Descriptions (exact):
    - `combat-patrol`: `500 points. Small and quick to play: the best way to learn.`
    - `incursion`: `1,000 points. Arks of Omen rules: one main detachment.`
    - `strike-force`: `2,000 points. The usual size for most games and events. Arks of Omen rules.`
    - `onslaught`: `3,000 points. Very large games. Core Book rules: up to ${n} detachments.`

    The recommended card shows the tag `Recommended for your first games`.
  - `DetachmentCard` gains `summary: string | null`, the `summaryLine` of the force's own info when there is one.
  - Step 4 uses `ChoiceList`, with `noneOption` for optional groups (L7). There are no pre-selected defaults unless the data forces one (L8): a default the data forces is labelled `(set by your choices)`.
  - The default list name uses `uniqueListName` against the player's lists.
  - `Decide later` creates the list with only the picks already made (L7).

- [ ] **Step 1: Write the failing tests.**
  - The Combat Patrol card shows `Recommended for your first games`.
  - The Dynasty step rows show summaries and `About Novokh`.
  - An Army of Renown choice can go back to `None`.
  - A second Necrons Combat Patrol list is named `Necrons Combat Patrol 2`.
  - In `builder.spec.ts`, the wizard flow still creates a list and lands in the editor with the new header.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w @recruit/web -- NewListPage newListSetup` and `CI=true npx playwright test -c apps/web/playwright.config.ts builder`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(builder): wizard explains sizes, detachments and choices; unique names`.

### Task 11: Export and share sheets

**Files:**
- Modify: `apps/web/src/lists/ExportSheet.tsx`, `ExportSheet.test.tsx`, `lists.css`

**Interfaces:**
- Keeps: `CopyButton` exactly as it is now (Plan C imports it).
- Produces:
  - **Export:** the text wraps (`white-space: pre-wrap`, no sideways scroll). Buttons: `Copy`, `Download .txt`, and `Share…` only when `navigator.share` exists; it shares `{ title: roster name, text }`.
  - **Share sheet:** keeps the link and its switch. It adds `Share…` through `navigator.share({ title, url })` when available. The copy names the screen correctly: `Turn sharing off here at any time.` (C8).

- [ ] **Step 1: Write the failing tests.**
  - With `navigator.share` stubbed, `Share…` calls it with the list's text.
  - Without it, there is no `Share…` button.
  - The export `textarea` has no horizontal overflow at 320px (e2e, in `editor.spec.ts`).
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(builder): export wraps on phones; native share when available`.

### Task 12: Problems: what to fix vs what to choose, naming the unit

**Files:**
- Modify: `apps/web/src/lists/IssuesPanel.tsx`, `packages/data/src/roster/explain.ts`, `packages/data/test/roster-explain.test.ts`, `apps/web/src/lists/ListEditorPage.test.tsx`

**Interfaces:**
- Produces:
  - `IssueList` groups issues under `Choices to make` (`option-required`, `warlord-missing`) and `Must fix` (all other rules), in that order.
  - Each item is styled by group: choices use the `--surface-2` card with a `--brass` edge; must-fix uses `--bad-bg`.
  - `explain()`'s remove fix label names the unit: `Remove ${unitName}`, not `Remove 1`.
  - The open-fix label is dropped when the choice is already on screen (`shownUnitId`, existing). In the editor the army-choice open fix becomes `Choose ${cleanTitle}`, which opens the Task 6 sheet.

- [ ] **Step 1: Write the failing tests.**
  - `roster-explain.test.ts`: the rule-of-three remove fix label is `Remove Doomsday Ark`.
  - `ListEditorPage.test.tsx`: the invalid fixture shows the `Choices to make` and `Must fix` headings with their issues under them.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w @recruit/data -- roster-explain` and `npm test -w @recruit/web -- lists`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(builder): problems grouped into choices and fixes; fixes name the unit`.

### Task 13: Flows, phone width and review

**Files:**
- Modify: `apps/web/e2e/editor.spec.ts`, `apps/web/e2e/builder.spec.ts`

- [ ] **Step 1:** Add e2e flows (phone and desktop):
  - open a list, Back to Your lists;
  - add a unit through the preview;
  - remove it and Undo;
  - Ctrl+Z on desktop;
  - choose a dynasty from the chip;
  - open and close a datasheet in place (the URL stays `/build/:id`);
  - no horizontal scroll at 320px with the picker, a unit editor and the Problems sheet open;
  - the Export sheet's Copy and the Share sheet's link switch. These checks move here from `share.spec.ts`, which Plan C rewrites to seed its list instead.

  Update `e2e-prod/a11y.spec.ts`, `offline.spec.ts` and `harness.spec.ts` for the changed labels. The a11y pass covers the new editor states: the picker preview, an army-choice sheet, a list's ⋯ menu.
- [ ] **Step 2:** Run the whole suite: `npm test`, `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web` and `CI=true npm run e2e -w @recruit/web`. Expected: all green, and axe clean.
- [ ] **Step 3:** Check the four builder screens by eye against their artboards in the dev server at 375×812 and at desktop width. Fix the differences.
- [ ] **Step 4:** Ask for one fresh review of `git diff main...builder-overhaul` on the most capable model, against the spec and this plan's Review Focus. Fix the confirmed findings test-first, and re-run Step 2.
- [ ] **Step 5:** Report the branch ready to merge (first in wave 2). Don't merge or push without the owner's go-ahead.

## Self-review

- **Owner's complaints:**
  - can't delete a list: Tasks 2 and 3;
  - can't see what doctrines do: Tasks 6 and 10;
  - can't see a unit before adding it: Task 8;
  - tabs and roles cluttered: Tasks 7 and 8;
  - no back buttons: Tasks 5 and 10;
  - Play mode entry: Task 5 (the button; Plan C builds the page).
- **Audit coverage:** L1–L5, L7–L14, L16–L22, L26 and C9. L15 is the requisition note (Task 9). L23 and L24 (partly) are Task 11. L25 is Plan C. L6, the Astra Militarum two-doctrine question, is covered by `ChoiceList multi` when the data says so; this plan doesn't change the data.
- **Types:**
  - `ReadyEditor` gains `undo`, `redo`, `canUndo`, `canRedo` and `version` (Task 1), and Tasks 5, 7 and 9 consume them.
  - `ChoiceList` (Task 6) is consumed by Tasks 6 and 10. `useEntryInfo` (Task 6) is consumed by Tasks 9 and 10.
  - `UnitPicker` gains `role` (Task 8), which `RoleSection`'s + passes (Task 7).
- **Review Focus:** all five are pinned (Tasks 2, 1/7, 6, 7 and 1).
- **Proportion:** copy, signatures and assertions only. There are no component bodies.
