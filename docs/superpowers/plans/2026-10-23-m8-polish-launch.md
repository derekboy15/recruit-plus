# Milestone 8 (Polish and launch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recruit+ is ready to put in front of the public:
- it is fast on a phone;
- it is accessible;
- after one online visit it works offline, and sync resumes when the connection returns;
- it is installable;
- its legal pages are in place;
- it has no missing plain English;
- it is ready to deploy to Vercel and Supabase as soon as the user creates the accounts.

**Architecture:**
- **A second Playwright suite runs against the real production build** (`vite build --mode e2e`, served by `vite preview`) with its real service worker.
  - The only difference from production is the Supabase URL. It points at a fake host, `http://supabase.e2e.test`, which the tests intercept with an in-memory PostgREST stand-in.
  - A signed-in session is seeded in `localStorage` exactly where supabase-js keeps it. The suite therefore exercises the shipped auth, sync and service-worker code, not the dev-only paths.
  - The offline, accessibility, performance and installability tests all live in this suite.
- **The service worker moves from `generateSW` to `injectManifest`** with a small `src/sw.ts`. That gives:
  - a real offline fallback page;
  - precaching of the "shell data" (rules, lessons, missions, core stratagems, faction index);
  - runtime caching of faction data as it is used.
- **Budgets are enforced twice:**
  - by `scripts/check-budgets.mjs` on the built `dist/` (byte sizes, deterministic, run in CI);
  - by `e2e-prod/perf.spec.ts` (timings and frame rate under 4× CPU throttling at 375×812, with generous margins over the measured baseline).
- Everything else is focused changes to existing code: accessibility fixes, board keyboard support, objective labels on turned maps, roster rule fixes, legal pages, icons, deploy docs and CI.

**Tech Stack:** unchanged (Node 24, npm workspaces, TypeScript 7, Vitest 5, Vite 8, React 19, vite-plugin-pwa 2, Dexie 4, Playwright 1.64). New dev dependencies:
- `@axe-core/playwright` in `apps/web`;
- `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration` and `workbox-core` in `apps/web`, at the versions vite-plugin-pwa already pulls in.

**Spec:** `docs/superpowers/specs/2026-10-20-recruit-plus-design.md` (§2, §4, §5, §7, §8, §10). The Milestone 1–7 plans in `docs/superpowers/plans/` describe the code this builds on.

**Branch:** `m8-polish-launch` in worktree `L:\9th Edition\app-m8`, off `main` at `211bd57`.

**Baseline measured before planning** (production build, Chromium at 375×812, 4× CPU throttle, 150 ms RTT and 1.6 Mbps):

| Measure | Value |
|---|---|
| Cold `/`, first contentful paint | 1.37 s |
| Warm routes (`/rules`, `/build/new`, `/learn`, `/table`), ready | 0.17–0.22 s |
| `/play`, ready | 0.95 s |
| Space Wolves faction page, ready | 0.33 s |
| Main entry JS (gzip) | 75 kB |
| Largest lazy chunk (`pixiRenderer`, gzip) | 84 kB |
| Precache | 63 entries, 1.63 MB |
| Largest catalogue (`space-wolves.json`) | 1.97 MB raw, 190 kB gzip |
| Largest roster (`imperium-space-marines.json`) | 0.96 MB raw, 161 kB gzip |
| Drill board and "Your first game" board while dragging | 60 fps, p95 frame 17 ms |

A first axe pass over 21 routes in their first state found one serious issue: `scrollable-region-focusable` on the datasheet statline tables. Nothing was critical.

**Scope notes (decisions for the user's review):**
1. **Performance is already inside sensible phone budgets.** M8 therefore:
   - sets budgets at roughly 1.5–2× the baseline;
   - enforces them in CI;
   - fixes the measured weak spot: the service worker downloads the 1.6 MB precache at the same moment as the first page. It is now registered after the `load` event.
   - also checks the cold load of the largest faction catalogue (Space Wolves) and a crowded Strike Force board. Task 3 fixes either one only if it breaks its budget.
2. **What "works offline" covers.** After one online visit while signed in, these work with no network:
   - **precached:** the app shell and every route's code, the rules reference, glossary and core stratagems, lessons and drills, and the table companion with missions;
   - **already on the device:** lists, saved sandbox and table games, and lesson progress, which already live in IndexedDB;
   - **cached when first used:** faction data (catalogues, rosters, guides).

   A faction you never opened online shows `You're offline, and this hasn't been saved on this device yet. Open it once while online and it will work offline after that.` It no longer shows "No guide for this faction yet" (an M3 known gap).
3. **The offline fallback page** (`/offline.html`) is a static, self-contained page. The service worker serves it for a page request it can't answer from cache or network, for example after the browser evicted the app's cache. It says the app needs one online visit and offers `Try again`.
4. **Privacy page contact.** Deleting an account and its data needs the site operator, so the privacy page names a contact. That address comes from a new env var, `VITE_CONTACT_EMAIL`, which `DEPLOY.md` lists as required.
   - When it is unset (local builds, CI), the page says `The contact address is added when the site is published.`
   - The production build check (Task 13) fails a Vercel build that leaves it unset (`VERCEL_ENV=production`).
5. **Known army-builder gaps fixed** (precedence: final GW > BSData > Wahapedia > library):
   - **Hive Tyrant Warlord requirement removed.** Dataslate #7 (13 Apr 2023) removed all three June 2022 Tyranids restrictions (library `05_Balance_Errata_and_Points/Balance_Dataslates.md` §9). This is a final GW change, so it beats BSData.
   - **Disciples of Be'lakor may take two allied detachments.** In an Arks of Omen army, a LEGIONES DAEMONICA Arks detachment that is a Disciples of Be'lakor army may take a Traitoris Astartes Patrol and a House Korvax Chaos Knights detachment (Wahapedia Arks of Omen GT page; library `04_Campaign_Books_and_Supplements/Armies_of_Renown.md`).
   - **The three "ally must be X" checks** (Genestealer Cults → Brood Brothers only, Drukhari → a different Drukhari type, Emperor's Children → Slaanesh Daemons only) are implemented only if the Wahapedia Arks of Omen GT page or the codex text states them. Each one that can't be confirmed stays in the known-gaps file, with the reason.
   - Every other gap stays documented (Lion as Warlord, named Chapter Masters, Kill Team Strike Force, Fallen allies, sub-faction keywords and the rest). No reliable source settles them.
6. **Objective labels on turned maps.** On a sandbox board that turns a landscape map a quarter turn clockwise, compass labels are turned the same way: `nw→ne`, `ne→se`, `se→sw`, `sw→nw`, `n→e`, `e→s`, `s→w`, `w→n`, keeping any digit suffix (`nw1→ne1`). Letters such as `a`, `b`, `A1`, `centre` are unchanged.
   - Only the label changes. The objective `id` stays, so saved games, scoring and the log are untouched, and a game saved before M8 still shows its old ids.
   - The table companion's map is drawn as printed (landscape), so it keeps the original names.
7. **No accounts, pushes or deploys.** `DEPLOY.md` is the user's checklist.

## Global Constraints
- **Everything in the Milestone 1–7 Global Constraints still applies:**
  - source precedence, with overrides carrying a `source` note;
  - 375×812 first, touch targets ≥ 44px, no horizontal page scroll;
  - dark theme;
  - the footer disclaimer, verbatim: "Unofficial fan-made tool. Not affiliated with or endorsed by Games Workshop. Warhammer 40,000 and all associated names are trademarks of Games Workshop Ltd.";
  - the Wahapedia credit "partly powered by Wahapedia" and the BSData credit;
  - no BattleScribe jargon in UI copy.
- **Plain English:**
  - never copy GW wording (the copy check: no run of 12+ consecutive words, and for 20+ word texts, no ≥50% shared word 4-grams);
  - every number, dice expression and keyword survives (`checkPlain`);
  - follow `packages/content/STYLE.md`.
- **Wrong rules are the worst failure.** Every roster rule change carries a `source` and a test with the citation in its name.
- **Accessibility target:**
  - no axe violations of impact `serious` or `critical` (WCAG 2.1 A and AA tags) on any audited route or state, at 375×812 and 1280×800;
  - text contrast ≥ 4.5:1 (≥ 3:1 for text ≥ 24px or bold ≥ 18.66px, and for focus indicators and control borders);
  - every interactive element reachable by Tab with a visible focus ring;
  - no horizontal scroll at 320px wide.
- **Performance budgets** (Task 3 pins them; changing one needs a note in `docs/perf.md`):
  - main entry JS ≤ 110 kB gzip; any other JS chunk ≤ 120 kB gzip;
  - CSS ≤ 25 kB gzip;
  - precache ≤ 2.6 MB raw;
  - any catalogue ≤ 300 kB gzip; any roster ≤ 250 kB gzip; `rules.json` ≤ 100 kB gzip;
  - cold `/` FCP ≤ 3.0 s and warm-route ready ≤ 1.0 s (4× CPU, 150 ms RTT, 1.6 Mbps, 375×812);
  - Space Wolves faction page cold-data ready ≤ 4.0 s;
  - board p95 frame ≤ 50 ms while panning a Strike Force board with 60+ models.
- **The production e2e build is a real production build:**
  - `--mode e2e` changes only env values (`apps/web/.env.e2e`);
  - no test-only code paths are added to `src/`. The DEV-only hooks (`window.__learn`, `window.__sandbox`) are unavailable there by design.
- **UI copy** (exact strings):
  - routes `/privacy` (title `Privacy`) and `/terms` (title `Terms of use`), linked from the footer as `Privacy` and `Terms`, next to `Legal & credits`;
  - skip link `Skip to main content`;
  - offline notice `You're offline, and this hasn't been saved on this device yet. Open it once while online and it will work offline after that.`;
  - fallback page title `Recruit+ needs one online visit`, button `Try again`.
- **Commits** go only to `m8-polish-launch`. No merge, push or deploy.

## Review Focus
1. **An expired session while offline.** The access token has expired and the phone has no signal. The app must still open lists and games from the device, not bounce to sign-in. When the connection returns, the refresh runs, or the user gets the re-sign-in banner.
   - Pinned by Task 5 test `expired session offline still opens lists`.
2. **A deep link reloaded offline:** `/table/<id>` or `/play/<id>` with no network. It must land on that game, not a blank screen or a redirect to `/`.
   - Pinned by Task 5 tests `offline reload of a table game resumes it` and `offline reload of a sandbox game resumes it`.
3. **A faction never opened online, opened offline.** It must show the offline notice, not a crash, a spinner forever, or "No guide for this faction yet".
   - Pinned by Task 5 test `unvisited faction offline shows the offline notice` and Task 4 unit test `guide page offline shows the offline notice`.
4. **Keyboard focus in overlays and on the board.**
   - Opening Menu, Log or Score in a game and pressing Escape closes it and returns focus to the button that opened it.
   - The board can be focused and left with Tab; it never traps focus.
   - Pinned by Task 9 tests `Escape closes the game menu and focus returns to Menu` and `Tab leaves the board`.
5. **Narrow screens and old saved games.**
   - At 320px wide, no route scrolls sideways. Pinned by Task 8 test `no horizontal scroll at 320px`.
   - A sandbox game saved before M8 has no objective labels and must still render its ids. Pinned by Task 10 test `objectives without a label show their id`.

---

## File Structure
```
.github/workflows/ci.yml                 + production build, budgets, prod e2e
.gitignore                               + apps/web/dist-e2e, apps/web/test-results-prod
DEPLOY.md                                NEW  step-by-step Supabase + GitHub + Vercel
vercel.json                              headers; SPA rewrite that skips /data and /assets
docs/perf.md                             NEW  baseline, budgets, how to measure
docs/superpowers/m2-known-gaps.md        updated (fixed items removed, reasons kept)
docs/superpowers/m3-known-gaps.md        offline guide item removed; faction secondaries noted done
packages/data/
  overrides/must-be-warlord.json or constraints.json   Hive Tyrant requirement removed (Task 11 finds where)
  overrides/aoo-allies.json              Disciples of Be'lakor second ally
  overrides/aoo-ally-restrictions.json   NEW  only if Task 11 confirms a restriction
  src/roster/validate.ts                 ally count/restriction checks
  scripts/content-todo.ts                + "missions" shard (faction secondaries)
  src/missions/build.ts                  report: faction secondaries counted as missing
  test/roster-gaps.test.ts               NEW
  test/missions-plain.test.ts            faction secondaries required
packages/content/
  missions/plain.json                    + ~170 faction secondary entries
  review/missions-faction-secondaries.md NEW  spot-check
packages/engine/src/core/state.ts        objectives[].label?: string
apps/web/
  package.json                           scripts e2e, e2e:dev, e2e:prod, build:e2e, budgets, icons; dev deps
  .env.e2e                               NEW  fake Supabase URL and key (no secrets)
  .env.example                           documented, + VITE_CONTACT_EMAIL
  playwright.prod.config.ts              NEW
  e2e-prod/fake-supabase.ts              NEW  session seed + in-memory PostgREST
  e2e-prod/fixtures.ts                   NEW  test.extend({ remote, signedIn })
  e2e-prod/helpers.ts                    NEW  waitForServiceWorker, goOffline, seed docs
  e2e-prod/harness.spec.ts  offline.spec.ts  a11y.spec.ts  perf.spec.ts  pwa.spec.ts   NEW
  scripts/check-budgets.mjs              NEW
  scripts/make-icons.mjs                 NEW  rasterises public/icon.svg with Playwright
  public/icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png   NEW (generated, committed)
  public/offline.html                    NEW
  index.html                             apple-touch-icon, manifest-friendly meta
  vite.config.ts                         injectManifest, manifest icons, precache list
  src/sw.ts                              NEW  precache, navigation, data caching, offline fallback
  src/pwa.ts                             NEW  registerAfterLoad()
  src/main.tsx                           uses registerAfterLoad
  src/theme.css                          contrast fixes, .sr-only, skip link, focus rings
  src/theme.contrast.test.ts             NEW  token contrast pairs
  src/layout/AppShell.tsx                skip link, <main id="main" tabIndex={-1}>
  src/layout/Footer.tsx                  Privacy / Terms links
  src/pages/Privacy.tsx  Terms.tsx  legal.test.tsx   NEW
  src/routes.tsx                         /privacy, /terms (public)
  src/layout/OfflineNotice.tsx           NEW  + isOfflineError(e)
  src/factions/FactionGuidePage.tsx (and other data pages)   offline notice on load failure
  src/play/board/BoardCanvas.tsx         focusable, keyboard pan/zoom/select/nudge, describedby summary
  src/play/board/boardKeys.ts            NEW  pure key → action mapping
  src/play/board/BoardSummary.tsx        NEW  screen-reader description + live region
  src/play/setup/missionAdapter.ts       turned compass labels
  src/play/setup/missions.ts             MissionLayout objectives[].label; objectiveName()
  src/play/board/scene.ts  pixiRenderer.ts  game/ScoreSheet.tsx  toolkit/Toolkit.tsx   use objectiveName
  (a11y fixes in whichever components Task 8's audit names)
```

---

### Task 1: Production e2e harness (real build, fake Supabase)

**Files:**
- Create: `apps/web/.env.e2e`, `apps/web/playwright.prod.config.ts`, `apps/web/e2e-prod/fake-supabase.ts`, `apps/web/e2e-prod/fixtures.ts`, `apps/web/e2e-prod/helpers.ts`, `apps/web/e2e-prod/harness.spec.ts`
- Modify: `apps/web/package.json` (scripts), `.gitignore`

**Interfaces:**
- Produces:
  - `.env.e2e`: `VITE_SUPABASE_URL=http://supabase.e2e.test`, `VITE_SUPABASE_ANON_KEY=e2e-anon-key`. supabase-js then stores the session under `localStorage['sb-supabase-auth-token']`.
  - Scripts in `apps/web/package.json`:
    - `"build:e2e": "node scripts/copy-data.mjs && vite build --mode e2e --outDir dist-e2e"`;
    - `"e2e:dev": "playwright test"`;
    - `"e2e:prod": "playwright test -c playwright.prod.config.ts"`;
    - `"e2e": "npm run e2e:dev && npm run e2e:prod"`.
  - `playwright.prod.config.ts`:
    - `testDir: './e2e-prod'`, port **5189**, `outputDir: 'test-results-prod'`;
    - the same `mobile` and `desktop` projects as `playwright.config.ts`;
    - `webServer.command: 'npm run build:e2e && npx vite preview --outDir dist-e2e --port 5189 --strictPort'`, timeout 300 s;
    - `reuseExistingServer: false`, because a stale build must never be reused.
  - `fake-supabase.ts`:
    - `E2E_USER = { id: '00000000-0000-4000-8000-0000000000e2', email: 'e2e@test' }`;
    - `sessionJson(opts?: { expired?: boolean }): string`, an auth-js session whose `access_token` is an unsigned JWT with `sub`, `aud: 'authenticated'`, `role`, `exp`. `expires_at` is 1 year ahead, or 1 hour ago when expired.
    - `class FakeRemote { rows: Row[]; pushes: Row[][]; seed(docs: Partial<Row>[]): void; install(context: BrowserContext): Promise<void> }`. `install` routes `http://supabase.e2e.test/**`:
      - `GET /rest/v1/documents`: applies `owner_id=eq.X`, `synced_seq=gt.N`, `order` and `limit`.
      - `POST /rest/v1/documents` (upsert): last-write-wins on `updated_at`; stamps `synced_seq` from a counter; records the batch in `pushes`.
      - `GET /auth/v1/user`: returns the user.
      - `POST /auth/v1/token`: returns a fresh session.
      - Anything else: 404 JSON.
  - `fixtures.ts`: `test = base.extend<{ remote: FakeRemote; signedIn: void }>`.
    - `remote` installs on the context.
    - `signedIn` (auto: false) adds an init script that sets the session only if the key is absent. A test can then replace it, and reloads keep it.
  - `helpers.ts`:
    - `waitForServiceWorker(page)`: awaits `navigator.serviceWorker.ready`, reloads once if `navigator.serviceWorker.controller` is null, then asserts it is non-null;
    - `goOffline(context)` / `goOnline(context)` wrap `context.setOffline`;
    - `seedDoc(remote, kind, data, id?)` builds a row for `E2E_USER`.

- [ ] **Step 1: Write the failing tests** (`harness.spec.ts`):
  - `signed-in session opens /build without the sign-in page`: with `signedIn`, go to `/build`; expect heading `Your lists` (use the exact heading `ListsPage` renders) and the URL to stay `/build`.
  - `a seeded remote list is pulled into the app`: seed one `list` doc named `Harness list` (copy the data shape from `e2e/lists.spec.ts`), visit `/build`, expect `Harness list` to be visible.
  - `a list created in the app is pushed to the remote`: create a list through `/build/new` (the `lists.spec.ts` flow), then `expect.poll(() => remote.rows.some(r => r.kind === 'list'))`.
  - `the service worker controls the page`: `waitForServiceWorker` passes on `/`.
- [ ] **Step 2: Run** `npm run e2e:prod -w apps/web`. Expected: FAIL (no config yet).
- [ ] **Step 3: Implement** the files above.
  - Use `context.route`, not `page.route`, so requests that pass through the service worker are caught too.
  - If Chromium bypasses the routes for service-worker-originated requests, set `serviceWorkers: 'allow'` and the `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` env in the config, and note it in the config comment.
  - Add `apps/web/dist-e2e` and `apps/web/test-results-prod` to `.gitignore`.
- [ ] **Step 4: Run** `npm run e2e:prod -w apps/web`. Expected: PASS on both projects. Also run `npm run e2e:dev -w apps/web` to confirm the old suite is unchanged.
- [ ] **Step 5: Commit** with `test(web): production-build e2e harness with a fake Supabase`.

### Task 2: Service worker with offline fallback and shell data precache

**Files:**
- Create: `apps/web/src/sw.ts`, `apps/web/src/pwa.ts`, `apps/web/src/pwa.test.ts`, `apps/web/public/offline.html`
- Modify: `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/package.json` (workbox dev deps), `apps/web/tsconfig.json` (if `src/sw.ts` needs the `WebWorker` lib, add a `tsconfig.sw.json` and exclude `sw.ts` from the app config)

**Interfaces:**
- Produces:
  - `registerAfterLoad(register: () => void, win: Window = window): void`. It calls `register` on `load`, or immediately if `document.readyState === 'complete'`. `main.tsx` uses it with `registerSW({ immediate: true })`.
  - `sw.ts` (Workbox):
    - `precacheAndRoute(self.__WB_MANIFEST)` and `cleanupOutdatedCaches()`;
    - a `NavigationRoute` to the precached `/index.html`, with denylist `[/^\/data\//, /^\/offline\.html$/]`;
    - `registerRoute(/^\/data\/(catalogues|roster|guides)\//, new StaleWhileRevalidate({ cacheName: 'recruit-faction-data', plugins: [new ExpirationPlugin({ maxEntries: 120 })] }))`;
    - other `/data/*.json` that isn't precached: `StaleWhileRevalidate` with `cacheName: 'recruit-data'`;
    - `setCatchHandler`: for `request.destination === 'document'` it returns the precached `/offline.html`, otherwise `Response.error()`;
    - `self.skipWaiting()` and `clientsClaim()`, matching today's `autoUpdate`.
  - `vite.config.ts`:
    - `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`;
    - `injectManifest.globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', 'data/{index,rules,lessons,missions,core-stratagems}.json']`;
    - `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024`;
    - keep the manifest; Task 6 adds the icons.
  - `offline.html`:
    - inline CSS only, with the theme colours;
    - the title `Recruit+ needs one online visit`;
    - one paragraph: `This page hasn't been saved on this device. Connect to the internet and open Recruit+ once; after that it works offline.`;
    - a `Try again` button (`location.reload()`);
    - the footer disclaimer, verbatim.

- [ ] **Step 1: Write the failing tests:**
  - `pwa.test.ts`:
    - `registers only after load`: a fake window with `readyState: 'loading'`; `register` is not called until a `load` event is dispatched;
    - `registers at once when already loaded`.
  - `e2e-prod/offline.spec.ts`, first two tests:
    - `shell data is precached`: after `waitForServiceWorker`, `caches.match('/data/rules.json')` and `'/data/missions.json'` resolve to responses;
    - `offline fallback page when the shell isn't cached`: delete every cache whose name contains `precache` via `page.evaluate`, go offline, `page.goto('/learn')`; expect heading `Recruit+ needs one online visit` and the disclaimer.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w apps/web -- pwa`, `npm run build -w apps/web` (it must report `injectManifest` and list the five data JSONs in the precache) and `npm run e2e:prod -w apps/web -- offline`. Expect PASS.
- [ ] **Step 5: Commit** with `feat(web): injectManifest service worker with offline fallback and precached shell data`.

### Task 3: Performance budgets and fixes

**Files:**
- Create: `apps/web/scripts/check-budgets.mjs`, `apps/web/scripts/check-budgets.test.ts` (it tests the pure `evaluateBudgets` function exported from a sibling `budgets.mjs`), `apps/web/e2e-prod/perf.spec.ts`, `docs/perf.md`
- Modify: `apps/web/package.json` (`"budgets": "node scripts/check-budgets.mjs"`), `apps/web/vite.config.ts` (`include` for the scripts test)

**Interfaces:**
- Produces:
  - `evaluateBudgets(files: { path: string; bytes: number; gzip: number }[], entry: string, precacheBytes: number): { ok: boolean; lines: string[] }`. It applies the Global Constraints budgets:
    - `entry` is the JS file `dist/index.html` loads;
    - "other chunks" are `assets/*.js`;
    - CSS is `assets/*.css`;
    - catalogues are `data/catalogues/*.json`, rosters `data/roster/*.json`, plus `data/rules.json`;
    - `precacheBytes` is the sum of the precache manifest entries' sizes, read from `dist/sw.js`'s injected manifest by URL.
  - `check-budgets.mjs` reads `dist/` (`zlib.gzipSync` at level 9), prints one line per budget (`ok  main entry 75.2 kB gzip ≤ 110 kB`), and exits 1 if any budget fails.
  - `perf.spec.ts` (mobile project only; `test.skip` on desktop). It sets CPU throttling to 4× and the network to 150 ms, 1.6 Mbps down and 0.75 Mbps up through a CDP session, then:
    - `cold home FCP ≤ 3.0s`: in a fresh context, read the `first-contentful-paint` entry;
    - `warm routes ready ≤ 1.0s`: after `waitForServiceWorker`, `goto` `/rules`, `/build`, `/learn` and `/table`, timing until their `h1` is visible;
    - `Space Wolves faction page cold data ≤ 4.0s`: in a fresh context, visit `/factions/imperium-adeptus-astartes-space-wolves` until the `Troops` heading shows;
    - `crowded Strike Force board p95 frame ≤ 50ms`:
      - seed (through `FakeRemote`) a `game` doc with `mode: 'sandbox'`, a Strike Force board and two armies of 60+ models, all deployed. Build it from `apps/web/src/play/__fixtures__/game.ts` or by recording the events of a short real setup; the test file explains which.
      - Open `/play/<id>`, pan with the mouse for 3 s and collect `requestAnimationFrame` gaps.
  - `docs/perf.md`: the baseline table above, the budgets, how to run both checks, and the result after this task.

- [ ] **Step 1: Write the failing tests:**
  - `check-budgets.test.ts`:
    - `flags an entry over 110 kB gzip`;
    - `flags a catalogue over 300 kB gzip`;
    - `passes the measured baseline`, using a fixture list with the baseline numbers;
    - `precache over 2.6 MB fails`.
  - `perf.spec.ts`: the four tests above.
  - `pwa.test.ts` already covers the service-worker registration timing (Task 2).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Then measure the crowded board and the Space Wolves cold load. If either breaks its budget, profile it (`page.tracing` or the Performance panel) and fix the top cause in the same task, recording before and after in `docs/perf.md`. Candidate fixes, in order of likelihood:
  - the board redraws every model on every camera change: cache base graphics and redraw only on scene change;
  - catalogue JSON parsing on the main thread: fetch with `response.json()` once, keep the cache, and avoid a second `structuredClone`.
- [ ] **Step 4: Run** `npm run build -w apps/web && npm run budgets -w apps/web`, `npm test -w apps/web -- budgets` and `npm run e2e:prod -w apps/web -- perf`. Expect PASS.
- [ ] **Step 5: Commit** with `perf(web): enforced bundle, data and phone timing budgets; SW registers after load`.

### Task 4: Offline-aware data pages

**Files:**
- Create: `apps/web/src/layout/OfflineNotice.tsx`, `apps/web/src/layout/OfflineNotice.test.tsx`
- Modify: every page that shows a load error for `/data/` JSON:
  - `factions/FactionGuidePage.tsx` (the M3 gap), `factions/FactionPage.tsx`, `factions/DatasheetPage.tsx`, `factions/StratagemsPage.tsx`;
  - `rules/*` pages, `lists/ListEditorPage.tsx`, `learn/useLessons.ts` consumers, `table/missionData.ts` consumers.

  Find them with `grep -rn "Couldn.t load\|No guide" apps/web/src`.

**Interfaces:**
- Produces:
  - `isOfflineError(e: unknown, nav: { onLine: boolean } = navigator): boolean`: true when `nav.onLine === false`, or when `e` is a `TypeError` from `fetch` (failed to fetch);
  - `<OfflineNotice />`: `role="status"` with the exact Global Constraints copy;
  - `<LoadError error={e} what="this faction" />`: renders `OfflineNotice` when `isOfflineError(e)`, else the page's existing `Couldn’t load …` text with `role="alert"`.
  - The guide page must show `No guide for this faction yet` only when the index says there is no guide, never on a failed fetch.

- [ ] **Step 1: Write the failing tests:**
  - `isOfflineError`: true for `navigator.onLine=false`; true for `new TypeError('Failed to fetch')`; false for a 404 `Error`.
  - `guide page offline shows the offline notice`: render `FactionGuidePage` with a fetch that rejects with `TypeError` and `onLine=false`; expect the offline copy and no `No guide for this faction yet`.
  - `datasheet page offline shows the offline notice` (same pattern).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, replacing each page's ad-hoc load-error text with `LoadError`.
- [ ] **Step 4: Run** `npm test -w apps/web`. Expect PASS.
- [ ] **Step 5: Commit** with `feat(web): offline notice instead of misleading load errors`.

### Task 5: Full offline audit (e2e, production build)

**Files:**
- Modify: `apps/web/e2e-prod/offline.spec.ts` (Task 2 created it)
- Modify: whatever the audit shows is broken. Likely suspects:
  - a route whose lazy chunk imports a non-precached asset;
  - `RequireAuth` waiting on a network `getUser`;
  - the sandbox and table loaders fetching data the precache lacks.

**The flow every test starts from:** with `signedIn`, the remote seeded with one list (Necrons, from `e2e/lists.spec.ts`) and lesson progress `{}`, visit `/`, `waitForServiceWorker`, then open:
1. the list (this caches its catalogue and roster);
2. `/rules`;
3. `/table/new`, then create a table game through the setup wizard with that list (the `e2e/table.spec.ts` flow);
4. `/play/new`, then create a sandbox game with that list against itself (the `e2e/sandbox.spec.ts` flow).

Then `goOffline` and `page.reload()`.

- [ ] **Step 1: Write the failing tests:**
  - `app shell offline`: `/` shows the home heading and the footer disclaimer.
  - `rules reference offline`: `/rules`, `/rules/glossary` and `/rules/stratagems` show their headings. `/rules/glossary` shows the entry `Engagement Range`.
  - `lessons offline`: `/learn` lists 15 lessons; `/learn/what-is-40k` shows its heading; its drill shows the `Drill` region and the board.
  - `lists offline`: `/build` shows the list; opening it shows its units. Adding a unit offline works and the total points change.
  - `offline reload of a table game resumes it`: `/table/<id>` shows the same round and phase. `Next phase` works offline.
  - `offline reload of a sandbox game resumes it`: `/play/<id>` shows the board and the deployment panel.
  - `faction data used so far offline`: `/factions/necrons` and a Necrons datasheet render.
  - `unvisited faction offline shows the offline notice`: `/factions/orks` shows the exact offline copy.
  - `sync resumes when back online`:
    - offline, rename the list (the editor's name field);
    - `remote.pushes` gains nothing while offline;
    - `goOnline`; `expect.poll` until a pushed row has the new name, within 10 s. The `online` event triggers `startAutoSync`.
  - `expired session offline still opens lists` (Review Focus 1): seed `sessionJson({ expired: true })` before the online visit, with the remote's `/auth/v1/token` route returning 200. Go offline and reload `/build`: the list is visible and the sign-in page is not.
- [ ] **Step 2: Run** `npm run e2e:prod -w apps/web -- offline`. Expect FAIL on whatever is broken.
- [ ] **Step 3: Fix each failure at its cause**, following superpowers:systematic-debugging, with a unit test beside the fixed code wherever the cause is in `src/`. Don't weaken an assertion to pass.
- [ ] **Step 4: Run** `npm run e2e:prod -w apps/web -- offline` and `npm test -w apps/web`. Expect PASS on both projects.
- [ ] **Step 5: Commit** with `test(web): full offline audit on the production build; fix: <what was fixed>`. Use one commit per distinct fix if there are several.

### Task 6: Installable PWA (icons, manifest)

**Files:**
- Create: `apps/web/scripts/make-icons.mjs`, `apps/web/public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `apps/web/e2e-prod/pwa.spec.ts`
- Modify: `apps/web/vite.config.ts` (manifest), `apps/web/index.html`, `apps/web/package.json` (`"icons": "node scripts/make-icons.mjs"`)

**Interfaces:**
- Produces:
  - `make-icons.mjs` launches Playwright Chromium and renders `public/icon.svg`. It writes:
    - `icon-192.png` and `icon-512.png`: transparent background, as drawn;
    - `icon-maskable-512.png`: the glyph scaled to 80% inside a full-bleed `#121212` square, so it stays in the maskable safe zone;
    - `apple-touch-icon.png`: 180×180, opaque `#121212` background, the glyph at 80%.

    The PNGs are committed; the script is rerun only when the SVG changes.
  - Manifest:
    - `id: '/'`, `scope: '/'`, `lang: 'en'`, `orientation: 'any'`, `categories: ['games', 'education']`;
    - icons: `icon-192.png` 192×192 `any`; `icon-512.png` 512×512 `any`; `icon-maskable-512.png` 512×512 `maskable`; `icon.svg` `any`.
  - `index.html`: `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<meta name="description" …>` and `<meta name="apple-mobile-web-app-title" content="Recruit+">`.

- [ ] **Step 1: Write the failing tests** (`pwa.spec.ts`):
  - `manifest is installable`:
    - `fetch('/manifest.webmanifest')` has a 192 and a 512 PNG, a `maskable` icon, `display: 'standalone'` and `start_url: '/'`;
    - each icon URL returns 200 with `image/png`, and its decoded size matches (read the width and height from the PNG header bytes).
  - `Chromium reports no installability errors`: a CDP session's `Page.getInstallabilityErrors` returns `[]` once the service worker controls the page.
  - `apple-touch-icon is linked and served`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, then run `npm run icons -w apps/web` and look at the four PNGs (Read tool) before committing.
- [ ] **Step 4: Run** `npm run e2e:prod -w apps/web -- pwa`. Expect PASS.
- [ ] **Step 5: Commit** with `feat(web): installable PWA icons and manifest`.

### Task 7: Legal pages, disclaimer everywhere, credits

**Files:**
- Create: `apps/web/src/pages/Privacy.tsx`, `apps/web/src/pages/Terms.tsx`, `apps/web/src/pages/legal.test.tsx`
- Modify: `apps/web/src/routes.tsx` (two public routes next to `/legal`), `apps/web/src/layout/Footer.tsx`, `apps/web/src/pages/Legal.tsx` (link to both), `apps/web/src/vite-env.d.ts` (`VITE_CONTACT_EMAIL?: string`), `apps/web/.env.example`
- Create: `apps/web/e2e-prod/legal.spec.ts`

**Content** (our own words, in short sections with headings):
- **Privacy:**
  - **What we store:**
    - your email address, kept by Supabase for sign-in (with Google sign-in, Google gives us your email address and name, and we keep only the email);
    - your army lists, saved sandbox and table games, lesson progress, and rules-error reports you send.
  - **Where:** on your device (IndexedDB and localStorage, so the app works offline) and in our Supabase database (EU or US, as chosen at setup; `DEPLOY.md` notes the choice).
  - **Who can see it:** only you. A list you share by link can be read by anyone who has the link.
  - **What we don't do:** no ads, no analytics or tracking, no selling data, no cookies apart from the sign-in session kept in your browser's storage.
  - **Deleting:** deleting a list or game in the app removes it from your lists, and it syncs as deleted. To delete your account and everything stored with it, contact `VITE_CONTACT_EMAIL`. Without it, show `The contact address is added when the site is published.`
  - **Sign out on a shared device:** this clears the session; data already downloaded stays in that browser until its site data is cleared.
  - **Changes:** the date this page was updated.
- **Terms of use:**
  - unofficial fan project, free, and not affiliated with Games Workshop (the disclaimer verbatim);
  - rules text is a summary that can be wrong, so check the official rules for tournaments, and use `Report a rules error`;
  - no warranty; the service may change or stop;
  - your content stays yours; shared links are public;
  - don't misuse the service (no attacks, scraping or abuse of other users);
  - Warhammer 40,000 names and data belong to Games Workshop; data credits go to BSData and Wahapedia;
  - the date.
- **Footer:** after the credits line, links `Legal & credits` · `Privacy` · `Terms`.

- [ ] **Step 1: Write the failing tests:**
  - `legal.test.tsx`:
    - `privacy lists what is stored`: the text contains `email`, `army lists`, `saved games`, `lesson progress`;
    - `privacy shows the contact email when set`;
    - `privacy without contact says it is added at publish`;
    - `terms carry the disclaimer verbatim`;
    - `footer links Legal & credits, Privacy and Terms`;
    - `/privacy and /terms are public` (render `AppRoutes` with a guard that throws).
  - `legal.spec.ts`: `disclaimer on every page`: every route in `routes.tsx` (with `:id` and `:slug` filled from the seeded remote list, a table game and a sandbox game created as in Task 5, and `necrons`), plus `/offline.html`, has the disclaimer text in the DOM. Credits are on `/legal`: `BSData` and `partly powered by Wahapedia`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Any route found without the footer, for example a full-screen game layout, gets the footer back below its panel, or a compact disclaimer line in its menu. Don't hide it.
- [ ] **Step 4: Run** `npm test -w apps/web -- legal` and `npm run e2e:prod -w apps/web -- legal`. Expect PASS.
- [ ] **Step 5: Commit** with `feat(web): privacy and terms pages; disclaimer on every page`.

### Task 8: Accessibility audit (axe) and fixes

**Files:**
- Create: `apps/web/e2e-prod/a11y.spec.ts`, `apps/web/src/theme.contrast.test.ts`
- Modify: `apps/web/package.json` (dev dep `@axe-core/playwright`), `apps/web/src/theme.css`, `apps/web/src/layout/AppShell.tsx` (skip link, `<main id="main" tabIndex={-1}>`), `apps/web/src/factions/DatasheetPage.tsx` (`.table-scroll`: `tabIndex={0}`, `role="region"`, `aria-label="{Unit} statline"` / `"{Unit} weapons"`), plus every component the audit names.

**Interfaces:**
- Produces:
  - `contrast(fg: string, bg: string): number` (WCAG relative luminance) inside the test file.
  - `a11y.spec.ts` helper `audit(page, name)`: `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`. It fails with a readable list (`impact id: selector`) for any `serious` or `critical` violation. The canvas element is excluded from axe; the board's labels are tested in Task 9.

**Audited states** (both projects; signed in; the remote seeded as in Task 5):
- **Public:** `/`, `/sign-in`, `/legal`, `/privacy`, `/terms`, `/share/<seeded public list id>`.
- **Learn:** `/learn`, `/learn/what-is-40k`, the drill before and after `Check answer` (wrong, then right), and `/learn/first-game` while locked.
- **Build:** `/build`, `/build/new` on each step, a list editor with units, a unit's wargear sheet open, the validation problems shown, and the export sheet open.
- **Rules:** `/rules`, an article, the glossary with a filter typed, core stratagems, `/rules/factions`, `/rules/reports`, and the report dialog open.
- **Factions:** `/factions`, `/factions/necrons`, the Necron Warriors datasheet with the official toggle on and off, its guide, and its stratagems.
- **Play:** `/play`, `/play/new` on each step, and a game with the Menu, Log, Score and Toolkit overlays each open.
- **Table:** `/table`, `/table/new` on each step, and a game on each tab (`Turn`, `Score`, `Stratagems`, `Tools`, `Log`) with the dice roller and odds calculator used.

- [ ] **Step 1: Write the failing tests:**
  - `theme.contrast.test.ts`, each pair ≥ 4.5 unless noted:
    - `--text` and `--text-muted` on `--bg`, `--surface` and `--surface-2`;
    - `--brass-strong` on `--bg` and `--surface`;
    - `--bad` on `--bad-bg`; `--ok` on `--ok-bg`;
    - `.badge--legends` and `.badge--fw` text on `--surface`;
    - button text on `--red` (`.btn--primary`);
    - `--focus` against `--bg` and `--surface` at ≥ 3;
    - `--border` for input outlines against `--surface-2` at ≥ 3. If this fails, raise the input border colour rather than the token used for card dividers.

    Parse the values from `theme.css`, so the test fails when someone edits a token.
  - `a11y.spec.ts`:
    - `no serious or critical axe violations: <state>`, one test per state above, through `test.describe` loops;
    - `skip link moves focus to main`: the first Tab focuses `Skip to main content`; Enter moves focus to `#main`;
    - `every focusable element shows a focus ring`: on `/`, `/build` and `/rules`, tab through up to 40 stops. For each, the computed `outline-style` isn't `none`, or `box-shadow` isn't `none`.
    - `no horizontal scroll at 320px` (Review Focus 5): at viewport 320×640, for `/`, `/build`, a list editor, `/rules/glossary`, the datasheet, `/table/<id>` and `/play/<id>`, `document.documentElement.scrollWidth - innerWidth ≤ 0`.
- [ ] **Step 2: Run** `npm test -w apps/web -- contrast` and `npm run e2e:prod -w apps/web -- a11y`. Expect FAIL (at least the datasheet table and the skip link).
- [ ] **Step 3: Fix every reported issue at its source.** Typical fixes:
  - labels for icon-only buttons and steppers;
  - `aria-pressed` on toggle chips;
  - a `<label>` for each select and input;
  - heading order;
  - the dialog role and `aria-modal` on overlays;
  - list semantics;
  - contrast tokens.

  Keep the visual design. If a fix changes a colour, update the token, not individual components.
- [ ] **Step 4: Run** both commands and `npm run e2e:dev -w apps/web` (the existing selectors must still match). Expect PASS.
- [ ] **Step 5: Commit** with `a11y(web): axe-clean routes at phone and desktop, skip link, focus rings, contrast tokens`. If the fixes are large, split them by area.

### Task 9: Keyboard and screen-reader support for the board, drills and overlays

**Files:**
- Create: `apps/web/src/play/board/boardKeys.ts`, `boardKeys.test.ts`, `apps/web/src/play/board/BoardSummary.tsx`, `BoardSummary.test.tsx`
- Modify: `apps/web/src/play/board/BoardCanvas.tsx`, `BoardCanvas.test.tsx`, `apps/web/src/play/game/GamePage.tsx`, `apps/web/src/learn/drill/DrillScreen.tsx`, and the game overlay component(s) (Menu, Log, Score, Toolkit)

**Interfaces:**
- Consumes: `BoardScene`, `SceneModel` (`scene.ts`), and `BoardCanvasProps.canDrag/onTap/onDrag`.
- Produces:
  - `type BoardKeyAction = { kind: 'pan'; dx: number; dy: number } | { kind: 'zoom'; factor: number } | { kind: 'fit' } | { kind: 'cycle'; step: 1 | -1 } | { kind: 'select' } | { kind: 'grab' } | { kind: 'nudge'; dx: number; dy: number } | { kind: 'drop' } | { kind: 'cancel' }`.
  - `boardKey(e: { key: string; shiftKey: boolean }, mode: 'browse' | 'grabbed'): BoardKeyAction | null`:
    - **browse mode:** arrows pan by 2" (8" with Shift). `+`/`=` zoom in ×1.4; `-` zoom out; `0` fits. `]` and `[` cycle the focused model. `Enter` selects (taps) the focused model. Space grabs it if `canDrag`.
    - **grabbed mode:** arrows nudge 0.5" (2" with Shift; up = +y in world inches). Space or Enter drops. Escape cancels.
    - Tab returns `null`, so it is never captured.
  - `BoardCanvas`:
    - the host gets `tabIndex={0}`, keeps `role="application"` and `aria-label={label}`, and gains `aria-describedby` pointing at `BoardSummary`'s id;
    - the focused model gets a highlight ring: `SceneModel.focused?: boolean`, drawn by `pixiRenderer`;
    - nudges call `onDrag(id, pos, 'start' | 'move' | 'end' | 'cancel')` exactly as a pointer drag does, so the engine's hard limits (Move, coherency, engagement) apply unchanged.
  - `BoardSummary({ scene, focusedId, labelFor })`:
    - a visually hidden (`.sr-only`) description: the board size; each zone ("Player A deployment zone: bottom edge"); each objective (its name and who controls it); each unit (name, army, model count, and "selected" or "target" when set);
    - plus an `aria-live="polite"` line announcing the focused or grabbed model and its position to 0.5" ("Intercessor 2, 14.5 inches from the left, 6 inches from the bottom").
  - Overlays (Menu, Log, Score, Toolkit) use a `dialog` role with `aria-modal`, move focus into the dialog on open, close on Escape, and return focus to their trigger.
  - Drills: feedback after `Check answer` is in a `role="status"` element. The drill board's label names the drill ("Drill board: move the Intercessors into range").

- [ ] **Step 1: Write the failing tests:**
  - `boardKeys.test.ts`:
    - `ArrowUp pans 2 inches, Shift 8`;
    - `+ and = zoom in`;
    - `] cycles forward`;
    - `space grabs only in browse`;
    - `grabbed ArrowLeft nudges -0.5`;
    - `Escape cancels when grabbed`;
    - `Tab is never captured`.
  - `BoardCanvas.test.tsx`:
    - `board is focusable and described`;
    - `keyboard nudge drives onDrag start/move/end`: with a fake renderer and a scene with one draggable model, focus, Space, ArrowRight ×2, Space → `onDrag` calls `start`, `move` (+0.5), `move` (+1.0), `end`;
    - `Escape cancels a keyboard drag`;
    - `Tab leaves the board` (Review Focus 4): `userEvent.tab()` from the board moves focus to the next control.
  - `BoardSummary.test.tsx`:
    - `lists units with model counts and objectives with controller`;
    - `announces the grabbed model position`.
  - `GamePage.test.tsx`: `Escape closes the game menu and focus returns to Menu` (Review Focus 4).
  - In the drill test file: `drill feedback is a status message`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w apps/web`, plus `npm run e2e:dev -w apps/web -- learn sandbox`. Expect PASS.
- [ ] **Step 5: Commit** with `a11y(web): keyboard board control, screen-reader board summary, dialog focus`.

### Task 10: Objective labels on turned sandbox maps

**Files:**
- Modify:
  - `packages/engine/src/core/state.ts` (`objectives: { id: string; pos: Pt; label?: string }[]`), with an engine test beside the setup tests;
  - `apps/web/src/play/setup/missions.ts` (`MissionLayout.objectives[].label?`, `objectiveName`);
  - `apps/web/src/play/setup/missionAdapter.ts`, `apps/web/src/play/setup/buildSetup.ts` (carry the label into the engine setup);
  - `apps/web/src/play/board/scene.ts` and `pixiRenderer.ts` (draw the name);
  - `apps/web/src/play/game/ScoreSheet.tsx`, `apps/web/src/play/toolkit/Toolkit.tsx` (show the name);
  - the engine's `log/describe.ts`, only if it prints objective ids.
- Test: `apps/web/src/play/setup/missionAdapter.test.ts`, `apps/web/src/play/board/scene.test.ts`

**Interfaces:**
- Produces:
  - `turnCompassLabel(id: string): string`. It applies the clockwise quarter turn from Scope note 6 to a leading compass token (`^(nw|ne|sw|se|n|e|s|w)(\d*)$`, case kept), and returns anything else unchanged.
  - `missionLayout(map, board)`: objectives gain `label`, which equals `turnCompassLabel(o.label ?? o.id)` only when the map is turned, and is `o.label` (or absent) otherwise.
  - `objectiveName(o: { id: string; label?: string }): string` returns `o.label ?? o.id`.

  Check the turn direction before writing the table: `toEngine` maps a landscape `(x, y)` to `(H − y, W − x)` with engine y up, so the printed map's top edge becomes the board's east edge (a clockwise quarter turn on screen).

- [ ] **Step 1: Write the failing tests:**
  - `turnCompassLabel`: `nw → ne`, `ne → se`, `se → sw`, `sw → nw`, `n → e`, `w → n`, `nw1 → ne1`, `centre → centre`, `a → a`, `A1 → A1`.
  - `turned Strike Force map relabels by position`: for `aoo-recover-the-relics` on a 44×60 board, the objective labelled `ne` sits in the top-right quadrant (x > 22, y > 30), `nw` top-left, `se` bottom-right, `sw` bottom-left. Do the same for one Onslaught map (`cb-all-out-war`: `n`, `e`, `s`, `w` match their edges).
  - `every turned mission's compass labels match their quadrant`: for all Strike Force and Onslaught missions, any label starting with `n` is above centre, `s` below, `e` right, and `w` left.
  - `unturned Incursion map keeps its labels`.
  - `objectives without a label show their id` (Review Focus 5): `scene.ts` with a setup objective `{ id: 'nw', pos }` renders the name `nw`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w packages/engine`, `npm test -w apps/web` and `npm run typecheck`. Expect PASS.
- [ ] **Step 5: Commit** with `fix(play): compass objective labels follow the turned sandbox board`.

### Task 11: Army-builder known gaps

**Files:**
- Modify:
  - `packages/data/overrides/aoo-allies.json` (or the file the allies count check reads; find it with `grep -rn "allied\|allies" packages/data/src/roster`);
  - wherever the Hive Tyrant Warlord requirement lives (`grep -rn "Hive Tyrant" packages/data/overrides packages/data/src`; if it comes from a BSData constraint, add a removal to `overrides/constraints.json` with a `source`);
  - `packages/data/src/roster/validate.ts`;
  - `docs/superpowers/m2-known-gaps.md`.
- Create: `packages/data/test/roster-gaps.test.ts`, and `packages/data/overrides/aoo-ally-restrictions.json` (only if a restriction is confirmed)

**Research first** (write the findings to the shared notes file `m8-gaps-research.md`, with URLs and quotes of 15 words or fewer):
1. Fetch the Wahapedia Arks of Omen GT page (`https://wahapedia.ru/wh40k9ed/the-rules/arks-of-omen-grand-tournament/`) into the scratchpad. Read its Battle Brothers / allied detachments section for:
   - the Disciples of Be'lakor exception (the exact allowed detachment types);
   - any statement that Genestealer Cults allies must be Brood Brothers;
   - that a Drukhari ally must be a different Drukhari type;
   - that an Emperor's Children Daemons ally must be Slaanesh.
2. Check the same three in the library codex files and the Wahapedia codex pages for those factions.
3. Hive Tyrant: confirm the 13 Apr 2023 removal in the library (`Balance_Dataslates.md` §9, "Faction changes") and, if reachable, GW's dataslate PDF.

- [ ] **Step 1: Write the failing tests** (`roster-gaps.test.ts`; the test names cite the source):
  - `[Dataslate 13 Apr 2023] a Tyranids list with a Hive Tyrant need not make it the Warlord`: a valid Tyranids Strike Force list with a Hive Tyrant and a different Warlord has no Warlord problem.
  - `[AoO GT: Disciples of Be'lakor] two allies allowed`: a Daemons Arks detachment marked Disciples of Be'lakor, plus a Chaos Space Marines Patrol and a Chaos Knights detachment, is not flagged `Remove the extra detachment`.
  - `a non-DoB Daemons army with two allies is still flagged`.
  - For each restriction research confirms, a pair of tests: one illegal list (for example, a GSC army whose Astra Militarum ally isn't Brood Brothers) gives a plain-language problem with a fix, and the legal version has no problem.
- [ ] **Step 2: Run** `npm test -w packages/data -- roster-gaps`. Expect FAIL.
- [ ] **Step 3: Implement** through overrides first (each with a `source`), and in `validate.ts` only where the data can't express the rule. Problem wording follows the M2 style: what's wrong, then the fix.
- [ ] **Step 4: Run** `npm test -w packages/data`. Expect PASS, including the existing known-legal and known-illegal list tests for every catalogue.
- [ ] **Step 5: Update `m2-known-gaps.md`.** Remove the fixed items. For each item kept, add one line on why (e.g. "No source found: checked Wahapedia Arks GT page, the codex and the library").
- [ ] **Step 6: Commit** with `fix(roster): Hive Tyrant Warlord no longer required (Dataslate Apr 2023); Disciples of Be'lakor allies; <confirmed ally checks>`.

### Task 12: Plain English for the faction secondaries

**Files:**
- Modify:
  - `packages/data/scripts/content-todo.ts`: a `missions` shard listing the faction secondaries without a passing entry, written to `packages/content/todo/missions.json` with the same fields as the datasheet shards;
  - `packages/content/missions/plain.json`;
  - `packages/data/src/missions/build.ts`: the report lists missing faction secondaries under `missing`;
  - `packages/data/test/missions-plain.test.ts`.
- Create: `packages/content/review/missions-faction-secondaries.md`

**Interfaces:**
- Consumes: `textKey`, `checkPlain`, the `missions/plain.json` entry format `{ name, kind: 'secondary', plain, waive? }` (M7 Task 7), and `STYLE.md`.

- [ ] **Step 1: Change the test.** Replace `faction secondaries may lack plain English` with `every faction secondary has checked plain English`: the report's `faction.written === faction.total`, and `flagged` is `[]`. Run `npm test -w packages/data -- missions-plain`. Expect FAIL (0 of 170).
- [ ] **Step 2: Add the `missions` shard** to `content-todo.ts`. Run `npm run data:build && npm run content:todo -- missions`. Expect `missions: 170 texts, 0 written, 170 to do`, or the deduplicated count of distinct texts; record which.
- [ ] **Step 3: Write the entries**, faction group by faction group (Imperium, Chaos, Xenos), following `STYLE.md`. Read each faction's own rules wording where a secondary names a faction action or keyword. After each group, run `npm run data:build && npm run content:todo -- missions` and fix every flag. Commit each group: `content(missions): plain English for <group> faction secondaries`.
- [ ] **Step 4: Spot-check**, M3 style. Sample 34 texts (20%) with `npm run content:todo -- --sample missions 34` (extend `--sample` to the missions shard if needed). Compare each against the official text for timing, VP amounts, caps, "progressive" or "end game", actions and keywords. Record verdicts in `review/missions-faction-secondaries.md` (the `Key | Name | Kind | Verdict | Note` table). Fix every FAIL and re-run the checker.
- [ ] **Step 5: Run** `npm run data:build`. Expect `faction secondaries 170 of 170` (or the distinct count). Then run `npm test -w packages/data`. Expect PASS. Update `m3-known-gaps.md` and the M7 follow-up note.
- [ ] **Step 6: Commit** with `content(missions): faction secondaries spot-checked; report requires full coverage`.

### Task 13: Deploy readiness (Vercel, Supabase, CI)

**Files:**
- Create: `DEPLOY.md`, `apps/web/scripts/check-env.mjs`, `apps/web/scripts/check-env.test.ts`
- Modify: `vercel.json`, `apps/web/src/deployConfig.test.ts`, `.github/workflows/ci.yml`, `apps/web/.env.example`, `apps/web/package.json` (`"prebuild": "node scripts/copy-data.mjs && node scripts/check-env.mjs"`), `README.md` (one link to `DEPLOY.md`)

**Interfaces:**
- Produces:
  - `checkEnv(env: Record<string, string | undefined>): string[]`. It returns problems:
    - with `VERCEL_ENV === 'production'`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_CONTACT_EMAIL` are required;
    - `VITE_AUTH_MODE=dev` is an error;
    - `VITE_SUPABASE_URL` must be `https://`.

    With `VERCEL_ENV === 'preview'`, missing Supabase values are a warning only, printed and not returned. Everywhere else it returns `[]`.

    `check-env.mjs` prints the problems and exits 1 if there are any.
  - `vercel.json`:
    - rewrite `{"source": "/((?!data/|assets/|sw\\.js|workbox-).*)", "destination": "/index.html"}`, so a missing data file is a 404, not HTML;
    - headers:
      - `/sw.js`: `Cache-Control: no-cache`;
      - `/assets/(.*)`: `public, max-age=31536000, immutable`;
      - `/data/(.*)`: `public, max-age=0, must-revalidate`;
      - all paths: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - CI (`ci.yml`): after `npm test`, run:
    - `npm run build` (production build check);
    - `npm run budgets -w apps/web`;
    - `npx playwright install --with-deps chromium`;
    - `npm run e2e` (both suites).

    The CI env sets nothing for Supabase, which `checkEnv` allows outside Vercel production.
  - `DEPLOY.md`: numbered steps, each with what to click or run and how to check it worked.
    1. **Supabase:**
       - create the project (free tier; region near the players);
       - run `apps/web/supabase/migrations/0001_documents.sql`, then `0002_rules_reports.sql`, in the SQL editor;
       - check the `documents` table and its RLS policies exist;
       - Auth → Providers: enable Email (magic link) and Google. Google needs an OAuth client in Google Cloud Console, with the Supabase callback URL as the authorised redirect;
       - Auth → URL Configuration: Site URL `https://<your-domain>`, plus redirect URLs `https://<your-domain>/**`, `https://*-<team>.vercel.app/**` and `http://localhost:5173/**`;
       - copy the Project URL and anon key.
    2. **GitHub:** create a private or public repo; `git remote add origin …`; push `main`. That needs the user's explicit go-ahead, so the doc says so. Check that CI runs green.
    3. **Vercel:**
       - import the repo; the framework preset "Other" uses `vercel.json`;
       - set the env vars for Production and Preview: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CONTACT_EMAIL`;
       - deploy, then check the deployed site against the list in step 5.
    4. **Domain** (optional), then update the Supabase Site URL.
    5. **After the first deploy:**
       - sign in by email and by Google;
       - create a list on a phone, see it on a second device;
       - share a list link and open it signed out;
       - send one rules report and see it in `rules_reports`;
       - install to the home screen;
       - turn on airplane mode and open lists, rules, lessons and a table game;
       - Lighthouse PWA check.
    6. **Env var reference:** a table of name, where it is used, required in production (yes/no), example. It includes `VITE_AUTH_MODE` (dev only; refused by production builds).
    7. **Rollback:** Vercel "Promote previous deployment".

- [ ] **Step 1: Write the failing tests:**
  - `check-env.test.ts`:
    - `production requires Supabase URL, key and contact email`;
    - `production refuses VITE_AUTH_MODE=dev`;
    - `production refuses an http Supabase URL`;
    - `preview without Supabase passes with a warning`;
    - `local build passes with nothing set`.
  - `deployConfig.test.ts`:
    - `data and assets are not rewritten to index.html`: test the rewrite regex against `/data/x.json`, `/assets/a.js`, `/sw.js` (no match) and `/build/123` (match);
    - `sw.js is never cached`;
    - `CI runs the production build, budgets and both e2e suites`: read `ci.yml` as text and assert the four commands in order;
    - `DEPLOY.md names every VITE_ variable used in src`: collect `import.meta.env.VITE_\w+` across `apps/web/src` with `fs` and a regex.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Make sure `.env.e2e` passes `checkEnv` (it isn't a Vercel env).
- [ ] **Step 4: Run** `npm test -w apps/web` and `npm run build`. Expect PASS. Then simulate a Vercel production build without the vars: `VERCEL_ENV=production npm run build -w apps/web` must fail with the three missing names.
- [ ] **Step 5: Commit** with `chore(deploy): DEPLOY.md, env checks, Vercel headers and CI production build`.

### Task 14: Full verification and manual walk-through

- [ ] **Step 1:** From the worktree root, run each of these and expect all green:
  - `npm run data:build`, which must print `faction secondaries N of N`;
  - `npm run typecheck`;
  - `npm test`;
  - `npm run build`;
  - `npm run budgets -w apps/web`;
  - `npm run e2e` (dev and prod suites).
- [ ] **Step 2: Walk the app** in the built-in browser against `vite preview` of `dist-e2e`. The fake session can't be seeded there, so use the dev server for signed-in flows, and preview for the signed-out pages and `/offline.html`. Check at 375×812:
  - home, sign-in, legal, privacy, terms;
  - a list, a drill, a table game;
  - the sandbox, keyboard-only: Tab to the board, `]`, Space, the arrows, Space;
  - a turned Strike Force map with relabelled objectives.

  Take screenshots for the user and save them to the shared notes folder (`m8-shots/`).
- [ ] **Step 3:** Update `docs/perf.md` with the final numbers from the perf spec output.
- [ ] **Step 4: Commit** any doc updates with `docs: M8 verification results`.

---

## Needs the user (after merge, not blocking this branch)
1. **Create the accounts** (Supabase, GitHub, Vercel) and follow `DEPLOY.md`. Pushing and deploying wait for the user's explicit go-ahead.
2. **Choose the contact email** for `VITE_CONTACT_EMAIL` (privacy requests).
3. **Optionally, have the privacy and terms text read by someone qualified.** They are plain, honest descriptions, not legal advice.
