/**
 * Phone timing budgets (docs/perf.md) on the production build: 375×812, CPU slowed 4×, 150 ms round trips and
 * 1.6 Mbps down. The limits sit well above the measured baseline so they catch regressions, not noise.
 */
import type { Page } from '@playwright/test';
import { crowdedGame } from './data';
import { expect, test } from './fixtures';
import { seedDoc, waitForServiceWorker } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'Phone budgets run in the mobile project only.');

async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
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
  await throttle(page);
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
  console.log(`crowded board: ${gaps.length} frames in 3 s, p95 ${Math.round(p95)} ms`);
  expect(p95).toBeLessThanOrEqual(50);
});
