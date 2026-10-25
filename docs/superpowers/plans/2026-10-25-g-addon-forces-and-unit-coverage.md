# Plan G: Add-on forces and unit coverage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Small forces that can't be an army on their own (Legion of the Damned, Astra Telepathica, both Titan Legions, Monsters and Gribblies) stop being offered as armies, and every screen says how they're really used.
- The builder stops accepting a Legion-only army.
- World Eaters get their Khorne Berzerkers, and Chaos Titans their Warlord Titan.
- Faction pages list exactly what the builder can field: units stored as "upgrades" included, a "Needs Sautekh dynasty"-style tag on units that need a choice, open-play-only entries removed.
- Legends units are badged as Legends.

**Architecture:**
- **Five data corrections** in `packages/data/overrides/`, each with a `source` note and applied at build time, so every screen gets them:
  - `added-units.json`: copies an existing BattleScribe unit into another catalogue, with listed changes, before extraction and emission;
  - `force-removals.json`: drops a catalogue-level detachment;
  - ability exclusions: `rule-exclusions.json` entries gain an optional `unit`;
  - Legends flags from Wahapedia's source books;
  - `add-on-forces.json`: a plain-English "how it's used" for each add-on force, published on `CatalogueSummary`.
- **Unit lists:** `extractUnits` uses the roster engine's own unit test, so faction pages and the picker agree. Each unit gets the choices that reveal it, read from its `hidden` modifiers.
- **Web:** the faction picker splits Armies and Add-on forces; the wizard won't start a list with an add-on force; the editor explains add-ons wherever they appear.

**Tech Stack:** unchanged, with no new dependencies.

**Spec:** this plan stands alone; it acts on the audit in this session, 25 Oct 2026. The facts it relies on:
- **The Legion's no-HQ rule:** "Saviours From Beyond" (a Legion Vanguard with no HQ) is in BSData v9.8.0 (`Imperium - Legion of the Damned.cat` line 487) and missing from Wahapedia's 9th-edition Damned Legionnaires datasheet (`000000150`). That datasheet comes from the source "Warhammer Legends: Legion of the Damned" and lists six abilities: And They Shall Know No Fear, Bolter Discipline, Shock Assault, Unyielding Spectres, Aid Unlooked For and Flaming Projectiles. The owner approved dropping the rule.
- **The final data release:** BSData v9.8.0 (19 Oct 2023) is the final 9th-edition release, so the two missing units must come from our own corrections.
- **Khorne Berzerkers:** World Eaters, Wahapedia `000002627`, Troops. 4–9 Khorne Berzerkers plus 1 Champion. 22 pts per model. Profile 6"/3+/3+/5/4/2/4 (Champion A5)/8 (Champion 9)/3+. Library `03_Codexes/Chaos/World_Eaters.md` line 116. BSData has the same unit only in `Chaos - Chaos Space Marines.cat` (entry `3930-491c-1688-555d`, Elites, 25 pts per model), and the World Eaters catalogue doesn't link that file.
- **Chaos Warlord Titan:** Heretic Titan Legions, Wahapedia `000002451`, Lords of War, 5,500 pts including wargear. BSData has only the Imperial "Warlord Titan" (`Imperium - Titan Legions.cat`).
- **Arks of Omen allies** (library `01_Core_Rules/Army_Building_Detachments_and_CP.md` §7): one Arks of Omen Detachment plus at most one ally from a permitted list. The add-on forces aren't on it.

**Branch:** `unit-coverage` in worktree `L:\9th Edition\app-coverage`, off `main` (`9dd2d6a`). For browser tests use ports `E2E_PORT=5208 E2E_PROD_PORT=5218`. One session, native execution, one review at the end.

## Global Constraints

- **Precedence:** final GW changes > BSData v9.8.0 > Wahapedia > the research library. Every correction names its evidence in `source`.
- **Scope of corrections:** a correction may touch only the entries it names. A build that finds a named entry missing fails with the catalogue, entry and override file named, like the existing overrides.
- **Nothing else changes:** the corrections must not alter any other unit's points, options or validation. The existing data tests and `test/roster-corpus.test.ts` stay green.
- **Copy:** plain English, curly apostrophes, sentence case. The add-on texts below are exact.
- **Budgets:** `npm run budgets -w @recruit/web` stays green (startup JS ≤ 150 kB, catalogues ≤ 300 kB, rosters ≤ 250 kB).

## Review Focus

1. **A list saved before this change** whose army is an add-on force (a Legion of the Damned list): it still opens and saves, shows the explanation, and loses nothing. Pinned in Task 8.
2. **An add-on force added to a Space Marine list at Combat Patrol, then the size changed to Strike Force:** the ally detachment is flagged as not allowed, with the Arks of Omen reason. It is not silently deleted. Pinned in Task 8.
3. **A unit hidden by two different conditions** (Imotekh is hidden in an Annihilation Legion, without Sautekh, and in a Cult of the Cryptek army): its tag names what it needs ("Sautekh dynasty"), not what excludes it. Pinned in Task 6.
4. **The copied Berzerkers carrying Chaos Space Marine relics or the CSM-only "Let the Galaxy Burn":** they must not. Pinned in Task 1.
5. **The 5,500-pt Chaos Warlord Titan:** it appears on its faction page and in the picker, but no battle size can field it. The picker shows the price, and adding it shows the normal points-over problem rather than a crash. Pinned in Task 2.

---

### Task 1: Copy a unit into another catalogue; Khorne Berzerkers for World Eaters

**Files:**
- Create: `packages/data/src/patch/addedUnits.ts`, `packages/data/overrides/added-units.json`, `packages/data/test/added-units.test.ts`
- Modify: `packages/data/src/build.ts` (apply the patches to the parsed `GameData` before `extractUnits`, `emitRosterFile` and `emitInfoFile`)

**Interfaces:**
- Produces:

  ```ts
  interface AddedUnit {
    catalogueName: string; entryName: string;          // target catalogue; the new unit's name
    from: { catalogueName: string; entryId: string };  // the BSData entry to copy
    newId: string;                                      // a fresh id, "<catalogue-prefix>-added-<slug>"
    primaryRole: string;                                // battlefield role category name in the target ("Troops")
    factionCategories: string[];                        // target category names replacing the source's faction links
    costPerModel?: number; costTotal?: number;          // points ("pts" cost type), per model entry or on the unit
    dropChildren?: string[];                            // child entry/group names left out (relics, CSM-only options)
    dropAbilities?: string[];                           // rule/profile names left out
    wahapediaId: string;                                // the datasheet the unit joins for text and abilities
    source: string;
  }
  function applyAddedUnits(gd: GameData, added: AddedUnit[]): void
  ```

  `applyAddedUnits` deep-copies the source `RawNode`, giving it the new id and name. It copies every node the subtree links to that the target's scope can't resolve into the target catalogue's `sharedSelectionEntries` / `sharedSelectionEntryGroups` / shared profiles and rules, keeping their ids. It swaps the category links, sets the costs, removes the dropped children and abilities, and appends an `entryLink` to the copy in the target's root `entryLinks`.

- [ ] **Step 1: Write the failing tests** (they run after `npm run data:build`, reading `generated/`):

  ```ts
  test('World Eaters have Khorne Berzerkers: Troops, 5–10 models, 22 pts each', () => {
    const u = unit('chaos-world-eaters', 'Khorne Berzerkers');
    expect(u).toMatchObject({ role: 'Troops', minModels: 5, maxModels: 10, points: 110, wahapediaId: '000002627' });
    expect(u.models.find((m) => m.name === 'Khorne Berzerker')!.chars).toMatchObject({ M: '6"', S: '5', W: '2', A: '4', Save: '3+' });
    expect(u.weapons.map((w) => w.name)).toEqual(expect.arrayContaining(['Berzerker chainblade', 'Bolt pistol', 'Khornate eviscerator']));
    expect(u.weapons.some((w) => /Maelstrom|Ashen Axe|Black Mace/.test(w.name))).toBe(false);
    expect(u.abilities.map((a) => a.name)).not.toContain('Let the Galaxy Burn');
    expect(u.factionKeywords).toEqual(expect.arrayContaining(['World Eaters']));
  });
  test('a World Eaters Strike Force with three Berzerker squads as its Troops validates', () => { /* roster engine: Arks of Omen detachment, an HQ, 3× Berzerkers (5 models) → no slot problems */ });
  test('adding 10 Berzerkers costs 220 pts in the builder', () => { /* availableUnits price 110; setCount to 10 → 220 */ });
  test('a correction naming a missing entry fails the build', () => { expect(() => applyAddedUnits(gd, [{ ...good, from: { ...good.from, entryId: 'nope' } }])).toThrow(/added-units.json.*nope/); });
  ```

- [ ] **Step 2: Run them and check they fail.** Run: `npm run data:build && npm test -w @recruit/data -- added-units`. Expected: FAIL (no unit).
- [ ] **Step 3: Implement** `applyAddedUnits` and the World Eaters entry.
  - Source: `Chaos - Chaos Space Marines` `3930-491c-1688-555d`.
  - Role: Troops.
  - Faction categories: the ones every World Eaters unit carries. Read them off an existing World Eaters Troops unit, such as Jakhals.
  - Costs: 22 per model.
  - Dropped: the CSM relic groups, the Mark of Khorne option and "Let the Galaxy Burn".
  - `wahapediaId`: `000002627`.
  - `source`: cite the library line and the Wahapedia id.
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data`. Expected: PASS, and every other suite unchanged.
- [ ] **Step 5: Commit** with `fix(data): World Eaters get Khorne Berzerkers (copied from the CSM entry, World Eaters points and keywords)`.

### Task 2: The Chaos Warlord Titan

**Files:**
- Modify: `packages/data/overrides/added-units.json`
- Test: `packages/data/test/added-units.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `chaos-chaos-titan-legions` has `Chaos Warlord Titan`: Lords of War, `points` 5500, faction keywords include `Titanicus Traitoris` and `Chaos`, not `Imperium`;
  - its weapons are the ones in Wahapedia `000002451`'s composition: apocalypse launchers, ardex-defensor lascannons, ardex-defensor maulers, Arioch power claws, Warlord feet, plus their options;
  - adding it at Onslaught yields exactly one problem, `points-over`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement** the entry.
  - Source: `Imperium - Titan Legions`, "Warlord Titan".
  - Faction categories: the Chaos Reaver Titan's.
  - Abilities: follow `000002451`. Keep Void Shields and Reactor Meltdown. Swap the Imperial-only ability for the Chaos one the Chaos Reaver carries ("Battle Titan") if the Wahapedia sheet lists it.
  - `costTotal`: 5500.
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data`. Expected: PASS.
- [ ] **Step 5: Commit** with `fix(data): Chaos Titan Legions get the Chaos Warlord Titan`.

### Task 3: Drop the old Legion of the Damned no-HQ rule

**Files:**
- Create: `packages/data/overrides/force-removals.json`
- Modify:
  - `packages/data/src/roster/emit.ts` (`EmitOverrides.forceRemovals`)
  - `packages/data/src/build.ts` (excludes `unit` abilities too)
  - `packages/data/overrides/rule-exclusions.json` (entries gain an optional `unit`)
- Test: `packages/data/test/roster-emit.test.ts`, `packages/data/test/rule-exclusions.test.ts`, `packages/data/test/roster-policy.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `generated/roster/imperium-legion-of-the-damned.json` has no force with id `0383-bad5-390e-4cca`;
  - the Damned Legionnaires datasheet has no "Saviours From Beyond" ability;
  - a Legion-only roster at Combat Patrol has no detachment it can fill: `detachmentChoices` offers only the core detachments, and each one fails its HQ slot;
  - an Ultramarines Combat Patrol can still add a Legion of the Damned Auxiliary Support Detachment, and that list validates.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** Add one `force-removals.json` entry (`catalogueName`, `forceId`, `forceName`, `source`: the Wahapedia `000000150` abilities and the owner's ruling, 25 Oct 2026) and one `rule-exclusions.json` entry with `unit: "Damned Legionnaires"`, `name: "Saviours From Beyond"`.
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data`. Expected: PASS.
- [ ] **Step 5: Commit** with `fix(data): the Legion of the Damned's 8th-edition no-HQ Vanguard is gone (not on the 9th datasheet)`.

### Task 4: Legends badges from Wahapedia's source books

**Files:**
- Modify: `packages/data/src/join/wahapedia.ts`
- Test: `packages/data/test/join.test.ts`

**Interfaces:**
- Produces: `UnitOut.legends` is true when BSData tags the name `[Legends]`, the catalogue name says `[LEGENDS]`, or the matched Wahapedia datasheet's `source_id` names a source starting `Warhammer Legends`.

- [ ] **Step 1: Write the failing tests:**
  - Damned Legionnaires, Renegade Cultists, Kabalite Trueborn and Carnac Commodus are `legends: true`;
  - Necron Warriors, Intercessor Squad and Khorne Berzerkers (World Eaters) are `legends: false`;
  - the number of units that change is exactly the audited 26 entries (18 names). The test lists them.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and check they pass.** The `units.test.ts` Legends checks stay green.
- [ ] **Step 5: Commit** with `fix(data): units Wahapedia files under Warhammer Legends are badged Legends`.

### Task 5: Add-on forces

**Files:**
- Create: `packages/data/overrides/add-on-forces.json`, `packages/data/test/add-on-forces.test.ts`
- Modify: `packages/data/src/model/types.ts` (`CatalogueSummary.addOn?: { how: string }`), `packages/data/src/build.ts`

**Interfaces:**
- Produces: `CatalogueSummary.addOn`, set for the catalogues below, with `how` texts exactly as written (the builder-backed test keeps them true):

| Catalogue | `how` |
|---|---|
| `Imperium - Legion of the Damned` | `A single Legends unit, not an army. Add a squad to an Imperium army as an extra detachment in Combat Patrol or Onslaught games; Incursion and Strike Force (Arks of Omen) don’t allow it as an ally.` |
| `Imperium - Adeptus Astra Telepathica` | `Two psyker characters, not an army. Add one to an Imperium army as an extra detachment in Combat Patrol or Onslaught games.` |
| `Imperium - Titan Legions` | `Titans join big Imperium armies: add one as a Super-heavy Auxiliary Detachment in Onslaught games. They don’t fit Combat Patrol, Incursion or Strike Force.` |
| `Chaos - Titanicus Traitoris` | `Titans join big Chaos armies: add one as a Super-heavy Auxiliary Detachment in Onslaught games. They don’t fit Combat Patrol, Incursion or Strike Force.` |
| `Unaligned - Monsters and Gribblies` | `Wild creatures, not an army. Add one to any army as an extra detachment in Combat Patrol or Onslaught games.` |

- [ ] **Step 1: Write the failing tests.**
  - The five catalogues have `addOn`, and no other catalogue does.
  - For each `how`, the roster engine agrees: at each size the text names, some army of that group is offered an allied detachment of the add-on's catalogue (via `detachmentChoices`); at the sizes it rules out, none is. If no Chaos Titan fits Onslaught's 3,000 points, the test fails and the text is corrected rather than the test.
  - None of the five can fill a detachment on its own at Incursion or Strike Force, and the Legion can't at any size (the Task 3 checks, reused).
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(data): add-on forces say how they’re used`.

### Task 6: Faction pages list what the builder can field

**Files:**
- Modify:
  - `packages/data/src/extract/units.ts`
  - `packages/data/src/model/types.ts` (`UnitOut.needs?: string[]`)
  - `packages/data/src/roster/options.ts` (export `isUnitEntry`'s rule as `isUnitLike(type, role, name)`, shared with extraction)
- Test: `packages/data/test/units.test.ts`, `packages/data/test/unit-needs.test.ts` (new)

**Interfaces:**
- **Extraction:** includes `upgrade` root entries that `isUnitLike` accepts, the same rule as the picker.
- **`UnitOut.needs`:** the option names whose selection removes the unit's `hidden`. It comes from modifiers `hidden=true` when `lessThan 1` / `equalTo 0` of X, or `hidden=false` when `atLeast 1` of X. Each X is turned into `${optionDisplay(X).name}${heading ? ' ' + heading.toLowerCase() : ''}`, e.g. `Sautekh dynasty`, `Blood Ravens`, `Wardmakers`. Conditions that *exclude* a unit (`atLeast 1` hides it) don't produce `needs`.
- **Left off the pages:**
  - units revealed only by the Open Play game type (a condition on the "Open" game-type entry);
  - units hidden with no revealing condition at all.

- [ ] **Step 1: Write the failing tests:**
  - **Upgrade-stored units now listed:**
    - Chaos Space Marines: Vashtorr the Arkifane;
    - Daemons: Skull Altar;
    - Servants of the Abyss: Cultist Firebrand and Rogue Psyker;
    - Astra Militarum: Crassus;
    - Grey Knights: Stormraven Gunship.
  - **Tags:**
    - Imotekh `needs` equals `['Sautekh dynasty']`;
    - Gabriel Angelos on Ultramarines `needs` includes `Blood Ravens`;
    - Brother-Captain Stern `needs` equals `['Wardmakers']`.
  - **Removed:** no catalogue lists `Land Raider Variant (Open Play)`.
  - **Agreement:** for every playable catalogue, the picker on a fresh Strike Force list (`availableUnits`) is a subset of the faction page's units plus the 14 shared fortifications. Every faction-page unit is either in that picker or has `needs` or `legends`.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run data:build && npm test -w @recruit/data`. Expected: PASS. Budgets stay within the catalogue limit.
- [ ] **Step 5: Commit** with `fix(data): faction pages list exactly what the builder can field, with what each unit needs`.

### Task 7: Armies vs add-on forces in the faction picker and the wizard

**Files:**
- Modify: `apps/web/src/factions/FactionPicker.tsx`, `apps/web/src/factions/FactionPicker.test.tsx`, `apps/web/src/lists/NewListPage.tsx`, `apps/web/e2e/builder.spec.ts`

**Interfaces:**
- **`FactionPicker`:** keeps its props.
  - Factions with `addOn` move to a final section headed `Add-on forces`, introduced by `These can’t be an army on their own. They join another army as allies.`
  - Each add-on row shows the crest, the name and its `how`.
  - With `onPick` (the wizard), add-on rows aren't buttons: each has a `Read the guide` link to `/factions/{slug}/guide` instead.
  - With `to` (Factions, Rules guides), they stay links.
  - Search still finds them, in their section.

- [ ] **Step 1: Write the failing tests:**
  - in the wizard, `Legion of the Damned` is under the `Add-on forces` heading, isn't a button, and shows its `how`;
  - `Necrons` is still a button under its group;
  - on the Factions page, `Legion of the Damned` links to `/factions/imperium-legion-of-the-damned`;
  - e2e: a phone user can't start a Legion of the Damned list.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(web): add-on forces are listed apart and can’t start a list`.

### Task 8: Add-on forces in the list editor

**Files:**
- Modify:
  - `apps/web/src/lists/SummarySheets.tsx` (the `DetachmentSheet` allies list)
  - `apps/web/src/lists/ListEditorPage.tsx` (banner)
  - `apps/web/src/lists/UnitPicker.tsx` (Legends badge and the needs reason)
  - their tests, and `apps/web/e2e/editor.spec.ts`

**Interfaces:**
- **Allies list:** each allied faction that is an add-on shows its `how` under its name.
- **Banner on an add-on army:** when a list's army catalogue is an add-on (a list saved before this change), the editor shows a `role="note"` above the summary strip: `{Faction} can’t be an army on its own. {how} To use it, start a list for the army it joins and add {Faction} with Add detachment.`, with a `New list` link.
- **Picker:** a row's Legends badge shows when `o.legends || unitInfo(...)?.unit.legends`. A row in `Not available with this army’s current choices` shows `Needs {needs.join(' or ')}` when the datasheet has `needs`.
- **Arks of Omen sizes:** an add-on ally detachment kept after the size changes to Incursion or Strike Force shows the existing Arks of Omen ally problem (policy `detail`). Nothing is deleted.

- [ ] **Step 1: Write the failing tests:**
  - a seeded Legion of the Damned list opens, shows the banner text and `New list`, and still saves edits;
  - an Ultramarines Combat Patrol's Add detachment lists `Legion of the Damned` with its `how`;
  - adding it, then changing the size to Strike Force, shows the Arks of Omen problem naming the Legion, and the detachment is still there;
  - in a Szarekhan list's picker, Imotekh's row under Not available reads `Needs Sautekh dynasty`;
  - Damned Legionnaires show the Legends badge.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(web): the editor explains add-on forces and why a unit isn’t available`.

### Task 9: Faction pages and datasheets show what a unit needs

**Files:**
- Modify: `apps/web/src/factions/FactionPage.tsx`, `apps/web/src/ui/datasheet/DatasheetView.tsx` (meta line), their tests

- [ ] **Step 1: Write the failing tests:**
  - the Necrons faction page's Imotekh row shows `Needs Sautekh dynasty`;
  - Imotekh's datasheet meta line ends `· Needs Sautekh dynasty`;
  - the Ultramarines page doesn't list `Land Raider Variant (Open Play)`;
  - the Chaos Space Marines page lists Vashtorr the Arkifane.
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(web): faction pages and datasheets say what a unit needs`.

### Task 10: Full checks and review

- [ ] **Step 1:** Run `npm run data:build`, `npm test`, `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web` and `E2E_PORT=5208 E2E_PROD_PORT=5218 CI=true npm run e2e -w @recruit/web`. Expected: all green.
- [ ] **Step 2:** Re-run the audit scripts (`scratchpad/audit-units.cjs`, plus a fresh picker comparison) and attach the before/after counts to the report. Expect:
  - World Eaters and Chaos Titans have no "not in BSData" gaps;
  - every catalogue's "only on page" list is empty apart from units with `needs` or `legends`.
- [ ] **Step 3:** Ask for one fresh review of `git diff main...unit-coverage` on the most capable model, against this plan's Review Focus. Fix the confirmed findings test-first.
- [ ] **Step 4:** Report the branch ready. Don't merge or push without the owner's go-ahead.

## Self-review

- **Owner's five points:**
  1. Add-on forces in the wizard and editor: Tasks 5, 7 and 8.
  2. The old Legion rule: Task 3.
  3. The two missing units: Tasks 1 and 2.
  4. Faction pages matching the builder: Tasks 6 and 9.
  5. Legends badges (found during the Legion check and folded in): Task 4.
- **Types:** `CatalogueSummary.addOn` (Task 5) is read by Tasks 7 and 8. `UnitOut.needs` (Task 6) is read by Tasks 8 and 9. `isUnitLike` (Task 6) is shared by the picker and extraction.
- **Review Focus:** 1 and 2 are in Task 8, 3 in Task 6, 4 in Task 1 and 5 in Task 2.
- **Open assumption:** the `how` texts are tested against the engine (Task 5), so a wrong claim fails the build rather than reaching players.
