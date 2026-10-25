/**
 * Phone timing budgets (docs/perf.md) on the production build: 375×812, CPU slowed 4×, 150 ms round trips and
 * 1.6 Mbps down. The limits sit well above the measured baseline so they catch regressions, not noise.
 */
import type { Page } from '@playwright/test';
import { crowdedGame } from './data';
import { expect, test } from './fixtures';
import { seedDoc, waitForServiceWorker } from './helpers';

// The "perf" project runs this file alone, after the other suites, at 375×812 (playwright.prod.config.ts).
test.describe.configure({ mode: 'serial' });

async function throttle(page: Page, rate = 4): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
}

/**
 * The budgets were measured on the owner's PC slowed 4×. A slower host (GitHub's runners are 1.7–2.4× slower, and vary
 * from run to run) is already part of the way to phone speed, so it is slowed less: by 4× the reference benchmark time
 * over its own, never more than 4× and never less than 1×. On the reference PC this stays 4×.
 * The benchmark's median on the reference PC, measured 25 Oct 2026 (37.0, 37.3 and 38.2 ms over three runs):
 */
const REFERENCE_BENCH_MS = 37;
/** Timestamp jitter allowed on a frame-time limit (see the crowded board test). */
const FRAME_JITTER_MS = 1;

async function calibratedRate(page: Page): Promise<number> {
  const ms = await page.evaluate(() => {
    const run = () => {
      const t0 = performance.now();
      let x = 0;
      for (let i = 0; i < 10_000_000; i++) x = (x * 31 + i) % 1_000_003;
      (globalThis as { benchSink?: number }).benchSink = x;
      return performance.now() - t0;
    };
    run(); // let the JIT warm up
    const times = Array.from({ length: 7 }, run).sort((a, b) => a - b);
    return times[3];
  });
  // Within 10% of the reference is benchmark noise: such a host is the reference PC, slowed the full 4×.
  const rate = ms <= REFERENCE_BENCH_MS * 1.1 ? 4 : Math.max(1, (4 * REFERENCE_BENCH_MS) / ms);
  console.log(`CPU benchmark ${ms.toFixed(1)} ms (reference ${REFERENCE_BENCH_MS} ms): CPU slowed ${rate.toFixed(2)}×`);
  return rate;
}

async function timeUntil(page: Page, path: string, ready: () => Promise<void>): Promise<number> {
  const t0 = Date.now();
  await page.goto(path);
  await ready();
  return Date.now() - t0;
}

test('cold home FCP ≤ 3.0s', async ({ page }) => {
  await throttle(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? Infinity);
  console.log(`cold home FCP ${Math.round(fcp)} ms`);
  expect(fcp).toBeLessThanOrEqual(3000);
});

test('warm routes ready ≤ 1.0s', async ({ page, signedIn }) => {
  void signedIn;
  await page.goto('/');
  await waitForServiceWorker(page);
  await throttle(page);
  for (const path of ['/rules', '/build', '/learn', '/table']) {
    const ms = await timeUntil(page, path, () => expect(page.getByRole('heading', { level: 1 })).toBeVisible());
    console.log(`warm ${path} ${ms} ms`);
    expect(ms, path).toBeLessThanOrEqual(1000);
  }
});

test('Space Wolves faction page cold data ≤ 4.0s', async ({ page, signedIn }) => {
  void signedIn;
  await throttle(page);
  const ms = await timeUntil(page, '/factions/imperium-adeptus-astartes-space-wolves', () =>
    expect(page.getByRole('heading', { name: 'Troops' })).toBeVisible({ timeout: 20_000 }),
  );
  console.log(`Space Wolves cold ${ms} ms`);
  expect(ms).toBeLessThanOrEqual(4000);
});

test('crowded Strike Force board p95 frame ≤ 50ms', async ({ page, remote, signedIn }) => {
  void signedIn;
  // 100 models on a Strike Force board (scripts/make-crowded-game.ts).
  const id = seedDoc(remote, 'game', crowdedGame());
  await page.goto(`/play/${id}`);
  const board = page.getByRole('application', { name: /Battlefield/ });
  await expect(board).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/crowded-board.png` });
  await throttle(page, await calibratedRate(page));
  const box = (await board.boundingBox())!;
  const frames = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const t: number[] = [];
        const start = performance.now();
        const tick = (now: number) => {
          t.push(now);
          if (now - start < 3000) requestAnimationFrame(tick);
          else resolve(t.slice(1).map((v, i) => v - t[i]));
        };
        requestAnimationFrame(tick);
      }),
  );
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Pan from an empty spot between the armies.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(cx + Math.sin(i / 5) * 60, cy + Math.cos(i / 5) * 30);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  const gaps = (await frames).sort((a, b) => a - b);
  const p95 = gaps[Math.floor(gaps.length * 0.95)];
  console.log(`crowded board: ${gaps.length} frames in 3 s, p95 ${p95.toFixed(1)} ms`);
  // Gaps come in whole 60 Hz frames (16.7 ms), so 50 ms is three frames; frame timestamps jitter by a fraction of a
  // millisecond, and three frames read as 50.1 ms on CI. The budget is still three frames: the next step is 66.7 ms.
  expect(p95).toBeLessThanOrEqual(50 + FRAME_JITTER_MS);
});
