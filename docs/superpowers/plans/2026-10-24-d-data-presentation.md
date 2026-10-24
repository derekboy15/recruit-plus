# Plan D: Data presentation layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The data tells the app what every army-building option is and does, and no raw data name or markup reaches a player. This plan delivers four things:
- **Rule and profile text** for every option (dynasties, Warlord traits, relics, wargear, stratagem upgrades), taken from BattleScribe's own data, which the build currently drops.
- **Display names** for option names, so data names like "Warlord Trait (Codex 2): …" never reach a player.
- **Fixes for five data faults** the audit found.
- **Clean rules text,** with no backticks.

**Architecture:**
- **Info files:** a new build step, `src/info/`, walks every BattleScribe file (catalogues, libraries and the `.gst`). For each `upgrade` selection entry, selection entry group and entry link, it collects the profiles and rules that entry carries or links to, with infoLinks and infoGroups resolved across the file's scope. It writes `generated/info/<slug>.json` (spec §4 `InfoFile`).
- **Plain English:** where an authored plain text already exists for the same official text (the plain store's `textKey`), it is attached. Texts without one are listed in `generated/info-plain-report.json` for Plan F. They are not added to the M8 "no missing plain English" coverage check.
- **Web side:** `apps/web/src/data/entryInfo.ts` loads a list's info files, and the service worker caches them at runtime like catalogues.
- **Display names:** `optionDisplay()` joins the roster engine's name helpers in `roster/names.ts`.
- **Fault fixes:** each fault is fixed at its root cause, test-first, following superpowers:systematic-debugging. The suspected causes below come from the raw data and must be confirmed before fixing.

**Tech Stack:** unchanged (Node 24, TypeScript 7, Vitest 5). There are no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md` §2 ("Descriptions everywhere", "Display names"), §4 (contracts, `extra` flags, bug list) and §6.

**Branch:** `data-presentation` in worktree `L:\9th Edition\app-data`, off `main` after `auth-passwords` is merged in. Runs alongside Plan A. This plan touches only:
- `packages/data/**`;
- `apps/web/src/data/` (new);
- `apps/web/src/factions/dataClient.ts` (one getter);
- `apps/web/src/sw.ts` (one runtime route);
- `apps/web/scripts/budgets.mjs` (one budget).

## Global Constraints

- **Source precedence (original design §4):** final GW changes, then BSData v9.8.0, then Wahapedia, then the research library. A correction goes in `packages/data/overrides/` with a `source` note, never as a hand edit of generated files.
- **Files and budget:** info files are `{ schema: 1, slug, entries }`, keyed by BSData entry id. Each is at most 150 kB gzip (new `infoGzip` budget). `entries` hold only `upgrade` entries, selection entry groups and entry links that carry their own info. They never hold `unit` or `model` entries: datasheets already cover those.
- **Plain English:** a plain text is attached only when `checkPlain(official, plain).ok`, exactly as `applyPlain` does.
- **Existing checks stay:** the M8 plain-English coverage stays at its current numbers. `test/plain-coverage.test.ts` must not start counting info texts.
- **Shape:** `optionDisplay(name)` returns `{ name, heading, legends }`. It never returns an empty `name`; it falls back to `displayName(bsName)`.
- **Regenerate before testing:** `npm run data:build` must succeed. Tests that read `generated/` run after it.

## Review Focus

1. **An option whose infoLink target is in another file** (a library, or the `.gst`'s shared rules), for example Space Marines chapter relics reached through the Ultramarines catalogue. Its info must resolve, not come back empty. Pinned in Task 2 with Ultramarines.
2. **A name with two prefixes or none:** "Stratagem: Relic", "Relic (Szarekhan): The Sovereign Coronal", "Gauss Blaster". None loses its meaning, and none comes back empty. Pinned in Task 1.
3. **The same rule text linked from many entries** (Living Metal on every Necron vehicle). It is stored once per entry, but the gzip size stays within budget. Pinned by the budget check in Task 3.
4. **A list whose ally catalogue's info file fails to load:** `loadEntryInfo` still returns what did load, and `entryInfo` returns `undefined` for the rest. It never rejects the whole editor. Pinned in Task 3.
5. **Export counts for a squad where only the sergeant takes a weapon:** it stays "1x", and only unit-wide choices multiply. Pinned in Task 6.

---

### Task 1: `optionDisplay`: display names and headings for option names

**Files:**
- Modify: `packages/data/src/roster/names.ts`, `packages/data/src/roster/index.ts` (export)
- Create: `packages/data/scripts/option-prefixes.ts` (survey, run once; output committed as a test fixture)
- Test: `packages/data/test/roster-names.test.ts`, `packages/data/test/fixtures/option-prefixes.json`

**Interfaces:**
- Produces: `interface OptionDisplay { name: string; heading: string | null; legends: boolean }` and `optionDisplay(bsName: string): OptionDisplay`, exported from `@recruit/data/roster`.

- [ ] **Step 1: Survey.** Write `scripts/option-prefixes.ts`. It reads every `generated/roster/*.json` and collects every distinct `^([^:]+):\s` prefix and `(…)` qualifier on `upgrade` entry names, with counts and three examples each. It writes `test/fixtures/option-prefixes.json`. Run it: `npx tsx packages/data/scripts/option-prefixes.ts`. Read the output and decide a rule for every prefix with 5 or more uses. Note the decisions in the test file's header comment.

- [ ] **Step 2: Write the failing tests.** The exact expectations, extended with one case per surveyed prefix:

```ts
test.each([
  ['Warlord Trait (Novokh): Blood-Fuelled Fury', { name: 'Blood-Fuelled Fury', heading: 'Warlord trait · Novokh', legends: false }],
  ['Warlord Trait (Codex 2): Eternal Madness', { name: 'Eternal Madness', heading: 'Warlord trait · Codex', legends: false }],
  ['Relic (Szarekhan): The Sovereign Coronal', { name: 'The Sovereign Coronal', heading: 'Relic · Szarekhan', legends: false }],
  ['Dynasty: Novokh', { name: 'Novokh', heading: 'Dynasty', legends: false }],
  ['Dynasty: <Custom>', { name: 'Custom dynasty', heading: 'Dynasty', legends: false }],
  ['Stratagem: Warlord Trait', { name: 'Warlord trait', heading: 'Stratagem', legends: false }],
  ['Stratagem: Relic', { name: 'Relic', heading: 'Stratagem', legends: false }],
  ['Stratagem: Dynastic Heirlooms', { name: 'Dynastic Heirlooms', heading: 'Stratagem', legends: false }],
  ['Renegades & Heretics [LEGENDS]', { name: 'Renegades & Heretics', heading: null, legends: true }],
  ['Gauss Blaster', { name: 'Gauss Blaster', heading: null, legends: false }],
  ['**Chapter Selection**', { name: 'Chapter Selection', heading: null, legends: false }],
])('%s', (input, expected) => expect(optionDisplay(input)).toEqual(expected));
test('every surveyed prefix with 5+ uses keeps a non-empty name', () => {
  for (const p of fixture.prefixes.filter((x) => x.count >= 5)) for (const ex of p.examples) expect(optionDisplay(ex).name.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run the tests and check they fail.** Run: `npm test -w @recruit/data -- roster-names`. Expected: FAIL with `optionDisplay is not a function`.
- [ ] **Step 4: Implement** `optionDisplay` with a table of prefix rules: `{ re, heading: (m) => string, name?: (m) => string }`. Placeholders `<Custom>` become `Custom <noun>`, where the noun is the prefix lower-cased. `[LEGENDS]` / `[Legends]` becomes `legends: true` and is stripped. The rest goes through `displayName`.
- [ ] **Step 5: Run the tests and check they pass.**
- [ ] **Step 6: Commit** with `feat(data): optionDisplay — player names and headings for BattleScribe option names`.

### Task 2: Info files: every option's profiles and rules

**Files:**
- Create: `packages/data/src/info/extract.ts`, `packages/data/src/info/index.ts`
- Modify:
  - `packages/data/src/model/types.ts` (`InfoProfile`, `InfoRule`, `EntryInfo`, `InfoFile`)
  - `packages/data/src/build.ts` (write `generated/info/<slug>.json` for every roster slug, including `system`; write `generated/info-plain-report.json`)
  - `packages/data/package.json` `exports` (types only, if needed)
- Test: `packages/data/test/info.test.ts` (unit tests on `test/fixtures/mini` plus real-data checks after `data:build`)

**Interfaces:**
- Produces (spec §4):
  - `emitInfoFile(gd: GameData, file: RawCatalogue, slug: string): InfoFile` covers one file. It resolves infoLinks (`type="profile" | "rule" | "infoGroup"`) through `buildIdIndex(catalogueScope(gd, file.id))`, the same index `extractUnits` uses.
  - `attachInfoPlain(files: InfoFile[], store: PlainStore): InfoPlainReport` sets `plain` on rules and on profile text characteristics where the store has an entry for `textKey(official)` that passes `checkPlain`. It returns `{ total, written, missing: { slug, entryId, name }[] }`.
- **What is included:**
  - **Profiles:** a profile's `type` is its `typeName` ("Weapon", "Abilities", "Wargear", "Psychic Power", "Warlord Trait"…), and `chars` are its characteristics.
  - **Rules:** a rule's `text` is its `<description>`.
  - **Entries:** entries are included when the info is non-empty, for `upgrade` entries, selection entry groups and entry links with their own `infoLinks`/`profiles`/`rules`. Hidden status is ignored; the roster engine decides visibility.

- [ ] **Step 1: Write the failing tests**

```ts
// after data:build, reading generated/info/necrons.json
test('Novokh (Dynasty: Novokh, 9c06-82d0-11f1-04da) carries Awakened By Murder', () => {
  const novokh = info('necrons').entries['9c06-82d0-11f1-04da'];
  expect(novokh.profiles?.map((p) => p.name)).toContain('Awakened By Murder');
  expect(JSON.stringify(novokh)).toMatch(/charge roll/i);
});
test('Relic Gauss Blaster (3cfe-2ba4-da94-0050) has its weapon profile', () => {
  const w = info('necrons').entries['3cfe-2ba4-da94-0050'].profiles!.find((p) => p.type === 'Weapon')!;
  expect(w.chars).toMatchObject({ Range: expect.stringMatching(/"/), S: expect.any(String), AP: expect.any(String) });
});
test('a chapter relic reached through the Space Marines library resolves for Ultramarines', () => {
  // pick the Ultramarines relic entry id from the survey; its profile or rule text is non-empty
});
test('no unit or model entries are included', () => { /* every key in every info file resolves to an upgrade, group or link */ });
test('every info file is within 150 kB gzip', () => { /* gzipSync(readFileSync(f)).length <= 150_000 for each generated/info/*.json */ });
test('info texts are not part of plain-English coverage', () => { /* plain-report.json totals equal the pre-change totals pinned in this test */ });
```

Add a unit test on `test/fixtures/mini`:
- an infoLink to a `sharedRules` rule in a linked library resolves;
- an `infoGroup`'s profiles are flattened.

- [ ] **Step 2: Run the tests and check they fail.** Run: `npm run data:build && npm test -w @recruit/data -- info`. Expected: FAIL. `generated/info` doesn't exist.
- [ ] **Step 3: Implement.**
  - Walk `rootEntries`, `shared`, `sharedSelectionEntryGroups` and nested children.
  - Collect each entry's own `profiles` and `rules` plus resolved `infoLinks`.
  - Keep only the characteristics with non-empty text.
  - Before writing, run `rmSync` on `generated/info` and recreate it.
  - Log `Info: N files, M entries, P of T texts in plain English (see generated/info-plain-report.json)`.
- [ ] **Step 4: Run the tests and check they pass.** Also run `npm test -w @recruit/data` (all of it). Expected: PASS, and `plain-coverage` unchanged.
- [ ] **Step 5: Commit** with `feat(data): info files — every option's profiles and rules from BattleScribe`.

### Task 3: Load info in the app

**Files:**
- Create: `apps/web/src/data/entryInfo.ts`, `apps/web/src/data/entryInfo.test.ts`
- Modify:
  - `apps/web/src/factions/dataClient.ts` (`export const getInfoFile = (slug: string) => getJson<InfoFile>(`/data/info/${slug}.json`)`)
  - `apps/web/src/sw.ts` (the runtime caching route for `/data/catalogues/` also matches `/data/info/`)
  - `apps/web/scripts/budgets.mjs` (`infoGzip: 150 * kB` and `each('info', /^data\/info\//, BUDGETS.infoGzip)`)
  - `apps/web/scripts/check-budgets.test.ts`

**Interfaces:**
- Produces exactly per spec §4:
  - `EntryInfoIndex`;
  - `loadEntryInfo(catalogueSlugs)`: the union of the slugs' `rosterScope` from `getIndex()`, plus `'system'`, each fetched once. A file that fails to load is skipped with `console.warn`, and the promise resolves with what loaded;
  - `entryInfo(scope, index, entryId)`: the link's own info followed by its target's (`resolve(scope, node).target.id`), with profiles and rules concatenated, else `undefined`;
  - `summaryLine(info, wording)`.

- [ ] **Step 1: Write the failing tests**

```ts
test('entryInfo follows a link to its target and merges both', async () => { /* stub fetch with a two-file fixture; expect profiles from link then target */ });
test('a file that fails to load is skipped', async () => { /* one fetch 404s; loadEntryInfo resolves; entryInfo for its ids is undefined */ });
test('summaryLine: first sentence of the first rule, plain when chosen and present', () => {
  const info = { rules: [{ name: 'Awakened by Murder', text: 'Add 1 to charge rolls. In a turn…', plain: '+1 to charge rolls. More.' }] };
  expect(summaryLine(info, 'plain')).toBe('+1 to charge rolls.');
  expect(summaryLine(info, 'official')).toBe('Add 1 to charge rolls.');
});
test('summaryLine falls back to an Abilities/Description profile, then null', () => { /* profile chars { Description: 'X. Y.' } → 'X.'; weapons-only info → null */ });
test('summaryLine caps at 160 characters with an ellipsis', () => { /* 300-char sentence → ends with '…' and length <= 160 */ });
// check-budgets.test.ts: an info file of 151 kB gzip FAILs, 149 kB is ok
```

- [ ] **Step 2: Run the tests and check they fail.**
- [ ] **Step 3: Implement.** A sentence ends at the first `. `, `! ` or `? ` not inside `"…"`, else at the end of the text.
- [ ] **Step 4: Run them and check they pass.** Then run `npm run build && npm run budgets -w @recruit/web`. Expected: `largest info (data/info/…) … ≤ 150.0 kB`.
- [ ] **Step 5: Commit** with `feat(web): load option info for a list; cache it offline; budget it`.

### Task 4: Datasheet weapons: Royal Warden, and relics flagged `extra`

**Suspected root cause, to confirm first:** `extract/units.ts`'s `SKIP_GROUP` (`^(…|relics?|…)\b`) is tested against entry link names as well as group names. So the Royal Warden's own "Relic Gauss Blaster" entry link (BSData `6de6-8e31-8111-5153`) is skipped. Meanwhile relic weapons inside groups whose names don't start with "Relic" ("Artefacts of the Aeons", chapter relic groups) are listed as the unit's own (R2).

**Files:**
- Modify: `packages/data/src/extract/units.ts`, `packages/data/src/model/types.ts` (`ProfileOut.extra?: true`, `AbilityOut.extra?: true`)
- Test: `packages/data/test/units.test.ts`

**Interfaces:**
- Produces: `extra: true` on weapons and abilities that come from list-building extras (relic, warlord-trait, stratagem, chapter-tactic or Army-of-Renown groups and entries), as spec §4 says.

- [ ] **Step 1: Reproduce.** Add a test asserting `necrons` Royal Warden `weapons.map(w => w.name)` contains `'Relic Gauss Blaster'` without `extra`. Run it: FAIL, `[]`. Add a temporary log in the walk to confirm which skip fires, then remove it.
- [ ] **Step 2: Write the failing tests for the flags.**
  - The Ultramarines Intercessor Squad has `Bolt Rifle` without `extra`, and every weapon whose name is in the Space Marines relic groups (from the survey in Step 3) with `extra: true`.
  - Necron Warriors' Gauss Flayer and Gauss Reaper are without `extra`.
  - The Overlord's `Voidreaper` (a Necron relic) has `extra: true`.
- [ ] **Step 3: Decide the rule from the data.**
  - List the group and entry names on the path to each weapon across five catalogues: Necrons, Ultramarines, Orks, Astra Militarum and Chaos Space Marines.
  - Express the rule as a name pattern on the enclosing groups and entries, not on the weapon's own name. Starting point: `/^(relics?|artefacts?|heirlooms?|treasures?|warlord traits?|stratagems?|chapter|vanguard|army of renown|requisition)/i` on any ancestor between the unit and the weapon, plus entries whose name starts `Relic (`.
  - Write the rule and its evidence as the comment above `SKIP_GROUP`.
- [ ] **Step 4: Implement.**
  - Apply `SKIP_GROUP` only to groups.
  - Mark profiles and abilities found under an "extra" ancestor with `extra: true` instead of skipping them.
  - Crusade and Battle Honours are still skipped.
- [ ] **Step 5: Run** `npm run data:build && npm test -w @recruit/data`. Expected: PASS. In `units.test.ts`, the "every playable catalogue" checks still pass.
- [ ] **Step 6: Commit** with `fix(data): units keep their own relic-named wargear; relics and options are flagged extra`.

### Task 5: Faction pages and the builder show the same points (C1)

**Suspected root cause, to confirm first:**
- `join/wahapedia.ts:182` sets `UnitOut.points` from Wahapedia's `Cost` (snapshot 2023-06-26);
- the builder charges BSData costs plus `overrides/costs.json`.

So the Catacomb Command Barge reads 145 on its faction page and 150 in the builder, and Orikan has no Wahapedia cost.

**Files:**
- Modify: `packages/data/src/build.ts`, `packages/data/src/join/wahapedia.ts`
- Create: `generated/points-report.json` (build output)
- Test: `packages/data/test/build.test.ts` (or `points.test.ts`)

**Interfaces:**
- Produces: `UnitOut.points` is the price the roster engine charges for the unit's minimum legal configuration, computed by `availableUnits(scope, roster, forceSelId)` on a scratch Strike Force roster for the catalogue. A unit the scratch roster can't price keeps the Wahapedia cost, and the report flags it.
- Produces: `points-report.json`: `{ slug, unit, engine, wahapedia }[]` for every disagreement, for review.

- [ ] **Step 1: Write the failing tests.**
  - `necrons` Catacomb Command Barge `points` equals the builder's picker price, read with the same `availableUnits` call in the test.
  - Orikan the Diviner `points` is not null.
  - Every unit in every catalogue that the picker can price agrees with the picker.
- [ ] **Step 2: Run them and check they fail** with 145 vs 150.
- [ ] **Step 3: Implement.** After the roster files are emitted in `buildAll`, build each catalogue's scope and price its units. Write the report. Print a summary line: `Points: N units priced by the engine, M differ from Wahapedia (see generated/points-report.json)`.
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data`, then check that `points-report.json` has the Catacomb Command Barge (150 vs 145). Expected: PASS.
- [ ] **Step 5: Commit** with `fix(data): faction pages show the builder's points; report Wahapedia disagreements`.

### Task 6: Export counts for unit-wide weapon choices (C2)

**Suspected root cause, to confirm first:** BSData models one weapon choice for a whole unit as a unit-level group ("Unit Weapon Choice", min = max = 1: Immortals `e306-eeaf-a28e-6c78`, Lychguard `ccb2-7c93-b6f6-70ab`). `exportText.ts` `aggregate()` therefore counts its single selection as "1x" for the whole unit.

**Files:**
- Modify: `packages/data/src/roster/exportText.ts`
- Test: `packages/data/test/roster-export.test.ts`

**Interfaces:**
- Produces: `unitExport(v)` prints a unit-wide choice as `${models}x ${name}`. A unit-wide choice is an upgrade that is a direct child of a unit with more than one model and is chosen in a group whose min and max are both 1 and whose options all carry a Weapon or Wargear profile. Everything else is unchanged.
- Produces: `unitSummary(v: SelView): UnitSummary` (spec §4), exported from `@recruit/data/roster`, built on the same walk as `aggregate`, with every name through `optionDisplay`:
  - **`traits`:** names whose heading starts with `Warlord trait`;
  - **`relics`:** names whose heading starts with `Relic`;
  - **`warlord`:** true when the unit holds a `Warlord` selection;
  - **`gear`:** the export's `${n}x ${name}` lines. A single item reads just its name ("Staff of Light"), and a unit-wide choice gets the model count;
  - **`other`:** the remaining chosen upgrades, except the Requisition stratagem entries ("Stratagem: Warlord Trait", "Stratagem: Relic"), which the trait or relic already shows.

  Plans B and C read it for list rows and Play mode.

- [ ] **Step 1: Write the failing tests**

```ts
test('Immortals (5 models) with their unit weapon choice export 5x Gauss Blaster', () => {
  expect(unitExport(immortals5).details).toContain('5x Gauss Blaster');
});
test('Lychguard (5) with warscythes export 5x Warscythe', () => { /* … */ });
test('a sergeant-only weapon in a squad stays 1x', () => { /* Ultramarines Intercessor Squad: the sergeant's chainsword (or whatever the fixture has) is 1x */ });
test('a one-model character keeps 1x', () => { /* Overlord with a Staff of Light → '1x Staff of Light' */ });
test('unitSummary: a Novokh Overlord Warlord with Blood-Fuelled Fury and the Blood Scythe', () => {
  const s = unitSummary(overlordWarlord); // built with the roster engine at strike-force with both Requisitions taken
  expect(s).toMatchObject({ warlord: true, traits: ['Blood-Fuelled Fury'], relics: ['Blood Scythe'], other: [] });
  expect(s.gear.join(' ')).not.toMatch(/Blood Scythe|Warlord Trait|Stratagem/); // relics aren't repeated as gear; requisitions aren't shown
});
test('unitSummary: Immortals gear is per model', () => expect(unitSummary(immortals5).gear).toEqual(['5x Gauss Blaster']));
```

- [ ] **Step 2: Run them and check they fail** (`1x Gauss Blaster`).
- [ ] **Step 3: Confirm** across the corpus with a quick script that lists unit-level min = max = 1 weapon groups in five catalogues. If BSData names them in other ways too ("Weapon Choice", "Unit Weapons"), the rule must be structural, as in Interfaces, not name-based.
- [ ] **Step 4: Implement** the structural rule in `aggregate`/`unitExport`.
- [ ] **Step 5: Run** `npm test -w @recruit/data -- roster-export`. Expected: PASS, and the other export tests are unchanged.
- [ ] **Step 6: Commit** with `fix(data): export counts a unit-wide weapon choice once per model`.

### Task 7: Warlord trait and relic at Combat Patrol and Onslaught (L15)

**Background:** Arks of Omen sizes require the 1 CP Requisitions for a Warlord trait or relic. That is correct, and `fixed-warlord-traits.test.ts` pins it. The Core Book sizes (Combat Patrol, Onslaught) give a CHARACTER Warlord one Warlord trait and the army one relic without a stratagem (library `01_Core_Rules/Army_Building_Detachments_and_CP.md` §5).

**Files:**
- Test: `packages/data/test/roster-policy.test.ts` (new cases)
- Modify, only if the test fails: `packages/data/src/roster/policy.ts` and/or `overrides/*.json`

- [ ] **Step 1: Write the tests.**
  - At `combat-patrol`, a Necrons Overlord that is the Warlord can choose a Necron Warlord trait (`childOptions` under the Overlord offers it) without "Stratagem: Warlord Trait". Validation raises no issue for that choice.
  - At `strike-force`, the same trait is not offered until "Stratagem: Warlord Trait" is taken. This is the existing behaviour.
- [ ] **Step 2: Run them.** If both pass, keep them as regression tests and commit with `test(data): Warlord trait availability by battle size`. If the Combat Patrol case fails, follow systematic-debugging to the modifier or policy that hides the trait. Fix it in `policy.ts` with the library citation, run again, and commit with `fix(data): Core Book sizes offer the Warlord's trait without the requisition`.

### Task 8: No backticks in rules, lessons or the glossary (R5)

**Suspected root cause, to confirm first:** `src/content/markdown.ts` has no inline-code rule, so the content's \`3"\` spans reach `Inline` text with their backticks.

**Files:**
- Modify: `packages/data/src/content/markdown.ts`
- Test: `packages/data/test/content-build.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - The inline parser turns ``within `3"` horizontally`` into the text `within 3" horizontally`.
  - After `data:build`, `rules.json`, `lessons.json` and `guides/*.json` contain no backtick character: `expect(raw).not.toContain('`')`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** A code span becomes plain text (no new `Inline` kind). Remove the backtick stripping in `apps/web/src/learn/lessonFacts.test.ts` if it is there only to work around this; leave it if it has another purpose.
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data && npm test -w @recruit/web -- lessonFacts`. Expected: PASS.
- [ ] **Step 5: Commit** with `fix(content): code spans render as text — no backticks in rules and lessons`.

### Task 9: Whole suite and review

- [ ] **Step 1:** Run `npm run data:build`, `npm test`, `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web` and `CI=true npm run e2e -w @recruit/web`. Expected: all green. Update any e2e assertion that pinned the old 145-point barge or "1x" export text: share and builder specs only, which are Plan B's and C's files in wave 2 but free in wave 1.
- [ ] **Step 2:** Ask for one fresh review of `git diff main...data-presentation` on the most capable model, against spec §4 and this plan's Review Focus. Fix the confirmed findings test-first.
- [ ] **Step 3:** Report the branch ready to merge after Plan A. Don't merge or push without the owner's go-ahead.

## Self-review

- **Spec §4 coverage:**
  - `InfoProfile`, `InfoRule`, `EntryInfo` and `InfoFile`: Task 2.
  - `optionDisplay`: Task 1.
  - `loadEntryInfo`, `entryInfo` and `summaryLine`: Task 3.
  - `extra` flags: Task 4.
  - `unitSummary`: Task 6. Plans B and C consume it.
- **Bug coverage:** C1 (Task 5), C2 (Task 6), Royal Warden (Task 4), L15 (Task 7), R5 (Task 8).
- **Types:** `getInfoFile` returns `InfoFile`. `loadEntryInfo` builds `EntryInfoIndex = Map<string, EntryInfo>` keyed by entry id, the same key `entryInfo` reads.
- **Review Focus:** all five are pinned (Tasks 2, 1, 2, 3 and 6).
- **Proportion:** the investigation steps give suspected causes with their evidence, and every fix pins an expected outcome. No bodies are written out.
