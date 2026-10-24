# Plan C: Play mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a saved list opens read-only in **Play mode** at `/build/:id/play`, the way New Recruit's Play button does. Play mode shows:
- the army's rules and its stratagems;
- every unit with its key stats;
- a phone-sized datasheet for any unit you tap, with Previous and Next to step through the army.

The share page becomes the same read-only view, and adds **Save to my lists**. The Table companion gets an `ArmyDrawer` built from the same parts.

**Architecture:**
- **One pure model, three screens:**
  - `playArmy(view, scope, units)` turns a validated roster into units by role. Each unit carries its key stats, a wargear line, a Warlord badge, its datasheet (`UnitOut`) and the weapons it actually has.
  - `armyRules` and `playStratagems` add the army's rules (chosen sub-faction texts from Plan D's entry info, plus the faction rules its units use) and stratagems (filtered to the list's faction and its choices).
  - `loadPlayData(listData)` does all the loading.
- **One loader, two sources:** `usePlayList(listId)` reads a list from this device. The share page reads from the public source. Both call `loadPlayData`.
- **Content and sheets are separate:**
  - `PlayArmyView` is page content (tiles and unit cards) that asks to open a `PlaySheet`.
  - `PlaySheets` renders that one sheet (army rules, stratagems or a unit's datasheet) with Plan A's `Sheet`.
  - On `PlayPage` and the share page the open sheet lives in the URL (`?sheet=rules|stratagems`, `?unit=<selId>`), so a phone's Back button closes it.
  - `ArmyDrawer` keeps it in state and shows one sheet at a time: the army, or the unit in its place.
- Nothing in Play mode edits or saves a list. The only write is Save to my lists (`createList`).

**Tech Stack:** unchanged (React 19, React Router 6, Dexie 4, Vitest 5 + Testing Library, Playwright 1.64). This plan adds no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md`:
- §2 (copy, look);
- §3 (Plan A components: `PageHeader`, `Sheet`, `DatasheetView`, `keyStats`, icons);
- §4 (Plan D: `optionDisplay`, `loadEntryInfo`, `entryInfo`, `EntryInfo`; the `ArmyDrawer` contract);
- §5 row C (scope, file ownership);
- §6 (rules for every plan).

The mockups are `PlayList.dc.html` and `PlayDatasheet.dc.html` on the canvas https://claude.ai/artifact/7876Z9d5vpJvDy5AQRc98h.

**Branch:** `play-mode` in worktree `L:\9th Edition\app-play-mode`, off `main` after Plans A and D are merged (wave 2, in parallel with B, E1, E2 and E3).

## Global Constraints

- **Files this plan may write:**
  - `apps/web/src/lists/play/**` (new);
  - `apps/web/src/lists/SharePage.tsx` and `apps/web/src/lists/SharePage.test.tsx`;
  - one route line plus its lazy import in `apps/web/src/routes.tsx`;
  - `apps/web/e2e/share.spec.ts`, `apps/web/e2e/play-mode.spec.ts` (new), `apps/web/e2e/seed.ts` (new) and `apps/web/e2e/data/novokh-incursion.json` (new).

  Every other file is read-only. That includes Plan B's `lists/*`, Plan A's `ui/*`, `theme.css`, `layout/*`, and `table/*`, `rules/*` and `factions/*`.
- **Read-only imports this plan relies on.** Their owners must keep these names and signatures:
  - `lists/editorView.ts`: `unitsByRole`, `isArmyOption`, `isAutoManaged`, `unitName`, `fmt`, `plural`, `problemsLabel`.
  - `lists/useRosterEditor.ts`: `slugsFor`.
  - `lists/unitIndex.ts`: `loadUnitIndex`, `unitInfo`, `UnitIndex`.
  - `lists/newListSetup.ts`: `armyChoices`, `startingRoster`, `listData`.
  - `lists/listStore.ts`: `createList`, `ListData`.
  - `lists/publicSource.ts`: `usePublicSource`, `PublicListSource`.
  - `lists/ExportSheet.tsx`: `CopyButton`.
  - `table/stratagemFilter.ts`: `CORE_GROUP`.
  - `rules/wording.tsx`: `WordingToggle`, `useWording`.
  - `rules/RulesText.tsx`: `RulesText`.
  - `layout/OfflineNotice.tsx`: `LoadError`.
  - `factions/dataClient.ts`: `getIndex`, `getPolicy`, `getRosterScope`, `getCatalogue`, `getCoreStratagems`.
  - `factions/useAsync.ts`: `useAsync`.
  - Plan A (§3): `PageHeader`, `Sheet`, `DatasheetView`, `keyStats`, `IconEdit`, `IconWarlord`, `IconNext`, `IconBack`, `IconRules`, `IconTable`.
  - Plan D (§4): `optionDisplay`, `unitSummary`, `UnitSummary`, `loadEntryInfo`, `entryInfo`, `EntryInfo`, `EntryInfoIndex`. Play mode never parses `unitExport().details`: the wargear line, the Warlord badge, traits and relics all come from `unitSummary(v)`.
- **Plan A provides `hideName`** (spec §3). Inside a `Sheet` already titled with the unit's name, C passes `hideName`, so the name isn't repeated as a heading.
- **CSS:** all of it goes in `lists/play/play-mode.css`, imported once by `PlayArmyView.tsx`. Use tokens from `theme.css` only (`--surface`, `--surface-2`, `--border`, `--text-soft`, `--text-muted`, `--brass-strong`, `--font-display`); add no new colours.
- **One `Sheet` at a time:** no screen in this plan opens a sheet inside a sheet.
- **Phone:**
  - no horizontal page scroll at 320px or 375px;
  - every tappable thing is at least 44px tall;
  - stats sit in `<dl>` lists, never in tables.
- **Copy, fixed** (UI strings use the curly apostrophe ’):

| Where | String |
|---|---|
| Play page subtitle | `Play mode · read only · {pts} pts` (points with `fmt`) |
| Play page Back | `{ to: '/build', label: 'Your lists' }`, so the aria-label is "Back to Your lists" |
| Play page Edit link | "Edit", to `/build/{id}` |
| Tiles | "Army rules" (subtitle: the first three rule names, joined with ", "); "Stratagems" (subtitle "Yours and core ones, by phase") |
| Unit card | name, then "· {models}" when models > 1; a "Warlord" badge, plus " · {trait}" when it has one; then the stats; the wargear line; "{pts} pts" |
| Unit sheet subtitle | `{role} · {n} model(s) · {pts} pts` (with `plural`) |
| Unit sheet nav | `<nav aria-label="Other units in this army">` with buttons "Previous" and "Next", each followed by the unit's name |
| No datasheet | "This unit has no datasheet in the rules data." |
| Rules sheet | title "Army rules"; sections "Your choices" and "Faction rules"; empty: "No army rules found for this list." |
| Stratagems sheet | title "Stratagems"; a checkbox "Show every stratagem"; note "Showing stratagems for your faction and its choices." |
| Empty army | "No units in this list yet." |
| Play page, missing list | h1 "List not found"; "We couldn’t find this list on this device. It may have been deleted."; link "Back to your lists" |
| Loading | "Loading your army…" |
| Share page | Back `{ to: '/', label: 'Home' }`; "Copy list"; signed out: link "Build your own"; signed in: button "Save to my lists" |
| ArmyDrawer, missing list | "This list isn’t on this device any more." |
| ArmyDrawer unit sheet | close label "Back to army" |

## Review Focus

1. **Units with no datasheet.** Some items are no longer in the rules data (`v.merged === null`), and some units have no matching `UnitOut`. Each is still listed with its name and points. Its sheet says "This unit has no datasheet in the rules data." *(Tests: Task 2, Task 5.)*
2. **Two detachments.** Units from both detachments appear together under their roles, in detachment order, and Previous and Next walk all of them. *(Test: Task 2.)*
3. **Phone Back.** With a datasheet open, Back closes the sheet and stays in Play mode. A stale `?unit=` link opens nothing and doesn't crash. *(Tests: Task 6, e2e Task 9.)*
4. **An empty list.** A list with no units says "No units in this list yet.", and Edit still works. *(Tests: Task 4, Task 6.)*
5. **Weapon names that differ from their profiles.** A selection "Staff of Light" matches the profiles "Staff of Light (Shooting)" and "Staff of Light (Melee)". Case and curly or straight apostrophes don't matter. Nothing matched means "show everything" (`taken` is `undefined`), never an empty datasheet. *(Test: Task 1.)*

---

### Task 1: Test fixture and the taken-weapons helper

**Files:**
- Create: `apps/web/src/lists/play/__fixtures__/playList.ts`
- Create: `apps/web/src/lists/play/playArmy.ts` (`takenWeapons` only; `playArmy` itself comes in Task 2)
- Test: `apps/web/src/lists/play/playArmy.test.ts`

**Interfaces:**
- Consumes:
  - from the roster engine: `startingRoster`, `armyChoices`, `listData` (B's `newListSetup.ts`), `addUnit`, `addChild`, `chooseInGroup`, `childOptions`, `availableUnits`, `addForce`, `detachmentChoices`, `validate`, `FORCE`;
  - `optionDisplay` (Plan D);
  - `stubGeneratedData` (`lists/__fixtures__/generatedData.ts`).
- Produces:
  - `novokhIncursionData(opts?: { secondDetachment?: boolean }): Promise<ListData>`:
    - a Necrons **Incursion** list named "Novokh Incursion" with the Arks of Omen Detachment and the Novokh dynasty;
    - units: Overlord (Warlord, with no trait, since under Arks of Omen a trait needs the 1 CP requisition), Royal Warden, Necron Warriors, Immortals, Skorpekh Destroyers;
    - with `secondDetachment`, a second detachment of the army's own faction holding Canoptek Scarab Swarms.
  - `pickOption(scope, roster, unitSelId, displayName): Roster`: finds the leaf whose `optionDisplay(name).name === displayName` among `childOptions` of the unit and of every selection under it, and adds it. Inside a group with `max === 1` it uses `chooseInGroup`; otherwise `addChild`. It throws `No option "{displayName}" under {unit}` if there is none, so a data change can't quietly weaken the tests. The fixture uses it for "Warlord".
  - `takenWeapons(v: SelView, unit: UnitOut): string[] | undefined`

- [ ] **Step 1: Write the failing tests** in `playArmy.test.ts` (it uses `stubGeneratedData()` in `beforeEach`, and `resetDataCache` plus `vi.unstubAllGlobals` in `afterEach`, as `SharePage.test.tsx` does). The helper `viewOf(data)` returns `validate(scope, data.roster, policy).view` and finds root selections by `unitName`.

```ts
test('the fixture: Novokh Incursion with an Overlord Warlord', async () => {
  const { view } = await viewOf(await novokhIncursionData());
  expect(unitSummary(unitNamed(view, 'Overlord')).warlord).toBe(true);
  expect(view.roster.battleSize).toBe('incursion');
});

test('taken weapons match profiles by name, by "name (mode)", ignoring case and apostrophes', async () => {
  const { view, units } = await viewOf(await novokhIncursionData());
  const warriors = unitNamed(view, 'Necron Warriors');
  expect(takenWeapons(warriors, datasheet(units, 'Necron Warriors'))).toEqual(['Gauss Flayer']);
  const fake = (names: string[]) => ({ ...warriors, children: names.map((name) => ({ ...warriors.children[0], name, children: [], sel: { ...warriors.children[0].sel, count: 1 } })) });
  const overlordSheet = datasheet(units, 'Overlord');
  expect(takenWeapons(fake(['staff of light']), overlordSheet)).toEqual(['Staff of Light (Shooting)', 'Staff of Light (Melee)']);
  expect(takenWeapons(fake(['Nothing That Matches']), overlordSheet)).toBeUndefined();
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/play/playArmy.test.ts`. Expected: FAIL, with "Cannot find module './playArmy'".

- [ ] **Step 3: Implement the fixture and `takenWeapons`.**
  - **`takenWeapons`:**
    1. Normalize names: lower case, trimmed, spaces collapsed, ’ → '.
    2. Collect the normalized names of all descendants with `count > 0`.
    3. Return the `unit.weapons` profile names `p` where `norm(p)` equals one of those names, or starts with one of them followed by ` (`.
    4. Return `undefined` when none match.

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/play/playArmy.test.ts`. Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/lists/play/playArmy.ts apps/web/src/lists/play/playArmy.test.ts apps/web/src/lists/play/__fixtures__/playList.ts
git commit -m "feat(play): Play mode fixture and the taken-weapons helper"
```

### Task 2: The army model

**Files:**
- Modify: `apps/web/src/lists/play/playArmy.ts`
- Test: `apps/web/src/lists/play/playArmy.test.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `takenWeapons`;
  - `unitSummary` (Plan D);
  - `unitsByRole`, `isArmyOption`, `isAutoManaged`, `unitName` (`editorView.ts`);
  - `unitInfo`, `UnitIndex` (`unitIndex.ts`);
  - `optionDisplay`, `displayName`, `factionDisplayName`, `BATTLE_SIZES`, `COST_PTS`.
- Produces:

```ts
export interface PlayUnit {
  selId: string; name: string; role: string; models: number; points: number;
  wargear: string[];               // unitSummary(v): [...gear, ...relics, ...other]
  warlord: boolean;                // unitSummary(v).warlord
  warlordTrait: string | null;     // unitSummary(v).traits[0] ?? null
  unit: UnitOut | null;            // its datasheet; null when the data has none (or v.merged is null)
  taken: string[] | undefined;
}
export interface PlayChoice { heading: string; name: string; entryId: string } // { heading: 'Dynasty', name: 'Novokh', entryId }
export interface PlayArmy {
  name: string; faction: string; sizeName: string; points: number; pointsLimit: number;
  choices: PlayChoice[];
  roles: { role: string; units: PlayUnit[] }[];   // rulebook order; detachments merged
  units: PlayUnit[];                             // the same units, flat, in display order (Previous / Next)
}
export function playArmy(view: RosterView, scope: Scope, units: UnitIndex | null): PlayArmy;
```

- [ ] **Step 1: Write the failing tests.**

```ts
test('the army: totals, choices, roles in rulebook order, and a flat order for Previous and Next', async () => {
  const data = await novokhIncursionData();
  const { view, scope, units } = await viewOf(data);
  const army = playArmy(view, scope, units);
  expect(army).toMatchObject({ name: 'Novokh Incursion', faction: 'Necrons', sizeName: 'Incursion', pointsLimit: 1000, points: data.summary.points });
  expect(army.choices).toContainEqual(expect.objectContaining({ heading: 'Dynasty', name: 'Novokh' }));
  expect(army.roles.map((r) => r.role)).toEqual(['HQ', 'Troops', 'Elites']);
  expect(army.units.map((u) => u.name)).toEqual(['Overlord', 'Royal Warden', 'Necron Warriors', 'Immortals', 'Skorpekh Destroyers']);
  const warriors = army.units[2];
  expect(warriors).toMatchObject({ models: 10, points: 110, wargear: ['10x Gauss Flayer'], warlord: false, warlordTrait: null, taken: ['Gauss Flayer'] });
  expect(warriors.unit?.name).toBe('Necron Warriors');
  expect(army.units[0]).toMatchObject({ warlord: true, warlordTrait: null }); // Arks of Omen: no trait without the requisition
  const s = unitSummary(unitNamed(view, 'Overlord'));
  expect(army.units[0].wargear).toEqual([...s.gear, ...s.relics, ...s.other]);
});

test('two detachments merge under their roles, in detachment order', async () => {
  const { view, scope, units } = await viewOf(await novokhIncursionData({ secondDetachment: true }));
  const army = playArmy(view, scope, units);
  expect(army.roles.find((r) => r.role === 'Fast Attack')!.units.map((u) => u.name)).toEqual(['Canoptek Scarab Swarms']);
  expect(army.units.at(-1)!.name).toBe('Canoptek Scarab Swarms');
});

test('a unit with no datasheet is still listed', async () => {
  const { view, scope } = await viewOf(await novokhIncursionData());
  const army = playArmy(view, scope, null);   // no unit index: no datasheets at all
  expect(army.units).toHaveLength(5);
  expect(army.units.every((u) => u.unit === null && u.taken === undefined)).toBe(true);
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/play/playArmy.test.ts`. Expected: FAIL, with "playArmy is not a function".

- [ ] **Step 3: Implement `playArmy`.**
  - **Roles:** `unitsByRole(scope, fv)` for each force in order, with the groups merged by role. The order is `BATTLEFIELD_ROLES`, then the rest, as `unitsByRole` sorts them.
  - **Choices:** from `view.forces[0].selections` where `isArmyOption && !isAutoManaged && children.length > 0`. Each child gives one `PlayChoice`:
    - `name`: `optionDisplay(child.name).name`;
    - `heading`: `optionDisplay(child.name).heading ?? displayName(parent.name)`;
    - `entryId`: `child.sel.entryId`.
  - **Points:** `points = view.total[COST_PTS] ?? 0`.
  - **Faction:** from `scope.catalogue(roster.catalogueId)`.

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/play/playArmy.test.ts`. Expected: PASS (6 tests).

- [ ] **Step 5: Commit.** `git commit -am "feat(play): the read-only army model, units by role across detachments"`

### Task 3: Army rules and stratagems

**Files:**
- Create: `apps/web/src/lists/play/armyRules.ts`
- Test: `apps/web/src/lists/play/armyRules.test.ts`

**Interfaces:**
- Consumes: `PlayArmy` (Task 2), `entryInfo` and `EntryInfoIndex` (Plan D), `CORE_GROUP` (`table/stratagemFilter.ts`, read-only), and `CatalogueOut` and `StratagemOut`.
- Produces:

```ts
export interface ArmyRule { name: string; text: string; plain?: string; from: string } // from: a choice's name ('Novokh') or the faction ('Necrons')
export function infoTexts(info: EntryInfo): { name: string; text: string; plain?: string }[];
export function armyRules(army: PlayArmy, scope: Scope, info: EntryInfoIndex | null, catalogues: CatalogueOut[]): ArmyRule[];
export function shownStratagemGroups(groups: string[], chosen: string[], offered: string[]): Set<string>;
export interface PhaseGroup { phase: string; stratagems: StratagemOut[] }
export function stratagemsByPhase(list: StratagemOut[]): PhaseGroup[];
export function playStratagems(a: { catalogues: CatalogueOut[]; core: StratagemOut[]; aoo: boolean; chosen: string[]; offered: string[] }): { mine: StratagemOut[]; all: StratagemOut[] };
```

- [ ] **Step 1: Write the failing tests.** These are pure tests with hand-made inputs, plus one built from the fixture.

```ts
test('info texts: rules as they are; ability profiles by their text column; weapon profiles left out', () => {
  const info = {
    rules: [{ name: 'Rule', text: 'Do X.', plain: 'You do X.' }],
    profiles: [
      { name: 'Awakened By Murder', type: 'Abilities', chars: { Description: 'Add 1 to charge rolls.' } },
      { name: 'Gauss Flayer', type: 'Weapon', chars: { Range: '24"', Type: 'Rapid Fire 1', S: '4', AP: '-1', D: '1', Abilities: '-' } },
    ],
  };
  expect(infoTexts(info)).toEqual([
    { name: 'Rule', text: 'Do X.', plain: 'You do X.' },
    { name: 'Awakened By Murder', text: 'Add 1 to charge rolls.' },
  ]);
});

test('stratagem groups: a group naming an offered choice shows only when chosen; others always', () => {
  const offered = ['Novokh', 'Sautekh', 'Annihilation Legion', 'Victrix Guard'];
  const shown = shownStratagemGroups(['Necrons', 'Novokh', 'Sautekh', 'Annihilation Legion', 'Victrix Guard (Specialist Detachment)', 'Cult of the Cryptek'], ['Novokh'], offered);
  expect([...shown].sort()).toEqual(['Cult of the Cryptek', 'Necrons', 'Novokh']);
});

test('stratagems: core always, Arks of Omen only at Arks of Omen sizes, and "all" holds everything', () => {
  const s = (id: string, group: string, phases = ['Shooting phase']) => ({ id, name: id, cp: '1', group, kind: 'Battle Tactic', phases, text: '' });
  const out = playStratagems({ catalogues: [{ stratagems: [s('a', 'Necrons'), s('b', 'Sautekh')] } as CatalogueOut], core: [s('c', CORE_GROUP), s('d', 'Arks of Omen')], aoo: false, chosen: [], offered: ['Sautekh'] });
  expect(out.mine.map((x) => x.id)).toEqual(['a', 'c']);
  expect(out.all.map((x) => x.id)).toEqual(['a', 'b', 'c']);
});

test('by phase: rulebook order, each stratagem once, under its first phase in that order', () => {
  const s = (id: string, phases: string[]) => ({ id, name: id, cp: '1', group: 'g', kind: '', phases, text: '' });
  const groups = stratagemsByPhase([s('fight', ['Fight phase']), s('cmd', ['Command phase', 'Fight phase']), s('pre', ['Before battle'])]);
  expect(groups.map((g) => [g.phase, g.stratagems.map((x) => x.id)])).toEqual([['Before battle', ['pre']], ['Command phase', ['cmd']], ['Fight phase', ['fight']]]);
});

test('army rules: the chosen dynasty first, then faction rules its units use', async () => {
  const data = await novokhIncursionData();
  const { view, scope, units, slugs } = await viewOf(data);
  const rules = armyRules(playArmy(view, scope, units), scope, await loadEntryInfo(slugs), [await getCatalogue('necrons')]);
  expect(rules[0]).toMatchObject({ from: 'Novokh' });
  expect(rules[0].name).toMatch(/awakened by murder/i);
  expect(rules.filter((r) => r.from === 'Necrons').map((r) => r.name)).toEqual(expect.arrayContaining(['Reanimation Protocols', 'Living Metal', 'Command Protocols']));
  expect(rules.map((r) => r.name)).not.toContain('Dynastic Agents and Star Gods'); // no unit has it as an ability
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/play/armyRules.test.ts`. Expected: FAIL, with "Cannot find module './armyRules'".

- [ ] **Step 3: Implement.**
  - **`infoTexts`:**
    - rules are passed through as they are;
    - from profiles, take the first of `Description`, `Effect`, `Abilities` or `Details` that is present and not `-`, with its `plain?.[key]`;
    - a profile with none of those columns is skipped.
  - **`armyRules`:**
    1. For each `army.choices` entry, `infoTexts(entryInfo(scope, info, c.entryId) ?? {})` with `from: c.name`.
    2. Then the rules of each catalogue whose name equals an ability name on any `army.units[].unit.abilities`, with `from` set to that catalogue's display name, deduplicated by name.
  - **`shownStratagemGroups`:** the key is lower case, ’ and � → ', with " (specialist detachment)" stripped. A group is hidden if its key equals an `offered` key that isn't in `chosen`.
  - **`stratagemsByPhase`:** uses `PHASE_ORDER`:
    1. "Before battle", "During deployment", "At the start of battle round";
    2. your phases: Command, Movement, Psychic, Shooting, Charge, Fight, Morale;
    3. "End of your turn";
    4. the enemy's phases (`Enemy …`, in the same order);
    5. "Being targeted", "Taking casualties", "Enemy taking casualties", "Any phase", "Any of your phases", "Any time".

    Unknown phases come last, in the order first seen.
  - **`playStratagems`:**
    - `all` is every catalogue's stratagems, then core stratagems whose group is `CORE_GROUP`, plus "Arks of Omen" when `aoo`;
    - `mine` is `all` filtered by `shownStratagemGroups` (the core groups always show).

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/play/armyRules.test.ts`. Expected: PASS (5 tests).

- [ ] **Step 5: Commit.** `git commit -am "feat(play): army rules and stratagems filtered to the list's choices"`

### Task 4: Loading: `loadPlayData` and `usePlayList`

**Files:**
- Create: `apps/web/src/lists/play/loadPlayData.ts`
- Test: `apps/web/src/lists/play/loadPlayData.test.tsx`

**Interfaces:**
- Consumes:
  - Tasks 2 and 3;
  - `slugsFor` (`useRosterEditor.ts`), `loadUnitIndex` (`unitIndex.ts`), `armyChoices` (`newListSetup.ts`);
  - `getIndex`, `getPolicy`, `getRosterScope`, `getCatalogue`, `getCoreStratagems`;
  - `loadEntryInfo` (D), `validate`, `exportText`, `BATTLE_SIZES`;
  - `useStorage` and `ListData`.
- Produces:

```ts
export interface PlayData {
  army: PlayArmy; rules: ArmyRule[];
  stratagems: { mine: StratagemOut[]; all: StratagemOut[] };
  issues: Issue[]; text: string;              // text: exportText, for "Copy list"
}
export async function loadPlayData(data: ListData): Promise<PlayData>;
export type PlayListState =
  | { status: 'loading' } | { status: 'missing' } | { status: 'error'; error: Error }
  | { status: 'ready'; listId: string; list: ListData; data: PlayData };
export function usePlayList(listId: string): PlayListState;   // this device's list (repo.getDoc); deleted or other kinds → 'missing'
```

- [ ] **Step 1: Write the failing tests.** Use a `StorageProvider` over `openDb('play-load-test-n')` and `fake-indexeddb/auto`.

```ts
test('loadPlayData: the army, its rules, its stratagems and the export text', async () => {
  const data = await novokhIncursionData();
  const out = await loadPlayData(data);
  expect(out.army.units).toHaveLength(5);
  expect(out.stratagems.mine.map((s) => s.name)).toContain('Blood Rites');            // Novokh's
  expect(out.stratagems.mine.map((s) => s.name)).not.toContain('Talent for Annihilation'); // Mephrit's
  expect(out.stratagems.all.map((s) => s.name)).toContain('Talent for Annihilation');
  expect(out.text).toMatch(/^Novokh Incursion\nNecrons · Incursion/);
});

test('usePlayList: ready for a saved list, missing for an unknown or deleted one', async () => {
  const repo = createRepository(db);
  await repo.saveDoc({ id: 'l1', kind: 'list', ownerId: 'u', data: await novokhIncursionData() });
  const { result } = renderHook(() => usePlayList('l1'), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 5000 });
  const missing = renderHook(() => usePlayList('nope'), { wrapper });
  await waitFor(() => expect(missing.result.current.status).toBe('missing'));
  await repo.deleteDoc('l1');
  const deleted = renderHook(() => usePlayList('l1'), { wrapper });
  await waitFor(() => expect(deleted.result.current.status).toBe('missing'));
});

test('an empty list loads with no units', async () => {
  const out = await loadPlayData(await necronsListData()); // the existing fixture with no units
  expect(out.army.units).toEqual([]);
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/play/loadPlayData.test.tsx`. Expected: FAIL, with "Cannot find module './loadPlayData'".

- [ ] **Step 3: Implement.**
  - **`loadPlayData` loads in parallel:**
    - index and policy;
    - the scope for `slugsFor(roster, catalogues, primary)`;
    - `loadUnitIndex(slugs)`, `loadEntryInfo(slugs)`;
    - `getCatalogue` for each slug;
    - `getCoreStratagems()`.
  - **`chosen` and `offered`:**
    - `chosen` is `army.choices` names;
    - `offered` is every option of `armyChoices(scope, roster)`, through `optionDisplay(o.name).name`.
  - **`aoo`:** `BATTLE_SIZES[roster.battleSize]?.mode === 'aoo'`.
  - **`usePlayList`:** `useAsync` keyed by `listId`, reading the doc, then `loadPlayData`.

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/play/loadPlayData.test.tsx`. Expected: PASS (3 tests).

- [ ] **Step 5: Commit.** `git commit -am "feat(play): load a list into the read-only army (this device or a share link)"`

### Task 5: Army view and its sheets

**Files:**
- Create:
  - `apps/web/src/lists/play/PlayArmyView.tsx`
  - `apps/web/src/lists/play/PlaySheets.tsx`
  - `apps/web/src/lists/play/play-mode.css`
- Test: `apps/web/src/lists/play/PlayArmyView.test.tsx`

**Interfaces:**
- Consumes:
  - `PlayData` (Task 4), `stratagemsByPhase` (Task 3);
  - `Sheet`, `DatasheetView`, `keyStats`, `IconWarlord`, `IconNext`, `IconBack`, `IconRules`, `IconTable` (A);
  - `RulesText`, `WordingToggle`, `fmt`, `plural`.
- Produces:

```ts
export type PlaySheet = { kind: 'rules' } | { kind: 'stratagems' } | { kind: 'unit'; selId: string };
export function PlayArmyView(props: { data: PlayData; onOpen: (s: PlaySheet) => void }): JSX.Element;
export function PlaySheets(props: { data: PlayData; open: PlaySheet; onOpen: (s: PlaySheet | null) => void; closeLabel?: string }): JSX.Element | null;
// null when open.kind === 'unit' names a selId the army doesn't have
```

- [ ] **Step 1: Write the failing tests.** Render the view with `loadPlayData(await novokhIncursionData())` inside `WordingProvider` and `MemoryRouter`. A small `Harness` keeps `open` in `useState` and renders both components.

```ts
test('tiles, roles and unit cards with key stats, wargear, Warlord and points', async () => {
  render(<Harness data={data} />);
  expect(screen.getByRole('button', { name: /^Army rules/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Stratagems/ })).toHaveTextContent('Yours and core ones, by phase');
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['HQ', 'Troops', 'Elites']);
  const warriors = screen.getByRole('button', { name: /^Necron Warriors/ });
  expect(warriors).toHaveTextContent('· 10');
  expect(warriors).toHaveTextContent('10x Gauss Flayer');
  expect(warriors).toHaveTextContent('110 pts');
  expect(within(warriors).getByText('Sv').nextElementSibling).toHaveTextContent('4+');
  expect(screen.getByRole('button', { name: /^Overlord/ })).toHaveTextContent(/Warlord(?! ·)/);
});

test('a Warlord with a trait shows it in the badge', () => {
  const withTrait = { ...data, army: { ...data.army, roles: data.army.roles.map((r) => ({ ...r, units: r.units.map((x) => (x.warlord ? { ...x, warlordTrait: 'Blood-Fuelled Fury' } : x)) })) } };
  render(<Harness data={withTrait} />);
  expect(screen.getByRole('button', { name: /^Overlord/ })).toHaveTextContent('Warlord · Blood-Fuelled Fury');
});

test('a unit sheet: datasheet, no repeated name heading, Previous and Next across the army', async () => {
  const u = userEvent.setup();
  render(<Harness data={data} />);
  await u.click(screen.getByRole('button', { name: /^Necron Warriors/ }));
  const sheet = screen.getByRole('dialog', { name: 'Necron Warriors' });
  expect(within(sheet).getByText(/Troops · 10 models · 110 pts/)).toBeInTheDocument();
  expect(within(sheet).getAllByRole('heading', { name: 'Necron Warriors' })).toHaveLength(1);
  const nav = within(sheet).getByRole('navigation', { name: 'Other units in this army' });
  expect(within(nav).getByRole('button', { name: /^Previous/ })).toHaveTextContent('Royal Warden');
  await u.click(within(nav).getByRole('button', { name: /^Next/ }));
  expect(screen.getByRole('dialog', { name: 'Immortals' })).toBeInTheDocument();
});

test('first unit has no Previous, last has no Next', async () => {
  const u = userEvent.setup();
  render(<Harness data={data} />);
  await u.click(screen.getByRole('button', { name: /^Overlord/ }));
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /^Previous/ })).not.toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: /^Close/ }));
  await u.click(screen.getByRole('button', { name: /^Skorpekh Destroyers/ }));
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /^Next/ })).not.toBeInTheDocument();
});

test('army rules and stratagems sheets; "Show every stratagem" widens the list', async () => {
  const u = userEvent.setup();
  render(<Harness data={data} />);
  await u.click(screen.getByRole('button', { name: /^Army rules/ }));
  const rules = screen.getByRole('dialog', { name: 'Army rules' });
  expect(within(rules).getByRole('heading', { name: 'Your choices' })).toBeInTheDocument();
  expect(within(rules).getByRole('heading', { name: 'Faction rules' })).toBeInTheDocument();
  expect(within(rules).getByText('Reanimation Protocols')).toBeInTheDocument();
  await u.click(within(rules).getByRole('button', { name: /^Close/ }));
  await u.click(screen.getByRole('button', { name: /^Stratagems/ }));
  const strats = screen.getByRole('dialog', { name: 'Stratagems' });
  expect(within(strats).getByText('Showing stratagems for your faction and its choices.')).toBeInTheDocument();
  expect(within(strats).getByText('Blood Rites')).toBeInTheDocument();
  expect(within(strats).queryByText('Talent for Annihilation')).not.toBeInTheDocument();
  await u.click(within(strats).getByRole('checkbox', { name: 'Show every stratagem' }));
  expect(within(strats).getByText('Talent for Annihilation')).toBeInTheDocument();
});

test('no datasheet and no units', async () => {
  const noSheets = { ...data, army: { ...data.army, units: data.army.units.map((x) => ({ ...x, unit: null })), roles: data.army.roles.map((r) => ({ ...r, units: r.units.map((x) => ({ ...x, unit: null })) })) } };
  const u = userEvent.setup();
  const { unmount } = render(<Harness data={noSheets} />);
  await u.click(screen.getByRole('button', { name: /^Immortals/ }));
  expect(screen.getByText('This unit has no datasheet in the rules data.')).toBeInTheDocument();
  unmount();
  render(<Harness data={{ ...data, army: { ...data.army, units: [], roles: [] } }} />);
  expect(screen.getByText('No units in this list yet.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/play/PlayArmyView.test.tsx`. Expected: FAIL, with "Cannot find module './PlayArmyView'".

- [ ] **Step 3: Implement it to match the mockups.**
  - **Tiles:** a two-column grid of two `<button>` tiles.
  - **Roles:** `<section>` per role with an `<h2>` (uppercase in CSS, `--font-display`, `--brass-strong`).
  - **Unit cards:** each card is one `<button>`. Inside it are spans, plus `<dl>` stat pairs: M, T, Sv, then Inv when `keyStats(...).inv` is set, then W.
  - **Unit sheet:** `<Sheet kind="full" title={name} footer={nav}>` holding:
    - the subtitle line;
    - the wargear line;
    - `<DatasheetView unit={u.unit} taken={u.taken} headingLevel={2} hideName />`, or the no-datasheet line.
  - **Rules sheet:** `<WordingToggle />`, then `RulesText` per rule, grouped as "Your choices" (rules with `from` ≠ the faction) and "Faction rules".
  - **Stratagems sheet:** the note, the checkbox, then `stratagemsByPhase(showAll ? all : mine)`. Each stratagem is a compact card: name, a "{cp} CP · {kind}" line, and `RulesText`.
  - **Import:** `import './play-mode.css'` in `PlayArmyView.tsx`.

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/play/PlayArmyView.test.tsx`. Expected: PASS (6 tests).

- [ ] **Step 5: Commit.** `git commit -am "feat(play): army view with unit cards, datasheet sheet with Previous/Next, rules and stratagems sheets"`

### Task 6: The Play page and its route

**Files:**
- Create:
  - `apps/web/src/lists/play/usePlaySheetParam.ts`
  - `apps/web/src/lists/play/PlayPage.tsx`
- Modify: `apps/web/src/routes.tsx` (one lazy import and one route line)
- Test: `apps/web/src/lists/play/PlayPage.test.tsx`

**Interfaces:**
- Consumes: `usePlayList` (Task 4), `PlayArmyView` and `PlaySheets` (Task 5), `PageHeader` and `IconEdit` (A), and `LoadError`.
- Produces:
  - `usePlaySheetParam(): [PlaySheet | null, (next: PlaySheet | null) => void]`. It maps `?sheet=rules`, `?sheet=stratagems` and `?unit=<selId>`. Opening from no sheet pushes a history entry (`state: { playSheet: true }`); switching sheets replaces it. Closing calls `navigate(-1)` when the sheet was opened in the app, else replaces the params with `{}`.
  - `PlayPage()`.
  - The route `/build/:id/play` → `guard(lazyPage(<PlayPage />))`.

- [ ] **Step 1: Write the failing tests.** Use `MemoryRouter` with `initialEntries={['/build/l1/play']}` and routes for `/build/:id/play`, `/build/:id` (`<p>Editor</p>`) and `/build` (`<p>Your lists page</p>`), inside `StorageProvider` and `WordingProvider`. Save `novokhIncursionData()` as `l1`.

```ts
test('header: list name, Play mode subtitle, Back to Your lists, Edit to the editor', async () => {
  renderPlay('l1');
  expect(await screen.findByRole('heading', { level: 1, name: 'Novokh Incursion' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText(`Play mode · read only · ${fmt(saved.summary.points)} pts`)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/build/l1');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('a sheet lives in the URL: Back closes it and stays in Play mode', async () => {
  const u = userEvent.setup();
  const { history } = renderPlay('l1');            // history: a test helper reading useLocation()
  await u.click(await screen.findByRole('button', { name: /^Immortals/ }, { timeout: 5000 }));
  expect(history.current().search).toMatch(/^\?unit=/);
  act(() => history.back());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(history.current().pathname).toBe('/build/l1/play');
});

test('a stale ?unit= opens nothing', async () => {
  renderPlay('l1', '?unit=not-a-unit');
  expect(await screen.findByRole('heading', { level: 1, name: 'Novokh Incursion' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a missing list', async () => {
  renderPlay('nope');
  expect(await screen.findByRole('heading', { level: 1, name: 'List not found' })).toBeInTheDocument();
  expect(screen.getByText('We couldn’t find this list on this device. It may have been deleted.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to your lists' })).toHaveAttribute('href', '/build');
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/play/PlayPage.test.tsx`. Expected: FAIL, with "Cannot find module './PlayPage'".

- [ ] **Step 3: Implement `PlayPage`.**
  - **States:** "Loading your army…"; for missing, the not-found section; for errors, `<LoadError error what="this list" />`.
  - **When ready:**
    - `PageHeader` with `title={army.name}`, the subtitle, `back`, and `actions` = the Edit `Link` (`className="btn btn--small"`, with `IconEdit`);
    - then `PlayArmyView`;
    - then `PlaySheets` when the param is set.
  - **Stale links:** an effect clears a stale `?unit=`.
  - **Route:** add it in `routes.tsx` next to `/build/:id`.

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/play/PlayPage.test.tsx`, then `npm run typecheck`. Expected: PASS (4 tests); typecheck clean.

- [ ] **Step 5: Commit.** `git commit -am "feat(play): /build/:id/play, read-only Play mode with URL-backed sheets"`

### Task 7: The share page on the same view, with Save to my lists

**Files:**
- Modify: `apps/web/src/lists/SharePage.tsx` (rewritten onto `loadPlayData`, `PlayArmyView` and `PlaySheets`)
- Test: `apps/web/src/lists/SharePage.test.tsx` (updated)

**Interfaces:**
- Consumes:
  - `loadPlayData`, `PlayArmyView`, `PlaySheets`, `usePlaySheetParam`;
  - `usePublicSource`, `CopyButton`, `createList`, `useAuth`, `useStorage`, `PageHeader`, `problemsLabel`.
- Produces: `SharePage()`. It keeps the existing not-found and error copy ("This list isn't shared, or the link is wrong." and "Couldn’t open this list: …").

- [ ] **Step 1: Update the tests.**
  - `renderShare` now wraps in `AuthProvider backend={fakeAuthBackend()}` (signed out), `StorageProvider db={db}` and `WordingProvider`. That matches the app, where the share route sits inside both providers. `renderShare(id, { user })` gives a signed-in backend (`getUser: async () => user`).
  - Existing assertions are kept but moved onto the new card: the h1, `/Necrons · Strike Force/`, `/110 \/ 2,000 pts/`, the problems label, "Copy list" copying the export text, "Build your own", no textbox, and the not-shared message.
  - New tests:

```ts
test('a shared list is the read-only army view: tap a unit for its datasheet', async () => {
  const u = userEvent.setup();
  await save('pub-3', await withWarriors(), true);
  renderShare('pub-3');
  const card = await screen.findByRole('button', { name: /^Necron Warriors/ }, { timeout: 5000 });
  expect(card).toHaveTextContent('10x Gauss Flayer');
  await u.click(card);
  expect(screen.getByRole('dialog', { name: 'Necron Warriors' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
});

test('signed in: Save to my lists copies it into your lists and opens it', async () => {
  const u = userEvent.setup();
  await save('pub-4', await withWarriors(), true);
  renderShare('pub-4', { user: { id: 'viewer-1', email: null } });
  await u.click(await screen.findByRole('button', { name: 'Save to my lists' }, { timeout: 5000 }));
  const mine = await createRepository(db).listDocs<ListData>('list', 'viewer-1');
  expect(mine).toHaveLength(1);
  expect(mine[0].data.roster.name).toBe('Necrons Strike Force');
  expect(await screen.findByText(`Editor ${mine[0].id}`)).toBeInTheDocument(); // the /build/:id stub route
  expect(screen.queryByRole('link', { name: 'Build your own' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/SharePage.test.tsx`. Expected: FAIL (there are no unit-card buttons and no "Save to my lists" yet).

- [ ] **Step 3: Implement.**
  - **Loading:** `useAsync(() => source.get(id).then((f) => f && loadPlayData(f.data).then((data) => ({ data, list: f.data, updatedAt: f.updatedAt }))), id)`.
  - **Header:** `PageHeader title={army.name} back={{ to: '/', label: 'Home' }}` with the subtitle `{faction} · {sizeName}`.
  - **Under the header:**
    - the totals line and the status chip;
    - "Read-only copy, last updated {date}.";
    - the actions: `CopyButton text={data.text} label="Copy list"`, then either the "Save to my lists" primary button (signed in) or the "Build your own" link (signed out).
  - **Save:** `createList(repo, user.id, list)`, then `navigate('/build/' + newId)`.
  - **Body:** `PlayArmyView` and `PlaySheets`, using `usePlaySheetParam`.

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/SharePage.test.tsx`. Expected: PASS (all, the old ones included).

- [ ] **Step 5: Commit.** `git commit -am "feat(share): shared lists open as the read-only army view, with Save to my lists"`

### Task 8: `ArmyDrawer` for the Table companion

**Files:**
- Create: `apps/web/src/lists/play/ArmyDrawer.tsx`
- Test: `apps/web/src/lists/play/ArmyDrawer.test.tsx`

**Interfaces:**
- Consumes: `usePlayList` (Task 4), `PlayArmyView` and `PlaySheets` (Task 5), `Sheet` (A).
- Produces: exactly the spec §4 contract, `ArmyDrawer(props: { listId: string; onClose: () => void }): JSX.Element`. Plan E2 mounts it in the Table.

- [ ] **Step 1: Write the failing tests.** Wrap in `StorageProvider`, `WordingProvider` and `MemoryRouter`, and save `novokhIncursionData()` as `l1`.

```ts
test('the army in one full sheet; a unit replaces it, and "Back to army" returns', async () => {
  const u = userEvent.setup();
  const onClose = vi.fn();
  render(<Providers><ArmyDrawer listId="l1" onClose={onClose} /></Providers>);
  const army = await screen.findByRole('dialog', { name: 'Novokh Incursion' }, { timeout: 5000 });
  await u.click(within(army).getByRole('button', { name: /^Necron Warriors/ }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'Necron Warriors' })).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Back to army' }));
  expect(screen.getByRole('dialog', { name: 'Novokh Incursion' })).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a list this device no longer has', async () => {
  render(<Providers><ArmyDrawer listId="gone" onClose={() => {}} /></Providers>);
  expect(await screen.findByText('This list isn’t on this device any more.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and check they fail.** Run `npm test -w @recruit/web -- src/lists/play/ArmyDrawer.test.tsx`. Expected: FAIL, with "Cannot find module './ArmyDrawer'".

- [ ] **Step 3: Implement.**
  - **State:** `const [open, setOpen] = useState<PlaySheet | null>(null)`.
  - **With a sheet open:** render `<PlaySheets data open onOpen={setOpen} closeLabel="Back to army" />`, with `onOpen(null)` returning to the army.
  - **Otherwise:** `<Sheet kind="full" title={state.status === 'ready' ? data.army.name : 'Your army'} onClose={onClose}>` with the loading line, the missing line, `LoadError`, or `PlayArmyView`.
  - **`closeLabel`:** `PlaySheets` passes it to its `Sheet`.

- [ ] **Step 4: Run them and check they pass.** Run `npm test -w @recruit/web -- src/lists/play/ArmyDrawer.test.tsx`. Expected: PASS (2 tests).

- [ ] **Step 5: Commit.** `git commit -am "feat(play): ArmyDrawer, the read-only army in one sheet for the Table companion"`

### Task 9: End-to-end tests: Play mode and the share page

**Files:**
- Create:
  - `apps/web/e2e/seed.ts`
  - `apps/web/e2e/data/novokh-incursion.json`
  - `apps/web/src/lists/play/e2eFixture.test.ts`
  - `apps/web/e2e/play-mode.spec.ts`
- Modify: `apps/web/e2e/share.spec.ts` (rewritten)

**Interfaces:**
- Consumes: `novokhIncursionData` (Task 1) and `DEV_USER` (`auth/devAuth.ts`; read-only, its id is `00000000-0000-4000-8000-000000000001`).
- Produces:
  - `signInDev(page: Page): Promise<void>`: sets `localStorage['recruit.devUser'] = '1'`.
  - `seedList(page: Page, doc: { id: string; data: unknown; isPublic?: boolean; ownerId?: string }): Promise<void>`. It:
    1. opens `/build` so the app creates the `recruitplus` database;
    2. waits until `indexedDB.databases()` lists it;
    3. puts `{ id, kind: 'list', ownerId: ownerId ?? DEV_USER.id, data, isPublic: isPublic ?? false, deleted: false, updatedAt: Date.now(), dirty: false }` into the `docs` store with raw IndexedDB (opened without a version).
  - `stableIds(data: ListData): ListData`: replaces every force and selection `id`, in depth-first order, with `f0`, `f1`… and `s0`, `s1`….
  - `e2e/data/novokh-incursion.json` = `stableIds(await novokhIncursionData())`.

- [ ] **Step 1: Write the fixture-drift test, then generate the JSON.**

```ts
// src/lists/play/e2eFixture.test.ts
test('the e2e Play mode list matches the fixture builder (UPDATE_E2E_FIXTURES=1 rewrites it)', async () => {
  const fresh = stableIds(await novokhIncursionData());
  if (process.env.UPDATE_E2E_FIXTURES) writeFileSync(FIXTURE, JSON.stringify(fresh, null, 2) + '\n');
  expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(fresh);
});
```

Run `UPDATE_E2E_FIXTURES=1 npm test -w @recruit/web -- src/lists/play/e2eFixture.test.ts`, then run the same command without the variable. Expected: PASS both times.

- [ ] **Step 2: Write `play-mode.spec.ts`.** It runs in both projects (375×812 and 1280×800).

```ts
test('Play mode: read-only army, datasheets with Previous/Next, phone Back closes, rules and stratagems', async ({ page }) => {
  await signInDev(page);
  await seedList(page, { id: PLAY_ID, data: novokh });
  await page.goto(`/build/${PLAY_ID}/play`);
  await expect(page.getByRole('heading', { level: 1, name: 'Novokh Incursion' })).toBeVisible();
  await expect(page.getByText(/^Play mode · read only · [\d,]+ pts$/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/build/${PLAY_ID}`);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  for (const name of [/^Army rules/, /^Stratagems/, /^Necron Warriors/]) expect((await page.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await noSidewaysScroll(page);

  await page.getByRole('button', { name: /^Necron Warriors/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Necron Warriors' });
  await expect(sheet.getByText('Gauss Flayer').first()).toBeVisible();
  await noSidewaysScroll(page);
  await sheet.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByRole('dialog', { name: 'Immortals' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/build/${PLAY_ID}/play$`));

  await page.getByRole('button', { name: /^Army rules/ }).click();
  await expect(page.getByRole('dialog', { name: 'Army rules' }).getByText(/awakened by murder/i).first()).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: /^Stratagems/ }).click();
  const strats = page.getByRole('dialog', { name: 'Stratagems' });
  await expect(strats.getByText('Blood Rites')).toBeVisible();
  await expect(strats.getByText('Talent for Annihilation')).toHaveCount(0);
  await strats.getByRole('checkbox', { name: 'Show every stratagem' }).check();
  await expect(strats.getByText('Talent for Annihilation')).toBeVisible();
});
```

- [ ] **Step 3: Rewrite `share.spec.ts`.** It now seeds a public copy (`seedList(page, { id: SHARE_ID, data: novokh, isPublic: true })`) instead of building one through the editor. The editor's Export and Share sheets belong to Plan B's `editor.spec.ts` from wave 2.
  - **Signed out**, at `/share/{SHARE_ID}`:
    - the h1, the totals, a unit card, and its datasheet sheet opening;
    - "Copy list" and "Build your own" each at least 44px tall;
    - no "Sign out", no textbox, no sideways scroll.
  - **Not shared:** `/share/00000000-0000-4000-8000-0000000000ff` shows "This list isn't shared, or the link is wrong."
  - **Signed in** (`signInDev`): "Save to my lists" leads to `/\/build\/[0-9a-f-]{36}$/`.

- [ ] **Step 4: Run the e2e suite.** Run `CI=true npx playwright test e2e/play-mode.spec.ts e2e/share.spec.ts` (in `apps/web`). Expected: PASS in both projects.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/e2e/seed.ts apps/web/e2e/data/novokh-incursion.json apps/web/e2e/play-mode.spec.ts apps/web/e2e/share.spec.ts apps/web/src/lists/play/e2eFixture.test.ts
git commit -m "test(e2e): Play mode and the share page from a seeded list"
```

### Task 10: Whole-branch verification

**Files:** none new.

- [ ] **Step 1: Run the full checks from the worktree root.** Run:
  - `npm test`;
  - `npm run typecheck`;
  - `npm run build`;
  - `npm run budgets -w @recruit/web`;
  - `CI=true npm run e2e -w @recruit/web`.

  Expected:
  - everything passes;
  - budgets print no `FAIL`, because the Play page is its own lazy chunk and stays under `chunkGzip` 120 kB;
  - `e2e-prod/a11y.spec.ts` stays clean.
- [ ] **Step 2: Check by hand at 375×812, using the dev server in the browser pane.**
  - Open Play mode for a real list.
  - Open a datasheet, step with Next, and close it with the phone's Back.
  - Open the share link signed out.

  Compare against the mockups `PlayList.dc.html` and `PlayDatasheet.dc.html`, and take screenshots for the owner.
- [ ] **Step 3: Review the whole branch on the most capable model.** Fix anything it finds as its own commit. Then report the branch as ready to merge (spec §5: B, then C, then the others). Don't push.

---

## Self-review

- **Spec coverage (§5 row C):**

| Requirement | Task |
|---|---|
| `/build/:id/play` | 6 |
| Header, Back and Edit | 6 |
| Army rules and Stratagems tiles that open sheets | 5 |
| Stratagems filtered to the faction and its choices | 3, 5 |
| Units by role with key stats, wargear and the Warlord | 2, 5 |
| A datasheet sheet with `taken` weapons and Previous/Next | 1, 5 (the `extra` flag on profiles and abilities is `DatasheetView`'s job; C only passes `taken`) |
| A shared model and hook | 2, 3, 4 |
| The share page on the same view, plus Save to my lists | 7 |
| `ArmyDrawer` exactly to contract | 8 |
| CSS in `lists/play/play-mode.css` | 5 |
| No horizontal scroll, and 44px targets in e2e | 9 |

  Under §6, the full suite, budgets and axe run in Task 10.
- **Gaps against the mockup, decided:**
  - The card adds "{pts} pts", which the mockup leaves out. Points matter on a share link.
  - Back goes to Your lists, not the editor, because Edit already goes there and Play mode is also reachable from the lists' ⋯ menu.
- **Types:**
  - `PlaySheet`, `PlayData`, `PlayArmy`, `PlayUnit`, `ArmyRule` and `PlayListState` are each defined once and used with the same names in later tasks.
  - `usePlaySheetParam` returns `[PlaySheet | null, setter]` everywhere.
  - The `closeLabel` that `PlaySheets` takes in Task 5 is the one `ArmyDrawer` passes in Task 8.
- **Review Focus:** each of its five lines has a test in the task named there.
- **Proportion:** the code blocks are tests and signatures. The bodies are left to the implementer, except the matching rules in `takenWeapons` and `shownStratagemGroups`, which the tests pin.
- **Cross-plan dependencies, to raise with the owners:**
  - **Plan B:**
    - keeps the read-only exports listed in Global Constraints;
    - its `editor.spec.ts` takes over the Export and Share sheet e2e checks that `share.spec.ts` used to cover;
    - its editor header and the lists ⋯ menu link to `/build/{id}/play`.
  - **Plan A:** `DatasheetView`'s `hideName` prop (now in spec §3).
  - **Plan D:**
    - `unitSummary` as in spec §4: Play mode takes its wargear, Warlord, traits and relics from it, never from export text;
    - `optionDisplay` gives the "Dynasty" heading, as the spec's example does;
    - the "Warlord" option is still offered under an Overlord (the fixture's `pickOption`).
