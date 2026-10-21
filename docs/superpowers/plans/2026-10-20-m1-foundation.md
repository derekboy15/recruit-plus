# Milestone 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in, mobile-first PWA shell whose data pipeline turns the final 9th Edition BSData release plus a Wahapedia snapshot into per-faction JSON for all 52 catalogues. Users can browse any faction's datasheets, and their documents are stored local-first and sync to Supabase.

**Architecture:**
- npm-workspaces monorepo:
  - `packages/data` is a Node build pipeline: XML/CSV → typed JSON in `packages/data/generated/`.
  - `apps/web` is a Vite + React + TypeScript PWA that lazy-loads that JSON.
- **Auth:** an `AuthProvider` with two implementations, Supabase (production) and Dev (local, no backend).
- **Storage:** documents live in IndexedDB (Dexie) and sync to a Supabase `documents` table, last-write-wins.

**Tech Stack:** Node 24, npm workspaces (pnpm isn't installed; my call), TypeScript 5, Vitest, fast-xml-parser, Vite, React 18, React Router 6, vite-plugin-pwa, Dexie + fake-indexeddb, @supabase/supabase-js, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-recruit-plus-design.md`

## Global Constraints
- Rules version: final 9th Edition. Sources are BSData `wh40k-9e` tag `v9.8.0` (zip sha256 `a6b167074743ab910811fc76fe095ef9f43141905887bf328a0cf99ed16232a7`) and the Wahapedia 9th Edition CSV export (`Last_update.csv` = 2023-06-26).
- Source precedence: final GW changes > BSData v9.8.0 > Wahapedia snapshot > research library. Manual corrections go only in `packages/data/overrides/*.json`, and each one carries a `source` note.
- The Wahapedia CSVs are committed under `packages/data/raw/wahapedia/` and never fetched at runtime. Credit Wahapedia with the text "Data partly powered by Wahapedia".
- BSData raw XML is fetched by script into `packages/data/raw/bsdata/` (gitignored) and verified against the sha256.
- Mobile-first: every screen must work at 375×812, and touch targets must be ≥ 44px.
- Required sign-in for app routes. These routes are public: `/`, `/sign-in`, `/legal`.
- Look: dark theme, clean and modern, with brass (`#b08d57`) and red (`#9b2226`) accents on a near-black background (`#121212`). Readability comes before styling.
- Every page footer carries the disclaimer: "Unofficial fan-made tool. Not affiliated with or endorsed by Games Workshop. Warhammer 40,000 and all associated names are trademarks of Games Workshop Ltd."

## Review Focus
1. **Names with apostrophes or diacritics** ("T'au Empire", "Ûthar the Destined") must produce stable URL slugs and still match Wahapedia. *Task 3 tests `slugify` and `normalizeName` on them.*
2. **Units whose datasheet comes entirely through an imported library.** Blood Angels import the Space Marines library, so their Intercessor Squad must still show a full profile. *Task 5 test.*
3. **Hidden or reference entries** (names starting with `[`, `hidden="true"` root entries, Crusade "Battle Honours") must not appear as units. *Task 5 test.*
4. **Offline with an expired session:** previously synced lists stay readable and editable offline, and sync resumes after sign-in. *Task 10 test.*
5. **The same document edited on two devices while offline:** the later `updatedAt` wins, and no other documents are lost. *Task 10 test.*

---

## File Structure
```
app/
  package.json                 workspaces, root scripts
  tsconfig.base.json
  .gitignore                   node_modules, dist, packages/data/raw/bsdata, packages/data/generated
  .github/workflows/ci.yml
  vercel.json
  packages/data/
    package.json  tsconfig.json  vitest.config.ts
    raw/wahapedia/*.csv        committed snapshot (19 files) + SHA256SUMS
    raw/bsdata/                fetched (gitignored)
    overrides/faction-map.json      BSData catalogue name -> {group, wahapediaFactionIds[]}
    overrides/name-matches.json     {catalogueId, bsdataName, wahapediaDatasheetId, source}[]
    scripts/fetch-bsdata.ts
    src/
      text.ts                  slugify, normalizeName, htmlToText
      wahapedia/csv.ts         parseWahapediaCsv
      wahapedia/load.ts        loadWahapedia(dir)
      bsdata/xml.ts            parseBsXml (fast-xml-parser config)
      bsdata/types.ts          Raw* types
      bsdata/gamedata.ts       loadGameData, catalogueScope, buildIdIndex
      model/types.ts           output types (UnitOut, CatalogueOut, DataIndex)
      extract/units.ts         extractUnits
      join/wahapedia.ts        joinWahapedia
      build.ts                 CLI: writes generated/
    test/
      fixtures/mini.gst  fixtures/mini.cat
      *.test.ts
  apps/web/
    package.json  vite.config.ts  index.html  playwright.config.ts
    scripts/copy-data.mjs      copies packages/data/generated -> public/data
    src/
      main.tsx  App.tsx  routes.tsx
      theme.css
      layout/AppShell.tsx  layout/NavBar.tsx  layout/Footer.tsx
      auth/AuthContext.tsx  auth/supabaseAuth.ts  auth/devAuth.ts  auth/RequireAuth.tsx
      pages/Home.tsx  pages/SignIn.tsx  pages/Placeholder.tsx  pages/Legal.tsx
      factions/dataClient.ts  factions/FactionsPage.tsx  factions/FactionPage.tsx  factions/DatasheetPage.tsx
      storage/db.ts  storage/repository.ts  storage/sync.ts  storage/supabaseRemote.ts
    supabase/migrations/0001_documents.sql
    e2e/smoke.spec.ts
```

---

### Task 1: Monorepo scaffold and Wahapedia CSV parser

**Files:**
- Create: root `package.json`, `tsconfig.base.json`, `.gitignore`, `README.md`
- Create: `packages/data/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/data/src/wahapedia/csv.ts`
- Test: `packages/data/test/csv.test.ts`

**Interfaces:**
- Produces: `parseWahapediaCsv(text: string): Record<string, string>[]`.

**Notes for the implementer:**
- Root scripts: `data:fetch`, `data:build`, `test` (`vitest run` in all workspaces), `typecheck`, `dev`, `build`, `e2e`.
- Wahapedia format: UTF-8 with a BOM, pipe-delimited, every line ends with `|`, CRLF line endings. Fields may contain HTML but never a literal `|` or a newline.

- [ ] **Step 1: Write the failing tests**
```ts
test('strips BOM, trailing pipe, CRLF', () => {
  const rows = parseWahapediaCsv('\uFEFFid|name|\r\n1|Necrons|\r\n2|T\'au Empire|\r\n');
  expect(rows).toEqual([{ id: '1', name: 'Necrons' }, { id: '2', name: "T'au Empire" }]);
});
test('keeps HTML inside fields and ignores blank trailing lines', () => {
  const rows = parseWahapediaCsv('a|b|\n<b>x</b>|y|\n\n');
  expect(rows).toEqual([{ a: '<b>x</b>', b: 'y' }]);
});
```
- [ ] **Step 2:** Run `npm test -w packages/data`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `parseWahapediaCsv`: split on lines, header from the first line, drop the final empty column.
- [ ] **Step 4:** Run `npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `chore: scaffold monorepo; feat(data): Wahapedia CSV parser`.

### Task 2: Source snapshots (Wahapedia committed, BSData fetched and verified)

**Files:**
- Create: `packages/data/raw/wahapedia/*.csv` (the 19 tables; copy from the recon download at `C:\Users\derek\AppData\Local\Temp\claude\L--9th-Edition\12277563-4b8e-4592-8d0c-e17654295832\scratchpad\recon_data\waha\`) and `packages/data/raw/wahapedia/SHA256SUMS`
- Create: `packages/data/scripts/fetch-bsdata.ts`, `packages/data/src/wahapedia/load.ts`
- Test: `packages/data/test/sources.test.ts`

**Interfaces:**
- Produces: `loadWahapedia(dir: string): Wahapedia`, where `Wahapedia = { lastUpdate: string; factions: Row[]; datasheets: Row[]; datasheetsModels: Row[]; datasheetsAbilities: Row[]; abilities: Row[]; datasheetsKeywords: Row[]; wargearList: Row[]; datasheetsWargear: Row[]; stratagems: Row[]; warlordTraits: Row[]; psychicPowers: Row[]; secondaries: Row[]; source: Row[] }` and `Row = Record<string,string>`.
- Produces: `npm run data:fetch`, which downloads `https://github.com/BSData/wh40k-9e/archive/refs/tags/v9.8.0.zip`, checks the sha256 above, and extracts the `.gst` and `.cat` files flat into `raw/bsdata/`. If the files are already present with matching hashes, it does nothing. On a mismatch it exits with code 1.

- [ ] **Step 1: Write failing tests**
  - `loadWahapedia` returns `lastUpdate` starting with `2023-06-26`.
  - `factions` contains a row with `name === 'Necrons'`.
  - `datasheets.length > 1500`.
  - `raw/bsdata` contains `Warhammer 40,000.gst` and exactly 52 `.cat` files.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `loadWahapedia` (reads the files named in the type, file name = PascalCase table name) and `fetch-bsdata.ts` (Node `fetch` and `crypto`, unzip via the `adm-zip` package).
- [ ] **Step 4:** Run `npm run data:fetch && npm test -w packages/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): Wahapedia snapshot and verified BSData fetch`.

### Task 3: Text utilities

**Files:**
- Create: `packages/data/src/text.ts`
- Test: `packages/data/test/text.test.ts`

**Interfaces:**
- Produces: `slugify(s: string): string`, `normalizeName(s: string): string`, `htmlToText(html: string): string`.

- [ ] **Step 1: Write failing tests**
```ts
expect(slugify("T'au Empire")).toBe('tau-empire');
expect(slugify('Ûthar the Destined')).toBe('uthar-the-destined');
expect(slugify('Imperium - Blood Angels')).toBe('imperium-blood-angels');
expect(normalizeName('Necron Warriors [Legends]')).toBe('necron warriors');
expect(normalizeName('Lord Of Contagion')).toBe(normalizeName('Lord of Contagion'));
expect(normalizeName('Ork Boyz')).not.toBe(normalizeName('Boyz'));
expect(htmlToText('<b>Re-roll</b> hit rolls of 1.<br>Then &amp; more')).toBe('Re-roll hit rolls of 1.\nThen & more');
```
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - `slugify`: NFKD normalise, strip diacritics, drop apostrophes, replace non-alphanumerics with `-`, collapse and trim dashes.
  - `normalizeName`: lowercase, strip `[Legends]`/`(Legends)`, strip diacritics and apostrophes, collapse whitespace.
  - `htmlToText`: turn `<br>` and `</p>` into `\n`, strip other tags, decode `&amp; &lt; &gt; &quot; &#39; &nbsp;`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): slug/name/html text utilities`.

### Task 4: BSData XML parsing and catalogue scope

**Files:**
- Create: `packages/data/src/bsdata/xml.ts`, `bsdata/types.ts`, `bsdata/gamedata.ts`
- Create: `packages/data/test/fixtures/mini.gst`, `test/fixtures/mini.cat` (hand-written, ~60 lines: one gst with a forceEntry, a category and a shared rule; one cat with a catalogueLink to a library cat, a root entryLink to a shared unit with a model, a weapon profile and an infoLink)
- Test: `packages/data/test/gamedata.test.ts`

**Interfaces:**
- Produces, in `types.ts`:
```ts
interface RawNode { id: string; name: string; type?: string; hidden?: boolean; targetId?: string; tag: string; attrs: Record<string,string>; children: RawNode[]; text?: string }
interface RawCatalogue { id: string; name: string; library: boolean; root: RawNode; links: { targetId: string; importRootEntries: boolean }[] }
interface GameData { system: RawCatalogue; catalogues: Map<string, RawCatalogue> }
```
- Produces: `loadGameData(dir: string): GameData`.
- Produces: `catalogueScope(gd: GameData, catalogueId: string): RawCatalogue[]`. This is the catalogue, then its linked catalogues recursively (depth-first, deduplicated), then the system.
- Produces: `buildIdIndex(scope: RawCatalogue[]): Map<string, RawNode>`. Every node with an `id`; the first one in scope order wins.

- [ ] **Step 1: Write failing tests**
  - **Fixtures:** `catalogueScope(mini)` returns `[mini, library, system]`.
  - **Fixtures:** every `targetId` in scope resolves through `buildIdIndex`.
  - **Real data:** `loadGameData(raw/bsdata)` loads 52 catalogues.
  - **Real data:** for each catalogue, the share of `entryLink`/`infoLink`/`categoryLink` `targetId`s that resolve in its scope is 1.0. Any exception must be listed in `overrides/unresolved-links.json` with a `source` note. The test fails on unlisted ones.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement with `fast-xml-parser`, using `preserveOrder: true` and `ignoreAttributes: false`. Map the result into the generic `RawNode` tree, keep `<description>`/`<characteristic>` text in `text`, and decode XML entities.
- [ ] **Step 4:** Run the tests. Expected: PASS. Add genuine dangling links to `unresolved-links.json` only after checking them in the XML.
- [ ] **Step 5:** Commit: `feat(data): BSData XML loader with catalogue import scope`.

### Task 5: Datasheet extraction

**Files:**
- Create: `packages/data/src/model/types.ts`, `packages/data/src/extract/units.ts`
- Test: `packages/data/test/units.test.ts`

**Interfaces:**
- Produces, in `model/types.ts`:
```ts
type BattlefieldRole = 'HQ'|'Troops'|'Elites'|'Fast Attack'|'Heavy Support'|'Flyer'|'Dedicated Transport'|'Lord of War'|'Fortification';
interface ProfileOut { name: string; chars: Record<string,string> }
interface AbilityOut { name: string; text: string; source: 'bsdata'|'wahapedia' }
interface UnitOut {
  id: string; slug: string; name: string; catalogueId: string;
  role: BattlefieldRole | null; keywords: string[]; factionKeywords: string[];
  models: ProfileOut[]; weapons: ProfileOut[]; abilities: AbilityOut[];
  psychic: ProfileOut[]; woundTrack: ProfileOut[]; transport: ProfileOut | null;
  minModels: number | null; maxModels: number | null; powerLevel: number | null;
  points: number | null; baseSize: string | null; wahapediaId: string | null;
  legends: boolean; forgeWorld: boolean;
}
interface CatalogueOut { id: string; slug: string; name: string; group: 'Imperium'|'Chaos'|'Xenos'|'Unaligned'; library: boolean; units: UnitOut[]; rules: { id: string; name: string; text: string }[] }
interface DataIndex { generatedAt: string; sources: { bsdata: 'v9.8.0'; wahapediaLastUpdate: string }; catalogues: Omit<CatalogueOut,'units'|'rules'> & { unitCount: number } [] }
```
- Produces: `extractUnits(gd: GameData, catalogueId: string): UnitOut[]`. `points`, `baseSize` and `wahapediaId` are `null` here; Task 6 fills them.

**Extraction rules:**
- **Selectable units:**
  - The root `entryLinks` and root `selectionEntries` of the catalogue.
  - Plus those of catalogues linked with `importRootEntries="true"`.
  - Only `type` `unit` or `model`.
  - Excluded: names starting with `[`, `hidden="true"`, and Battle Honours / Crusade entries.
- **Role:** the name of the `categoryLink` with `primary="true"`, mapped to `BattlefieldRole` (`Fast Attack`, `Heavy Support`, `Lord of War`, `Dedicated Transport`, `Flyer`, `Fortification`, `HQ`, `Troops`, `Elites`); anything else is `null`.
- **Profiles:** collected depth-first through the entry subtree, following `entryLink`/`infoLink` targets via the id index with a visited set.
  - `typeName` `Unit` goes to `models`; `Weapon` to `weapons`; `Abilities` to `abilities`.
  - `Psychic Power` goes to `psychic`; `Wound Track` to `woundTrack`; `Transport` to `transport`.
  - Weapons and models are deduplicated by name.
- **Keywords:** names of the non-primary `categoryLink`s, with entries starting with `Faction:` stripped into `factionKeywords`.
- **Model counts:**
  - `minModels`/`maxModels`: the sum of `min`/`max` `parent`-scope constraints on child model entries and groups. A single-model unit is `1`/`1`.
- **Other fields:**
  - `powerLevel`: the ` PL` cost on the unit entry.
  - `legends`: the name contains `[Legends]`.
  - `forgeWorld`: the catalogue name contains `FW `, or the publication name contains `Imperial Armour`.

- [ ] **Step 1: Write failing tests (real data)**
```ts
const warriors = extractUnits(gd, NECRONS).find(u => u.name === 'Necron Warriors')!;
expect(warriors.role).toBe('Troops');
expect(warriors.models[0].chars).toMatchObject({ M: '5"', WS: '3+', BS: '3+', S: '4', T: '4', W: '1', A: '1', Ld: '10', Save: '4+' });
expect(warriors.keywords).toEqual(expect.arrayContaining(['Core']));
expect(warriors.weapons.map(w => w.name)).toEqual(expect.arrayContaining(['Gauss flayer', 'Gauss reaper']));
expect([warriors.minModels, warriors.maxModels]).toEqual([10, 20]);
// Review Focus 2
const ba = extractUnits(gd, BLOOD_ANGELS).find(u => u.name === 'Intercessor Squad')!;
expect(ba.models.length).toBeGreaterThan(0);
// Review Focus 3
for (const c of gd.catalogues.values()) if (!c.library) for (const u of extractUnits(gd, c.id)) expect(u.name.startsWith('[')).toBe(false);
// every non-library catalogue yields units, and every unit has >=1 model profile
```
  If a real profile name or case differs, for example `Gauss flayer`, check the XML and match the data. Don't change the expected stats.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `extractUnits` following the rules above.
- [ ] **Step 4:** Run the tests. Expected: PASS. Any unit without a model profile goes into `overrides/units-without-profiles.json` with a reason (e.g. a fortification with no Unit profile). The test allows only listed ones.
- [ ] **Step 5:** Commit: `feat(data): datasheet extraction from BSData`.

### Task 6: Wahapedia join (points, base size, official ability text)

**Files:**
- Create: `packages/data/overrides/faction-map.json`, `packages/data/overrides/name-matches.json`
- Create: `packages/data/src/join/wahapedia.ts`
- Test: `packages/data/test/join.test.ts`

**Interfaces:**
- Consumes: `UnitOut[]` (Task 5) and `Wahapedia` (Task 2).
- Produces: `joinWahapedia(units: UnitOut[], catalogueName: string, w: Wahapedia, overrides: Overrides): { units: UnitOut[]; unmatched: string[] }`.

**Join rules:**
- **Faction map:** maps each BSData catalogue name to `{ group, wahapediaFactionIds: string[] }`. Write all 52 entries by hand from `Factions.csv`. Library catalogues map to their parent faction ids.
- **Matching:**
  - Within the mapped faction ids, match by `normalizeName(unit.name) === normalizeName(datasheet.name)`.
  - Otherwise use `name-matches.json`.
  - Otherwise the unit is unmatched.
- **Points:**
  - On a match, `points` = the sum over `Datasheets_models` rows of `Number(Cost)` for the first (minimum) configuration line of each model.
  - `baseSize` is taken from the first `Datasheets_models.base_size`, and `wahapediaId` is set.
  - Abilities with no BSData text get Wahapedia text, via `htmlToText` with `source: 'wahapedia'`.

- [ ] **Step 1: Write failing tests**
  - Necron Warriors match: `wahapediaId` is non-null, `baseSize` contains `32mm`, and `points > 0`.
  - T'au Empire's `Commander in Coldstar Battlesuit` matches. This covers the apostrophe in the catalogue name.
  - Every non-library catalogue reaches a match rate ≥ 0.9, written to `generated/report.json`. The unmatched names are listed in the report for Milestone 2/3 follow-up. The design target is 1.0 by the end of Milestone 3.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `joinWahapedia`. Add `name-matches.json` entries only after checking both names refer to the same datasheet.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): join Wahapedia points, base sizes and text`.

### Task 7: Build CLI and generated output

**Files:**
- Create: `packages/data/src/build.ts`
- Test: `packages/data/test/build.test.ts`

**Interfaces:**
- Produces:
  - `npm run data:build`, which writes `packages/data/generated/index.json` (`DataIndex`), `generated/catalogues/<slug>.json` (`CatalogueOut`, one per catalogue) and `generated/report.json`.
  - `report.json` has the shape `{ catalogueSlug: { units, matched, unmatched: string[], unitsWithoutProfiles: string[] } }`.
- `CatalogueOut.rules` holds the catalogue's `sharedRules` and root `rules`, with their `description` text.

- [ ] **Step 1: Write failing tests**
  - After the build, the index lists 52 catalogues and each slug file exists.
  - Every non-library catalogue has `unitCount > 0`.
  - Each catalogue JSON is under 4 MB.
  - `necrons.json` contains Necron Warriors with `points > 0`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `build.ts`: load once, then extract, join and write files for each catalogue with stable sort order (units by role, then name).
- [ ] **Step 4:** Run `npm run data:build && npm test -w packages/data`. Expected: PASS. Check the timing; it should finish in under 60 seconds.
- [ ] **Step 5:** Commit: `feat(data): build CLI producing per-faction JSON`.

### Task 8: Web app shell (PWA, theme, navigation)

**Files:**
- Create: `apps/web/*` per the File Structure (Vite React TS template), `src/theme.css`, `layout/*`, `pages/Home.tsx`, `pages/Placeholder.tsx`, `pages/Legal.tsx`, `routes.tsx`
- Test: `apps/web/src/layout/NavBar.test.tsx` (Vitest + Testing Library + jsdom)

**Interfaces:**
- Produces these routes:

| Route | Contents |
|---|---|
| `/` | Home: what the app is, plus "Sign in" |
| `/learn` | Placeholder: "Lessons arrive in Milestone 6" |
| `/build` | Placeholder (M2) |
| `/play` | Placeholder (M5) |
| `/table` | Placeholder (M7) |
| `/rules` | Placeholder (M3) |
| `/factions...` | Task 9 |
| `/legal` | Disclaimer and Wahapedia credit |

- `NavBar` items, in order: Learn, Build, Play, Table, Rules.
  - Under 768px it is a fixed bottom tab bar with 44px+ targets.
  - At 768px and above it is a left side rail.

- [ ] **Step 1: Write failing test.** `NavBar` renders five links with the exact labels and hrefs above, and the active route has `aria-current="page"`.
- [ ] **Step 2:** Run `npm test -w apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement the shell.
  - `theme.css` has CSS variables for the Global Constraints colours.
  - System font stack, minimum body text size 16px.
  - `vite-plugin-pwa` configured with: manifest name "Recruit+ 40k 9th", theme colour `#121212`, `display: standalone`, and auto-update of a service worker that caches the app shell and `/data/**` (StaleWhileRevalidate).
  - `Footer` shows the disclaimer.
- [ ] **Step 4:** Run the tests. Expected: PASS. Also run `npm run build -w apps/web`; it should succeed.
- [ ] **Step 5:** Commit: `feat(web): PWA shell with mobile tab bar and theme`.

### Task 9: Faction and datasheet browser

**Files:**
- Create: `apps/web/scripts/copy-data.mjs` (runs as `predev`/`prebuild`), `factions/dataClient.ts`, `factions/FactionsPage.tsx`, `factions/FactionPage.tsx`, `factions/DatasheetPage.tsx`
- Test: `apps/web/src/factions/DatasheetPage.test.tsx`, `dataClient.test.ts`

**Interfaces:**
- Consumes: `DataIndex` and `CatalogueOut` JSON (types imported from `@recruit/data/model` via the workspace package export `"./model": "./src/model/types.ts"`).
- Produces:
  - `getIndex(): Promise<DataIndex>`.
  - `getCatalogue(slug: string): Promise<CatalogueOut>`. Fetches `/data/catalogues/<slug>.json` with an in-memory cache.
- Routes:
  - `/factions`: non-library catalogues grouped by Imperium, Chaos, Xenos and Unaligned, plus a search box.
  - `/factions/:slug`: units grouped by role, with a Legends/FW filter toggle (default: show all, with a badge).
  - `/factions/:slug/units/:unitSlug`: the datasheet. It shows:
    - a statline table (scrolls horizontally on phones)
    - weapons table, abilities, keywords, points and base size
    - an "Official wording" label on ability text. The plain-English layer arrives in Milestone 3.

- [ ] **Step 1: Write failing tests.** Render `DatasheetPage` with a Necron Warriors fixture. Assert that `T` shows `4`, Save shows `4+`, `Gauss flayer` is listed, and the points are shown. `getCatalogue` called twice fetches once.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the pages and `copy-data.mjs`. The copy script fails with a clear message if `packages/data/generated` is missing ("run npm run data:build").
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): faction and datasheet browser`.

### Task 10: Auth and local-first storage with sync

**Files:**
- Create: `apps/web/src/auth/*`, `pages/SignIn.tsx`, `storage/db.ts`, `storage/repository.ts`, `storage/sync.ts`, `storage/supabaseRemote.ts`, `supabase/migrations/0001_documents.sql`, `.env.example`
- Test: `apps/web/src/auth/RequireAuth.test.tsx`, `apps/web/src/storage/sync.test.ts` (uses `fake-indexeddb`)

**Interfaces:**
- Produces auth:
```ts
interface User { id: string; email: string | null }
interface AuthApi { user: User | null; loading: boolean; signInWithEmail(email: string): Promise<void>; signInWithGoogle(): Promise<void>; signOut(): Promise<void> }
```
  - `useAuth(): AuthApi`.
  - `VITE_AUTH_MODE=dev` selects `devAuth`, which signs in instantly as `{id:'dev-user', email:'dev@local'}` and is persisted in localStorage. It is refused if `import.meta.env.PROD` is set.
  - Otherwise the Supabase client is built from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
  - The last session is cached so `user` is available offline.
- Produces storage:
```ts
type DocKind = 'list' | 'game' | 'progress';
interface Doc<T = unknown> { id: string; kind: DocKind; ownerId: string; updatedAt: number; deleted: boolean; isPublic: boolean; data: T; dirty: boolean }
```
  - `repository`: `saveDoc(doc)`, `getDoc(id)`, `listDocs(kind)`, `deleteDoc(id)`. Writes set `dirty=true` and `updatedAt=Date.now()`. Delete is soft (`deleted=true`).
  - `interface RemoteStore { pushDocs(docs: Doc[]): Promise<void>; pullSince(ownerId: string, since: number): Promise<Doc[]> }`.
  - `syncOnce(remote: RemoteStore, ownerId: string): Promise<{ pushed: number; pulled: number }>`:
    1. Push dirty docs and clear `dirty` on success.
    2. Pull docs newer than the stored cursor. Apply each remote doc only if `remote.updatedAt > local.updatedAt`.
    3. Advance the cursor to the max `updatedAt` seen.
  - `startAutoSync` runs `syncOnce` on `online`, on focus, and every 60s while signed in.
- Produces the migration: table `documents(id uuid pk, owner_id uuid not null references auth.users, kind text check in ('list','game','progress'), data jsonb not null, updated_at bigint not null, deleted boolean default false, is_public boolean default false)` with RLS:
  - the owner can select, insert, update and delete their own rows;
  - anyone can select rows where `is_public and not deleted`.

- [ ] **Step 1: Write failing tests**
  - `RequireAuth` redirects to `/sign-in` when `user` is null and renders its children when signed in.
  - Sync, against an in-memory fake `RemoteStore`:
    - a local dirty doc is pushed and becomes clean;
    - a newer remote doc overwrites the local copy;
    - an older remote doc does not;
    - *Review Focus 5:* the same id is edited on "two devices" (two local DBs sharing one fake remote). After both sync, both hold the later version, and an unrelated doc on device A survives.
    - *Review Focus 4:* with `navigator.onLine=false` and a cached user, `saveDoc` and `listDocs` still work, and the next `syncOnce` pushes the edits.
    - a deleted doc propagates as `deleted=true`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement auth, storage and sync. `SignIn` offers a magic-link email form and a Google button; in dev mode it shows a "Continue (dev)" button.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): auth providers and local-first storage with sync`.

### Task 11: End-to-end smoke tests, CI and deploy config

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`, `.github/workflows/ci.yml`, `vercel.json`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the e2e test.** Two Playwright projects: `mobile` (375×812, hasTouch) and `desktop` (1280×800). The dev server runs with `VITE_AUTH_MODE=dev`. The flow:
  1. Visit `/factions`; it redirects to `/sign-in`.
  2. Click "Continue (dev)".
  3. Open Necrons, then Necron Warriors.
  4. Expect the visible text `Gauss flayer` and a `T` cell with `4`.
  5. Expect the nav: on mobile, a bottom tab bar is visible at y > 700; on desktop, a side rail.
  6. Expect the footer disclaimer to be visible.
- [ ] **Step 2:** Run `npm run e2e`. Expected: PASS for both projects. Fix layout issues found at 375px.
- [ ] **Step 3:** Add CI (`ubuntu-latest`, Node 24): `npm ci`, `npm run data:fetch`, `npm run data:build`, `npm run typecheck`, `npm test`, `npx playwright install --with-deps chromium`, `npm run e2e`.
  - `vercel.json`: build command `npm run data:fetch && npm run data:build && npm run build -w apps/web`, output `apps/web/dist`, SPA rewrite of all paths to `/index.html` except `/data/*` and assets.
- [ ] **Step 4:** Manual check: run `npm run dev`, open it in the built-in browser at mobile size, and walk the flow. Take screenshots for the user.
- [ ] **Step 5:** Commit: `test: e2e smoke at phone and desktop; ci: workflow and Vercel config`.

---

## Needs the user (not blocking local development)
1. **Supabase project (free):** create one, run `apps/web/supabase/migrations/0001_documents.sql` in its SQL editor, enable Email (magic link) and Google providers, then put the URL and anon key in `apps/web/.env.local`. Until then the app runs in dev auth mode.
2. **GitHub repo and Vercel project:** needed for CI runs and preview deploys on a phone. Until then, test on a phone via the local network (`npm run dev -- --host`).
