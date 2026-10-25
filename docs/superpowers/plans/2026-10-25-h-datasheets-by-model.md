# Plan H: Datasheets that say which model has what

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every datasheet says which model each stat line, weapon and ability belongs to, from per-model data the build now keeps; Play mode musters each model's exact gear by entry id.

**Architecture:**
- **Data:** extraction keeps, per unit, the model kinds (their stat line, default count, default gear and abilities, by index into the unit's existing `models` / `weapons` / `abilities` lists), the unit's options, and an entry-id map from every BSData entry in the unit's tree to what it brings. Nothing is copied per model; the existing flat lists stay (plain English and the Wahapedia join keep writing into them).
- **Web:** two pure builders turn a unit (and, in a list, its `SelView`) into a datasheet model; one layout (B) renders it: a labelled stats table, a weapons table with Carried by, abilities labelled with who has them.
- **Engine:** `musterUnit` reads model profiles and weapons through the entry-id map, falling back to today's name matching only for gear labelled Unit.

**Tech Stack:** unchanged (TypeScript, React 19, Vitest, Playwright). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-datasheets-by-model-design.md` (approved 25 Oct 2026).

**Branch:** `datasheets-by-model` in worktree `L:\9th Edition\app-datasheets`, off `main` (`d073864`). Browser tests on ports `E2E_PORT=5210 E2E_PROD_PORT=5220`. Nothing merged or pushed without the owner's go-ahead.

## Global Constraints

- **Precedence:** final GW changes > BSData v9.8.0 > Wahapedia > the research library. Default loadouts come from BSData's tree (entry minimums, group `defaultSelectionEntryId`), the same rule as the list editor's `requiredChildren` (`packages/data/src/roster/edit.ts:210`).
- **Attribution is never guessed (spec §4.1, §7a):** a weapon or ability is shown against a model only when it is reachable from that model's entry in the tree. Gear on the unit itself is labelled **Unit**; "Everyone" only where `isUnitWideChoice` (`roster/emit.ts:170`) says every model takes it. No name-matching to attribute.
- **No per-model copies:** model kinds and options hold indexes into `UnitOut.models` / `.weapons` / `.abilities` / `.psychic`; the entry map holds indexes. `plain/collect.ts` keeps writing `plain` into the flat lists.
- **Budgets stay green:** catalogues ≤ 300 kB gzip (Space Wolves is 146 kB today; the plan's own ceiling is +25%, 183 kB), startup JS ≤ 150 kB, precache ≤ 3.0 MB.
- **Phone width:** at 375 × 812 every datasheet passes the existing `noSidewaysScroll` check, with no table that scrolls sideways inside the page (spec §4.2): the stats table may drop to two rows per model; the weapons table may stack Carried by under the weapon name.
- **Copy:** plain English, curly apostrophes, sentence case. Labels: `Unit`, `Everyone`, `Carried by`, `Options`, `Can also take`, `Also available`, `Models`, `Weapons`, `Abilities`, `Keywords`.
- **Nothing else changes:** points, validation and the list editor's unit editor behave as before; existing tests stay green, any changed expectation is updated with its reason in the ledger.

## Review Focus

1. **A unit whose models sit in a nested unit entry or behind a link to a group** (Cadian Command Squad's "Cadian Veterans", attachés via "Attachés and Bodyguards"): counts, default models and Play-mode mustering all include them. Pinned in Tasks 1 and 6.
2. **Same-named profiles with different ids** (two "Frag grenades" entries in one squad) and **a shared entry reached from several models**: each model still lists it; no model loses or steals a weapon. Pinned in Task 2.
3. **A unit with no model entries** (Traitor Guardsman Squad, Medusa Carriage Battery) or **gear only on the unit** (Warlocks, Wraithguard): rows labelled Unit, nothing attributed to a model. Pinned in Task 2.
4. **A saved list from before this change** (its selections reference the same BSData ids): the in-list datasheet and Play mode still work; nothing in saved data is migrated. Pinned in Tasks 5 and 6.
5. **Degrading models and multi-profile weapons** (Warlord Titan, plasma Standard/Supercharge): one stats row plus the wound-bracket strip; profiles grouped under one weapon. Pinned in Task 4.

---

### Task 1: Model kinds and correct model counts

**Files:**
- Modify: `packages/data/src/extract/units.ts` (`modelEntries`, `modelCount` / `innerCount`), `packages/data/src/model/types.ts`
- Test: `packages/data/test/unit-models.test.ts` (new), `packages/data/test/units.test.ts`

**Interfaces:**
- Produces in `model/types.ts`:
  ```ts
  /** One kind of model a unit can have (spec §3). Indexes point into the unit's own flat lists. */
  export interface ModelKindOut {
    /** BSData ids that select this model: the model entry's id, and the link's id when a link reached it. */
    entryIds: string[];
    name: string;            // the entry's name, e.g. "Cadian Veteran w/ Medi-pack"
    profile: number;         // index into UnitOut.models; -1 when the entry carries no Unit profile
    defaultCount: number;    // in the unit as the list editor adds it (0 for optional models)
    min: number;
    max: number;             // -1 = no limit
    optional?: true;         // reached only through a group whose minimum is 0 ("Can also take")
  }
  ```
  `UnitOut.modelKinds?: ModelKindOut[]`: present whenever the tree has model entries (a single-model unit has one kind); absent only when it has none.
- `minModels` / `maxModels` count nested `type="unit"` entries and entryLinks to groups.

- [ ] **Step 1: Write the failing tests** (`unit-models.test.ts`, real data via `extractUnits` on raw BSData, like `units.test.ts`):
  - Cadian Command Squad (Astra Militarum): `minModels` 5 and a default unit of 5; `maxModels` counts the optional attachés as BSData's limits allow; model kinds' names include `Cadian Commander` (default 1) and the four Veterans (default 1 each), each with `profile` pointing at the `Veteran` / `Cadian Commander` profile; `Astropath`, `Master of Ordnance`, `Officer of the Fleet`, `Ogryn Bodyguard`, `Nork Deddog` are `optional: true`, default 0.
  - Necron Warriors: one kind or two (BSData's split), default total 10, min 10, max 20.
  - Intercessor Squad: Sergeant default 1, Intercessors default 4.
  - Tempestus and Platoon Command Squads keep their current 5/5.
  - Every unit in every playable catalogue: the sum of non-optional `defaultCount` lies within `[minModels, maxModels]`; every `profile` ≥ 0 indexes `models`.
- [ ] **Step 2: Run them; check they fail** (`npx vitest run test/unit-models.test.ts` in `packages/data`).
- [ ] **Step 3: Implement.** `modelEntries` already reaches the model entries (with their link): keep their ids; compute default counts with the editor's rule (entry minimum, group default up to its max); count nested units and links to groups in `innerCount`; mark models under a min-0 group optional.
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data`. Expected: PASS. Fix collateral (model-count expectations in corpus or Wahapedia minimum points) with a ledgered reason each.
- [ ] **Step 5: Commit** `fix(data): units keep their model kinds and count nested squads`.

### Task 2: What each model carries, and the entry map

**Files:**
- Modify: `packages/data/src/extract/units.ts` (`collect`), `packages/data/src/model/types.ts`
- Test: `packages/data/test/unit-models.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** What one BSData entry brings, by index into the unit's flat lists. */
  export interface EntryGear { w?: number[]; a?: number[]; p?: number[]; m?: number }  // weapons, abilities, psychic, model profile
  ModelKindOut.weapons: number[]; ModelKindOut.abilities: number[]   // default loadout and what it grants
  UnitOut.unitGear?: { weapons: number[]; abilities: number[] }     // on the unit itself: shown as "Unit"
  UnitOut.everyone?: number[]                                       // weapons isUnitWideChoice gives every model
  UnitOut.entries?: Record<string, EntryGear>                       // every entry id in the unit's tree (link and target ids)
  ```
- Consumed by Tasks 3–6.

- [ ] **Step 1: Write the failing tests:**
  - Command Squad defaults: Commander → Laspistol, Chainsword, Frag grenades; abilities include Refractor Field and Commanding Authority. Veteran w/ Medi-pack → Lasgun, Frag grenades; abilities Medi-pack. Veteran w/ Master-Vox → Laspistol, Frag grenades; abilities Master Vox. Veteran w/ Regimental Standard → Lasgun, Frag grenades; Regimental Standard. Veteran w/ chainsword → Laspistol, Chainsword, Frag grenades (the second Frag grenades entry `5de8…`: Review Focus 2).
  - Regimental Tactics and Voice of Command are in `unitGear.abilities`, not on a model.
  - A unit with no model entries (Traitor Guardsman Squad) has `unitGear` and no model kinds; Warlocks' weapon options sit in `unitGear` or options, never on a model.
  - `entries` maps the Medi-pack option's link id and target id to the same `{ w, a }`.
  - **Reachability across every catalogue:** each index in a model kind's `weapons` / `abilities` comes from an entry walked from that model's entry; `unitGear` holds only entries walked from the unit outside any model.
  - **Size:** each generated catalogue's gzip size ≤ 125% of its size at `d073864` (recorded in the test as a table).
- [ ] **Step 2: Run them; check they fail.**
- [ ] **Step 3: Implement.** Walk each model entry with its own visited set (a shared entry is walked once per model, not once per unit), recording indexes from the unit's existing deduped lists; walk the unit's non-model children for `unitGear`; record every walked entry (link and target id) in `entries`.
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data && npm run build && npm run budgets -w @recruit/web`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(data): each model kind knows its stats, gear and abilities by entry`.

### Task 3: The unit's options

**Files:**
- Modify: `packages/data/src/extract/units.ts`, `packages/data/src/model/types.ts`
- Test: `packages/data/test/unit-models.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface UnitOptionOut {
    name: string;              // the group's name as a player reads it (optionDisplay)
    who: string[];             // model kind names it belongs to; [] = the unit
    min: number; max: number;  // -1 = no limit
    choices: { name: string; weapons: number[]; abilities: number[]; models?: number[] }[]; // models: kinds it adds
    replaces?: number[];       // weapons of the default loadout a choice replaces (the group's default entry)
  }
  UnitOut.options?: UnitOptionOut[]
  ```
  Relic and chapter extras stay `extra` and out of `options` ("Also available").
- [ ] **Step 1: Write the failing tests:** the Command Squad's attachés group appears with its five models as choices (`who` = []); an Intercessor Sergeant's weapon group lists its choices with `who` = ["Intercessor Sergeant"] and `replaces` the bolt rifle; Shock Troops' special-weapon group has `who` naming the trooper kind; every weapon index in any option is reachable from that option's group.
- [ ] **Step 2: Run them; check they fail.**
- [ ] **Step 3: Implement** from the groups and links walked in Task 2 (a group's `defaultSelectionEntryId` gives `replaces`; its constraints give min/max).
- [ ] **Step 4: Run** the data suite and budgets. Expected: PASS.
- [ ] **Step 5: Commit** `feat(data): units list their options and who can take them`.

### Task 4: Layout B: labelled stats, weapons with Carried by, abilities with who

**Files:**
- Create: `apps/web/src/ui/datasheet/sheetModel.ts` (pure), `apps/web/src/ui/datasheet/StatTable.tsx`, `apps/web/src/ui/datasheet/WeaponTable.tsx`
- Modify: `apps/web/src/ui/datasheet/DatasheetView.tsx`, `index.ts`, `apps/web/src/theme.css`
- Test: `apps/web/src/ui/datasheet/sheetModel.test.ts` (new), `DatasheetView.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface SheetModel {
    models: { label: string; count: number; profile: ProfileOut | null; gear: string[] }[];  // gear: in-list rows only
    stats: { label: string; profile: ProfileOut; track?: Bracket[] }[];   // one row per profile, "Veteran ×4"
    weapons: { weapon: ProfileOut; profiles: ProfileOut[]; count?: number; carriedBy: string }[];
    abilities: { ability: AbilityOut; who: string }[];                    // "Unit", a model name, or "Veteran with Medi-pack"
    options: UnitOptionOut[]; canAlsoTake: ModelKindOut[]; extras: (ProfileOut | AbilityOut)[];
    keywords: { unit: string[]; faction: string[]; perModel: { model: string; keywords: string[] }[] };
  }
  export function factionSheet(unit: UnitOut): SheetModel;          // the unit as added (spec §3.1)
  export function listSheet(unit: UnitOut, v: SelView): SheetModel; // from the player's selections (spec §3.2), Task 5
  ```
  `DatasheetView` props become `{ unit, sheet?: SheetModel, headingLevel?, hideName? }`; without `sheet` it uses `factionSheet(unit)`. `taken` is removed.
- [ ] **Step 1: Write the failing tests** (`sheetModel.test.ts`, real generated data via the existing fixtures helper): Command Squad stats rows `Cadian Commander ×1`, `Veteran ×4`; weapons Laspistol carried by "Commander, 2 Veterans", Lasgun "2 Veterans", Frag grenades "Everyone"; abilities Refractor Field → "Cadian Commander", Medi-pack → "Veteran with Medi-pack", Regimental Tactics → "Unit"; Warlord Titan one stats row with a track; plasma gun's Standard and Supercharge under one weapon row. `DatasheetView.test.tsx`: replace "it has no wide stats table" with "each stat row and weapon row is labelled" (role `table`, row headers named), keep the wound-track, wording-switch and keyword tests.
- [ ] **Step 2: Run them; check they fail.**
- [ ] **Step 3: Implement** `factionSheet`, the two tables (semantic `<table>` with row headers; at < 480 px the stats table wraps to two rows per model and the weapons table puts Carried by under the name, no inner scroll), and the new section order: header, Models (in-list only), Stats, Weapons, Options (closed), Psychic, Abilities, Can also take, Also available, Transport, Keywords.
- [ ] **Step 4: Run** `npm test -w @recruit/web`, then the datasheet e2e at phone width (`rules.spec.ts`, `play-mode.spec.ts`) on ports 5210/5220. Expected: PASS; update the `characteristics` group assertions in `DatasheetPage`, `UnitEditor`, `ListEditorPage`, `UnitPicker` tests and `editor.spec.ts` to the new labelled rows.
- [ ] **Step 5: Commit** `feat(web): datasheets label every stat line, weapon and ability with its model`.

### Task 5: A unit in a list, New Recruit's order

**Files:**
- Modify: `apps/web/src/ui/datasheet/sheetModel.ts` (`listSheet`), `apps/web/src/lists/DatasheetSheet.tsx`, `apps/web/src/lists/play/playArmy.ts` (`PlayUnit` carries `sheet: SheetModel`; `takenWeapons` removed), `apps/web/src/lists/play/PlaySheets.tsx`
- Test: `sheetModel.test.ts`, `apps/web/src/lists/play/playArmy.test.ts`, `ListEditorPage.test.tsx`

**Interfaces:**
- Consumes `UnitOut.entries` (Task 2): each model selection's `entryId` / `merged.target.id` → its kind; each gear selection beneath it → weapon and ability indexes; gear on the unit → "Unit".
- [ ] **Step 1: Write the failing tests:** a Command Squad added with defaults then given a plasma pistol on the Commander: Models rows `1x Cadian Commander: Chainsword, Frag grenades, Plasma pistol`, `1x Cadian Veteran w/ Medi-pack: Frag grenades, Lasgun, Medi-pack`, …; weapons only those carried, Plasma pistol ×1 carried by "Commander"; identical models grouped (`6x Shock Trooper: Frag grenades, Lasgun`); an Astropath taken shows in Models and Stats; a list saved before this change (fixture roster from the corpus) renders.
- [ ] **Step 2: Run them; check they fail.**
- [ ] **Step 3: Implement** `listSheet`; the list editor's datasheet sheet and Play mode's datasheet pass `sheet`; the picker preview and faction page keep `factionSheet`.
- [ ] **Step 4: Run** the web suite and `play-mode.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): a unit in a list shows each model with what it carries`.

### Task 6: Play mode musters each model's exact gear

**Files:**
- Modify: `packages/engine/src/data/muster.ts` (`musterUnit`, `profileFor`, `weaponsFor`), `packages/engine/test/data/muster-baseline.json`
- Test: `packages/engine/test/data/muster.test.ts`, `packages/engine/test/scenario/full-game.test.ts`

**Interfaces:**
- Consumes `UnitOut.entries`. `UnitInput.models` stays `{ profile: string; weapons: string[]; count }[]` (names of the adapter's profiles), so the engine core is unchanged.
- [ ] **Step 1: Write the failing tests:** a Command Squad musters 5 models (the Commander and the four Veterans: today the nested Veterans are dropped, Review Focus 1) with the Medi-pack Veteran holding Lasgun and Frag grenades; a Necron Warriors unit musters as before; `unmatched-model` and `unmatched-weapon` counts in the baseline go down, never up; every legal corpus list still musters.
- [ ] **Step 2: Run them; check they fail.**
- [ ] **Step 3: Implement:** walk model selections at any depth (nested unit selections included); profile from `entries[id].m`; weapons from the entries of the model's own gear plus `everyone`; name matching only for gear labelled Unit and entries missing from the map (older data).
- [ ] **Step 4: Run** `npm test -w @recruit/engine` and the full game scenarios. Expected: PASS; lower the baseline to the new counts.
- [ ] **Step 5: Commit** `fix(engine): Play mode musters each model's own gear by entry`.

### Task 7: Hand-checked units and the remaining screens

**Files:**
- Create: `packages/data/test/unit-models-checked.test.ts`
- Modify: `apps/web/src/lists/UnitPicker.tsx` (preview keeps the faction view, now via `DatasheetView` default), `apps/web/src/learn/drill/DrillCard.tsx` (no change expected; covered by tests)
- [ ] **Step 1: Write the hand-checked expectations** (default models, each one's weapons and abilities, from the BSData tree and the codex page in the research library) for ten units: Cadian Command Squad, Infantry Squad, Intercessor Squad, Necron Warriors, Lychguard, Boyz, Termagants, Crisis Battlesuits, Khorne Berserkers (World Eaters), Chaos Warlord Titan. Each expectation names its source.
- [ ] **Step 2: Run them**; any failure is a real bug, fixed test-first in the task that owns the code.
- [ ] **Step 3: Commit** `test(data): ten units' models and gear checked by hand`.

### Task 8: Full checks and review

- [ ] **Step 1:** `npm run data:build`, `npm test`, `npm run typecheck`, `npm run content:check`, `npm run build`, `npm run budgets -w @recruit/web`, `E2E_PORT=5210 E2E_PROD_PORT=5220 CI=true npm run e2e -w @recruit/web` (production suite alone, as the performance test is sensitive to load). Expected: all green.
- [ ] **Step 2:** Screenshots at 375 px of the Command Squad on its faction page, in a list, and in Play mode, for the report.
- [ ] **Step 3:** One fresh review of `git diff main...datasheets-by-model` on the most capable model against this plan's Review Focus; fix confirmed findings test-first.
- [ ] **Step 4:** Report the branch ready. Don't merge or push without the owner's go-ahead.

## Self-review

- **Spec coverage:** §2 goal 1 (all four screens): Tasks 4, 5, 7. Goal 2 (two views): Tasks 4, 5. Goal 3 (per-model data, counts): Tasks 1–3. Goal 4 (Play mode by entry): Task 6. §4 anti-goals: attribution (Tasks 2, 7), phone width (Task 4), options (Task 3), wall of rows (grouping, Task 5), Play mode (Task 6). §7a: Unit label and Everyone (Task 2), proof (Tasks 2, 7), default unit (Task 1).
- **Types:** `ModelKindOut`, `EntryGear`, `UnitOptionOut` (Tasks 1–3) are read by `sheetModel` (Tasks 4–5) and `muster` (Task 6). `DatasheetView`'s `taken` prop is replaced by `sheet` in Task 4; Task 5 updates its two callers.
- **Open assumption:** the +25% size ceiling holds; if `entries` alone breaks it, Task 2 stores target ids only and resolves link ids through the roster scope (ledgered).
