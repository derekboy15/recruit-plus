# Milestone 3 (Rules Reference and Faction Guides) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user can search the core rules in plain English, read a guide for every playable faction, and read every datasheet ability, army rule and stratagem in plain English, with the official wording one tap away and a way to report a rules error.

**Architecture:**
- **Library first:** four known defects in the research library (`L:\9th Edition\`, outside the repo) are fixed before any content is written from it.
- **Official text in the data:** the build adds stratagems (Wahapedia) to each faction's JSON and writes the core stratagems. A small amendments file records final-GW changes the sources missed.
- **Plain English is authored content**, not generated at runtime. It lives in a new `packages/content` workspace:
  - `plain/<shard>.json` maps a hash of each official text to its plain-English version;
  - `rules/*.md` holds the Rules Reference and glossary;
  - `guides/<slug>.md` holds the faction guides;
  - `review/<slug>.md` holds the spot-check records.
- **The build joins and checks it.** `packages/data` reads the content and checks every plain-English text against its official text: numbers, dice, keywords, and no copied wording. It attaches only texts that pass. It compiles the Markdown (a strict subset, no HTML) into JSON blocks.
- **The web app** renders plain English by default, with a remembered "Official wording" switch, a Rules section with search, faction guide and stratagem pages, and a "Report a rules error" button that saves a document through the existing local-first storage.

**Tech Stack:** unchanged from Milestone 2. Node 24, npm workspaces, TypeScript 7, Vitest 5, Vite 8, React 19, React Router 6, Dexie 4, supabase-js 2, Playwright. No new dependencies of any kind: the Markdown subset compiler and the search are ours. Hashes use `node:crypto` (build side only).

**Spec:** `docs/superpowers/specs/2026-10-20-recruit-plus-design.md` (sections 3.1, 4, 6 and 8). The Milestone 1 and 2 plans in `docs/superpowers/plans/` describe the code this plan builds on.

**Branch:** `m3-rules-reference` (created off `main` in `L:\9th Edition\app`).

**Scope notes:**
- **Plain-English volume.** About 3,800 distinct datasheet texts (abilities, weapon abilities, psychic powers, army rules; about 160,000 words of official text) plus about 1,100 matched-play stratagems. Tasks 13–16 write them in parallel batches, one shard per subagent.
- **Out of scope:** Warlord Traits, Relics and psychic disciplines. The app doesn't display them yet, so they get plain English when a later milestone shows them.
- **Core rules have no official text in our sources** (the Wahapedia export has no core rules). The Rules Reference therefore has no wording toggle, except on core stratagems, which do have official text.

## Global Constraints
- Everything in the Milestone 1 and 2 Global Constraints still applies:
  - source precedence and overrides with a `source` note;
  - 375×812 first, and touch targets ≥ 44px;
  - dark theme colours, the footer disclaimer and the Wahapedia credit;
  - no BattleScribe jargon in the UI.
- **Source precedence** (spec §4): final GW changes (13 Apr 2023 Dataslate, final points) > BSData v9.8.0 > Wahapedia snapshot (2023-06-26) > research library. Plain English and guides may never contradict a higher source. Where the library disagrees with BSData or Wahapedia, the higher source wins and the library is corrected.
- **Rules version:** the final 9th Edition state. Content describes the rules as they stood on 13 Apr 2023. History ("this changed in 2022") appears only where a newcomer would otherwise be confused, and always in a `> **Tip:**` note.
- **Never copy Games Workshop wording.** Plain English is written in our own words. The copy check (Task 4) fails any plain text that shares a run of **12 or more consecutive words** with its official text. For official texts of 20+ words, it also fails when **half or more** of the plain text's word 4-grams appear in the official text. Rules articles and guides are written from the already-paraphrased library and never from official text.
- **Every number, dice expression and keyword survives.** The cross-check (Task 4) flags any of these that is in the official text but not in the plain English, and any dice, roll, modifier or distance that is in the plain English but not in the official text. A flagged text is not shown. A flag may be waived only with a written reason in the content file.
- **Unconfirmed claims:** content may not contain "(unverified)". Anything the library marks unverified is either left out or put in a `> **Not confirmed:**` note.
- **Plain-English style** (written into `packages/content/STYLE.md` in Task 5, and binding on every content task):
  1. Write to the player: "you", "your unit", "this model". Short sentences.
  2. Put timing and conditions first: "In your Shooting phase, when this unit is chosen to shoot, …".
  3. Keep keywords in CAPITALS exactly as the official text has them (`CORE INFANTRY`, `<DYNASTY>`).
  4. Write numbers as digits, distances as `6"`, rolls as `5+`, modifiers as `+1`/`-1`, and dice as `D6`, `2D6`, `D3+3`.
  5. Never add, drop or soften an effect, a restriction, a once-per-battle limit or a timing window. If the official text is ambiguous, keep the ambiguity rather than guessing.
  6. No flavour text, no strategy advice (that belongs in guides), and no references to page numbers or books.
  7. Explain a game term the first time it matters only when the Rules Reference doesn't already cover it; otherwise use the term as is.
- **UI copy** (exact strings):
  - wording switch buttons: `Plain English` / `Official wording`;
  - fallback label when no checked plain text exists: `Official wording (plain-English version not ready yet)`;
  - amendment note prefix: `Rules update:`;
  - report button: `Report a rules error`;
  - report dialog title: `Report a rules error`;
  - its options: `It's wrong`, `It's unclear`, `There's a typo`, `Something else`;
  - its note field label: `Tell us more (optional)`;
  - its buttons: `Send report` / `Cancel`;
  - after saving: `Thanks. We've saved your report.`
- **Wording preference:** `localStorage` key `recruit.wording`, values `plain` | `official`, default `plain`. Reads and writes are wrapped in try/catch, so a blocked storage falls back to `plain`.
- New routes are behind sign-in, like the existing faction pages.

## Review Focus
1. **Official text changes after its plain English was written** (a data update, or a new amendment). The old plain text must stop showing, and the official text shows with the fallback label until the plain text is rewritten. *Task 5 test `changed official text hides the old plain text`.*
2. **Unusual number, dice and keyword forms:**
   - in the official text: `D3+3`, `2D6`, `D6+1`, `<DYNASTY>`, `6″` (curly inch mark), `+1`, `-1`, `4+`, `4++`, `1CP`;
   - in the plain English: number words such as "three".

   None may cause a false pass. *Task 4 tests `curly inch marks`, `dice with modifiers`, `angle-bracket keywords`, `number words in plain text count`, `a changed distance in plain text is flagged`.*
3. **Search queries with punctuation or odd casing:** "look out sir", "Look Out, Sir!", "T'au", "overwatch", "OVERWATCH", a typo with no hits. Each finds the right section or shows the empty-state copy, and never throws. *Task 9 tests.*
4. **Reporting while offline or signed out of sync:** the report is saved locally as a dirty document and synced later, never lost. *Task 8 test `a report saved with no network stays dirty and is listed`.*
5. **Very long rules text and wide tables on a phone** (Reanimation Protocols is about 1,600 characters; terrain trait tables). No horizontal page overflow at 375px; tables scroll inside `.table-scroll`. *Task 18 e2e.*

---

## File Structure
```
L:\9th Edition\ (research library, not in git)
  01_Core_Rules/Core_Rules_Turn_Sequence.md        + Indirect Fire penalty (Task 1)
  02_Missions_and_Game_Modes/*.md                  secondaries count; Aircraft cap attribution (Task 1)
  **/*.md                                          tabletopbattles.com -> goonhammer.com (Task 1)
  README.md                                        + "Corrections (October 2026)" (Task 1)
app/
  package.json                                     + script content:todo
  .gitignore                                       + packages/content/todo/
  packages/content/                                NEW workspace (authored content only)
    package.json  STYLE.md
    plain/<shard>.json                             plain-English texts by official-text hash
    rules/<nn>-<id>.md  rules/glossary.md           Rules Reference articles and glossary
    guides/<catalogue-slug>.md                     one per playable catalogue (42)
    review/<catalogue-slug>.md                     spot-check records (42)
  packages/data/
    overrides/stratagem-factions.json   NEW  catalogue -> Wahapedia faction/subfactions
    overrides/stratagems.json           NEW  superseded or duplicate stratagems to drop
    overrides/core-stratagems.json      NEW  the core stratagem ids
    overrides/amendments.json           NEW  final-GW changes the sources missed
    src/model/types.ts                  StratagemOut, plain fields, content types
    src/text.ts                         + titleCase
    src/extract/stratagems.ts           NEW  selectStratagems, coreStratagems
    src/plain/check.ts                  NEW  tokens, cross-check, copy check (browser-safe)
    src/plain/collect.ts                NEW  official texts, keys, shards
    src/plain/store.ts                  NEW  load content, apply plain text, report
    src/content/markdown.ts             NEW  frontmatter + Markdown subset -> Block JSON
    src/content/build.ts                NEW  rules.json, guides/<slug>.json
    src/build.ts                        wires stratagems, amendments, plain text, content
    scripts/content-todo.ts             NEW  per-shard to-do lists and spot-check samples
    test/stratagems.test.ts  test/final-rules.test.ts  test/plain-check.test.ts
    test/plain-store.test.ts  test/content-build.test.ts  test/rules-content.test.ts
    test/guides-content.test.ts  test/plain-coverage.test.ts  test/spot-check.test.ts
    test/fixtures/content/...
  apps/web/
    supabase/migrations/0002_rules_reports.sql     NEW
    src/storage/types.ts                           DocKind + 'report'
    src/factions/dataClient.ts                     + getRules, getCoreStratagems, getGuide
    src/rules/wording.tsx  RulesText.tsx  Blocks.tsx  ReportButton.tsx  reports.ts  search.ts
    src/rules/RulesHome.tsx  RulesArticlePage.tsx  GlossaryPage.tsx  CoreStratagemsPage.tsx
    src/rules/GuidesIndexPage.tsx  ReportsPage.tsx
    src/factions/FactionGuidePage.tsx  StratagemsPage.tsx  StratagemCard.tsx  FactionTabs.tsx
    src/factions/DatasheetPage.tsx  FactionPage.tsx  src/routes.tsx  src/App.tsx  src/pages/Legal.tsx
    e2e/rules.spec.ts
```

---

### Task 1: Research library fixes

The library sits outside git, so back it up first. Every edit is logged in the README.

**Files (all under `L:\9th Edition\`):**
- Modify: `02_Missions_and_Game_Modes/Secondary_Objectives.md`, `02_Missions_and_Game_Modes/Matched_Play_Overview.md`, `02_Missions_and_Game_Modes/Combat_Patrol_and_Boarding_Actions.md`, `02_Missions_and_Game_Modes/Other_Modes.md`, `01_Core_Rules/Core_Rules_Turn_Sequence.md`, and every `.md` file with a `tabletopbattles.com` link (about 270 links)
- Modify: `README.md` (new section `## Corrections (October 2026)`)
- Create (scratchpad, not the library): a zip backup of all library `.md` files, and the link-check script and its output

**Fixes, with the source each one rests on:**
1. **Core Book secondaries: the count is 17.**
   - The Wahapedia `Secondaries.csv` rows with `game = "Matched Play"` and no faction are exactly 17. Every one of them must appear in the Core Book column of the Secondary_Objectives table:
     - Assassinate, Bring It Down, Titan Slayers, Slay the Warlord;
     - Thin Their Ranks, Attrition, While We Stand We Fight, First Strike;
     - Engage on All Fronts, Linebreaker, Domination;
     - Investigate Sites, Repair Teleport Homer, Raise the Banners High;
     - Abhor the Witch, Mental Interrogation, Psychic Ritual.
   - Change the table's Count cell from 16 to 17, adding any row that's missing.
   - Grep all 52 files for any other Core Book secondaries count and make it agree.
2. **Aircraft caps come from the first Balance Dataslate (9 Nov 2021), not the Core Book.**
   - Matched_Play_Overview §2: keep the table but move "Max AIRCRAFT models" out of it into a note under it. The note says the caps (1 at Combat Patrol and Incursion, 2 at Strike Force, 3 at Onslaught, counted in models) came from that dataslate and stayed to the end of 9th.
   - §3 "Universal Matched Play Rules (Core Book and later FAQs)": attribute each bullet correctly. Aircraft caps come from the 9 Nov 2021 dataslate, and starting in Strategic Reserves from Arks of Omen (Jan 2023). Indirect Fire comes from the 14 Apr 2022 dataslate, and the Astra Militarum exemption ended in Jan 2023.
   - Check the Aircraft lines in Combat_Patrol_and_Boarding_Actions.md (line ~22) and Other_Modes.md (line ~60) and add the same attribution.
3. **Indirect Fire in the turn sequence.** In Core_Rules_Turn_Sequence.md's Shooting phase section (near the "Targets must be in range and visible" bullet), add a bullet in the library's paraphrase style, matching Balance_Dataslates.md line ~83:
   - the penalty: worse BS by 1, and +1 to the target's armour save, which stacks with cover;
   - added 14 Apr 2022;
   - the Astra Militarum exemption removed Jan 2023.

   Cite `05_Balance_Errata_and_Points/Balance_Dataslates.md`.
4. **Goonhammer links.**
   1. Rewrite every `https://www.tabletopbattles.com/<path>` and `https://tabletopbattles.com/<path>` to `https://www.goonhammer.com/<path>`.
   2. Request every rewritten URL (GET, follow redirects, 10 s timeout, one at a time with a short pause).
   3. A URL that doesn't end in HTTP 200 gets ` (link unverified)` appended. If a web search for the article title finds the right goonhammer.com URL, use that instead.
   4. Record the totals (rewritten / verified / unverified) in the README corrections section.

- [ ] **Step 1:** Zip all library `.md` files (not `app/`) into the scratchpad as `library-backup-2026-10-21.zip`, and list the zip's entry count. Expected: 52 entries.
- [ ] **Step 2:** Apply fixes 1–3. Verify:
  - `grep -n "Count" 02_Missions_and_Game_Modes/Secondary_Objectives.md` shows `| **Count** | 17 |`;
  - `grep -rn -i "indirect" 01_Core_Rules/Core_Rules_Turn_Sequence.md` has a hit;
  - `grep -rn -i "Core Book and later FAQs" 02_Missions_and_Game_Modes` has none.
- [ ] **Step 3:** Run the link rewrite and check (the script lives in the scratchpad). Verify `grep -rn "tabletopbattles" --include=*.md L:/9th\ Edition --exclude-dir=app` returns nothing.
- [ ] **Step 4:** Write the README corrections section: one line per fix, with the source and the link totals.
- [ ] **Step 5:** No git commit (outside the repo). Report the four diffs (a short before/after for fixes 1–3) to the controller.

### Task 2: Stratagems in the faction data

**Files:**
- Create: `packages/data/src/extract/stratagems.ts`, `packages/data/overrides/stratagem-factions.json`, `packages/data/overrides/stratagems.json`, `packages/data/overrides/core-stratagems.json`
- Modify: `packages/data/src/model/types.ts`, `packages/data/src/text.ts`, `packages/data/src/wahapedia/load.ts` (load `StratagemPhases.csv` as `stratagemPhases`), `packages/data/src/join/wahapedia.ts` (`Overrides`, `loadOverrides`), `packages/data/src/build.ts`
- Test: `packages/data/test/stratagems.test.ts`, `packages/data/test/text.test.ts`

**Interfaces:**
- Produces, in `model/types.ts`:
```ts
export interface StratagemOut {
  id: string;        // Wahapedia id
  name: string;      // titleCase of the Wahapedia name: "Command Re-roll"
  cp: string;        // as printed: "1", "2", "1/2"
  group: string;     // the type's prefix before " – " ("Necrons", "Annihilation Legion"), else the faction name
  kind: string;      // the type after the prefix, without " Stratagem": "Battle Tactic", "Epic Deed", "Wargear", "Strategic Ploy", "Core"
  phases: string[];  // StratagemPhases rows for this id, file order
  text: string;      // htmlToText(description)
  amended?: string;  // Task 3
  plain?: string;    // Task 5
}
// CatalogueOut gains: stratagems: StratagemOut[]   ([] for library catalogues)
```
- Produces: `titleCase(s: string): string`. It lower-cases the string, then capitalises the first letter of each space-separated word. Small words (`a an and as at by for from in into of on or the to with`) stay lower-case unless they come first. The part after a hyphen or apostrophe stays lower-case. Examples: `"COMMAND RE-ROLL"` → `"Command Re-roll"`; `"T'AU EMPIRE"` → `"T'au Empire"`; `"SONS OF THE FORGE"` → `"Sons of the Forge"`.
- Produces: `selectStratagems(w: Wahapedia, entry: StratagemFaction, exclude: Set<string>): StratagemOut[]`, where `StratagemFaction = { catalogueName: string; factionId: string; subfactions: 'all' | string[]; source: string }`. It also produces `coreStratagems(w: Wahapedia, ids: string[]): StratagemOut[]`.
- Build output: `CatalogueOut.stratagems`, and `generated/core-stratagems.json` (`StratagemOut[]`, in the order of `core-stratagems.json`).

**Decisions:**
- **A Wahapedia row belongs to a catalogue when all three hold:**
  - `faction_id === entry.factionId`;
  - `subfaction_id` is empty, equals `factionId`, or `entry.subfactions` is `'all'` or includes it;
  - its id isn't in `overrides/stratagems.json`.
- **Matched-play filter (drop the row):**
  - `is_boarding_action === 'true'`;
  - `type` matches `/Boarding Action|Requisition|Crusade/`.
- **`stratagem-factions.json`:** exactly one entry per playable catalogue (42). Each has a `source` naming the Wahapedia faction page or the library file.
  - Chapter catalogues (Blood Angels, Ultramarines, …) list `SM` with their own `CH..` subfaction plus their successor chapters' ids (for example Blood Angels: `CHBA`, `CHFT`, `CHLA`).
  - `Imperium - Space Marines` lists `SM` with the subfactions of chapters that have no catalogue of their own.
  - Necrons, CSM and others with dynasty or legion stratagems use `'all'`.
  - Work out each list from `Factions.csv` (`parent_id`).
- **`stratagems.json`:** `[{ id, name, reason, source }]`. Use it to drop superseded copies: Wahapedia has 72 name+faction duplicates, many of them pre-codex versions.
  - For each duplicate inside one catalogue's output, keep the version from the latest source in `Source.csv` (newest codex or supplement, or a later errata date).
  - Drop the others with `reason: "superseded by <source name>"`.
- **`core-stratagems.json`:** `[{ id, name, source }]` for the 7 Core Book stratagems and the Arks of Omen requisitions:

| id | name |
|---|---|
| 000002134002 | Command Re-roll |
| 000002134003 | Cut Them Down |
| 000002134004 | Desperate Breakout |
| 000002134005 | Emergency Disembarkation |
| 000002134006 | Fire Overwatch |
| 000002134007 | Counter-offensive |
| 000002134008 | Insane Bravery |
| 000008013002 | Warlord Trait |
| 000008013003 | Relic |
| 000008013004 | Heroic Support |

  The 7 Core Book entries cite `01_Core_Rules/Core_Stratagems.md` §2. The three requisitions cite §3 (Arks of Omen). They keep `kind: "Requisition"` and `group: "Arks of Omen"`; the Core Book ones get `group: "Core Book"` and `kind: "Core"`. The requisition-type filter above doesn't apply to core ids. "New Orders" (`000007114002`) is a Tempest of War stratagem (`02_Missions_and_Game_Modes/Other_Modes.md`), so it isn't included.

- [ ] **Step 1: Write the failing tests.**
  - `titleCase` examples above.
  - `every playable catalogue has one stratagem-factions entry; libraries have none` (a library's `stratagems` is `[]`).
  - `no boarding, requisition or crusade stratagems in any catalogue`.
  - `no catalogue lists two stratagems with the same name and group`.
  - `core stratagems are the ten ids in order` (names as in the table, `Command Re-roll` with `cp: "1"`, and `Desperate Breakout` phases include `Movement phase`).
  - **Real data, Necrons:**
    - includes `Swift Dismemberment` with `group: "Annihilation Legion"`, `kind: "Battle Tactic"`, `cp: "1"`;
    - includes exactly one `Resurrection Protocols`, with `kind: "Epic Deed"`;
    - every stratagem has non-empty `text` and at least one phase. If the data has a phaseless row, assert the exact list of phaseless names instead, so new ones are noticed.
  - **Real data, coverage:** every non-excluded, matched-play Wahapedia stratagem of a mapped faction appears in at least one catalogue. Print the missing names on failure.
- [ ] **Step 2:** Run `npm test -w packages/data -- stratagems text`. Expected: FAIL.
- [ ] **Step 3:** Implement, write the three override files, wire the build, and validate the overrides there: unknown catalogue names and unknown ids throw, as in `loadPolicy`.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS. Put the total stratagem count in the commit message.
- [ ] **Step 5:** Commit: `feat(data): matched-play stratagems per faction and the core stratagems`.

### Task 3: Final-rules check and amendments

BSData v9.8.0 and the Wahapedia snapshot both postdate the 13 Apr 2023 dataslate, but nothing proves they carry every change. This task proves it for the changes that touch text we show.

**Files:**
- Create: `packages/data/overrides/amendments.json`, `packages/data/test/final-rules.test.ts`
- Modify: `packages/data/src/build.ts`, `packages/data/src/model/types.ts` (`AbilityOut.amended?`, `CatalogueOut.rules[].amended?`)

**Interfaces:**
- Produces `Amendment = { catalogueName: string; kind: 'ability' | 'rule' | 'stratagem'; name: string; cp?: string; note: string; source: string }`, applied in the build:
  - a stratagem's `cp` is replaced when `cp` is set;
  - `note` (our own words, one or two sentences) goes into `amended`.
  - It applies to every unit ability with that name in the catalogue, or to the named rule or stratagem. The build throws if an amendment matches nothing.

**Decisions:**
- **The checks** come from `05_Balance_Errata_and_Points/Balance_Dataslates.md`: the 5 Jan 2023 (Arks of Omen) and 13 Apr 2023 dataslates, plus earlier changes that were still in force at the end. Every change there to a stratagem's CP or effect, a datasheet ability or an army rule becomes one row in `final-rules.test.ts`:
```ts
interface FinalRuleCheck { catalogue: string; kind: 'ability' | 'rule' | 'stratagem'; name: string; cp?: string; contains?: string[]; absent?: string[]; source: string }
```
  - `contains` and `absent` are short factual fragments: numbers, keywords, a phrase of 2–4 words.
  - The test reads the value after amendments, so a check passes when either the data or an amendment carries the change.
- **Rows the library marks "(unverified)"** are written as `test.todo` with the reason, never as assertions.
- **When the data disagrees with a check:**
  1. Confirm with the dataslate summary in the library and the Wahapedia text.
  2. Add an amendment.
  3. Never edit the check to match the data.
- **Points changes are out of scope.** Milestone 2's corpus covered them.

- [ ] **Step 1:** Write `final-rules.test.ts` with every applicable change (expect roughly 20–60 rows) and an empty `amendments.json` (`[]`).
- [ ] **Step 2:** Run `npm run data:build && npm test -w packages/data -- final-rules`. Expected: any failures are real gaps.
- [ ] **Step 3:** Add one amendment per gap, each with its source, and implement the build step. Add a unit test: `an amendment that matches nothing throws`.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `test(data): final-rules checks against the 2023 dataslates; amendments for gaps`.

### Task 4: Plain-English checker

**Files:**
- Create: `packages/data/src/plain/check.ts`
- Test: `packages/data/test/plain-check.test.ts`

**Interfaces:**
- Produces (browser-safe, no `node:` imports):
```ts
export type TokenKind = 'dice' | 'roll' | 'mod' | 'dist' | 'num' | 'kw';
export interface Token { kind: TokenKind; value: string } // canonical value: 'D3+3', '5+', '+1', '6"', '3', 'CORE INFANTRY'
export function normaliseRulesText(s: string): string;
export function extractTokens(text: string): Token[];        // deduplicated, first-seen order
export interface CrossCheck { missing: Token[]; extra: Token[] }
export function crossCheck(official: string, plain: string): CrossCheck;
export interface CopyCheck { longestRun: number; shared4: number; copied: boolean }
export function copyCheck(official: string, plain: string): CopyCheck;
export interface PlainVerdict { ok: boolean; missing: Token[]; extra: Token[]; copy: CopyCheck }
export function checkPlain(official: string, plain: string, waive?: Record<string, string>): PlainVerdict;
```

**Decisions:**
- **`normaliseRulesText`:**
  - `″ “ ”` → `"`; `’ ‘` → `'`; `– —` → `-`; non-breaking space → space; collapses whitespace;
  - `(\d+)\s*(inches|inch)\b` → `$1"`;
  - `(\d+)\s*"` → `$1"`.
- **Token rules,** applied to normalised text in this order. Text consumed by one rule isn't re-read by a later one.
  1. **dice:** `/\b(\d*)D(\d+)(?:\s*([+-])\s*(\d+))?\b/` (capital D in the official text; either case in plain). Value: `${n}D${s}${sign}${k}` with no spaces, n omitted when empty or 1.
  2. **roll:** `/\b(\d+)\+(?!\d)/`. Value `5+`. `4++` gives roll `4+`.
  3. **mod:** `/(?<![\w"])([+-])(\d+)\b/`. Value `+1` or `-1`.
  4. **dist:** `/\b(\d+(?:\.\d+)?)"/`. Value `6"`.
  5. **num:** any other standalone integer. Value `3`. `1CP` gives num `1` plus kw `CP`.
  6. **kw:** maximal runs of words in which every word matches `/^<?[A-Z][A-Z0-9'\-]*>?$/` and has at least 2 letters. Words that are dice tokens are excluded. Value: the run joined by single spaces.
- **Number words in plain text:** `zero`–`twenty` are read as their digits before extracting.
- **`crossCheck`:**
  - **missing:**
    - a `num` official token is satisfied by any plain token with the same numeric value (num, the count in a dice token, roll, mod magnitude, dist);
    - `dice`, `roll`, `mod` and `dist` need the same kind and value;
    - `kw` needs the run to appear in the plain text as whole words, case-insensitive. A trailing `s` on the last word is allowed (`CHARACTERS`).
  - **extra:** plain `dice`, `roll`, `mod` and `dist` tokens with no equal official token.
- **`copyCheck`:** words are lower-cased, punctuation is stripped, and keyword runs count as words.
  - `longestRun` is the longest common run of consecutive words.
  - `shared4` is the fraction of the plain text's distinct word 4-grams that occur in the official text.
  - `copied = longestRun >= 12 || (officialWords >= 20 && shared4 >= 0.5)`.
- **`checkPlain`:** a token whose `value` is a key of `waive` is dropped from `missing` and `extra`. `ok` is true when `missing` and `extra` are empty and `copied` is false. Copying can't be waived.

- [ ] **Step 1: Write the failing tests** (each asserts exact token values or the verdict):
  - `extracts dice, rolls, modifiers, distances, numbers and keywords` from `Roll 2D6; on a 4+ add 1 to hit rolls (+1) for CORE INFANTRY units within 6".` The expected token list is spelled out in full.
  - `curly inch marks`: `within 6″` gives `6"`.
  - `dice with modifiers`: `D3+3` and `D6 + 1` give `D3+3` and `D6+1`; `D3` alone gives `D3`.
  - `angle-bracket keywords`: `<DYNASTY> CORE` is one kw token.
  - `4++ is a 4+ roll`.
  - `number words in plain text count`: official `select 3 units`, plain `pick three units`, no missing.
  - `a changed distance in plain text is flagged`: official `6"`, plain `9"` gives missing `6"` and extra `9"`.
  - `keywords match case-insensitively with a plural s`.
  - `waived tokens don't fail`, and `copying can't be waived`.
  - `a 12-word shared run is copied, an 11-word run isn't`.
  - `a short official text may be close`: 8-word official, identical plain, `copied` false.
  - `half the 4-grams shared fails for long texts`.
  - **Real data smoke:** for every official text in `necrons.json`, `extractTokens` doesn't throw and `crossCheck(t, t)` has no missing or extra tokens.
- [ ] **Step 2:** Run `npm test -w packages/data -- plain-check`. Expected: FAIL.
- [ ] **Step 3:** Implement `check.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): plain-English cross-check and copy check`.

### Task 5: Plain-English store, to-do lists and build join

**Files:**
- Create: `packages/content/package.json` (`{"name":"@recruit/content","private":true,"version":"0.1.0"}`), `packages/content/STYLE.md`, `packages/content/plain/.gitkeep`, `packages/data/src/plain/collect.ts`, `packages/data/src/plain/store.ts`, `packages/data/scripts/content-todo.ts`
- Modify: `packages/data/src/model/types.ts`, `packages/data/src/build.ts`, `packages/data/package.json` (script `content-todo`), root `package.json` (`"content:todo": "npm run content-todo -w packages/data --"`), `.gitignore` (`packages/content/todo/`)
- Test: `packages/data/test/plain-store.test.ts`

**Interfaces:**
- Consumes: `checkPlain`, `normaliseRulesText` (Task 4); `StratagemOut` and amendments (Tasks 2–3).
- Produces, in `model/types.ts` (browser-safe, so the web app can import them):
  - `AbilityOut.plain?: string`;
  - `ProfileOut.plain?: Record<string, string>` (keyed by characteristic name);
  - `CatalogueOut.rules[].plain?: string`;
  - `StratagemOut.plain?` (Task 2);
  - `export const TEXT_CHARS = ['Abilities', 'Details', 'Powers Known', 'Other'] as const;`, the profile characteristics that hold rules text.
- Produces, in `collect.ts`:
```ts
export type TextKind = 'ability' | 'weapon' | 'psychic' | 'rule' | 'stratagem';
export interface OfficialText { key: string; shard: string; kind: TextKind; name: string; text: string }
export function officialFor(text: string, amended?: string): string; // text, plus "\n\nRules update: " + amended when present
export function textKey(official: string): string;                    // sha1 of normaliseRulesText(official), first 12 hex chars
export function collectOfficialTexts(cats: CatalogueOut[], core: StratagemOut[]): OfficialText[];
export function textsInCatalogue(cat: CatalogueOut): OfficialText[];  // every text shown on that faction's pages, any shard
```
- Produces, in `store.ts`:
```ts
export interface PlainEntry { name: string; kind: TextKind; plain: string; waive?: Record<string, string> }
export type PlainShard = Record<string, PlainEntry>; // key -> entry, keys sorted when written
export function loadPlainStore(dir: string): Map<string, PlainEntry & { shard: string }>;
export interface ShardReport { total: number; written: number; flagged: { key: string; name: string; missing: string[]; extra: string[] }[]; copied: { key: string; name: string; longestRun: number }[] }
export interface PlainReport { shards: Record<string, ShardReport>; orphans: { shard: string; key: string; name: string }[] }
export function applyPlain(cats: CatalogueOut[], core: StratagemOut[], store: ReturnType<typeof loadPlainStore>): PlainReport;
```

**Decisions:**
- **What is collected:**
  - every unit ability;
  - every `TEXT_CHARS` value of weapons and psychic profiles that has more than 3 words and isn't `-`;
  - every catalogue rule;
  - every faction stratagem and core stratagem.

  Values of 3 words or fewer (`Blast`, `Melta 2`) are keyword labels the Rules Reference explains, so they're shown as they are. The official text checked and hashed is `officialFor(text, amended)`.
- **Shards:**
  - core stratagems go in `core`;
  - unit texts go in the slug of the unit's `catalogueId` (so Space Marines library units are written once);
  - rules and stratagems go in their catalogue's slug.
  - Keys are global. The first occurrence wins, iterating `core`, then catalogues in `index.json` order.
- **`applyPlain`** sets the `plain` field only when an entry exists for the key and `checkPlain(...).ok`. Flagged and copied entries are reported, not applied.
  - Entries whose key no longer occurs are `orphans`.
  - The build writes `generated/plain-report.json` and logs a one-line total.
  - The build **fails** if the same key exists in two shard files.
- **`content-todo`:**
  - `npm run content:todo -- <shard>` writes `packages/content/todo/<shard>.json`. It contains every text of that shard without a passing entry: `{ key, kind, name, official, tokens: string[], problem?: { missing, extra, copied } }`. It prints `<shard>: <total> texts, <written> written, <todo> to do`.
  - `--all` prints that line for every shard.
  - `--sample <catalogue-slug> <n>` prints a deterministic sample (seeded by the slug) of `n` keys from `textsInCatalogue`, for Task 17.
- **`STYLE.md`** holds:
  - the Global Constraints style rules, copy rule and token rules, in the content author's terms;
  - the JSON entry format;
  - the authoring loop: run to-do, write entries, run to-do again until 0, then run tests;
  - three worked examples taken from real Necrons texts: an ability, a stratagem and a weapon ability text, each with its plain version and a note on why it passes.

- [ ] **Step 1: Write the failing tests** (fixture catalogues built in the test; no real content needed):
  - `keys are stable and ignore whitespace and quote style`.
  - `a text shared by two catalogues is collected once, in the first shard`.
  - `short weapon labels are not collected`.
  - `a passing entry sets plain; a flagged entry doesn't and is reported`.
  - *Review Focus 1:* `changed official text hides the old plain text`. Build, apply, change the official text by one number, rebuild: `plain` is unset and the old entry is an orphan.
  - `an amended text includes the amendment in its key and its check`.
  - `the same key in two shard files throws`.
  - `textsInCatalogue includes library unit texts and the catalogue's stratagems`.
  - **Real data:** `collectOfficialTexts` over the generated catalogues returns more than 4,000 texts, every playable catalogue has at least 1 text in `textsInCatalogue`, and no key collides with a different normalised text.
- [ ] **Step 2:** Run `npm test -w packages/data -- plain-store`. Expected: FAIL.
- [ ] **Step 3:** Implement `collect.ts`, `store.ts`, the build join (after amendments, before writing catalogues), the script and `STYLE.md`.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data && npm run content:todo -- --all`. Expected: tests PASS, and every shard shows `0 written`.
- [ ] **Step 5:** Commit: `feat(data): plain-English store, to-do lists and checked join into faction data`.

### Task 6: Rules and guide content compiler

**Files:**
- Create: `packages/data/src/content/markdown.ts`, `packages/data/src/content/build.ts`, `packages/data/test/fixtures/content/` (one article, a glossary with 2 terms, one guide), `packages/content/rules/.gitkeep`, `packages/content/guides/.gitkeep`
- Modify: `packages/data/src/model/types.ts`, `packages/data/src/build.ts`
- Test: `packages/data/test/content-build.test.ts`

**Interfaces:**
- Produces, in `model/types.ts`:
```ts
export type Inline = { t: 'text'; v: string } | { t: 'b'; c: Inline[] } | { t: 'i'; c: Inline[] } | { t: 'a'; href: string; c: Inline[] };
export type Block =
  | { t: 'h3'; id: string; c: Inline[] } | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Block[][] } | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'note'; kind: 'tip' | 'unconfirmed'; c: Inline[] };
export interface RulesSection { id: string; title: string; blocks: Block[]; text: string }   // text: plain text for search
export interface RulesArticle { id: string; title: string; order: number; summary: string; intro: Block[]; sections: RulesSection[] }
export interface GlossaryTerm { id: string; term: string; blocks: Block[]; text: string }
export interface RulesData { articles: RulesArticle[]; glossary: GlossaryTerm[] }
export interface KeyUnit { name: string; unitSlug: string; why: Inline[] }
export interface FactionGuide { slug: string; title: string; plays: Block[]; armyRules: Block[]; keyUnits: KeyUnit[] }
```
- Produces, in `markdown.ts`: `parseFrontmatter(src: string, file: string): { meta: Record<string, string | string[]>; body: string }`, `compileMarkdown(body: string, file: string): { intro: Block[]; sections: { id: string; title: string; blocks: Block[] }[] }`, `blocksText(blocks: Block[]): string`.
- Produces, in `build.ts`: `buildContent(contentDir: string, cats: CatalogueOut[]): { rules: RulesData; guides: FactionGuide[] }`. The main build writes `generated/rules.json` and `generated/guides/<slug>.json`.

**Decisions:**
- **Frontmatter** is between `---` lines, with `key: value` and `key: [a, b]` only.
  - Articles: `id`, `title`, `order`, `summary`, `sources`.
  - `glossary.md`: `id: glossary`, `title`, `sources`.
  - Guides: `catalogue` (exact catalogue name), `title`, `sources`.
  - `sources` entries must match `/^0[1-5]_[^/]+\/.+\.md( §[\d.]+)?$/`. The build doesn't open the library, so it stays hermetic.
- **Markdown subset:**
  - `##` starts a section (or a glossary term);
  - `###` makes an `h3` with a slug id;
  - blank-line-separated paragraphs;
  - `- ` and `1. ` lists, with one nested level by two-space indent;
  - `**bold**`, `*italic*`, `[text](href)`;
  - pipe tables with a header separator row;
  - `> **Tip:** …` and `> **Not confirmed:** …` notes.

  Anything else throws `<file>:<line>: unsupported Markdown "<snippet>"`: `#`, `####`, HTML tags, code, images, other blockquotes.
- **Links:** `href` must start with `/rules/`, `/factions/` or `#`. External links throw: sources are cited in frontmatter, not linked.
- **Ids:** `slugify(title)`, made unique within an article with `-2`, `-3`.
- **Content checks** (any violation throws, naming the file):
  - the text `(unverified)` (any case) appears anywhere;
  - `tabletopbattles` appears anywhere;
  - a guide doesn't have exactly the sections `How this army plays`, `Army rules`, `Key units` in that order;
  - a guide's `Key units` isn't a list of 3–8 items of the form `[[Unit Name]] - why it matters`, or a `[[Unit Name]]` doesn't match a unit `name` in that catalogue's JSON (exact, or ignoring a ` [Legends]` suffix);
  - a guide's `catalogue` isn't a playable catalogue;
  - two guides share a catalogue.
- **An empty content directory** builds to `{ articles: [], glossary: [] }` and no guides.

- [ ] **Step 1: Write the failing tests** against the fixture:
  - the article compiles to the expected `RulesArticle`, with `toEqual` on one section's blocks: a table, a nested list and a tip note;
  - glossary terms get ids;
  - the guide resolves `[[Necron Warriors]]` to `necron-warriors` (fixture catalogue);
  - each rejection above throws with file and line (one test each: HTML tag, external link, `(unverified)`, a missing guide section, an unknown key unit);
  - `blocksText` flattens a table and a list to searchable text.
- [ ] **Step 2:** Run `npm test -w packages/data -- content-build`. Expected: FAIL.
- [ ] **Step 3:** Implement, and wire it into `build.ts`, reading `join(root, '..', 'content')`.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS; `generated/rules.json` exists with empty arrays.
- [ ] **Step 5:** Commit: `feat(data): compile Rules Reference and faction guide Markdown into JSON`.

### Task 7: Wording switch and plain-English datasheets

**Files:**
- Create: `apps/web/src/rules/wording.tsx`, `apps/web/src/rules/RulesText.tsx`
- Modify: `apps/web/src/App.tsx` (wrap in `WordingProvider`), `apps/web/src/factions/DatasheetPage.tsx`, `apps/web/src/factions/__fixtures__/necrons.ts`, `apps/web/src/pages/Legal.tsx`, `apps/web/src/theme.css`
- Test: `apps/web/src/rules/wording.test.tsx`, `apps/web/src/factions/DatasheetPage.test.tsx`

**Interfaces:**
- Consumes: `AbilityOut.plain`, `ProfileOut.plain`, `amended` (Tasks 3, 5).
- Produces:
```ts
export type Wording = 'plain' | 'official';
export const WORDING_KEY = 'recruit.wording';
export function WordingProvider(props: { children: ReactNode; initial?: Wording }): JSX.Element;
export function useWording(): { wording: Wording; setWording(w: Wording): void };
export function WordingToggle(): JSX.Element; // two buttons, aria-pressed, role="group" aria-label="Rules wording"
export function RulesText(props: { official: string; plain?: string; amended?: string }): JSX.Element;
```

**Decisions:**
- **`RulesText`:**
  - With wording `plain` and `plain` set, it shows `plain`.
  - With `plain` unset, it shows `official` under the muted fallback label.
  - With wording `official`, it shows `official`.
  - `amended` adds a brass-bordered note `Rules update: {amended}` under either wording.
  - Text keeps line breaks (`white-space: pre-line`).
- **Datasheet:**
  - One `WordingToggle` under the unit's title line.
  - Ability cards use `RulesText`.
  - In the weapon and psychic tables, a `TEXT_CHARS` cell shows `plain[col]` when the wording is plain and it exists, otherwise the official value.
  - The Milestone 2 note `Official wording shown. Plain-English explanations arrive in Milestone 3.` is removed.
- **Legal page:** add `Plain-English rules text is written by Recruit+ in its own words; the official wording comes from BattleScribe data and Wahapedia.`

- [ ] **Step 1: Write the failing tests.**
  - The provider defaults to plain, and `setWording('official')` persists to `localStorage`.
  - A throwing `localStorage` still renders plain.
  - `RulesText` shows each of the three cases above, plus the amendment note.
  - Datasheet (fixture with `plain` on one ability and one weapon's `Abilities`):
    - plain is shown by default;
    - after clicking `Official wording`, the official ability text and weapon cell show and the button has `aria-pressed="true"`;
    - an ability without `plain` shows the fallback label.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): plain-English datasheets with a remembered official-wording switch`.

### Task 8: Report a rules error

**Files:**
- Create: `apps/web/src/rules/reports.ts`, `apps/web/src/rules/ReportButton.tsx`, `apps/web/src/rules/ReportsPage.tsx`, `apps/web/supabase/migrations/0002_rules_reports.sql`
- Modify: `apps/web/src/storage/types.ts` (`DocKind` adds `'report'`), `apps/web/src/routes.tsx` (`/rules/reports`), `apps/web/src/factions/DatasheetPage.tsx`
- Test: `apps/web/src/rules/reports.test.ts`, `apps/web/src/rules/ReportButton.test.tsx`

**Interfaces:**
- Consumes: `Repository`, `useStorage`, `useAuth`, `newDocId` (Milestones 1–2); `useWording` (Task 7).
- Produces:
```ts
export type ReportTargetKind = 'ability' | 'army-rule' | 'stratagem' | 'datasheet' | 'rules-section' | 'glossary' | 'guide';
export interface RulesReport {
  target: { kind: ReportTargetKind; name: string; path: string /* location.pathname + hash */ };
  problem: 'wrong' | 'unclear' | 'typo' | 'other';
  note: string;
  wording: Wording; text: string;  // what the user was looking at
  dataGeneratedAt: string;         // index.json generatedAt
}
export async function saveReport(repo: Repository, ownerId: string, report: RulesReport): Promise<string>; // kind 'report', id newDocId()
export function useReports(): { reports: Doc<RulesReport>[]; loading: boolean };
export function ReportButton(props: { target: Omit<RulesReport['target'], 'path'>; text: string }): JSX.Element;
```

**Decisions:**
- **`ReportButton`:**
  - A low-emphasis text button, at least 44px tall.
  - It opens the existing `lists/Panel.tsx` sheet with the dialog copy from Global Constraints: a radio group (`It's wrong` selected by default), the textarea, and `Send report` / `Cancel`.
  - Saving shows the thanks line for 3 s and closes the sheet.
- **Placement:**
  - one button per ability card, stratagem card and army-rule card;
  - one at the end of each rules section, glossary term and guide;
  - one at the end of each datasheet (`kind: 'datasheet'`, for profile and weapon tables).
- **`/rules/reports`** ("Your rules reports"):
  - newest first, each showing the date (`en-GB`), target name, problem label and note;
  - empty state: `You haven't reported anything yet.`
- **Migration `0002_rules_reports.sql`:**
  - drops and recreates the `documents.kind` check with `('list', 'game', 'progress', 'report')`;
  - creates `view public.rules_reports with (security_invoker = true)` selecting `id, owner_id, data, updated_at` from `documents` where `kind = 'report' and not deleted`.

  The maintainer reads that view with the service role: that's the issues list. Users can only ever read their own reports (existing RLS).

- [ ] **Step 1: Write the failing tests.**
  - `saveReport stores a dirty 'report' doc with a UUID`.
  - *Review Focus 4:* `a report saved with no network stays dirty and is listed`. Use a repository on fake-indexeddb with no remote, then `useReports` lists it.
  - ReportButton: open, pick `It's unclear`, type a note, `Send report`. The saved doc has `problem: 'unclear'`, the note, the target, `wording: 'plain'` and the shown text, and the thanks copy appears.
  - `Cancel` saves nothing.
  - ReportsPage renders the empty state, then a saved report.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement. Put the datasheet buttons in place now; Tasks 9–10 add the rest.
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): report a rules error, saved locally and synced; your reports page`.

### Task 9: Rules Reference pages and search

**Files:**
- Create: `apps/web/src/rules/Blocks.tsx`, `apps/web/src/rules/search.ts`, `apps/web/src/rules/RulesHome.tsx`, `apps/web/src/rules/RulesArticlePage.tsx`, `apps/web/src/rules/GlossaryPage.tsx`, `apps/web/src/rules/CoreStratagemsPage.tsx`, `apps/web/src/rules/__fixtures__/rules.ts`, `apps/web/src/factions/StratagemCard.tsx`
- Modify: `apps/web/src/factions/dataClient.ts`, `apps/web/src/routes.tsx` (replace the `/rules` placeholder; all rules pages lazy, like the builder)
- Test: `apps/web/src/rules/search.test.ts`, `apps/web/src/rules/RulesHome.test.tsx`, `apps/web/src/rules/Blocks.test.tsx`, `apps/web/src/rules/CoreStratagemsPage.test.tsx`

**Interfaces:**
- Consumes: `RulesData`, `Block`, `StratagemOut` (Tasks 2, 6); `RulesText`, `WordingToggle` (Task 7); `ReportButton` (Task 8).
- Produces:
  - `getRules(): Promise<RulesData>` (`/data/rules.json`), `getCoreStratagems(): Promise<StratagemOut[]>` (`/data/core-stratagems.json`), `getGuide(slug): Promise<FactionGuide>` (`/data/guides/<slug>.json`).
  - In `search.ts`:
```ts
export interface SearchDoc { id: string; kind: 'section' | 'term' | 'stratagem'; title: string; text: string; path: string }
export function searchDocs(rules: RulesData, core: StratagemOut[]): SearchDoc[]; // sections -> /rules/<article>#<section>, terms -> /rules/glossary#<id>, core -> /rules/stratagems#strat-<id>
export function search(docs: SearchDoc[], query: string, limit?: number): { doc: SearchDoc; snippet: string }[]; // limit default 20
```
  - `StratagemCard({ s }: { s: StratagemOut })`: name, `{cp} CP`, kind, phases joined `, `, then `RulesText` and `ReportButton`. Its element id is `strat-${s.id}`.
  - `Blocks({ blocks }: { blocks: Block[] })`: renders tables inside `.table-scroll`, notes as `.note--tip` / `.note--unconfirmed` (the latter titled `Not confirmed`), and internal links with `<Link>`.

**Decisions:**
- **Search normalisation:** lower-case; strip diacritics and apostrophes; replace `-` `,` `.` `!` `?` `"` `(` `)` `:` with spaces; split on whitespace. A doc matches when every query word is a prefix of some word in its title or text.
- **Search score** (higher first; ties by title):
  - 100: the title equals the query;
  - 50: the title starts with the query;
  - 30: all words are in the title;
  - 10: otherwise.
- **Snippet:** about 120 characters of `text` around the first matched word, with `…` at the cut ends.
- **Pages:**
  - **`/rules`:**
    - `h1` `Rules`;
    - a search box labelled `Search the rules`, placeholder `Try "look out sir" or "overwatch"`;
    - while there's a query, results (title, kind label, snippet; each a link) or `Nothing matches "{query}". Try fewer words.`;
    - otherwise, cards for each article in `order` (title + summary), then `Glossary`, `Core stratagems`, `Faction guides` (`/rules/factions`, Task 10) and `Your rules reports`.
  - **`/rules/:articleId`:** title, intro, then each section as an `h2` with `id`, its blocks and a `ReportButton`. A hash in the URL scrolls to that section after load. An unknown id shows `That rules page doesn't exist.` with a link to `/rules`.
  - **`/rules/glossary`:** a filter box and terms A–Z, each an `h2` with `id`.
  - **`/rules/stratagems`:** `WordingToggle`, then core stratagems grouped `Core Book` and `Arks of Omen` as `StratagemCard`s.

- [ ] **Step 1: Write the failing tests** (fixture `RulesData` with sections `Look Out, Sir`, `Overwatch` and `Engagement Range`, a glossary term `T'au`, and core stratagem `Fire Overwatch`):
  - *Review Focus 3:* `look out sir`, `Look Out, Sir!` and `LOOK OUT SIR` each give `Look Out, Sir` first; `t'au` and `tau` find the term; `overwatch` ranks the `Overwatch` section above `Fire Overwatch`; `zzzz` returns `[]`; an empty or whitespace query returns `[]`.
  - The snippet contains the match and is at most 125 characters.
  - RulesHome: typing `overwatch` lists results whose links go to `/rules/<article>#overwatch`; typing `zzzz` shows the empty-state copy.
  - Blocks renders a table inside `.table-scroll` and an unconfirmed note titled `Not confirmed`.
  - CoreStratagemsPage shows plain by default and the official text after the toggle.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): Rules Reference pages with search, glossary and core stratagems`.

### Task 10: Faction guide and stratagem pages

**Files:**
- Create: `apps/web/src/factions/FactionTabs.tsx`, `apps/web/src/factions/FactionGuidePage.tsx`, `apps/web/src/factions/StratagemsPage.tsx`, `apps/web/src/rules/GuidesIndexPage.tsx`
- Modify: `apps/web/src/factions/FactionPage.tsx`, `apps/web/src/routes.tsx`
- Test: `apps/web/src/factions/FactionGuidePage.test.tsx`, `apps/web/src/factions/StratagemsPage.test.tsx`

**Interfaces:**
- Consumes: `getGuide`, `getCatalogue`, `getIndex`, `StratagemCard`, `Blocks`, `RulesText`, `ReportButton`, `FactionPicker`.
- Produces routes: `/factions/:slug/guide`, `/factions/:slug/stratagems`, `/rules/factions`.

**Decisions:**
- **`FactionTabs`:** a row of three links under the faction title on all three faction pages (`Guide`, `Units`, `Stratagems`), each ≥ 44px, with `aria-current="page"` on the active one. Library catalogues show only `Units`.
- **Guide page:**
  - `h1` = faction display name;
  - `How this army plays` (Blocks);
  - `Army rules` (Blocks: the guide's summary);
  - `Key units`, a list of links to each datasheet with the `why` text;
  - then `Army rules in full`: a `WordingToggle`, and a `RulesText` card plus `ReportButton` for each `rules` entry of every catalogue in the faction's `rosterScope` (except `system`). Cards are grouped under the catalogue's display name when there's more than one, and catalogues with no rules are skipped.
  - The guide ends with a `ReportButton` (`kind: 'guide'`).
  - A missing guide file shows `No guide for this faction yet.` (only possible before Task 12).
- **Stratagems page:**
  - a `WordingToggle`;
  - a search box (`Search stratagems`) filtering by name or text;
  - phase chips (`All phases`, then each distinct `phases` value as written in the data, single-select; the data has its own `Any phase` value, which is a chip like any other);
  - groups in this order: the faction's own group first, then the others A–Z;
  - each card a `StratagemCard`.
  - Empty filter result: `No stratagems match.`
- **`/rules/factions`:** the `FactionPicker` list linking each playable faction to `/factions/:slug/guide`.

- [ ] **Step 1: Write the failing tests** (fixture catalogue with 2 rules, 3 stratagems in 2 groups, and a guide):
  - the guide page renders the three guide sections and a key-unit link to `/factions/necrons/units/necron-warriors`;
  - `Army rules in full` shows plain text, and official after the toggle;
  - the stratagems page groups with the own group first; the `Fight phase` chip leaves only fight-phase stratagems; searching a name narrows the list; a nonsense search shows `No stratagems match.`;
  - the tabs mark the current page.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): faction guide and stratagem pages`.

### Task 11: Rules Reference content

**Files:**
- Create: `packages/content/rules/01-basics.md` … `12-core-stratagems.md`, `packages/content/rules/glossary.md`
- Test: `packages/data/test/rules-content.test.ts`

**Articles** (id: title; sources). Each is written fresh for a newcomer from the already-paraphrased library, under the style rules, in the final 13 Apr 2023 state:

| id | Title | Sources |
|---|---|---|
| basics | The basics | 01_Core_Rules/Core_Rules_Turn_Sequence.md, Glossary_and_Keywords.md (datasheets, dice, re-rolls and modifiers, measuring, visibility, coherency, Engagement Range) |
| command-phase | Command phase | Core_Rules_Turn_Sequence.md |
| movement-phase | Movement phase | Core_Rules_Turn_Sequence.md (moves, Advance, Fall Back, FLY, AIRCRAFT, transports, reinforcements, Strategic Reserves) |
| psychic-phase | Psychic phase | Psychic_Phase.md |
| shooting-phase | Shooting phase | Core_Rules_Turn_Sequence.md, Balance_Dataslates.md (weapon types, Blast, Look Out Sir, Big Guns Never Tire, Indirect Fire) |
| charge-phase | Charge phase | Core_Rules_Turn_Sequence.md (charges, Overwatch, Heroic Interventions) |
| fight-phase | Fight phase | Core_Rules_Turn_Sequence.md |
| morale-phase | Morale phase | Core_Rules_Turn_Sequence.md (Morale, Combat Attrition) |
| terrain | Terrain | Terrain_Rules.md (categories, every trait, a "who gets cover" table) |
| army-building | Building a legal army | Army_Building_Detachments_and_CP.md, Matched_Play_Overview.md (Battle-forged, detachments, CP, Rule of Two/Three, the Arks of Omen detachment and allies) |
| matched-play | Matched play games | Matched_Play_Overview.md, Grand_Tournament_Mission_Packs.md, Secondary_Objectives.md (battle sizes, mission sequence, primaries and secondaries, Universal Matched Play Rules with their true sources) |
| core-stratagems | How stratagems work | Core_Stratagems.md §1 (CP, once per phase, links to `/rules/stratagems`) |

**`glossary.md`:** one `##` term per entry in Glossary_and_Keywords.md §2–§5. Unit-type keywords appear in CAPITALS. Each term is 1–4 sentences and links to the article that explains it.

**Pinned facts.** These are the tests. Each row asserts that a section's `text` contains every listed token, using `extractTokens` from Task 4. Section ids come from section titles, so name the sections to produce these ids: `Unit coherency`, `Engagement Range`, `Look Out, Sir`, and so on.

| Article#section (id) | Must contain |
|---|---|
| basics#unit-coherency | `2"`, `5"`, `6` (units of 6 or more need two neighbours) |
| basics#engagement-range | `1"`, `5"` |
| shooting-phase#look-out-sir | `3"`, `9` |
| charge-phase#charging | `12"`, `2D6` |
| shooting-phase#blast | `6`, `10`, `11`, `3` |
| shooting-phase#indirect-fire | `-1`, `+1` |
| psychic-phase#smite | `5`, `D3`, `D6`, `10` |
| psychic-phase#perils-of-the-warp | `D3` |
| matched-play#battle-sizes | `500`, `1000`, `2000`, `3000`, `3`, `6`, `12`, `18` |
| matched-play#aircraft | `1`, `2`, `3` |
| matched-play#secondary-objectives | `17` (Core Book), `11` (Arks of Omen) |

If the library disagrees with a pinned fact, stop and report it to the controller; don't change the test.

- [ ] **Step 1:** Write `rules-content.test.ts`:
  - the pinned-fact table;
  - `articles are the twelve ids in order`;
  - `glossary has at least 40 terms`;
  - `no section is empty`;
  - `every internal link resolves to an article, section or glossary term id`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Write the articles and glossary. Dispatch them as parallel subagents, at most 4, each with whole articles; the glossary goes to one agent. Each agent gets STYLE.md, the source files and this task's table.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS. Read two articles end to end in the dev server at 375px.
- [ ] **Step 5:** Commit: `content: plain-English Rules Reference and glossary`.

### Task 12: Faction guides (42)

**Files:**
- Create: `packages/content/guides/<catalogue-slug>.md` for each of the 42 playable catalogues
- Test: `packages/data/test/guides-content.test.ts`

**Decisions:**
- **Sources:**
  - Codex factions: their `03_Codexes/...` file.
  - Space Marine chapters with a supplement: `Space_Marine_Supplements.md` plus `Space_Marines.md`.
  - Agents, Assassins, Sisters of Silence and Astra Telepathica: `Imperial_Agents_and_Allies.md`.
  - Forge World, Legends and smaller catalogues (Titan Legions, Renegades & Heretics, Servants of the Abyss, Gellerpox, Fallen, Blackstone Fortress, Monsters and Gribblies, Legion of the Damned): `Other_Chaos_Content.md`, `04_Campaign_Books_and_Supplements/Imperial_Armour_and_Legends.md`, or the catalogue's own rules and units when the library has nothing. Sources rank above the library, so this is fine; the guide's `sources` then says `catalogue data`. Allow this by extending the sources pattern with the literal `catalogue data`. This is the one change to Task 6's code in this task, and it comes with a test.
- **Length and content:**
  - Each guide is 250–700 words.
  - `How this army plays` covers style, strengths and weaknesses, and what a new player should expect.
  - `Army rules` summarises the faction's main rules in plain English. It must agree with the catalogue's official `rules` text and the faction's stratagems (higher sources).
  - `Key units` lists 3–8 units, current datasheets before Legends.
- **Competitive history** appears only as final-state advice. Library claims marked unverified are left out.

- [ ] **Step 1:** Write `guides-content.test.ts`:
  - `every playable catalogue has exactly one guide`;
  - `each guide is 250–700 words`;
  - `each guide names at least 3 key units that resolve` (the compiler already throws on bad units; this pins the count).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Write the guides with parallel subagents grouped by library file. Each agent gets STYLE.md, the library file, and the catalogue JSON's `rules`, stratagem names and unit names.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `content: faction guides for every playable faction`.

### Tasks 13–16: Plain-English texts

Each task covers the shards listed below. The method is the same for all four.

**Method:**
1. Run `npm run content:todo -- <shard>` for each shard in the task.
2. Dispatch one subagent per shard, or per 150 texts for big shards (split by key order; each agent writes a separate temporary file that the controller merges). Each agent gets:
   - `packages/content/STYLE.md`;
   - the shard's to-do JSON;
   - the instruction to write `packages/content/plain/<shard>.json` entries only for its keys.

   No agent edits another shard.
3. Re-run the to-do until the shard says `0 to do`. Flagged texts are rewritten. A flag is waived only when the token is genuinely irrelevant to the meaning, with the reason written out, for example: `"waive": { "1": "\"1\" is part of the name \"Ka'tah Stance 1\"" }`.
4. Run `npm run data:build && npm test -w packages/data`.
5. Commit with the shard list and the count of texts and waivers.

| Task | Shards |
|---|---|
| 13 | `core`; `imperium-space-marines` and the 12 `imperium-adeptus-astartes-*` chapters; `imperium-fw-adeptus-astartes`; `imperium-legion-of-the-damned`; `fallen` |
| 14 | every other `imperium-*` shard |
| 15 | every `chaos-*` shard |
| 16 | every `aeldari-*`, `necrons`, `orks`, `tau-empire`, `tyranids*`, `leagues-of-votann`, `unaligned-*` shard; then enable coverage |

**Task 16 also adds `packages/data/test/plain-coverage.test.ts`.** Write it in Task 13 as `test.todo` and turn it on here. It asserts that across all shards:
- every collected text has a passing entry (written = total);
- there are no orphans;
- no entry is copied;
- the total number of waived tokens is under 2% of all checked tokens (printed in the commit).

- [ ] **Task 13 steps:** the method for its shards, plus the coverage test as `test.todo`. Commit: `content: plain English for core stratagems and the Space Marine family`.
- [ ] **Task 14 steps:** the method for its shards. Commit: `content: plain English for the rest of the Imperium`.
- [ ] **Task 15 steps:** the method for its shards. Commit: `content: plain English for Chaos`.
- [ ] **Task 16 steps:** the method for its shards, then turn the coverage test on, and run `npm run data:build && npm test -w packages/data`. Expected: PASS. Commit: `content: plain English for Xenos and Unaligned; plain-English coverage is complete`.

### Task 17: Spot-check of each faction

**Files:**
- Create: `packages/content/review/<catalogue-slug>.md` for each of the 42 playable catalogues
- Test: `packages/data/test/spot-check.test.ts`

**Decisions:**
- **Sample:** `npm run content:todo -- --sample <slug> 20` (deterministic), plus every catalogue rule of that faction, plus its guide.
- **The reviewer** is a fresh subagent per faction, not the one that wrote the texts. It compares each sampled plain text with its official text (shown via `generated/` data) for meaning:
  - effects, conditions, timing, limits, targets, numbers, keywords;
  - and the guide against the official rules.
- **Each finding is fixed** in the content file before the record is written. Its row says `FIXED` and what changed.
- **Record format:**
```
# Spot-check: <faction display name>
Sample: 20 texts (seed <slug>) + <n> army rules + guide

| Key | Name | Kind | Verdict | Note |
|---|---|---|---|---|
| 1a2b3c4d5e6f | Reanimation Protocols | rule | PASS | |
| 6f5e4d3c2b1a | Swift Dismemberment | stratagem | FIXED | plain text said "Fight phase"; official is "Shooting phase" |

Guide: PASS
```
- **If more than 3 of a faction's 20 samples need fixing,** the whole shard is re-reviewed by a second agent before the record is accepted, and the record says so.

- [ ] **Step 1:** Write `spot-check.test.ts`. For every playable catalogue:
  - the file exists;
  - its sampled keys are exactly the `--sample <slug> 20` keys (or all of them when fewer exist), plus every catalogue rule key;
  - every verdict is `PASS` or `FIXED`;
  - it has a `Guide:` line with `PASS` or `FIXED`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Dispatch the reviewers in parallel batches, apply their fixes, re-run the plain-English checks, and write the records.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS. Put the total FIXED count in the commit message.
- [ ] **Step 5:** Commit: `content: spot-check every faction's plain English and guide`.

### Task 18: End-to-end flow, manual walkthrough, whole-branch review

**Files:**
- Create: `apps/web/e2e/rules.spec.ts`
- Modify: `apps/web/e2e/smoke.spec.ts` (it may assert the removed Milestone 2 note; update it if so)

- [ ] **Step 1: Write the e2e test** (both projects, dev sign-in):
  1. `/rules`: search `look out sir`, open the first result, and expect the URL hash `#look-out-sir` and the section heading visible.
  2. `/rules/stratagems`: expect `Command Re-roll` in plain English. Tap `Official wording`, reload, and expect the official wording to persist (`aria-pressed="true"`).
  3. Switch back to `Plain English`. Open `/factions/necrons/guide`, follow the key-unit link for Necron Warriors, and expect the `Reanimation Protocols` card to show the plain text (the text from `necrons.json`'s `plain`, read in the test, not typed).
  4. On that card, `Report a rules error` → `It's unclear` → `Send report` → the thanks copy. Then `/rules/reports` lists `Reanimation Protocols`.
  5. `/factions/necrons/stratagems`: the `Fight phase` chip narrows the list. `Swift Dismemberment` is under `Annihilation Legion`.
  6. *Review Focus 5:* on `/factions/necrons/units/necron-warriors` and `/rules/terrain`, no horizontal overflow at 375px, and every button and link in `main` is ≥ 44px tall.
- [ ] **Step 2:** Run `npm test && npm run e2e` from the repo root. Expected: everything PASSES, in both projects.
- [ ] **Step 3: Manual check.**
  - Run the dev server. In the built-in browser at 375×812, walk: Rules search, one article, the glossary, core stratagems with the toggle, then the Necrons, Blood Angels and Imperial Knights guides and stratagem pages, plus a datasheet in each.
  - Screenshot the rules home, an article, a guide, a stratagems page and a datasheet in plain English for the user.
  - Note anything awkward as follow-ups.
- [ ] **Step 4:** Commit: `test: e2e Rules Reference, guides, plain-English datasheets and reports`.
- [ ] **Step 5: Whole-branch review.** Use superpowers:requesting-code-review, with a second reviewer focused on rules accuracy that re-samples 5 random factions' plain text against official text. Fix what they find, re-run `npm test && npm run e2e`, then use superpowers:finishing-a-development-branch.

---

## Needs the user (not blocking)
1. **Supabase:** reports sync and the maintainer's `rules_reports` view exist only once the Supabase project is set up and migration 0002 is applied. Until then, reports stay on the device and are listed on "Your rules reports".
2. **Rules accuracy spot-check:** the user is welcome to read any faction they know well and report errors with the new button. Those reports are the best check we have on top of the automated ones.
