# Plan F: Plain English for army-building options

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every army-building option text the builder shows (sub-faction codes, Warlord traits, relics, stratagem upgrades, psychic powers, wargear abilities) has checked plain English. The option-text coverage goes from 1,662 of 3,416 to **3,416 of 3,416, with 0 flagged**, and no option in the builder is labelled "Official wording" any more.

**Architecture:**
- **Option texts join the faction shards.** Their plain English goes in the existing `packages/content/plain/<shard>.json` files, in the same entry format. There are no new shard files, apart from three catalogues that had no shard before. The reasons:
  - 1,662 option texts already have entries there, because they are also datasheet texts.
  - The store already attaches entries by key, wherever they live, and it already keeps option texts from being reported as orphans.
  - The M3 groups already own those files, so ownership needs no new map.
  - A text that moves between a datasheet and an option list needs no file move. (Plan D moved 292 texts this way.)
- **An option text has one owning shard:**
  - the shard that already holds an entry for it;
  - otherwise the first info file it occurs in, in slug order with `system` last;
  - and `system` maps to `core`.
- **Coverage report:** `generated/plain-report.json` gains an `options` section, per owning shard. It carries the same counts as the page shards (`total`, `written`, `flagged`, `copied`), plus a count per tier. `generated/info-plain-report.json` goes away, so there is one coverage report. The M8 check (`test/plain-coverage.test.ts`) still reads only the page `shards`, so it stays green throughout. A new always-on test fails if any option entry is flagged or copied. The "every option text is written" test is `test.todo` until Task 9 turns it on.
- **Tiers set the writing order,** most visible first:
  - **1. Army choices:** options chosen once for the whole army, with no unit above them (sub-faction codes, Army of Renown, army-wide references).
  - **2. Warlord traits.**
  - **3. Relics.**
  - **4. Unit options:** stratagem upgrades, psychic powers, wargear abilities.

  A text's tier is that of its most visible use. Each group commits tier by tier, so if work stops early, newcomers' first screens are already covered.
- **Parallel by faction group, as in M3:**
  - Tasks 1–4 build the tools on one branch, which is reviewed and merged first.
  - Four content sessions (Tasks 5–8) then work in their own worktrees off that `main`. Each edits only its own shard files.
  - Task 9 turns the full-coverage checks on once all four are merged.

**Tech Stack:** unchanged: Node 24, TypeScript 7, Vitest 5, tsx. No new dependencies.

**Spec:**
- `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md` §2 ("Descriptions everywhere") and §5 row F;
- Plan D's notes (`plan-d-status.md` in the shared notes folder): the info files, `info-plain-report.json` and `summaryLine`;
- `packages/content/STYLE.md`: the voice and the checker rules.

**Measured on `main` at 5f75e9b (24 Oct 2026):**
- 3,416 distinct option texts; 1,662 are written and 1,754 are not (about 79,000 words of official text).
- Rough split of the 1,754 by tier, from a throwaway classifier (Task 1 makes this exact):
  - army choices about 690;
  - Warlord traits about 390;
  - relics about 440;
  - unit options about 230.

## Global Constraints

- **Plain-English rules:** `packages/content/STYLE.md` rules 1–9 bind every entry, along with the checker:
  - every number, dice expression, roll, modifier, distance and keyword run survives;
  - nothing is invented;
  - **no run of 12 or more consecutive official words** and, for official texts of 20+ words, **under half** of the plain text's word 4-grams shared;
  - waivers only with a written reason;
  - **waived tokens stay under 2% of all checked tokens** (page and option texts together). Each group also keeps its own waivers under 2% of its texts' tokens.
- **The builder's one-line summary** is the first line of an option's text, up to its first sentence, cut at **160 characters** with "…" (`apps/web/src/data/entryInfo.ts` `summaryLine`). So:
  - make the first sentence say what the option does, within 160 characters (`merge-plain-draft` warns, it doesn't fail);
  - never leave the summary identical to the official one. The builder labels an identical summary "Official wording", and Task 9's test fails on it.
- **Rules version:** describe the option text as the info file has it (BSData v9.8.0). Option texts have no "Rules update:" notes. If you know of a later Games Workshop change to an option, don't write it in: the checker would flag the invented numbers anyway. List it in the group's status note for the owner instead.
- **Ownership:**
  - write only keys from your own shards' to-do lists (`merge-plain-draft` refuses others);
  - one key lives in exactly one shard (`loadPlainStore` throws otherwise);
  - content sessions edit only their group's `packages/content/plain/<shard>.json` and `packages/content/review/options/<shard>.md`;
  - Tasks 1–4 and 9 own every code and test change.
- **Existing checks stay green at every commit:**
  - page plain English 4,742 of 4,742, 0 flagged, 0 orphans;
  - faction secondaries complete;
  - the page spot-check records;
  - the info `infoGzip` budget of 150 kB per file (the largest is 43 kB today).
- **Commands:**
  - **per task:** `npm run data:build`, `npm test -w @recruit/data`, `npm run typecheck`;
  - **per branch, at the end:** `npm test`, `npm run build`, `npm run budgets -w @recruit/web`;
  - **Task 9 also runs** `CI=true npm run e2e -w @recruit/web`.
- **Worktree setup** (each branch): `npm ci`, `npm run data:fetch`, `npm run data:build`.
- **Nothing is pushed.** The owner approves each merge into `main`, and any push or deploy, separately.

## Review Focus

1. **The builder still says "Official wording" somewhere at the end.** This happens when an option's summary comes from a text nobody wrote, or when a plain summary matches the official one word for word. Expected: no option summary of more than three words is labelled "Official wording". *Task 9 test `every option summary of more than three words is in plain English`.*
2. **A first sentence too long for the one-line summary.** It gets cut mid-thought with "…". Expected: the author is told at merge time, and the spot-check reviewer reads each sampled summary as a summary. *Task 3 test `warns when the first sentence is over 160 characters`; Task 5–8 spot-check checklist.*
3. **A relic or trait in a library's shared entries, reached only by a link from a catalogue.** It has no unit above it in its own file, so a naive rule calls it an army choice. Expected: it takes the tier of the link that reaches it (relic: 3). *Task 1 test `a shared library entry takes its tier from the links that reach it`.*
4. **One text used by several options or files** (the same trait in a codex and a supplement, a rule linked from many entries). Expected: it is listed once, owned by one shard, ranked at its most visible use, and written so it reads right for each use. *Task 1 tests `a text in two files is listed once …` and `its tier is the most visible of its uses`; STYLE section from Task 3.*
5. **A session writes a key that belongs to another group** (or two sessions draft the same key). Expected: it is refused before it reaches a shard file, and never left to collide at merge. *Task 3 test `refuses a key that is not in the to-do list`; the existing `loadPlainStore` duplicate-key check stays as the backstop.*

---

## File Structure

```
packages/data/
  src/info/tiers.ts            NEW  optionTierOf: an option entry's tier (1 army choice … 4 unit option)
  src/info/index.ts            + collectOptionTexts, optionShard, optionSample; attachInfoPlain reports per shard
  src/plain/store.ts           + OptionShardReport, CoverageReport types
  src/plain/draft.ts           NEW  mergeDraft, firstSentenceLength (pure)
  src/build.ts                 plain-report.json gains `options`; info-plain-report.json no longer written; console line
  scripts/content-todo.ts      option texts in to-do lists; --tier, --sample-options; --all shows option counts
  scripts/merge-plain-draft.ts NEW  checks a draft and merges passing entries into a shard (wraps mergeDraft)
  test/option-texts.test.ts    NEW  tiers, owners, sample
  test/plain-draft.test.ts     NEW  mergeDraft
  test/option-spot-check.test.ts NEW  option spot-check records
  test/info.test.ts            per-shard attachInfoPlain report; page/option totals
  test/plain-coverage.test.ts  option checks; waiver share counts option tokens
packages/content/
  STYLE.md                     + "Option texts" section and one worked example
  plain/<shard>.json           option entries (Tasks 5–8); 3 new shard files
  review/options/<shard>.md    NEW  option spot-check records (Tasks 5–8)
apps/web/src/
  lists/__fixtures__/generatedData.ts  + withoutInfoPlain
  lists/ListEditorPage.test.tsx, lists/NewListPage.test.tsx, lists/UnitEditor.test.tsx  pin official wording by stripping plain
  data/entryInfo.coverage.test.ts      NEW (Task 9)
```

## Branches and order

| Step | Branch / worktree (off `main`) | Tasks | Starts when |
|---|---|---|---|
| Tools | `plain-options` / `L:\9th Edition\app-plain-options` | 1–4 | the owner approves this plan |
| Group 1 | `plain-options-marines` / `L:\9th Edition\app-plain-marines` | 5 | `plain-options` is merged |
| Group 2 | `plain-options-imperium` / `L:\9th Edition\app-plain-imperium` | 6 | `plain-options` is merged |
| Group 3 | `plain-options-chaos` / `L:\9th Edition\app-plain-chaos` | 7 | `plain-options` is merged |
| Group 4 | `plain-options-xenos` / `L:\9th Edition\app-plain-xenos` | 8 | `plain-options` is merged |
| Finish | `plain-options` (merge `main` in first) | 9 | all four groups are merged |

- `plain-options` gets one whole-branch review (most capable model) before it merges. The group branches are reviewed by their spot-checks. Task 9 ends with a final rules-accuracy review.
- The group branches touch disjoint files, so they merge in any order (suggested: 1, 2, 3, 4). Run `npm run data:build && npm test` after each merge.

---

### Task 1: Option tiers and owners

**Files:**
- Create: `packages/data/src/info/tiers.ts`
- Modify: `packages/data/src/info/index.ts`
- Test: `packages/data/test/option-texts.test.ts`

**Interfaces:**
- Consumes: `RosterFile`, `RNode` (`src/roster/types.ts`: `extraKind?: 'trait' | 'relic'`, `type`, `targetId`); `optionDisplay` (`src/roster/names.ts`); `InfoFile`; `textKey`, `OfficialText`, `spotSample` (`src/plain/collect.ts`); `PlainStore`.
- Produces:

```ts
// src/info/tiers.ts
export type OptionTier = 1 | 2 | 3 | 4;
export const TIER_NAMES: Record<OptionTier, string> = { 1: 'army choices', 2: 'Warlord traits', 3: 'relics', 4: 'unit options' };
export type TierOf = (slug: string, entryId: string) => OptionTier;
export function optionTierOf(files: RosterFile[]): TierOf;

// src/info/index.ts
export interface OptionText extends OfficialText { tier: OptionTier }
export function optionShard(slug: string): string;   // 'system' -> 'core', else slug
export function collectOptionTexts(files: InfoFile[], store: PlainStore, tierOf: TierOf): OptionText[];
export function optionSample(texts: OptionText[], shard: string): OptionText[];
```

**Decisions:**
- **The tier of one node,** given the chain of nodes above it in its file:
  1. Tier 2 if the node or any node above it has `extraKind: 'trait'`, or `optionDisplay(name).heading` starts with `Warlord trait`.
  2. Tier 3 if any of them has `extraKind: 'relic'`, or a heading of `Relic` / `Relic · …`.
  3. Otherwise, tier 4 if any node in the chain is a `unit` or `model` entry, or a link whose target is one. Targets are resolved across all files.
  4. Otherwise, if the chain starts in the file's `rootEntries`, tier 1.
  5. Otherwise (the chain starts in `shared`), the best tier among the links, in any file, that target the top shared node, found recursively with a visited set. With no such link, tier 4.
- **The tier of an entry** is the best tier among its nodes with that id in that slug's file (or in any file if the slug's file has none). An unknown id is tier 4.
- **`collectOptionTexts`:**
  - **Which texts:** it collects exactly the texts `attachInfoPlain` looks up: rules, then each profile's `textChars`. It walks files sorted by slug, with `system` last.
  - **Fields:** `key = textKey(text)`; `name` and `text` come from the first occurrence.
  - **`kind`:** `'rule'` for rules, `'weapon'` for `Weapon` profiles, `'psychic'` for a profile type matching `/psychic/i`, and `'ability'` otherwise.
  - **`tier`:** the best tier over every occurrence.
  - **`shard`:** `store.get(key)?.shard ?? optionShard(firstSlug)`.
  - **Order:** first-seen order.
- **`optionSample`:** at most 10 of the shard's texts. Take 5 from tier 1 and 5 from tiers 2–4, topped up from the other half when one is short, using `spotSample(…, \`options:${shard}\`, n)` within each half.

- [ ] **Step 1: Write the failing tests** in `test/option-texts.test.ts`, with small fixture files:

```ts
const file = (slug: string, rootEntries: RNode[], shared: RNode[] = []): RosterFile =>
  ({ schema: 1, id: slug, name: slug, slug, library: false, links: [], rootEntries, shared, categories: [], forces: [] });
const necrons = file('necrons', [
  { id: 'dyn', kind: 'entry', type: 'upgrade', name: 'Dynasty Choice', children: [{ id: 'novokh', kind: 'entry', type: 'upgrade', name: 'Dynasty: Novokh' }] },
  { id: 'army-wt', kind: 'group', name: 'Warlord Traits', children: [{ id: 'army-trait', kind: 'entry', type: 'upgrade', name: 'Enduring Will', extraKind: 'trait' }] },
  { id: 'overlord', kind: 'entry', type: 'unit', name: 'Overlord', children: [
    { id: 'fury', kind: 'entry', type: 'upgrade', name: 'Warlord Trait (Novokh): Blood-Fuelled Fury', extraKind: 'trait' },
    { id: 'rod-link', kind: 'link', name: 'The Burning Rod', targetId: 'rod', targetKind: 'entry', extraKind: 'relic' },
    { id: 'coronal', kind: 'entry', type: 'upgrade', name: 'Relic (Szarekhan): The Sovereign Coronal' },
    { id: 'orb', kind: 'entry', type: 'upgrade', name: 'Resurrection Orb' }] }]);
const library = file('necrons-library', [], [{ id: 'rod', kind: 'entry', type: 'upgrade', name: 'The Burning Rod' }, { id: 'lost', kind: 'entry', type: 'upgrade', name: 'Unused' }]);
const tierOf = optionTierOf([necrons, library]);
```

  Tests and their assertions:
  - `a dynasty under a root entry is an army choice`: `tierOf('necrons', 'novokh')` is `1`.
  - `a trait is tier 2 under a unit or at army level`: `fury` and `army-trait` are `2`.
  - `a relic is tier 3 by its marker or its heading`: `coronal` is `3`.
  - `wargear under a unit is tier 4`: `orb` is `4`.
  - `a shared library entry takes its tier from the links that reach it`: `tierOf('necrons-library', 'rod')` is `3`.
  - `a shared entry no link reaches, or an unknown id, is tier 4`: `lost` and `'nope'` are `4`.
  - `a text in two files is listed once, owned by the first file in slug order, with system last`. The text `T` is a rule named `Shared` in `system` entry `s`, and a rule named `Code` in `necrons` entries `orb` and `novokh` (in that order). The files are passed system first. Expected: `collectOptionTexts([sysInfo, necInfo], new Map(), tierOf)` equals `[{ key: textKey(T), shard: 'necrons', kind: 'rule', name: 'Code', text: T, tier: 1 }]`.
  - `its tier is the most visible of its uses`: covered by the case above (`orb` gives 4, `novokh` gives 1, so the result is 1).
  - `a text only in system is owned by core`; and `a text with an entry is owned by the shard holding it` (a store entry in `imperium-space-marines`).
  - `exactly the texts attachInfoPlain looks up`: on a fixture with a weapon, a three-word profile text and a psychic profile, `new Set(texts.map((t) => t.key))` equals `infoTextKeys(files)`, and the kinds are right.
  - `optionSample takes 5 army choices and 5 others, topped up when one half is short, the same every run`.

- [ ] **Step 2: Run them and check they fail.** Run: `npm test -w @recruit/data -- option-texts`. Expected: FAIL, with `optionTierOf` and `collectOptionTexts` not exported.
- [ ] **Step 3: Implement** `tiers.ts` (an index of every node in every file, keyed by id: `{ slug, node, chain, root: 'root' | 'shared' }`, plus a target id → link occurrences index), then `collectOptionTexts`, `optionShard` and `optionSample` in `src/info/index.ts`.
- [ ] **Step 4: Run them and check they pass.** Then run `npm run typecheck`.
- [ ] **Step 5: Commit** with `feat(data): option texts — tier (army choice, trait, relic, unit option) and owning shard`.

### Task 2: Option texts in the coverage report

**Files:**
- Modify: `packages/data/src/info/index.ts` (`attachInfoPlain`), `packages/data/src/plain/store.ts` (types), `packages/data/src/build.ts`
- Test: `packages/data/test/info.test.ts`, `packages/data/test/plain-coverage.test.ts`

**Interfaces:**
- Consumes: Task 1's `collectOptionTexts`, `optionTierOf`, `OptionTier`.
- Produces:

```ts
// src/plain/store.ts
export interface OptionShardReport extends ShardReport { tiers: Record<OptionTier, { total: number; written: number }> }
export interface CoverageReport extends PlainReport { options: Record<string, OptionShardReport> }   // generated/plain-report.json
// src/info/index.ts
export interface InfoPlainReport { total: number; written: number; flagged: number; shards: Record<string, OptionShardReport> }
export function attachInfoPlain(files: InfoFile[], store: PlainStore, tierOf: TierOf): InfoPlainReport;
```

**Decisions:**
- **Attaching:** `attachInfoPlain` still attaches plain English in place, exactly as now: only entries that pass `checkPlain`.
- **Counting:** its report counts each `collectOptionTexts` text once, under that text's `shard`:
  - `written` counts entries that pass;
  - `flagged` gets `{ key, name, missing, extra }` for any missing or extra tokens;
  - `copied` gets `{ key, name, longestRun }`;
  - `tiers[t]` counts total and written.
  - `InfoPlainReport.flagged` is the total of all `flagged` and `copied` rows.
- **`build.ts`:**
  - write `plain-report.json` after the info files are attached, as `{ ...plain, options: infoPlain.shards }`;
  - stop writing `info-plain-report.json`;
  - pass `optionTierOf(rosterFiles)` in;
  - replace the `Info:` console line with: `Option texts: ${written} of ${total} written, ${flagged} flagged (army choices a/b · Warlord traits c/d · relics e/f · unit options g/h)`.

- [ ] **Step 1: Write the failing tests.**
  - In `info.test.ts`, replace the `attachInfoPlain` report expectations so they assert the per-shard shape. Two files: `necrons` (a rule `RULE` with a passing entry, and a text whose entry says 2 where the official text says 1) and `system` (one text, no entry). Expected:
    - `report.shards.necrons` has `{ total: 2, written: 1 }`;
    - its `flagged[0].missing` is `['1']`;
    - its `tiers[4]` is `{ total: 2, written: 1 }`;
    - `report.shards.core.total` is `1`;
    - the flagged text gets no `plain`.

    The tier comes from a stub `TierOf` returning 4.
  - Replace `info texts are not part of plain-English coverage` with `option texts are counted apart from page texts`. It reads `plain-report.json` as `CoverageReport` and expects:
    - page totals still `{ total: 4742, written: 4742 }`;
    - the option totals summed over `options` to have `total` `3416` and `written` ≥ `1662`;
    - `existsSync(join(GEN, 'info-plain-report.json'))` to be `false`.
  - In `plain-coverage.test.ts`:
    - add `every option-text entry passes its checks` (always on): `Object.values(report.options).flatMap((r) => [...r.flagged, ...r.copied])` equals `[]`;
    - add `test.todo('every option text has plain English (Plan F Task 9 turns this on)')`;
    - change the waiver test so `tokens` also counts `extractTokens` of every text from `collectOptionTexts`, run over `generated/info/*.json` with the store and a `() => 4` tier function (tiers don't matter here). Count each key once across page and option texts.
- [ ] **Step 2: Run them and check they fail.** Run: `npm test -w @recruit/data -- info plain-coverage`. Expected: the unit test FAILS on the shape. The generated-data tests FAIL until the build is rerun.
- [ ] **Step 3: Implement** the report, the types and the build wiring.
- [ ] **Step 4: Run the build and the tests.** Run `npm run data:build`. Expected output includes `Option texts: 1662 of 3416 written, 0 flagged (army choices …)` and, unchanged, `Plain English: 4742 of 4742 texts written, 0 flagged, 0 orphaned`. Then run `npm test -w @recruit/data` and `npm run typecheck`. Expected: PASS. Record the four tier totals in the commit message: they are what Tasks 5–8 work through.
- [ ] **Step 5: Commit** with `feat(data): option texts in the plain-English coverage report, by shard and tier`.

### Task 3: Authoring tools and the option-text style

**Files:**
- Create: `packages/data/src/plain/draft.ts`, `packages/data/scripts/merge-plain-draft.ts`, `packages/data/test/plain-draft.test.ts`, `packages/data/test/option-spot-check.test.ts`
- Modify: `packages/data/scripts/content-todo.ts`, `packages/content/STYLE.md`

**Interfaces:**
- Consumes: `checkPlain`, `PlainShard`, `TextKind`; Task 1's `collectOptionTexts`, `optionSample`, `optionTierOf`, `TIER_NAMES`.
- Produces:

```ts
// src/plain/draft.ts (pure)
export interface TodoItem { key: string; kind: TextKind; name: string; official: string; tier?: OptionTier }
export interface DraftEntry { plain: string; waive?: Record<string, string> }
export interface MergeResult {
  shard: PlainShard;                                   // input plus passing entries, keys sorted
  merged: string[];
  failed: { key: string; reason: string }[];           // "not in the to-do list" | "missing [6\"] extra [] copied (14 words)"
  longSummaries: { key: string; length: number }[];    // first sentence over 160 characters (merged anyway)
}
export function mergeDraft(shard: PlainShard, todo: TodoItem[], draft: Record<string, DraftEntry>): MergeResult;
export function firstSentenceLength(plain: string): number;  // first line, to the first ". ", "! " or "? " outside quotes; as entryInfo.ts firstSentence
```

- **CLI:**
  - `npx tsx packages/data/scripts/merge-plain-draft.ts <shard> <draft.json>` reads `packages/content/todo/<shard>.json` and writes `packages/content/plain/<shard>.json` (creating it if needed). It prints one line per failure and per long summary, then `N merged, M failed`, and exits 1 if anything failed.
  - `npm run content:todo -- <shard> [--tier <1-4>]` now also lists the shard's open option texts, each with `tier`. `--tier` limits the option to-dos to that tier. Its summary line becomes `<shard>: P texts, W written, T to do; options: O to do (army choices a, Warlord traits b, relics c, unit options d)`.
  - `--all` prints that line for every shard.
  - `--show <key>` also finds option texts.
  - `--sample-options <shard>` prints `optionSample`'s keys, one per line (`key\ttier\tname`).

- [ ] **Step 1: Write the failing tests.**
  - `plain-draft.test.ts`:
    - `merges a passing entry, with name and kind from the to-do, keys sorted`;
    - `refuses a key that is not in the to-do list`: it lands in `failed` with reason `not in the to-do list` and is absent from `shard`;
    - `keeps a failing entry out and says why`: an official `within 6"` drafted as `within 9"` lands in `failed` with a reason containing `missing [6"]` and `extra [9"]`;
    - `warns when the first sentence is over 160 characters`: a 170-character first sentence is merged and listed in `longSummaries` with `length: 170`;
    - `firstSentenceLength stops at the first sentence outside quotes and ignores inch marks`: `'Move 6" more. Then …'` gives `13`.
  - `option-spot-check.test.ts`, following `spot-check.test.ts`:
    - `every option spot-check record covers its sample with no failures` (always on). For each `packages/content/review/options/*.md` that exists, its 12-character key rows include every `optionSample` key for that shard, and every verdict is `PASS` or `FIXED`. With no records yet, it passes.
    - `test.todo('every shard with option texts has an option spot-check record (Plan F Task 9 turns this on)')`.
- [ ] **Step 2: Run them and check they fail.** Run: `npm test -w @recruit/data -- plain-draft option-spot-check`. Expected: FAIL, with `mergeDraft` not exported.
- [ ] **Step 3: Implement** `draft.ts`, the merge script and the `content-todo.ts` changes. Option texts are appended to `texts` when their key isn't already a page text.
- [ ] **Step 4: Add an "Option texts" section to `STYLE.md`**, after "The authoring loop". It covers:
  - what option texts are;
  - the 160-character first sentence, with the split-it advice ("Once per battle, in your Command phase: …");
  - never leaving the summary identical to the official one;
  - one text serving several options (keep the official subject: "this WARLORD", "the bearer", "units with this code");
  - the tier order;
  - the option loop: `content:todo -- <shard> --tier <n>`, draft, `merge-plain-draft`, `data:build`, to-do again.

  Then add one worked example in the existing format: the Necrons Warlord trait Blood-Fuelled Fury. Get its official text from `npm run content:todo -- --show <key>`, write plain English to these rules, and put it in `necrons.json` through `merge-plain-draft`. This is the only content Tasks 1–4 write.
- [ ] **Step 5: Run everything and check it passes.**
  - `npm run data:build`. Expected: `Option texts: 1663 of 3416 written, 0 flagged`.
  - `npm run content:todo -- necrons --tier 2`. Expected: the JSON items carry `"tier": 2`.
  - `npm test -w @recruit/data` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** with `feat(data): option to-do lists by tier, merge-plain-draft, option spot-check records; STYLE for option texts`.

### Task 4: Web tests that don't depend on what has been written

Three builder tests read the real generated data, and they assert that Novokh's code and Blood-Fuelled Fury have no plain English yet. Task 3 already writes Blood-Fuelled Fury, and Group 4 writes Novokh. They must pin the official-wording fallback by stripping plain English, the way `with plain English for a code, the dynasty row shows it` already injects it.

**Files:**
- Modify: `apps/web/src/lists/__fixtures__/generatedData.ts`, `apps/web/src/lists/ListEditorPage.test.tsx`, `apps/web/src/lists/NewListPage.test.tsx`, `apps/web/src/lists/UnitEditor.test.tsx`

**Interfaces:**
- Produces: `export function withoutInfoPlain(fetchMock: ReturnType<typeof stubGeneratedData>, slug: string): void`. It wraps the mock's implementation so `/data/info/<slug>.json` is served with every `plain` removed (rules and profiles); every other URL is unchanged.

- [ ] **Step 1: See the break.** On this branch Blood-Fuelled Fury now has plain English (Task 3). Run: `npm test -w @recruit/web -- UnitEditor`. Expected: FAIL in `Warlord traits drop their prefix and sit under their kind; each says what it does`. The description no longer starts `Official wording`.
- [ ] **Step 2: Add `withoutInfoPlain`.** Use it in these three tests: that UnitEditor test, ListEditorPage's `each dynasty says what its code does…`, and NewListPage's `the dynasty step says what each dynasty does…`. Rename the ListEditorPage test to `each dynasty says what its code does; without plain English for Novokh’s code, it is labelled Official wording`. The other two keep their names.
- [ ] **Step 3: Prove independence.**
  - Temporarily merge a passing plain entry for Novokh's code (Awakened By Murder) into `necrons.json` with `merge-plain-draft`, then run `npm run data:build` and `npm test -w @recruit/web -- ListEditorPage NewListPage UnitEditor`. Expected: PASS.
  - Then revert `necrons.json` to the committed version and rebuild.
- [ ] **Step 4: Run the branch checks.** Run `npm test`, `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web`. Expected: PASS.
- [ ] **Step 5: Commit** with `test(web): builder tests pin the official-wording fallback whatever plain English exists`.
- [ ] **Step 6: Review and hand over.**
  - Run a whole-branch review of `plain-options` on the most capable model (superpowers:requesting-code-review). Fix its findings test-first.
  - Write `plan-f-tools-status.md` in the shared notes folder. It records the tier totals per group (from `npm run content:todo -- --all`), so Tasks 5–8 can check their starting counts.
  - Stop. The owner approves the merge into `main`, and the group sessions start from that `main`.

### Tasks 5–8: Plain English for each group's option texts

Each group is one session in its own worktree (see Branches and order), following the same method. The groups reuse M3's split, with one change for balance: Tyranids and Genestealer Cults move from the Imperium group to Group 1. Grouped as in M3, the sizes would be 317 / 579 / 371 / 487. With the move they are 441 / 455 / 371 / 487.

| Task | Group | Shards (every shard of the group with option to-dos; `content:todo -- --all` is the authority) | About |
|---|---|---|---|
| 5 | Space Marines, core, Fallen, Tyranids, GSC | `core` (the `.gst`'s texts), `imperium-space-marines`, the 11 `imperium-adeptus-astartes-*`, `imperium-fw-adeptus-astartes`, `imperium-legion-of-the-damned`, `fallen`, `tyranids`, `tyranids-genestealer-cults` | 441 texts, 20,300 words |
| 6 | Rest of the Imperium | every other `imperium-*`, including the new `imperium-agents-of-the-imperium` and `imperium-death-korps-of-krieg` | 455 texts, 21,200 words |
| 7 | Chaos | every `chaos-*`, including the new `chaos-fw-heretic-astartes` | 371 texts, 15,800 words |
| 8 | Aeldari, Necrons, Orks, T'au, Votann, Unaligned | `aeldari-*` (most of it is `aeldari-aeldari-library`, 218), `necrons`, `orks`, `tau-empire`, `leagues-of-votann`, `unaligned-monsters-and-gribblies` | 487 texts, 21,600 words |

**Method (the session's steps):**

- [ ] **Step 1: Set up.**
  - Run `git worktree add "L:\9th Edition\app-plain-<group>" -b plain-options-<group> main`, then the worktree setup.
  - Expected from the build: `Option texts: 1663 of 3416 written, 0 flagged`.
  - Run `npm run content:todo -- --all` and write the group's per-shard, per-tier counts at the top of `plan-f-<group>-ledger.md` in the shared notes folder.
- [ ] **Steps 2–5: One step per tier, in order: 1 army choices, 2 Warlord traits, 3 relics, 4 unit options.** For tier *t*:
  1. Run `npm run content:todo -- <shard> --tier t` for each group shard with open tier-*t* texts.
  2. **Draft.** The session writes the drafts itself, or dispatches one drafting subagent per shard, or per 150 texts in a big shard (split by key order). Each drafter gets `STYLE.md` and its to-do JSON. It writes a draft file `{ "<key>": { "plain": "…", "waive"?: {…} } }` in the scratchpad and may check it with `npx tsx packages/data/scripts/check-plain-file.ts <todo> <draft>`. No drafter writes a shard file.
  3. **Merge** each draft with `npx tsx packages/data/scripts/merge-plain-draft.ts <shard> <draft>`. Rewrite every failure and re-merge until it prints `0 failed`. Shorten every long-summary warning unless the rule truly can't be split, and note any that are kept in the ledger.
  4. Run `npm run data:build`, then the tier-*t* to-do again for each shard. Expected: `options: 0 to do` at tier *t* for every group shard. Then run `npm test -w @recruit/data`. Expected: PASS (0 flagged, 0 copied, waivers under 2%).
  5. **Commit** with `content(options): plain English for <group>: <tier name>`. The body gives each shard's texts written and waived tokens with their reasons, and the group's waiver share.
- [ ] **Step 6: Spot-check every group shard that owns option texts.**
  - `npm run content:todo -- --sample-options <shard>` gives up to 10 keys. A fresh reviewer subagent per shard (never the one that drafted it) compares each sampled plain text with its official text (`--show <key>`). It checks:
    - meaning: effects, conditions, timing, limits, targets (friendly or enemy), numbers and keywords;
    - whether the first sentence works as the one-line summary.
  - Each finding is fixed in the shard through `merge-plain-draft`.
  - **The record** is `packages/content/review/options/<shard>.md`:

```
# Option spot-check: <faction display name>
Sample: 10 option texts (seed options:<shard>)

| Key | Name | Tier | Verdict | Note |
|---|---|---|---|---|
| 1a2b3c4d5e6f | Awakened By Murder | 1 | PASS | |
| 6f5e4d3c2b1a | Blood-Fuelled Fury | 2 | FIXED | said "within 6\""; official is "within 3\"" |
```

  - If more than 2 of a shard's 10 samples need fixing, a second reviewer reads every option text the group wrote for that shard before the record is accepted, and the record says so.
  - Run `npm run data:build && npm test -w @recruit/data`. Expected: PASS; the always-on record test validates each new record.
  - **Commit** with `content(options): spot-check <group> option texts`. Give the FIXED count in the body.
- [ ] **Step 7: Run the branch checks.** Run `npm test` (the web tests read the generated data), `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web`. Expected: PASS.
- [ ] **Step 8: Hand over.**
  - Write `plan-f-<group>-status.md` in the shared notes folder: texts written per tier, waivers, the FIXED count, any long summaries kept, and any later rules changes noticed (see Global Constraints).
  - Stop. The owner approves the merge.

### Task 9: Coverage complete

**Files:**
- Modify: `packages/data/test/plain-coverage.test.ts`, `packages/data/test/option-spot-check.test.ts`, `packages/data/test/info.test.ts`
- Create: `apps/web/src/data/entryInfo.coverage.test.ts`

**Interfaces:**
- Consumes: `CoverageReport` (Task 2), `optionSample` (Task 1), `summaryLine` (`apps/web/src/data/entryInfo.ts`).

- [ ] **Step 1: Bring the branch up to date.** In `L:\9th Edition\app-plain-options`, merge `main`, which now has all four groups. Then run `npm ci` and `npm run data:build`. Expected: `Option texts: 3416 of 3416 written, 0 flagged (army choices …)`. If any texts are left (a data change, or a key between groups), write them here with the Tasks 5–8 method, and record them in the commit.
- [ ] **Step 2: Turn the checks on.**
  - In `plain-coverage.test.ts`, the todo becomes `test('every option text has plain English that passes the checks')`. It asserts that every `options` shard has `written === total`, and that the summed totals are `{ total: 3416, written: 3416 }`.
  - In `option-spot-check.test.ts`, the todo becomes a test that every shard owning option texts has a record.
  - In `info.test.ts`, `option texts are counted apart from page texts` pins `written: 3416`.
- [ ] **Step 3: Write `entryInfo.coverage.test.ts`:** `every option summary of more than three words is in plain English`.
  - For every `packages/data/generated/info/*.json` (read with `node:fs`, as `generatedData.ts` does), and every entry whose `summaryLine(info, 'official')` has more than three words, assert `summaryLine(info, 'plain')` differs from it.
  - The failure message names the slug, the entry id and the summary.
  - Fix any failure in the owning shard (an identical summary is reworded), then rebuild.
- [ ] **Step 4: Run everything.**
  - `npm test`, `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web`, `CI=true npm run e2e -w @recruit/web`. Expected: all PASS.
  - If `e2e-prod/perf.spec.ts` fails while other sessions are running suites, rerun it alone before treating it as a failure.
- [ ] **Step 5: Manual check.** At 375×812, in the built-in browser on the production build, walk these screens in plain English and screenshot them to `plan-f-shots/` in the shared notes folder:
  - the new-list wizard's army options step for Necrons (dynasty summaries) and for an Adeptus Astartes chapter;
  - an Overlord's Warlord traits and relics in the unit editor, with one ⓘ sheet;
  - a Chaos Space Marines relic;
  - a Play mode army-rules section.

  Switch to `Official wording` once to confirm the official text still shows. Note anything awkward as a follow-up.
- [ ] **Step 6: Commit** with `test: every option text has plain English (3,416 of 3,416)`.
- [ ] **Step 7: Final review.** Run a whole-branch review of the Task 9 diff on the most capable model. Add a second reviewer focused on rules accuracy: it re-samples 5 factions, chosen by `spotSample` over the shard list with seed `plan-f-final`, comparing 10 option texts each with their official text. Fix what they find, re-run Step 4, write `plan-f-status.md` in the shared notes folder, and stop. The owner approves the final merge, and any push, separately.

---

## Needs the owner

1. **Approve this plan.** In particular: option texts in the faction shards (not new files); Tyranids and GSC moving into Group 1 for balance; one tools branch merged before the four content sessions start.
2. **Approve five merges into `main`:** `plain-options` after Task 4, each of the four group branches, then `plain-options` again after Task 9.
3. **Rules accuracy:** reading the option texts of a faction you know well, and reporting errors with "Report a rules error", is the best check on top of the automated ones.
