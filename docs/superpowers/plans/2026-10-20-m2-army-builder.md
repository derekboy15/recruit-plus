# Milestone 2 (Army Builder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user can build, check, save, export and share a legal list for every playable 9th Edition catalogue, on a phone, with every problem explained in plain English with a fix.

**Architecture:**
- **Roster data:** the build pipeline emits each BattleScribe file's selection tree as compact JSON (`generated/roster/<slug>.json`), keeping links, costs, categories, constraints, modifiers, conditions and repeats. One file per `.cat`/`.gst`, so the 13 Space Marine chapters share one copy of the Space Marines library.
- **Roster engine:** a pure TypeScript module in `packages/data/src/roster/` (no Node imports), used by both the tests and the web app through the package export `@recruit/data/roster`. It has five layers:
  1. scope and link resolution
  2. evaluation: counts, conditions, modifiers and costs
  3. edits
  4. BSData constraint validation
  5. a matched-play policy layer for the rules BSData doesn't encode (battle-size detachment rules, Rule of Two/Three, points limit, faction checks)
- **Explanations:** issues become plain-English messages with a fix in `explain.ts`. Lists are stored as `kind: 'list'` documents through the existing repository and sync.
- **Sharing:** a public `/share/:id` route reads the document through the existing `is_public` RLS policy.

**Tech Stack:** unchanged from Milestone 1: Node 24, npm workspaces, TypeScript 7, Vitest 5, fast-xml-parser, Vite 8, React 19, React Router 6, Dexie 4, supabase-js 2, Playwright. No new runtime dependencies. Ids come from `crypto.randomUUID()`.

**Spec:** `docs/superpowers/specs/2026-10-20-recruit-plus-design.md` (sections 3.2, 4, 6 and 8). The Milestone 1 plan `docs/superpowers/plans/2026-10-20-m1-foundation.md` describes the code this plan builds on.

**Branch:** `m2-army-builder` (already created off `main` in `L:\9th Edition\app`).

**Scope notes:**
- Datasheets in the builder link to the Milestone 1 datasheet pages, which show the official wording. Plain-English text and its toggle arrive in Milestone 3, as already agreed.
- BSData's nested child forces (inside some .gst detachments) aren't used by any rule the builder needs, so they're dropped.

## Global Constraints
- Everything in the Milestone 1 Global Constraints still applies: sources and their precedence, overrides with a `source` note, 375×812 first, touch targets ≥ 44px, dark theme colours, the footer disclaimer, the Wahapedia credit.
- **Battle sizes** (spec §4):

| Size | Points limit | Mission rules | Detachments offered |
|---|---|---|---|
| Combat Patrol | 500 | Core Book "1. Eternal War" | Core Book detachments, max 1 |
| Incursion | 1000 | "5. Chapter Approved: Arks of Omen" | Arks of Omen |
| Strike Force | 2000 | "5. Chapter Approved: Arks of Omen" | Arks of Omen |
| Onslaught | 3000 | Core Book "1. Eternal War" | Core Book detachments, max 4 |

- **Core Book detachments** (Combat Patrol and Onslaught):
  - Patrol, Battalion, Brigade, Vanguard, Spearhead, Outrider, Supreme Command, Super-Heavy, Super-Heavy Auxiliary, Fortification Network, Auxiliary Support.
  - Plus catalogue-level force entries (only Legion of the Damned's Vanguard in v9.8.0).
  - Never offered: Unbound, Reinforcements, Order of Battle, Boarding Patrol.
- **Arks of Omen army** (research library `01_Core_Rules/Army_Building_Detachments_and_CP.md` §7.5):
  - exactly one Arks of Omen Detachment;
  - plus at most one allied Patrol, Super-Heavy Auxiliary or Auxiliary Support, from the permitted list in `overrides/aoo-allies.json`.
- **Rule of Two/Three:** no datasheet more than 2 times at Incursion and 3 times at Strike Force, Combat Patrol and Onslaught. Troops, Dedicated Transports and Fortifications are exempt. Datasheets listed together in `overrides/datasheet-equivalence.json` count as one (all Daemon Prince datasheets, for example).
- **Points** are BSData `pts` costs after modifiers, with corrections only from `overrides/costs.json`. Power Level is the BSData ` PL` cost. CP is the BSData `CP` cost (starting CP arrives as a positive cost on the Battle Size selection).
- **Cost type ids** (v9.8.0 .gst): `points` = pts, `e356-c769-5920-6e14` = PL, `2d3b-b544-ad49-fb75` = CP.
- **Copy:** every validation message is plain English, says what is wrong in the user's own list (unit and detachment names), and ends with a concrete fix. Write "pts", never "points cost". Don't use BattleScribe jargon in the UI ("selection", "entry", "force", "constraint").
- Lists open read-only at `/share/:id` without sign-in. All other builder routes require sign-in.
- New document ids are UUID v4 strings (`crypto.randomUUID()`).

## Review Focus
1. **Per-model wargear on a stack of identical models.** A user changes the weapon on one model of 10 and then removes a model. Totals, per-model limits and the export must stay right. *Task 4 test `split then shrink keeps per-model wargear`.*
2. **Changing battle size or detachment after units are added.** Units stay, and issues reflect the new limits (Strike Force → Incursion flags a third copy of a datasheet). *Task 6 test `switching to Incursion flags the third copy`.*
3. **A later choice hides a unit already in the list** (a sub-faction choice that rules a unit out). The unit stays visible with a `hidden-selected` issue; it is never silently dropped and never crashes the view. *Task 5 test.*
4. **A saved or shared list mentions an entry id the current data doesn't have** (an old list, a corrupt document). Evaluation keeps going, reports `unknown-entry`, and the share page still renders. *Task 3 and Task 15 tests.*
5. **Leaving the editor right after an edit.** The debounced save is flushed on unmount and `pagehide`, so the last tap is never lost. *Task 14 test.*

---

## File Structure
```
packages/data/
  package.json                      + export "./roster": "./src/roster/index.ts"
  overrides/
    playable-catalogues.json        NEW  [{catalogueName, source}] libraries that are really playable (Fallen)
    costs.json                      NEW  [{catalogueName, entryId, entryName, costTypeId, value, source}]
    aoo-allies.json                 NEW  [{catalogueName, allies:[{catalogueName, detachments:string[], note}], source}]
    datasheet-equivalence.json      NEW  [{name, entryIds:string[], categoryName?, source}]
  src/
    bsdata/gamedata.ts              isPlayableCatalogue honours playable-catalogues.json
    build.ts                        writes generated/roster/*.json, index.rosterScope
    model/types.ts                  CatalogueSummary.rosterScope
    roster/
      types.ts                      roster file + roster document types (shared contract)
      emit.ts                       RawCatalogue -> RosterFile (Node side, not exported to the browser)
      scope.ts                      buildScope, resolve, root entries
      evaluate.ts                   counts, conditions, modifiers, costs -> RosterView
      edit.ts                       createRoster, addForce, addUnit, setCount, split, remove, options
      options.ts                    availableUnits, armyOptions, childOptions
      validate.ts                   BSData constraint checks -> Issue[]
      policy.ts                     battle sizes, detachments, Rule of 2/3, points, CP, factions
      explain.ts                    Issue -> {text, fix}
      exportText.ts                 Roster -> plain-text list
      index.ts                      browser-safe public API
  test/
    fixtures/roster/mini.ts         hand-built RosterFile[] fixture (also used by web tests)
    roster-emit.test.ts  roster-evaluate.test.ts  roster-edit.test.ts
    roster-validate.test.ts  roster-policy.test.ts  roster-explain.test.ts  roster-export.test.ts
    corpus/spec.ts                  ListSpec types + buildFromSpec
    corpus/imperium/*.ts  corpus/chaos/*.ts  corpus/xenos/*.ts   one file per playable catalogue
    roster-corpus.test.ts
apps/web/src/
  routes.tsx                        /build, /build/new, /build/:id (guarded), /share/:id (public)
  factions/dataClient.ts            + getRosterFile, getRosterScope
  storage/ids.ts                    NEW newDocId, isUuid
  storage/sync.ts                   per-doc push fallback, id repair, overlap re-pull, auth errors
  storage/supabaseRemote.ts         auth-error detection
  auth/AuthContext.tsx              needsReauth + markSessionExpired
  layout/ReauthBanner.tsx           NEW
  lists/listStore.ts                NEW list documents over the repository
  lists/useRosterEditor.ts          NEW roster state, evaluation, debounced save
  lists/ListsPage.tsx  lists/NewListPage.tsx  lists/ListEditorPage.tsx
  lists/UnitPicker.tsx  lists/UnitEditor.tsx  lists/IssuesPanel.tsx  lists/ArmyOptions.tsx
  lists/ExportSheet.tsx  lists/SharePage.tsx  lists/publicSource.ts
  lists/*.test.tsx
  e2e/builder.spec.ts
```

---

### Task 1: Fallen is playable (Milestone 1 deferred item)

`Fallen.cat` is marked `library="true"` in v9.8.0 and no catalogue links to it. As a result the factions page hides it, and its units can't be reached anywhere.

**Files:**
- Create: `packages/data/overrides/playable-catalogues.json`
- Modify: `packages/data/src/bsdata/gamedata.ts` (`isPlayableCatalogue`), `packages/data/src/build.ts`, `packages/data/src/join/wahapedia.ts` (`Overrides`, `loadOverrides`)
- Test: `packages/data/test/build.test.ts`

**Interfaces:**
- Produces: `isPlayableCatalogue(cat: RawCatalogue, playable: Set<string>): boolean`. A catalogue is playable when it isn't a library, or when its name is in the set. `Overrides.playableCatalogues: Set<string>`.
- Produces: the file content `[{ "catalogueName": "Fallen", "source": "BSData v9.8.0 marks Fallen.cat library=\"true\" but no catalogue imports it; Fallen are a playable faction (Faction: Fallen datasheets)." }]`.

- [ ] **Step 1: Write the failing tests** in `build.test.ts`:
```ts
test('Fallen is a playable catalogue with its units', () => {
  const fallen = index.catalogues.find((c) => c.name === 'Fallen')!;
  expect(fallen.library).toBe(false);
  expect(fallen.unitCount).toBeGreaterThanOrEqual(4);
});
test('exactly 42 playable catalogues', () => {
  expect(index.catalogues.filter((c) => !c.library)).toHaveLength(42);
});
```
- [ ] **Step 2:** Run `npm test -w packages/data -- build`. Expected: FAIL (Fallen `library` is true; the count is 41).
- [ ] **Step 3:** Implement the override and thread it through `buildAll`. Update every other caller of `isPlayableCatalogue` (`grep -rn isPlayableCatalogue packages`).
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(data): Fallen is playable (library flag override)`.

### Task 2: Emit roster data for every BattleScribe file

**Files:**
- Create: `packages/data/src/roster/types.ts`, `packages/data/src/roster/emit.ts`, `packages/data/overrides/costs.json` (`[]`)
- Modify: `packages/data/src/build.ts`, `packages/data/src/model/types.ts`, `packages/data/package.json`
- Test: `packages/data/test/roster-emit.test.ts`

**Interfaces:**
- Produces, in `roster/types.ts`. This is the contract every later task uses; copy it exactly:
```ts
export const COST_PTS = 'points';
export const COST_PL = 'e356-c769-5920-6e14';
export const COST_CP = '2d3b-b544-ad49-fb75';
export type CostMap = Record<string, number>;

export type CondType = 'lessThan' | 'greaterThan' | 'equalTo' | 'notEqualTo' | 'atLeast' | 'atMost' | 'instanceOf' | 'notInstanceOf';
/** Flags default to BattleScribe's defaults: shared=true, includeChild*=false, percent=false. */
export interface Cond { type: CondType; field: string; scope: string; childId: string; value: number; percent?: true; shared?: false; childSel?: true; childForces?: true }
export interface CondGroup { type: 'and' | 'or'; conds: Cond[]; groups: CondGroup[] }
export interface Repeat { field: string; scope: string; childId: string; value: number; repeats: number; roundUp?: true; shared?: false; childSel?: true; childForces?: true }
export type ModType = 'set' | 'increment' | 'decrement' | 'append' | 'add' | 'remove' | 'set-primary' | 'unset-primary';
export interface Mod { type: ModType; field: string; value: string; when?: CondGroup; repeats?: Repeat[] }
export interface Constraint { id: string; type: 'min' | 'max'; field: string; scope: string; value: number; percent?: true; shared?: false; childSel?: true; childForces?: true }
export interface CatLink { id: string; targetId: string; primary?: true; constraints?: Constraint[]; mods?: Mod[] }
export interface RNode {
  id: string; kind: 'entry' | 'group' | 'link'; name: string;
  type?: 'unit' | 'model' | 'upgrade';            // entries
  targetId?: string; targetKind?: 'entry' | 'group'; // links
  hidden?: true; collective?: true; defaultId?: string; // defaultId: a group's defaultSelectionEntryId
  costs?: CostMap; cats?: CatLink[]; constraints?: Constraint[]; mods?: Mod[]; children?: RNode[];
}
export interface RCategory { id: string; name: string; hidden?: true; constraints?: Constraint[]; mods?: Mod[] }
export interface RForce { id: string; name: string; hidden?: true; cats: CatLink[]; constraints?: Constraint[]; mods?: Mod[] }
export interface RosterFile {
  schema: 1; id: string; name: string; slug: string; library: boolean;
  links: { targetId: string; importRootEntries: boolean }[];
  rootEntries: RNode[];   // root entryLinks + root selectionEntries, document order
  shared: RNode[];        // sharedSelectionEntries + sharedSelectionEntryGroups
  categories: RCategory[];
  forces: RForce[];       // top-level forceEntries only
}
```
- Produces: `emitRosterFile(cat: RawCatalogue, slug: string, costOverrides: CostOverride[]): RosterFile`, where `CostOverride = { catalogueName: string; entryId: string; entryName: string; costTypeId: string; value: number; source: string }`.
- Produces build output:
  - `generated/roster/<slug>.json` for each of the 52 catalogues, plus `generated/roster/system.json` for the .gst.
  - `CatalogueSummary.rosterScope: string[]`: the roster slugs of `catalogueScope(gd, id)` in scope order, ending with `'system'`.

**Emission rules:**
- **Children:**
  - `selectionEntries`, `selectionEntryGroups` and `entryLinks` become `children`, in that document order.
  - Modifier groups are flattened. Each inner modifier gets `when = { type: 'and', conds: groupConds, groups: [groupCondGroups..., ownWhen] }` (empty parts omitted). The group's repeats are appended to the modifier's own `repeats`.
- **Kept modifier fields:** `hidden`, `name`, `category`, any cost type id, and any constraint id.
- **Dropped modifier fields:** `page`, `description`, and characteristic ids.
- **Dropped elements:** profiles, rules, infoLinks, publications and comments.
- **Dropped entries:** entries and links whose name matches `/^(battle honours|battle scars|crusade)\b/i`.
- **Child forceEntries** nested inside forceEntries are dropped. The builder never creates nested forces.
- **Cost overrides** replace `costs[costTypeId]` on the node whose `id === entryId`. The build throws if an override matches no node or the node's name differs from `entryName`.

- [ ] **Step 1: Write the failing tests**
  - `mini.cat` fixture (extend it with one constraint, one modifier with a condition group and a repeat, and one modifier group). The emitted JSON matches a hand-written `toEqual` object, including flattened modifier-group conditions and defaulted flags omitted.
  - **Real data, every file:** every `targetId` of every link node in each catalogue's `rosterScope` resolves to a node in some scope file's `shared`, `rootEntries` or nested children. Any exception must be listed in `overrides/unresolved-links.json`.
  - **Real data, supported vocabulary:** the union of all `Mod.type`, `Cond.type`, `Cond.scope` and `Constraint.scope` values, after excluding ids (matching `/^[0-9a-f]{4}-/i` or a UUID), is a subset of the enums above plus `{'self','parent','ancestor','force','roster','primary-catalogue'}`. `Cond.field` and `Constraint.field` are `selections`, `forces` or a cost type id. This test is how an unsupported BSData feature gets noticed.
  - **Real data:** each `generated/roster/*.json` is under 4 MB.
  - **Real data:** `necrons` has a root entry named `Necron Warriors`, whose `Warriors` group has `constraints` min 10 / max 20. The Gauss Flayer model link resolves to an entry with `costs.points === 11`.
  - **Real data:** the `Aeldari Library` link `Harlequin's Kiss` carries `costs.points === 10`. Link costs are kept on the link node.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-emit`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `emit.ts`. Wire it into `buildAll` after the existing per-catalogue loop, and add the `./roster` package export (it points at `index.ts`, created in Task 3; add a placeholder `export * from './types'` now).
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS. Record total `generated/roster` size in the commit message.
- [ ] **Step 5:** Commit: `feat(data): emit BattleScribe selection trees as roster JSON`.

### Task 3: Roster engine — scope and evaluation

**Files:**
- Create: `packages/data/src/roster/scope.ts`, `packages/data/src/roster/evaluate.ts`, `packages/data/src/roster/index.ts`, `packages/data/test/fixtures/roster/mini.ts`
- Test: `packages/data/test/roster-evaluate.test.ts`

**Interfaces:**
- Consumes: `RosterFile` and its parts (Task 2).
- Produces the roster document types, in `types.ts`:
```ts
export type BattleSizeId = 'combat-patrol' | 'incursion' | 'strike-force' | 'onslaught';
/** count = identical copies; children apply to each copy. entryId = id of the chosen child node (a link id for links). */
export interface Sel { id: string; entryId: string; count: number; children: Sel[] }
export interface ForceSel { id: string; forceId: string; catalogueId: string; selections: Sel[] }
export interface Roster { schema: 1; name: string; catalogueId: string; battleSize: BattleSizeId; forces: ForceSel[] }
```
- Produces, in `scope.ts`:
  - `buildScope(files: RosterFile[]): Scope`. Files are in scope order; first id wins. A roster with an allied detachment from another catalogue uses one scope built from the union of both catalogues' `rosterScope` files (primary catalogue's files first, deduplicated). BSData ids are global, so first-wins stays correct. `Scope = { files; system: RosterFile; node(id): RNode | undefined; category(id): RCategory | undefined; force(id): RForce | undefined; catalogue(id): RosterFile | undefined; parentGroups(nodeId): string[] }`.
  - `resolve(scope, node): Merged`. `Merged = { node: RNode; target: RNode; ids: string[] /* [link id, target id] or [id] */; name; type; hidden; collective; costs: CostMap; cats: CatLink[]; constraints: Constraint[]; mods: Mod[]; children: RNode[] }`.
    - Link fields override target fields.
    - Costs merge per type: `link.costs[t] ?? target.costs[t] ?? 0`.
    - `cats`, `constraints` and `mods` concatenate: link first, then target.
  - `rootEntriesFor(scope, catalogueId): RNode[]`. The catalogue's root entries, then those of links with `importRootEntries` (recursive, deduplicated), then the system's root entries.
- Produces, in `evaluate.ts`:
```ts
export interface SelView {
  sel: Sel; merged: Merged | null; parent: SelView | null; force: ForceView;
  name: string; type: 'unit' | 'model' | 'upgrade'; hidden: boolean;
  categories: string[]; primary: string | null;
  own: CostMap;    // effective cost of one copy × sel.count
  total: CostMap;  // own + children totals × sel.count
  models: number;  // model copies in this subtree (1 per copy for a model-type unit)
  children: SelView[];
}
export interface ForceView { force: ForceSel; entry: RForce | null; name: string; hidden: boolean; selections: SelView[]; total: CostMap }
export interface RosterView { roster: Roster; forces: ForceView[]; total: CostMap; unknown: { selId: string; entryId: string }[] }
export function evaluate(scope: Scope, roster: Roster): RosterView;
export function effectiveConstraints(scope: Scope, owner: Merged | RForce | CatLink | RCategory, ctx: EvalContext): Constraint[];
export function countIn(ctx: EvalContext, scopeKey: string, field: string, childId: string, opts: { childSel: boolean; childForces: boolean }): number;
export function checkCond(ctx: EvalContext, c: Cond): boolean;
```
  `EvalContext = { scope; view: RosterView; at: SelView | ForceView /* where the owning node is being evaluated */ }`.

**Evaluation semantics.** These are the decisions; implement exactly.
- **Counting:**
  - `countIn` sums, over matching selections `s` in the scope container, `s.count × Π(count of s's ancestors strictly below the container)`.
  - With `childSel: false`, only the container's direct children count.
  - `s` matches `childId` when one of these is true:
    - `childId` is in `merged.ids`;
    - `childId` is one of `s`'s effective categories;
    - `childId` is `'any'`, or equals `s.type` (`'model' | 'unit' | 'upgrade'`).
  - When the owner is a group, its own constraints count selections whose `entryId` is a descendant of that group.
  - For `field === 'forces'`, count forces whose `forceId === childId` (or all forces for `'any'`).
  - For a cost type id field, sum `total[field]` of the matching selections.
  - With `percent`, the result is that number × 100 ÷ the same sum over all selections in the container (0 if the container's total is 0).
- **Scope keys:**
  - `self` is the selection being evaluated.
  - `parent` is its parent selection, or its force for root selections. For an unselected candidate (options and root entries), `parent` is the container it would be added to.
  - `force` is the nearest force. `roster` is the whole roster.
  - `ancestor` is only meaningful with `instanceOf`/`notInstanceOf`: true when any ancestor selection's `merged.ids` include `childId`.
  - `primary-catalogue` with `instanceOf`: `roster.catalogueId === childId`.
  - Any other id: the nearest ancestor-or-self selection whose `merged.ids` include it, or the nearest force whose `forceId` equals it. If none exists, the condition is false and the constraint is skipped.
- **instanceOf with scope `force` or `parent`:** true when that container's entry id (`forceId` or `merged.ids`) equals `childId`.
- **Condition comparisons:** compare the count against `value` with the named operator. A condition group is `and`/`or` over its conditions and subgroups; an empty group is true.
- **Repeats:**
  - multiplier = Σ over repeats of `floor(count / value) × repeats`, with `ceil` when `roundUp`, and 0 when `value` is 0;
  - a modifier with repeats applies `multiplier` times;
  - a modifier with neither `when` nor repeats always applies once.
- **Modifier order:** modifiers apply in document order to: name, hidden, costs (keyed by cost type id), categories (`add`, `remove`, `set-primary`, `unset-primary` with the category id in `value`) and constraint values (keyed by constraint id).
  - `set` assigns.
  - `increment`/`decrement` add or subtract `Number(value)` per application.
  - `append` appends `' ' + value` to the name.
- **Categories feed counts, and counts feed category modifiers.** So effective categories are evaluated to a fixed point: start from base categories, re-evaluate all category modifiers using the previous pass's categories, and stop when nothing changes or after 5 passes. All other modifiers are evaluated once, after the categories settle.
- **Unknown entry ids:** a `Sel` whose `entryId` isn't a child of its parent's merged node (or a root entry for the force) gets `merged: null`, `name: 'Unknown item'`, zero costs and no children evaluation. It is listed in `view.unknown`. Evaluation never throws on roster content.

- [ ] **Step 1: Write the failing tests** against `test/fixtures/roster/mini.ts`. Build the fixture by hand: a system file with Patrol and Battalion forces, HQ/Troops/Character/Warlord categories and pts/PL/CP cost types, and a catalogue with:
  - a Troops unit "Warriors" (model link min 10 max 20 at 11 pts, a `PL` set-to-12 modifier when more than 10 models, scoped to the unit's own id);
  - an HQ character "Lord" with a "Warlord" upgrade that adds the Warlord category;
  - a group with `defaultId`;
  - a link whose cost overrides its target;
  - an Elites unit "Squad": a model link min 5 max 10, each model with a max-1/min-1 weapon group (default "Bolter" 0 pts, "Plasma" 5 pts). Task 4 uses it.

  Tests:
  - `10 warriors cost 110 pts and 6 PL`; `11 warriors cost 121 pts and 12 PL`.
  - `link costs override target costs per type`.
  - `count multiplies through ancestor copies`: a model stack with count 10, each copy holding 1 weapon, counts as 10 weapons in unit scope.
  - `childSel false counts only direct children`.
  - `add category modifier makes Lord count as Warlord` (roster-scope count of the Warlord category = 1 after selecting the upgrade).
  - `category modifiers reach a fixed point` (a modifier conditioned on a category that another modifier adds).
  - `repeat applies floor(count/value)×repeats times`; `roundUp uses ceil`.
  - `percent condition compares against the container total` (25% PL case shaped like the gst's Daemonic Pact).
  - `instanceOf ancestor` and `primary-catalogue` conditions.
  - *Review Focus 4:* `unknown entry id is reported, not thrown`.
  - **Real data:** a Necrons roster with one Necron Warriors (10 × Gauss Flayer model) totals `{points: 110, PL: 6}`.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-evaluate`. Expected: FAIL.
- [ ] **Step 3:** Implement `scope.ts` and `evaluate.ts`. Export them, and the types, from `index.ts`. `index.ts` must not import `emit.ts` or any `node:` module.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): roster engine scope and modifier/condition evaluation`.

### Task 4: Roster engine — edits and option queries

**Files:**
- Create: `packages/data/src/roster/edit.ts`, `packages/data/src/roster/options.ts`
- Test: `packages/data/test/roster-edit.test.ts`

**Interfaces:**
- Consumes: Task 3 (`evaluate`, `resolve`, `rootEntriesFor`, `checkCond`, `effectiveConstraints`).
- Produces. Every edit is pure: it returns a new `Roster`, and never mutates its input.
```ts
export function newId(): string; // crypto.randomUUID()
export function addForce(scope: Scope, r: Roster, forceId: string, catalogueId: string): Roster;
export function removeForce(scope: Scope, r: Roster, forceSelId: string): Roster;
export function addUnit(scope: Scope, r: Roster, forceSelId: string, entryId: string): { roster: Roster; selId: string };
export function addChild(scope: Scope, r: Roster, parentSelId: string, entryId: string, count?: number): Roster;
export function setCount(scope: Scope, r: Roster, selId: string, count: number): Roster; // 0 removes
export function removeSelection(r: Roster, selId: string): Roster;
export function splitSelection(r: Roster, selId: string): { roster: Roster; selId: string }; // peels one copy off a stack
export function duplicateSelection(r: Roster, selId: string): Roster;
export function chooseInGroup(scope: Scope, r: Roster, parentSelId: string, groupId: string, entryId: string): Roster; // for max-1 groups: replaces the current choice
export interface UnitOption { entryId: string; name: string; role: string | null; points: number; legends: boolean }
export function availableUnits(scope: Scope, r: Roster, forceSelId: string): UnitOption[];   // type unit|model, not hidden, primary category in the force's cats
export function armyOptions(scope: Scope, r: Roster, forceSelId: string): UnitOption[];      // type upgrade root entries (Configuration, Stratagems), not hidden
export interface OptionNode { kind: 'option' | 'group'; id: string; name: string; min: number; max: number /* -1 = no limit */; count: number; pointsEach: number; collective: boolean; selIds: string[]; children: OptionNode[] }
export function childOptions(scope: Scope, r: Roster, selId: string): OptionNode[];
```
**Decisions:**
- **`addUnit` and `addChild` fill required children recursively:**
  - For each non-hidden child entry or link with an effective parent-scope `min ≥ 1`, add it with `count = min`.
  - For each group with min ≥ 1, add `min` copies of `defaultId`, or of the first non-hidden child when there is no default.
- **A minimum on a model stack is one `Sel` with `count = min`.** Children of that model are filled once and apply to every copy.
- **`splitSelection`** lowers the stack's count by 1. It inserts, right after it, a deep copy with `count: 1` and fresh ids, and returns the new selection's id.
- **`setCount` on a stack** changes that one `Sel`'s `count`. The unit editor's model stepper always acts on the first `Sel` of that `entryId` (the original stack). Split-off, customised copies are kept until the user removes them by name.
- **`removeForce` on the first force** moves its `Configuration`-category selections to the new first force.
- **`availableUnits`** sorts by role order (`BATTLEFIELD_ROLES`), then name. `points` is the effective cost after `addUnit` would fill the defaults; compute it by simulating the add against an evaluation.

- [ ] **Step 1: Write the failing tests**
  - `addUnit fills a 10-model default stack` (mini Warriors: one model `Sel` with count 10, plus its default weapon).
  - `addUnit picks the group default`.
  - `chooseInGroup replaces the previous choice`.
  - `setCount 0 removes the selection`.
  - `edits never mutate the input roster` (deep-freeze the input).
  - *Review Focus 1:* `split then shrink keeps per-model wargear`:
    1. Use the mini "Squad" (model stack of 10, each model with a max-1 weapon group: default Bolter 0 pts, alternative Plasma 5 pts).
    2. Split one copy, and `chooseInGroup` Plasma on the split copy.
    3. `setCount` the original stack to 8.
    4. Expect 9 models: 8 with Bolter and 1 with Plasma.
    5. Expect pts = 9 × model cost + 5.
    6. Expect `validateConstraints`-style per-model weapon counts: each copy has exactly 1 weapon (assert through `countIn` with `self` scope).
  - `removeForce keeps configuration selections`.
  - **Real data:** `availableUnits` for a Necrons Arks of Omen force includes Necron Warriors with `points: 110` and `role: 'Troops'`, and includes no hidden or `[Reference]` entries. `armyOptions` includes `Dynasty Choice`.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-edit`. Expected: FAIL.
- [ ] **Step 3:** Implement `edit.ts` and `options.ts`, and export them from `index.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): roster edits and option queries`.

### Task 5: BSData constraint validation

**Files:**
- Create: `packages/data/src/roster/validate.ts`
- Test: `packages/data/test/roster-validate.test.ts`

**Interfaces:**
- Consumes: Tasks 3 and 4.
- Produces (in `types.ts`):
```ts
export type RuleKind =
  | 'points-over' | 'cp-negative' | 'slot-min' | 'slot-max' | 'warlord-missing' | 'warlord-extra'
  | 'unique' | 'unit-limit' | 'model-count' | 'wargear-max' | 'option-required' | 'hidden-selected'
  | 'unknown-entry' | 'rule-of-three' | 'detachment-not-allowed' | 'detachment-count'
  | 'detachment-faction' | 'army-faction' | 'other';
export type Fix =
  | { kind: 'add-unit'; forceSelId: string; entryIds: string[] }
  | { kind: 'remove'; selIds: string[] }
  | { kind: 'set-count'; selId: string; count: number }
  | { kind: 'open'; selId: string };
export interface Issue {
  rule: RuleKind; forceSelId?: string; selId?: string;
  subject: { id: string; name: string };  // the entry, category or force the rule is about
  limit: number; actual: number; fix?: Fix;
}
export function validateConstraints(scope: Scope, view: RosterView): Issue[];
```
**Which constraints are checked:**
- **Every force:**
  - The force entry's own constraints.
  - Each category link's constraints, counted with selections in that force that carry the category.
- **Every category entry in scope with constraints:** checked once per roster for roster scope, and once per force for force scope (Warlord min/max, Character limits).
- **Every container** (force root and every selection): for each non-hidden child node of the container's merged node, check that child's effective constraints with field `selections`. For a force root, the children are `rootEntriesFor` filtered as in `availableUnits`. Constraints on hidden nodes are skipped.
- **Every selection whose effective `hidden` is true:** a `hidden-selected` issue.
- **Every `view.unknown` item:** an `unknown-entry` issue.
- A constraint value of `-1` means "no limit" and is skipped.
- **`min`** fails when count < value. **`max`** fails when count > value.

**Classifying a failure into `RuleKind`, first match wins:**
1. A category named `Warlord` → `warlord-missing` (min) or `warlord-extra` (max).
2. A category link on a force → `slot-min` / `slot-max`.
3. A unit/model root entry, max, scope roster/force, value ≤ 1 → `unique`.
4. A unit/model root entry, otherwise → `unit-limit`.
5. A model entry, or a group whose descendants are models → `model-count`.
6. An upgrade or group, max → `wargear-max`.
7. An upgrade or group, min → `option-required`.
8. Anything else → `other`.

**Default fixes:**

| Rule | Fix |
|---|---|
| `slot-min` | `add-unit` with up to 3 entries from `availableUnits` whose role is that category, cheapest first |
| `slot-max`, `unique`, `unit-limit`, `hidden-selected`, `unknown-entry` | `remove` the newest offending selection(s) |
| `model-count` | `set-count` to the nearest legal value |
| `wargear-max`, `option-required`, `warlord-*` | `open` the unit |

- [ ] **Step 1: Write the failing tests** (mini fixture)
  - `empty Patrol needs 1 HQ and 1 Troops` (two `slot-min` issues; the HQ fix lists `Lord`).
  - `4 Troops in a Patrol is slot-max`.
  - `no Warlord`, then `two Warlords`.
  - `9 warriors is model-count with set-count 10`.
  - `a second copy of a unique character is unique`.
  - `two weapons on a one-weapon model is wargear-max`.
  - *Review Focus 3:* `a unit hidden by a later choice stays listed with hidden-selected`.
  - `-1 limits are ignored`.
  - **Real data:** an empty Necrons Arks of Omen roster gets an issue that the HQ slot needs 1. A legal Necrons Patrol (Overlord as Warlord + 10 Necron Warriors + Dynasty Choice made) has zero issues from `validateConstraints`. Build it with `addForce`/`addUnit`/`chooseInGroup`, choosing Game Type Matched → `1. Eternal War` and Battle Size Combat Patrol by hand (`createRoster` arrives in Task 6). If the Overlord's Warlord option has a different name in the data, use the data's name.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-validate`. Expected: FAIL.
- [ ] **Step 3:** Implement `validate.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): validate rosters against BSData constraints`.

### Task 6: Matched-play policy (battle sizes, detachments, Rule of Two/Three, points, factions)

**Files:**
- Create: `packages/data/src/roster/policy.ts`, `packages/data/overrides/aoo-allies.json`, `packages/data/overrides/datasheet-equivalence.json`
- Modify: `packages/data/src/build.ts` (copy both overrides into `generated/roster/policy.json`, so the browser gets them)
- Test: `packages/data/test/roster-policy.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces:
```ts
export interface BattleSize { id: BattleSizeId; name: string; points: number; mode: 'core' | 'aoo'; maxDetachments: number; sameDatasheetLimit: number; gameTypeEntryId: string; missionPackEntryId: string; battleSizeEntryId: string }
export const BATTLE_SIZES: Record<BattleSizeId, BattleSize>;
export interface PolicyData { aooAllies: AooAllies[]; equivalence: DatasheetEquivalence[] }
export interface DetachmentChoice { forceId: string; name: string; catalogueId: string; allied: boolean }
export function detachmentChoices(scope: Scope, r: Roster, policy: PolicyData, catalogues: CatalogueSummary[]): DetachmentChoice[];
export function createRoster(scope: Scope, opts: { name: string; catalogueId: string; battleSize: BattleSizeId; forceId: string }): Roster;
export function setBattleSize(scope: Scope, r: Roster, size: BattleSizeId): Roster;
export function validatePolicy(scope: Scope, view: RosterView, policy: PolicyData): Issue[];
export function validate(scope: Scope, roster: Roster, policy: PolicyData): { view: RosterView; issues: Issue[] }; // evaluate + validateConstraints + validatePolicy, deduplicated
```
- **Entry ids** come from the v9.8.0 .gst. Write them as constants with the name in a comment. A test asserts each id resolves to an entry with that name.
  - Game Type `Matched`: look it up inside Game Type `bf09-85b2-c097-1071`.
  - Mission packs: `1. Eternal War`, and `5. Chapter Approved: Arks of Omen` = `76d2-6e71-243f-ad3d`.
  - Battle sizes: Combat Patrol `af70-08c1-1c6f-0770`, Incursion `5686-7cd9-6664-635b`, Strike Force `09f9-b586-8d63-7635`, Onslaught `fad2-035f-88a7-60c0`.
  - Force entries by name, from the .gst `forceEntries`. The Arks of Omen Detachment is `fa51-993c-2f8b-9be4`.
- `BATTLE_SIZES` values: points 500/1000/2000/3000; modes core/aoo/aoo/core; `maxDetachments` 1/2/2/4; `sameDatasheetLimit` 3/2/3/3.

**Decisions:**
- **`createRoster`:**
  1. Adds the chosen force.
  2. Adds root entries whose effective roster/force min ≥ 1 (with their defaults) into the first force.
  3. Then sets Game Type → Matched → the mode's mission pack, and Battle Size → the size's entry, via `chooseInGroup`.
- **`setBattleSize`** swaps those two choices. It keeps every other selection, and never removes forces.
- **`detachmentChoices`:**
  - In core mode, it offers the Core Book force entries (Global Constraints) and the catalogue's own `forces`, for the primary catalogue and for any playable catalogue in the same `FactionGroup`.
  - In aoo mode with no Arks of Omen Detachment yet, it offers only that one.
  - In aoo mode with one already, it offers the allied Patrol/Super-Heavy Auxiliary/Auxiliary Support for the catalogues listed under the primary catalogue in `aoo-allies.json` (`allied: true`), and nothing once an ally exists.
- **`validatePolicy` rules:**

| Rule | When it fails |
|---|---|
| `points-over` | `view.total.points` is above the size's points limit |
| `cp-negative` | `view.total[COST_CP] < 0` |
| `detachment-count` | Core mode with more forces than `maxDetachments`; aoo mode with ≠1 Arks of Omen Detachment or more than 1 ally |
| `detachment-not-allowed` | a force entry or ally not in `detachmentChoices` for that position |
| `rule-of-three` | more root unit/model selections with the same datasheet key than `sameDatasheetLimit`, roster-wide, ignoring effective primary Troops, Dedicated Transport and Fortification. The datasheet key is the resolved target id, or the equivalence group name |
| `detachment-faction` | a force's units share no faction keyword other than IMPERIUM, CHAOS, AELDARI, YNNARI or TYRANIDS (Fortification Network forces are exempt) |
| `army-faction` | the army's units share no faction keyword at all (Unaligned units are ignored) |

  Faction keywords are categories whose name starts with `Faction: `.
- **Deduplication:** `validate` drops BSData issues for constraints with field `forces`. The policy layer owns detachment counts.
- **`aoo-allies.json` content:** transcribe the Battle Brothers list from research library §7.5 into catalogue names. For example, `"Aeldari - Craftworlds"` gets allies `[{ "catalogueName": "Aeldari - Harlequins", "detachments": ["Patrol Detachment -2CP"] }]`. Every IMPERIUM catalogue gets `Imperium - Agents of the Imperium` (Patrol, Auxiliary Support), `Imperium - Imperial Knights` (Super-Heavy Auxiliary) and `Leagues of Votann` (Patrol). Each entry's `source` cites the Arks of Omen GT pack (Wahapedia page in the research library's sources).
- **`datasheet-equivalence.json` content:**
  - one group `Daemon Prince` using `categoryName: "Daemon Prince"` (the .gst category);
  - the Genestealer Cults Brood Brothers ⇄ Astra Militarum datasheet pairs, found by matching names in the two catalogues;
  - each with its source (research library §7.2).

- [ ] **Step 1: Write the failing tests**
  - `gst ids resolve to the expected names`.
  - `createRoster(Strike Force) selects Matched, Arks of Omen and Strike Force`.
  - `2001 pts in Strike Force is points-over by 1`.
  - `fourth Canoptek Wraiths unit at Strike Force is rule-of-three, third is fine`.
  - `Troops are exempt from rule-of-three`.
  - *Review Focus 2:* `switching to Incursion flags the third copy`.
  - `two Daemon Prince datasheets count together`.
  - `two Arks of Omen Detachments is detachment-count`.
  - `Harlequins Patrol ally is allowed for Craftworlds, Orks Patrol is not`.
  - `Combat Patrol with two detachments is detachment-count` (exactly one issue; no duplicate from BSData `forces` constraints).
  - `Space Marines with an Astra Militarum unit in one detachment is detachment-faction`.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-policy`. Expected: FAIL.
- [ ] **Step 3:** Implement `policy.ts`, write both override files, and write `generated/roster/policy.json` in the build.
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): matched-play policy for battle sizes, detachments and Rule of Two/Three`.

### Task 7: Plain-language explanations and fixes

**Files:**
- Create: `packages/data/src/roster/explain.ts`
- Test: `packages/data/test/roster-explain.test.ts`

**Interfaces:**
- Consumes: `Issue` and `RosterView` (Tasks 3–6), and `BATTLE_SIZES`.
- Produces: `explain(issue: Issue, view: RosterView, scope: Scope): { text: string; fixLabel?: string }`. `fixLabel` is the button text for `issue.fix` (`Add Necron Warriors`, `Remove 1`, `Set to 10 models`, `Open Overlord`).

**Copy.** These are exact templates; `{}` are filled from the issue and view. Numbers use `toLocaleString('en-GB')`. Unit names are the selection's effective name. `{force}` is the force's effective name without a trailing CP suffix (`/ -?\d+CP$| 0CP$/`). Lists of names are "A", "A or B", "A, B or C".

| Rule | Text |
|---|---|
| `slot-min` | `Your {force} needs {n} more {category} {unit/units}. Add {A, B or C}.` If there are no candidates: `Your {force} needs {n} more {category} {unit/units}, but {faction} has nothing it can take there. Pick a different detachment.` |
| `slot-max` | `Your {force} has {actual} {category} units but can only take {limit}. Remove {actual-limit}, or move {it/them} to another detachment.` |
| `points-over` | `Your army is {over} pts over the {limit} pts limit for {size}. Remove units or wargear worth at least {over} pts.` |
| `cp-negative` | `You've spent {short} CP more than you have. Remove a detachment or an upgrade that costs CP.` |
| `warlord-missing` | `Choose a Warlord. Open a Character such as {name} and turn on "{warlordOptionName}".` |
| `warlord-extra` | `You have {actual} Warlords, but an army has exactly 1. Turn "Warlord" off on {actual-1} of them.` |
| `unique` | `{name} is a unique unit, so your army can include only {limit}. Remove {actual-limit}.` |
| `unit-limit` | `Your army can include at most {limit} {name}. Remove {actual-limit}.` |
| `rule-of-three` | `You have {actual} {name} units. {size} allows {limit} of the same datasheet (Troops and Dedicated Transports don't count). Remove {actual-limit}.` |
| `model-count` | `{unit} must have between {min} and {max} models. It has {actual}.` (Only the minimum is known: `at least {min} models`; only the maximum: `at most {max} models`.) |
| `wargear-max` | `{unit} can take at most {limit} {option}. It has {actual}.` |
| `option-required` | `{unit} needs {limit-actual} more from "{group}".` |
| `hidden-selected` | `{name} can't be in this army any more because of an earlier choice. Remove it, or change that choice.` |
| `unknown-entry` | `One item in this list isn't in the current rules data, so it was skipped. Remove it.` |
| `detachment-count` (aoo) | `An Arks of Omen army has exactly 1 Arks of Omen Detachment and at most 1 allied detachment.` |
| `detachment-count` (core) | `{size} allows {limit} {detachment/detachments}. Remove {actual-limit}.` |
| `detachment-not-allowed` | `{force} isn't allowed at {size}. Remove it and pick from the detachments offered.` |
| `detachment-faction` | `Every unit in your {force} must share a faction, such as {faction}. Move {name} to its own detachment or remove it.` |
| `army-faction` | `Every unit in your army must share a faction keyword. {name} doesn't share one with the rest. Remove it.` |
| `other` | `{subject} {needs at least / can have at most} {limit} here. It has {actual}.` |

- [ ] **Step 1: Write the failing tests.** One `expect(explain(...).text).toBe('...')` per rule kind above, using the mini fixture and real Necrons. These include the spec's own example: `Your Battalion Detachment needs 1 more Troops unit. Add Immortals or Necron Warriors.` (candidates cheapest first; check the actual order against the data and assert it). Also assert `fixLabel` for each kind that has a fix.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-explain`. Expected: FAIL.
- [ ] **Step 3:** Implement `explain.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): plain-English validation messages with fixes`.

### Task 8: Text export

**Files:**
- Create: `packages/data/src/roster/exportText.ts`
- Test: `packages/data/test/roster-export.test.ts`

**Interfaces:**
- Consumes: `RosterView`, `BATTLE_SIZES`, `factionDisplayName` logic. Move `factionDisplayName` from `apps/web/src/factions/names.ts` to `packages/data/src/roster/names.ts`, export it from `roster/index.ts`, and re-export it from the web file so existing imports keep working.
- Produces: `exportText(view: RosterView, scope: Scope): string`.

**Format.** Exact, `\n` line endings:
```
{list name}
{faction} · {size name} · {pts} / {limit} pts · {PL} PL · {CP} CP

== {force name} ({catalogue display name}) ==
Army: {config selection name}: {chosen child names joined ", "}      (one line per Configuration selection with children)
{Role}
- {unit name}{ (N models) when N > 1} · {pts} pts
    {count}x {upgrade name}                                          (non-model descendants, aggregated by name across copies, document order)
    {model name} ({count}): {upgrade names joined ", "}               (only when the unit has more than one distinct model stack)

Built with Recruit+ (unofficial fan-made tool)
```
- Roles follow `BATTLEFIELD_ROLES` order. Units with no role go under `Other`.
- A Warlord shows as `    Warlord` on the first line under its unit.
- Numbers are formatted with `en-GB` thousands separators.

- [ ] **Step 1: Write the failing test.** A real Necrons roster (Overlord Warlord with one upgrade, 20 Necron Warriors split 18/2 between two weapons, Dynasty Choice made) exports to a string you write out in full in the test. The expected pts in that string come from BSData values read in the test, not typed by hand.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-export`. Expected: FAIL.
- [ ] **Step 3:** Implement `exportText.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): plain-text list export`.

### Task 9: Known-legal / known-illegal corpus harness + Imperium catalogues

**Files:**
- Create: `packages/data/test/corpus/spec.ts`, `packages/data/test/roster-corpus.test.ts`, and one `packages/data/test/corpus/imperium/<slug>.ts` per playable Imperium catalogue (23 files)

**Interfaces:**
- Consumes: the public engine API (Tasks 3–8).
- Produces, in `spec.ts`:
```ts
export interface UnitSpec { name: string; models?: Record<string, number>; options?: string[]; warlord?: boolean }
export interface DetachmentSpec { detachment: string; catalogue?: string; army?: Record<string, string>; units: UnitSpec[] }
export interface ListSpec { title: string; battleSize: BattleSizeId; detachments: DetachmentSpec[]; expect: { points: number; powerLevel: number } }
export interface IllegalSpec extends Omit<ListSpec, 'expect'> { expectRules: RuleKind[] }
export interface CatalogueCorpus { catalogue: string; legal: ListSpec[]; illegal: IllegalSpec[] }
export function buildFromSpec(scope: Scope, catalogueId: string, spec: ListSpec | IllegalSpec): Roster;
```
- **`buildFromSpec`:**
  - Finds detachments, units, options and models by their effective name.
  - Throws `Corpus: "<name>" not found under "<parent>"` or `...is ambiguous` instead of guessing.
  - `models` sets model stack counts by model name.
  - `options` adds or chooses option names anywhere in the unit's option tree.
  - `warlord: true` selects the unit's option whose name is `Warlord`.
  - `army` picks Configuration choices as `{ "Dynasty Choice": "Szarekhan" }`.
- **`roster-corpus.test.ts`** globs `corpus/**/*.ts` and checks each:
  - Every legal list: `validate()` returns zero issues, and the totals equal `expect`.
  - Every illegal list: the multiset of issue rules equals `expectRules`.
  - The corpus covers every playable catalogue in the index (fails listing the missing ones until Tasks 10–11 land; mark that one test `.todo` in this task and enable it in Task 11).

**Authoring rules for corpus files:**
- **Legal lists:** at least 1 per catalogue, at any battle size the catalogue can legally fill. Use the Arks of Omen sizes where possible.
- **Expected totals:** `expect.points` and `expect.powerLevel` are worked out by hand from the Wahapedia snapshot (`Datasheets_models.Cost` × models + wargear costs), shown as a comment beside each unit.
  - If BSData disagrees with Wahapedia, check the 13 Apr 2023 / final points sources in `L:\9th Edition\05_Balance_Errata_and_Points\`.
  - Then either fix the spec, or add a `costs.json` override with a source. Never change the expected number just to match the engine.
- **Illegal lists:** at least 2 per catalogue, each failing for a different reason.
- **Rule coverage:** across all three corpus tasks, every rule kind except `unknown-entry` and `other` appears in at least 3 catalogues.

- [ ] **Step 1:** Write `spec.ts`, the test harness, and the Imperium corpus files. Start with `imperium-adeptus-custodes.ts` and `imperium-space-marines`-based chapters. Chapters that share the library still each need their own file and their own chapter units.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-corpus`. Expected: failures that point at either engine bugs or spec mistakes.
- [ ] **Step 3:** Fix engine bugs in the module that owns them, each with a new focused unit test in that module's test file. Fix spec mistakes only after checking the data.
- [ ] **Step 4:** Run `npm test -w packages/data`. Expected: PASS (coverage test still `.todo`).
- [ ] **Step 5:** Commit: `test(data): roster corpus harness and Imperium known-legal/illegal lists`.

### Task 10: Chaos corpus

**Files:**
- Create: one `packages/data/test/corpus/chaos/<slug>.ts` per playable Chaos catalogue, including Fallen (10 files)

**Interfaces:**
- Consumes: `spec.ts` (Task 9).

- [ ] **Step 1:** Write the corpus files under Task 9's authoring rules. Include a Daemon Prince equivalence illegal list (Chaos Space Marines or Death Guard), and a Disciples of Be'lakor or Legiones Daemonica ally list.
- [ ] **Step 2:** Run `npm test -w packages/data -- roster-corpus`.
- [ ] **Step 3:** Fix engine bugs, with focused unit tests, as in Task 9 Step 3.
- [ ] **Step 4:** Run `npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `test(data): Chaos known-legal/illegal lists`.

### Task 11: Xenos and Unaligned corpus; corpus coverage on

**Files:**
- Create: one `packages/data/test/corpus/xenos/<slug>.ts` per playable Xenos and Unaligned catalogue (9 files)
- Modify: `packages/data/test/roster-corpus.test.ts` (enable the coverage test)

- [ ] **Step 1:** Write the corpus files. Include Craftworlds + Harlequins ally (legal) and Craftworlds + Orks ally (illegal: `detachment-not-allowed`).
- [ ] **Step 2:** Enable the coverage test. Run `npm test -w packages/data`. Expected: the coverage test passes, which proves all 42 playable catalogues are covered, and the rule-coverage assertion holds.
- [ ] **Step 3:** Fix engine bugs, with focused unit tests, as in Task 9 Step 3.
- [ ] **Step 4:** Run `npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `test(data): Xenos/Unaligned lists; corpus covers every playable catalogue`.

### Task 12: Sync hardening (Milestone 1 deferred items)

**Files:**
- Create: `apps/web/src/storage/ids.ts`, `apps/web/src/layout/ReauthBanner.tsx`
- Modify: `apps/web/src/storage/sync.ts`, `apps/web/src/storage/supabaseRemote.ts`, `apps/web/src/auth/AuthContext.tsx`, `apps/web/src/auth/types.ts`, `apps/web/src/App.tsx`, `apps/web/src/layout/AppShell.tsx`
- Test: `apps/web/src/storage/sync.test.ts`, `apps/web/src/layout/ReauthBanner.test.tsx`

**Interfaces:**
- Produces:
  - `newDocId(): string` and `isUuid(id: string): boolean` (RFC 4122 v1–v5 pattern).
  - `class SyncAuthError extends Error {}`.
  - `syncOnce(db, remote, ownerId): Promise<{ pushed: number; pulled: number; failed: string[]; rekeyed: number }>`.
  - `startAutoSync(db, remote, ownerId, opts?: { intervalMs?: number; onAuthError?: () => void }): () => void`.
  - `AuthApi.needsReauth: boolean` and `AuthApi.markSessionExpired(): void`.
- `PULL_OVERLAP = 50`, exported from `sync.ts`.

**Decisions:**
1. **Non-UUID ids:**
   - Before pushing, every local doc whose id fails `isUuid` is re-keyed in one Dexie transaction: a copy goes in with `newDocId()`, `dirty: true`, the same `updatedAt`, and the old row is deleted locally. Such ids never reached the server, so this is safe.
   - Return the count as `rekeyed`.
2. **One bad document blocks syncing:**
   - `pushDocs` is tried with all dirty docs. If it throws a non-auth error, each doc is pushed alone.
   - Docs that still fail stay dirty, and their ids go in `failed`. The others are marked clean.
   - The pull cursor still advances.
3. **Cursor overlap:** pull with `max(0, cursor - PULL_OVERLAP)`. This catches rows whose server sequence was assigned before a slower transaction committed. Applying a pulled doc stays idempotent: it is applied only if strictly newer.
4. **Expired sign-in:**
   - `supabaseRemote` throws `SyncAuthError` when the PostgREST error has HTTP status 401, or a code of `PGRST301`/`PGRST302`, or a message matching `/jwt|token/i`.
   - `startAutoSync` catches it, calls `onAuthError`, and stops its timer.
   - `App` passes `markSessionExpired`, which sets `needsReauth` (the cached user stays, so local lists stay usable).
   - `ReauthBanner` (rendered by `AppShell` above page content when `needsReauth`) says: `Your sign-in has expired. Your lists are safe on this device. Sign in again to sync them.` It has a `Sign in again` button that goes to `/sign-in`.
   - A later `SIGNED_IN` event clears `needsReauth` and restarts sync.

- [ ] **Step 1: Write the failing tests**
  - `a doc with a non-uuid id is re-keyed and pushed`.
  - `one rejected doc doesn't block the others` (the fake remote throws on any batch containing id X, and on X alone).
  - `rows committed out of sequence order are still pulled`: the fake remote assigns seq 5 to doc A, the client pulls (cursor 6 via doc B at 6), then A becomes visible with seq 5; the next sync must apply A.
  - `auth error calls onAuthError and stops retrying`.
  - Banner test: renders the exact copy when `needsReauth` and links to `/sign-in`.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement. Add an `ids.ts` test for `isUuid` (a v4 UUID is true, `'dev-list-1'` is false).
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(web): sync survives bad ids and rejected docs, re-pulls an overlap window, prompts re-sign-in on auth errors`.

### Task 13: Lists page and new-list wizard

**Files:**
- Create: `apps/web/src/lists/listStore.ts`, `apps/web/src/lists/ListsPage.tsx`, `apps/web/src/lists/NewListPage.tsx`
- Modify: `apps/web/src/factions/dataClient.ts`, `apps/web/src/routes.tsx`, `apps/web/src/App.tsx` (pass the repository and db through a `StorageContext`)
- Test: `apps/web/src/lists/listStore.test.ts`, `apps/web/src/lists/NewListPage.test.tsx`, `apps/web/src/factions/dataClient.test.ts`

**Interfaces:**
- Consumes: `@recruit/data/roster` (`buildScope`, `createRoster`, `detachmentChoices`, `armyOptions`, `chooseInGroup`, `BATTLE_SIZES`, `validate`), the repository (Milestone 1), and `newDocId` (Task 12).
- Produces:
  - `getRosterFile(slug: string): Promise<RosterFile>`.
  - `getRosterScope(catalogueSlugs: string[]): Promise<Scope>`: the union of their `rosterScope` files in order, memoised by the joined key. The editor rebuilds the scope when an ally from another catalogue is added.
  - `getPolicy(): Promise<PolicyData>`.
  - In `listStore.ts`:
```ts
export interface ListData { roster: Roster; summary: { catalogueSlug: string; faction: string; battleSize: BattleSizeId; points: number; pointsLimit: number; issueCount: number } }
export function useLists(): { lists: Doc<ListData>[]; loading: boolean };
export async function createList(repo: Repository, ownerId: string, data: ListData): Promise<string>; // id = newDocId()
export async function saveList(repo: Repository, doc: Pick<Doc<ListData>, 'id' | 'ownerId' | 'isPublic'>, data: ListData): Promise<void>;
export async function setListPublic(repo: Repository, id: string, isPublic: boolean): Promise<void>;
```
- Routes:
  - `/build`: ListsPage.
  - `/build/new`: NewListPage.
  - `/build/:id`: the editor (Task 14).
  - `/share/:id`: Task 15.

**UI decisions:**
- **ListsPage:**
  - A `New list` primary button at the top.
  - Each saved list is a card: name, faction, battle size, `{pts} / {limit} pts`, and either a red `{n} problems` badge or a green `Legal` badge.
  - Empty state: `No lists yet. Build your first army: it takes a couple of minutes.`
- **NewListPage** is four steps on one route, with a step indicator and Back/Next buttons at least 44px tall:
  1. **Faction:** reuse the grouped, searchable faction list from FactionsPage. Extract `FactionPicker` from `FactionsPage.tsx` and use it in both places.
  2. **Battle size:** four cards showing name, points, and a one-line description:
     - `Arks of Omen rules: one main detachment` (Incursion, Strike Force)
     - `Core Book rules: up to {n} detachments` (Combat Patrol, Onslaught)
  3. **Detachment:** cards from `detachmentChoices`, each showing its slot summary (for example `1–2 HQ · 1–3 Troops`) from the force's category-link constraints.
  4. **Army options:** for each `armyOptions` entry that has choices (Dynasty Choice, Army of Renown), a single-choice list. It can be skipped with `Decide later`. Then `Create list` saves the list and navigates to `/build/:id`.
- Default list name: `{faction} {size name}` (for example `Necrons Strike Force`).

- [ ] **Step 1: Write the failing tests**
  - `createList` stores `kind: 'list'` with a UUID id and the summary.
  - `getRosterScope(['necrons'])` fetches `necrons` and `system` once each. `getRosterScope(['aeldari-craftworlds', 'aeldari-harlequins'])` fetches the shared Aeldari Library once.
  - NewListPage with a mocked data client walks Necrons → Strike Force → Arks of Omen Detachment → Szarekhan → Create. A list doc exists whose roster has the Strike Force selection and the dynasty choice.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): saved lists page and new-list wizard`.

### Task 14: List editor (units, wargear, live totals, issues with fixes)

**Files:**
- Create: `apps/web/src/lists/useRosterEditor.ts`, `apps/web/src/lists/ListEditorPage.tsx`, `apps/web/src/lists/UnitPicker.tsx`, `apps/web/src/lists/UnitEditor.tsx`, `apps/web/src/lists/IssuesPanel.tsx`, `apps/web/src/lists/ArmyOptions.tsx`
- Test: `apps/web/src/lists/useRosterEditor.test.tsx`, `apps/web/src/lists/ListEditorPage.test.tsx`

**Interfaces:**
- Consumes: the engine's edit and option API (Task 4), `validate` (Task 6), `explain` (Task 7), and `listStore` (Task 13).
- Produces:
```ts
export type EditorAction =
  | { type: 'add-unit'; forceSelId: string; entryId: string } | { type: 'add-child'; parentSelId: string; entryId: string }
  | { type: 'set-count'; selId: string; count: number } | { type: 'remove'; selId: string } | { type: 'split'; selId: string }
  | { type: 'duplicate'; selId: string } | { type: 'choose'; parentSelId: string; groupId: string; entryId: string }
  | { type: 'add-force'; forceId: string; catalogueId: string } | { type: 'remove-force'; forceSelId: string }
  | { type: 'battle-size'; size: BattleSizeId } | { type: 'rename'; name: string } | { type: 'apply-fix'; fix: Fix };
export function useRosterEditor(listId: string): { status: 'loading' | 'ready' | 'missing'; roster: Roster; view: RosterView; issues: Issue[]; scope: Scope; dispatch(a: EditorAction): void; flush(): Promise<void> };
```
  - Saves are debounced by 600 ms.
  - `flush` runs on unmount and on `pagehide` (*Review Focus 5*).
  - `apply-fix` turns a `Fix` into an edit. For `add-unit` with several candidates, it opens the UnitPicker filtered to those `entryIds`. For `open`, it navigates to that unit.

**UI decisions** (mobile first; at 768px and above the unit editor opens as a right-hand panel instead of a full screen):
- **Sticky header:**
  - an editable list name;
  - a points bar `{pts} / {limit} pts` that turns red when over;
  - `{PL} PL · {CP} CP`;
  - an issues button: `✓ Legal` (green), or `{n} problems` (red).
- **IssuesPanel:** a bottom sheet on phones and a side column on desktop. Each issue shows the `explain` text plus a fix button labelled `fixLabel`.
- **Body:**
  - ArmyOptions card first (Configuration choices, with an inline `option-required` hint).
  - Then one section per detachment: units grouped by role, each row showing name, `(N models)`, pts, and a red dot when the unit has issues. Then `+ Add unit` and `Remove detachment`.
  - At the bottom: `+ Add detachment` (choices from `detachmentChoices`) and the battle-size selector.
- **UnitPicker:**
  - a search box, then units grouped by role showing name, pts, and `Legends`/`Forge World` badges (from `UnitOut` via the catalogue JSON, matched by entry target id);
  - rows are full-width 52px tap targets;
  - tapping a row adds the unit and opens its editor.
- **UnitEditor:**
  - a model-count stepper per model stack (`−`/`+` buttons, 44×44, disabled at min/max);
  - option groups from `childOptions`: radio-style cards for max-1 groups, checkboxes for 0–1 options, steppers for higher maxima. Each shows `+{pts} pts` when it costs points.
  - a `Customise one model` action on stacks with children, which runs `split`;
  - a `View datasheet` link to `/factions/:slug/units/:unitSlug`;
  - `Duplicate unit` and `Remove unit`.

- [ ] **Step 1: Write the failing tests**
  - Hook: dispatching `add-unit` updates `view.total.points` right away. The save goes out once within 600 ms of several rapid dispatches.
  - *Review Focus 5:* unmounting straight after a dispatch still saves the latest roster.
  - Page, with the mini fixture scope: add Warriors from the picker; the header shows `110 / 2,000 pts`.
  - Page: the issues button shows the count; tapping the HQ issue's `Add Lord` fix adds Lord.
  - Page: `+` on the model stepper is disabled at 20.
  - Page: an over-limit list shows the points bar with `aria-invalid="true"`.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep each component under ~250 lines; split out subcomponents if one grows past that.
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): list editor with wargear controls, live totals and fixable issues`.

### Task 15: Text export and public share link

**Files:**
- Create: `apps/web/src/lists/ExportSheet.tsx`, `apps/web/src/lists/SharePage.tsx`, `apps/web/src/lists/publicSource.ts`
- Modify: `apps/web/src/lists/ListEditorPage.tsx` (Export and Share buttons), `apps/web/src/routes.tsx` (public `/share/:id`), `apps/web/src/App.tsx`
- Test: `apps/web/src/lists/publicSource.test.ts`, `apps/web/src/lists/SharePage.test.tsx`

**Interfaces:**
- Consumes: `exportText` (Task 8), `setListPublic` (Task 13), and the existing Supabase client from `createAuthSetup`.
- Produces:
  - `interface PublicListSource { get(id: string): Promise<{ data: ListData; updatedAt: number } | null> }`.
  - `createSupabasePublicSource(client)` runs `from('documents').select('data, updated_at').eq('id', id).eq('is_public', true).eq('deleted', false).maybeSingle()`. This works for a signed-out visitor through the `anyone reads public documents` policy.
  - `createLocalPublicSource(db)` is for dev mode without Supabase: it reads the local doc only if `isPublic`.

**Decisions:**
- **ExportSheet:**
  - shows `exportText` in a read-only monospace `<textarea>`;
  - `Copy` uses `navigator.clipboard.writeText` and confirms with `Copied` for 2 s;
  - `Download .txt` builds a Blob locally (no network).
- **Share:**
  - The toggle `Anyone with the link can view` calls `setListPublic` and saves. The document syncs with `is_public = true`.
  - When on, it shows the link `${location.origin}/share/${id}` with a `Copy link` button.
  - Turning it off makes the link stop working after the next sync.
- **SharePage:**
  - outside `RequireAuth`; uses the app shell without the account menu;
  - shows the list name, faction, size, totals, the issues count, and the full export text rendered as sections (not editable);
  - has `Build your own` (links to `/`);
  - not found or not public: `This list isn't shared, or the link is wrong.`;
  - an unknown entry renders as `Unknown item` (*Review Focus 4*).

- [ ] **Step 1: Write the failing tests**
  - `createSupabasePublicSource` issues exactly the query above (fake client recording calls) and returns null when there's no row.
  - SharePage renders a public list's name and `Necron Warriors` for a signed-out user (no AuthProvider user).
  - SharePage shows the not-found copy for a private list.
  - SharePage renders `Unknown item` for a roster containing an unknown entry id.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement. Pick `createSupabasePublicSource` when `setup.supabase` exists, and `createLocalPublicSource(db)` otherwise.
- [ ] **Step 4:** Run `npm test -w apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): text export and read-only share links`.

### Task 16: End-to-end builder flow, performance check, manual walkthrough

**Files:**
- Create: `apps/web/e2e/builder.spec.ts`
- Modify: `packages/data/test/roster-policy.test.ts` (performance test)

- [ ] **Step 1: Write the e2e test** (both Playwright projects, dev sign-in):
  1. `/build` → `New list` → Necrons → Strike Force → Arks of Omen Detachment → pick a dynasty → `Create list`.
  2. Expect the issues button to show problems. Open it, and expect the text `needs 1 more HQ unit`.
  3. Tap its fix, pick `Overlord`, open Overlord, and turn on `Warlord`.
  4. Add Necron Warriors three times (the compulsory Troops stack). Expect `✓ Legal`.
  5. Expect the header to show the BSData total. Compute it in the test from the generated JSON in `public/data/roster/necrons.json`, not as a typed number.
  6. Open Export and expect the text to contain `Necron Warriors (10 models)`.
  7. Turn on sharing, read the link, sign out, and open the link. Expect `Necron Warriors` read-only, and no sign-in redirect.
  8. Expect every button and interactive row in the editor to have a bounding box height ≥ 44, and no horizontal overflow at 375px.
- [ ] **Step 2: Performance test** (data package):
  - Build a 3,000-pt Space Marines Onslaught roster with 40 units by script.
  - Expect `validate()` to take under 150 ms (median of 5 runs) on the dev machine.
  - If it's slower, add memoisation of `countIn` per evaluation pass before going further.
- [ ] **Step 3:** Run `npm test && npm run e2e` from the repo root. Expected: everything PASSES, both projects.
- [ ] **Step 4: Manual check.**
  - Run `npm run dev`. In the built-in browser at 375×812, build a legal list for Necrons, Blood Angels (imports the library) and Imperial Knights (Lords of War compulsory).
  - Screenshot the editor, the issues sheet, the unit editor and the share page for the user.
  - Note anything awkward as follow-ups.
- [ ] **Step 5:** Commit: `test: e2e army builder flow at phone and desktop; roster performance check`.
- [ ] **Step 6: Whole-branch review.** Use superpowers:requesting-code-review. Fix what it finds, re-run `npm test && npm run e2e`, then use superpowers:finishing-a-development-branch.

---

## Needs the user (not blocking)
1. **Supabase:** share links work across devices only once the Supabase project exists, with the M1 migration (its `anyone reads public documents` policy is already there). Until then, share links work on the same device in dev mode.
2. **Corpus spot-check:** the user is welcome to send one or two real lists they know are legal (any faction) to add to the corpus.
