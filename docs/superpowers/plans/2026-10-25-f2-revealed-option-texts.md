# Plan F2: Text for options that show only a name

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Options that the army builder shows with a name and no description get their text, wherever BattleScribe keeps it:
- Chaos Knights' The Diamonas, The Teeth That Hunger and The Gauntlet of Ascension;
- Death Guard's The Daemon's Favour;
- three Army of Renown choices;
- Death Company upgrades;
- the Treasures of the Aeldari relic.

No option is left described in official wording only.

**Architecture:**
- **Root cause (found 25 Oct).** These options are empty markers in BattleScribe: the option itself has no profile, rule or infoLink. Choosing it reveals text elsewhere in the catalogue. Examples:
  - The Diamonas renames the Knight Desecrator's laser destructor and shows a second Weapon profile, "The Diamonas", which is hidden while the relic's selection count is 0.
  - The Daemon's Favour swaps the Malignant Plaguecaster's Pestilential Fallout ability for Torrent of Putrefaction.

  `emitInfoFile` (`packages/data/src/info/extract.ts`) collects only an option's own profiles and rules and what its infoLinks reach, so the revealed text never reaches the option.
- **Fix:** an option with no text of its own takes the profiles, rules and infoGroups (and the targets of infoLinks) that its selection reveals. "Reveals" means: a `set hidden = true` modifier on them whose conditions include `selections` of this option `equalTo 0` (or `lessThan 1`). Options that already have text are left alone, which keeps the change to exactly the options that show nothing today.
- **Measured on main (2fd4525):**
  - **Blast radius:** of 4,261 options with no text (most are structural: model counts, configuration), 18 have revealed text (listed in Task 1).
  - **Writing needed:** the 18 bring about 30 texts, of which 28 already have plain English as datasheet texts. 3 are new: Death Company's Death Visions entries "On the Bridge of the Vengeful Spirit", "The Grace of the Angel" and "To Slay the Warmaster".
- **Three "extra relic" stratagem markers have no text anywhere in BattleScribe:**
  - **Treasures of the Aeldari Relic:** Wahapedia has the Treasures of the Aeldari Stratagem, with plain English already, so an override links the marker to it (Task 2).
  - **Trophies of Fenris (1 or 2 extra Relics, for 1 or 3 CP):** there is no text in BattleScribe, Wahapedia or the research library, and the final rule for extra Space Wolves relics (Relic of the Chapter, 1 CP per Relic) prices it differently. This plan leaves them with their names only, which say what they buy, rather than invent rules text. The owner decides (see "Needs the owner").

**Tech Stack:** unchanged: Node 24, TypeScript 7, Vitest 5. No new dependencies.

**Spec:**
- `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md` §2 "Descriptions everywhere": every army-building choice says what it does before you pick it;
- Plan F (`docs/superpowers/plans/2026-10-25-f-plain-english-options.md`): option-text coverage, tiers, the tools.

**Branch:** `option-reveals` in worktree `L:\9th Edition\app-option-reveals`, off `main`. Start **after Plan F Task 9 (`plain-options`, 52e3392) is merged**: its tests pin 3,416 option texts written, and this plan moves those pins. Setup: `npm ci`, `npm run data:fetch`, `npm run data:build`.

## Global Constraints

- **Source precedence:** final GW changes, then BSData v9.8.0, then Wahapedia, then the research library. Text comes from those sources only. Never write rules text for an option that has none. An override carries a `source` note.
- **Reveal rule scope:** only options with no profiles or rules of their own (after their infoLinks) take revealed text. Hidden status is otherwise ignored, as `emitInfoFile` already does.
- **Plain English:** the 3 new texts follow `packages/content/STYLE.md`, including "Option texts" (first sentence at most 160 characters, never identical to the official one). Write them with `npm run content:todo -- imperium-space-marines --tier <n>` and `merge-plain-draft`.
- **Existing checks stay green at every commit:**
  - page texts 4,742 of 4,742;
  - every option text written;
  - 0 flagged;
  - every option spot-check record covers its sample;
  - no option summary labelled "Official wording" (`apps/web/src/data/entryInfo.coverage.test.ts`).
- **Commands:**
  - **per task:** `npm run data:build`, `npm test -w @recruit/data`, `npm run typecheck`;
  - **at the end:** `npm test`, `npm run build`, `npm run budgets -w @recruit/web`, `CI=true npm run e2e -w @recruit/web`.
- **Nothing is pushed.** The owner approves the merge.

## Review Focus

1. **A swap pair.** A relic shows its own profile and hides the base weapon's. The base profile is hidden while the relic count is `equalTo 1`, which is a different condition. Expected: only the revealed profile attaches, never the base one. *Task 1 test `the profile a relic hides is not attached to it`.*
2. **An option that already has text,** such as an Army of Renown with its own rules, that also reveals profiles. Expected: it keeps exactly its own text. *Task 1 test `an option with text of its own gains nothing from reveals`.*
3. **A reveal condition that mixes the option with others** in an `or` or `and` group. Expected: it attaches when any condition in the modifier says "hidden while this option is 0"; conditions on other options don't attach it to them. *Task 1 tests `a reveal inside a condition group attaches` and `a reveal conditioned on another option does not attach`.*
4. **A shard's option-text set grows.** Its spot-check sample may gain keys, and the record test then fails. Expected: the new sample keys are reviewed and recorded, not skipped. *Task 1 Step 6, pinned by `option-spot-check.test.ts`.*
5. **The Warlord box gains a summary** in Astra Militarum, Krieg ("Voice of Command") and Necrons ("Grand Strategist"). Expected: it reads as what being Warlord gives, in plain English, beside the Arks of Omen note. *Task 1 test in `UnitEditor.test.tsx`, plus Task 3's screenshot.*

---

### Task 1: Options take the text their selection reveals

**Files:**
- Modify: `packages/data/src/info/extract.ts`, `packages/data/test/fixtures/info/info.cat`, `packages/data/test/info.test.ts`, `packages/data/test/plain-coverage.test.ts` (totals pin), `apps/web/src/lists/UnitEditor.test.tsx`
- Modify (content): `packages/content/plain/imperium-space-marines.json` (3 entries), and `packages/content/review/options/<shard>.md` for any shard whose sample gains keys

**Interfaces:**
- Consumes: `buildIdIndex`, `catalogueScope` (`src/bsdata/gamedata.ts`); `emitInfoFile`'s own `infoOf` collector.
- Produces: no new exports. `emitInfoFile(gd, file, slug)` keeps its signature, and `InfoFile` keeps its shape. Internally:

```ts
/** Ids of options whose selection reveals each profile/rule/infoGroup/infoLink: hidden while the option's count is 0. */
function revealIndex(scope: RawCatalogue[]): Map<string, RawNode[]>;   // option id -> revealed nodes, scope order, deduplicated
```

**Decisions:**
- **What counts as a reveal:** a node is revealed by option X when its `<modifiers>` hold `type="set" field="hidden" value="true"`, and somewhere in that modifier's `conditions` or `conditionGroups` there is a `<condition field="selections" … childId=X>` with `type="equalTo" value="0"` or `type="lessThan" value="1"`.
- **What gets collected:** a revealed infoLink is resolved to its target (profile, rule or infoGroup), and that target is collected as `infoOf` collects its own. Each node is collected once.
- **Where it attaches:** X is the option entry's own id; the text goes under the entry, in the file that defines it, from that file's scope.
- **Links in another file:** when a link's target is defined in another file (a library) and still has no text, but this file's scope reveals text for the target's id, that text goes under the link's own id. The builder's `entryInfo` reads a link's own info, then its target's, so nothing shows twice.
- **When it applies:** only when `infoOf(X)` is empty (and, for a link, its target's info is empty too).

- [ ] **Step 1: Extend the fixture.** In `test/fixtures/info/info.cat`:
  - add a shared relic marker `se-marker` with no profiles or rules;
  - add a unit with a weapon `se-base` carrying two profiles: `Base gun`, hidden while `se-marker` is `equalTo 1`, and `Marker gun` (Weapon), hidden while `se-marker` is `equalTo 0`;
  - add a rule `Marker rule`, revealed by `se-marker` inside an `or` condition group;
  - add a profile hidden while another entry `se-other` is `equalTo 0`;
  - add an option `se-own` with its own rule that also reveals a profile.

- [ ] **Step 2: Write the failing tests** in `info.test.ts`, in the `info fixture` describe:
  - `a marker option takes the weapon profile its selection reveals`: `entries['se-marker'].profiles.map(p => p.name)` contains `Marker gun`.
  - `the profile a relic hides is not attached to it`: those names don't contain `Base gun`.
  - `a reveal inside a condition group attaches`: `entries['se-marker'].rules.map(r => r.name)` contains `Marker rule`.
  - `a reveal conditioned on another option does not attach`: the `se-other` profile isn't in `se-marker`'s info.
  - `an option with text of its own gains nothing from reveals`: `entries['se-own']` equals its own rule only.
  - Update the fixture's key list in `the file is keyed by entry id` to add `se-marker`.

  In `generated info files`, add `options that show only a name take the text their selection reveals`. It checks these real entries (id → a name that must be among its profiles or rules):
  - Chaos Knights: `253c-8df9-6fb9-8cee` → `The Diamonas` (Weapon); `20f6-3a9c-732b-72a7` → `The Teeth That Hunger`; `058d-e731-d4bd-092c` → `The Gauntlet of Ascension`;
  - Death Guard: `e06c-eb49-b5e6-f07a` → `Torrent of Putrefaction`;
  - Chaos Space Marines: `2eb6-087d-4893-3167` (Army of Renown - Cogs of Vashtorr) → `Techinfernal Loci`;
  - Orks: `72c2-00c2-e738-c214` (Speed Freeks Speed Mob) → `Adrenaline Junkies`;
  - Space Marines: `4ad6-eb88-f4b3-590e` (Death Company Captain) → has rules or profiles.

- [ ] **Step 3: Run them and check they fail.** Run: `npm test -w @recruit/data -- info`. Expected: the five fixture tests FAIL, and so does the real-data test once the data is built.
- [ ] **Step 4: Implement** `revealIndex`, and the empty-info fallback in `emitInfoFile`'s walk. Then run `npm run data:build`. Expected:
  - the `Option texts:` line shows a new total (about 3,440) with **3 not written**;
  - `plain-coverage`'s `every option text has plain English` FAILS, naming `imperium-space-marines: 3 to do`.

  Record the new total.
- [ ] **Step 5: Write the 3 texts.**
  - `npm run content:todo -- --all` shows which tier they fall in. List them with `npm run content:todo -- imperium-space-marines --tier <n>`.
  - Draft them to STYLE: "Death Visions" entries. Keep every number and keyword, and make each first sentence say what the vision does.
  - Merge with `merge-plain-draft`, then rebuild. Expected: `Option texts: N of N written, 0 flagged`.
  - Then update the two `{ total: 3416, written: 3416 }` pins (`info.test.ts`, `plain-coverage.test.ts`) to N.
- [ ] **Step 6: Spot-check rows.** Run `npm test -w @recruit/data -- option-spot-check`.
  - For each shard it reports with new sample keys, a fresh reviewer compares those texts with their official text, as in Plan F Tasks 5–8 Step 6.
  - Add the rows to `packages/content/review/options/<shard>.md`.
  - Expected: PASS.
- [ ] **Step 7: The Warlord box.** In `UnitEditor.test.tsx`, add `the Warlord option says what being Warlord gives`. For the Necrons Overlord (real data), the `Warlord` checkbox's accessible description is not empty and doesn't start with `Official wording`. Run `npm test -w @recruit/web -- UnitEditor entryInfo.coverage`. Expected: PASS.
- [ ] **Step 8: Run the task checks and commit.** Run `npm test -w @recruit/data` and `npm run typecheck`. Expected: PASS. Commit with `fix(data): an option with no text of its own takes the text its selection reveals (Chaos Knights and Death Guard relics, Armies of Renown, Death Company)`.

### Task 2: The Treasures of the Aeldari relic shows its Stratagem

**Files:**
- Create: `packages/data/overrides/option-stratagems.json`
- Modify: `packages/data/src/info/index.ts`, `packages/data/src/build.ts`, `packages/data/test/info.test.ts`

**Interfaces:**
- Produces:

```ts
// overrides/option-stratagems.json
type OptionStratagems = { catalogueName: string; entryId: string; stratagem: { catalogue: string; name: string }; source: string }[];
// src/info/index.ts
export function attachOptionStratagems(files: InfoFile[], overrides: OptionStratagems, cats: CatalogueOut[], slugOf: (catalogueName: string) => string): void;
// adds { name: stratagem.name, text: officialFor(s.text, s.amended) } to the entry's rules; throws on an unknown catalogue, entry or stratagem
```

- **The one entry:** `{ "catalogueName": "Aeldari - Aeldari Library", "entryId": "8ca6-6aeb-178c-207e", "stratagem": { "catalogue": "aeldari-craftworlds", "name": "Treasures of the Aeldari" }, "source": "BSData's Treasures of the Aeldari Relic is a marker with no text; the Stratagem it buys is Wahapedia's Treasures of the Aeldari (Craftworlds and Harlequins)." }`
- **Where it runs:** `build.ts` calls it right after the info files are emitted, before `applyPlain` and `infoTextKeys`. The text key is the stratagem's own (amendment included), so its existing plain English attaches.

- [ ] **Step 1: Write the failing tests.**
  - Unit test `attachOptionStratagems adds the stratagem's text to the marker, and throws on an unknown stratagem`, with fixture `InfoFile` and `CatalogueOut` objects.
  - Real-data test: `aeldari-aeldari-library` entry `8ca6-6aeb-178c-207e` has a rule named `Treasures of the Aeldari` with `plain` set.
- [ ] **Step 2: Run them and check they fail.** Run: `npm test -w @recruit/data -- info`. Expected: FAIL.
- [ ] **Step 3: Implement** the function, the override file and the build call (load the override with the others in `loadOverrides`, or read it beside them).
- [ ] **Step 4: Rebuild and run the checks.** Run `npm run data:build && npm test -w @recruit/data` and `npm run typecheck`. Expected: PASS, with option texts unchanged (the stratagem text was already counted as a page text and now counts as an option text too). If the option total moves, update the two pins with a note.
- [ ] **Step 5: Commit** with `feat(data): the Treasures of the Aeldari relic shows the Stratagem it buys`.

### Task 3: Check, look, review

- [ ] **Step 1: Run the full checks.** `npm test`, `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web`, `CI=true npm run e2e -w @recruit/web`. Expected: all PASS. If `e2e-prod/perf.spec.ts` fails while other sessions run suites, rerun it alone.
- [ ] **Step 2: Phone screenshots.** Use a temporary Playwright script on the production e2e build with the fake session, as in Plan F Task 9 Step 5, at 375×812. Capture:
  - a Knight Desecrator's relics (The Diamonas shows its profile line);
  - a Knight Rampager's The Teeth That Hunger with its ⓘ sheet;
  - the Chaos Space Marines Army of Renown choice (Cogs of Vashtorr described);
  - a Necrons Overlord's Warlord box.

  Save them to `plan-f2-shots/` in the shared notes folder, then delete the script (don't commit it).
- [ ] **Step 3: Review.** Run one whole-branch review on the most capable model (superpowers:requesting-code-review) with this plan's Review Focus. Fix Critical and Important findings test-first. Write `plan-f2-status.md` in the shared notes folder and stop. The owner approves the merge.

---

## Needs the owner

1. **Approve this plan.** In particular:
   - the reveal rule applies to all 18 options with no text of their own, not just relics;
   - that includes the Warlord box in three factions and some Deathwatch model choices.
2. **Trophies of Fenris (Space Wolves): leave them as names only, or describe them?** These are "1 Extra Relic, 1 CP" and "2 Extra Relics, 3 CP". No source has their text. The final rule for extra relics (Relic of the Chapter) costs 1 CP per Relic, so the 3 CP option may be out of date in BattleScribe itself. Recommendation: leave them as names, which say what they buy, and treat the pricing as a BattleScribe question.
3. **Approve the merge,** after Task 3.
