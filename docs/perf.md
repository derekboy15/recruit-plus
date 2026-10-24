# Phone performance

Recruit+ is built for phones first. This page records what was measured, the budgets that guard it and how to check them.

## How it's measured
- **Sizes:** run `npm run build && npm run budgets -w apps/web`. This measures `apps/web/dist` (gzip level 9) against `apps/web/scripts/budgets.mjs`. CI runs it on every push.
- **Timings and frame rate:** run `npm run e2e:prod -w apps/web -- --project=perf`. The perf project runs after the other suites, one test at a time. It uses the production build and its service worker in Chromium at 375×812, with:
  - the CPU slowed 4× (CDP `Emulation.setCPUThrottlingRate`);
  - 150 ms round trips, 1.6 Mbps down and 0.75 Mbps up.

  The board test opens a saved Strike Force game with 100 models (`apps/web/e2e-prod/data/crowded-game.json`, made by `npx tsx scripts/make-crowded-game.ts`). It pans for 3 s and reads `requestAnimationFrame` gaps.

## Baseline (before Milestone 8, main at 211bd57)

| Measure | Value |
|---|---|
| Cold `/`, first contentful paint | 1.37 s |
| Warm routes (`/rules`, `/build/new`, `/learn`, `/table`), ready | 0.17–0.22 s |
| `/play`, ready | 0.95 s |
| Main entry JS (gzip) | 75 kB |
| Largest lazy chunk (`pixiRenderer`, gzip) | 84 kB |
| Precache | 63 entries, 1.63 MB |
| Largest catalogue (`space-wolves.json`) | 1.97 MB raw, 190 kB gzip |
| Largest roster (`imperium-space-marines.json`) | 0.96 MB raw, 161 kB gzip |
| Drill board and "Your first game" board while dragging | 60 fps, p95 frame 17 ms |

## Budgets

| Budget | Limit |
|---|---|
| Main entry JS | ≤ 110 kB gzip |
| Any other JS chunk | ≤ 120 kB gzip |
| All CSS | ≤ 25 kB gzip |
| Service-worker precache | ≤ 2.75 MB raw |
| Any catalogue | ≤ 300 kB gzip |
| Any roster | ≤ 250 kB gzip |
| `rules.json` | ≤ 100 kB gzip |
| Any option info file (`data/info/`) | ≤ 150 kB gzip |
| Cold `/` first contentful paint | ≤ 3.0 s |
| Warm route ready | ≤ 1.0 s |
| Space Wolves faction page, cold data | ≤ 4.0 s |
| Crowded Strike Force board, p95 frame while panning | ≤ 50 ms |

Changing a budget needs a line in the change log below saying why.

## What changed in Milestone 8
- **The service worker registers after the page's `load` event.** Before, its install (now 2.35 MB with the precached shell data) downloaded at the same time as the first page.
- **Shell data is precached:** rules, lessons, missions, core stratagems and the faction index, so they work offline. This raised the precache from 1.63 MB to 2.35 MB. The 2.6 MB budget leaves room for one more lesson or rules file, not a catalogue: catalogues stay "cached when used".

## After Milestone 8

| Measure | Quiet machine (Task 3) | Full e2e run (Task 14) |
|---|---|---|
| Cold `/` FCP | 1.37 s | 1.73 s |
| Warm `/rules` | 0.38 s | 0.36 s |
| Warm `/build` | 0.19 s | 0.30 s |
| Warm `/learn` | 0.30 s | 0.53 s |
| Warm `/table` | 0.21 s | 0.32 s |
| Space Wolves faction page, cold data | 2.24 s | 3.66 s |
| Crowded board (100 models) | p95 frame 17 ms | p95 frame 33 ms |

**Sizes after Milestone 8:**
- main entry 75.9 kB gzip;
- largest chunk 83.3 kB gzip;
- precache 2.53 MB (78 entries, including the icons and the shell data).

**Nothing broke a budget,** so no rendering or parsing fix was needed.

**Space Wolves is the closest to its limit** (3.66 s of 4.0 s on a busy machine). Its time is mostly the 4× slowed CPU parsing and rendering a 2 MB catalogue, since the data itself arrives gzipped. If this budget starts failing in CI, split the catalogue: load datasheet details on demand instead of with the faction page.

## Change log
- 2026-10-23: budgets set (Milestone 8).
- 2026-10-24: `infoGzip` (150 kB per option info file) added with the info files (UI overhaul Plan D). The largest, the Aeldari Library, is 43 kB gzip; info files are cached when used, like catalogues.
- 2026-10-24: precache raised from 2.6 MB to 2.75 MB so the self-hosted fonts are precached (UI overhaul Plan A follow-up). Barlow Condensed 500/600/700 and Inter's variable latin file add 114 kB; without them an offline first paint fell back to system fonts.
