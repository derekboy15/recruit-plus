/** The full offline audit, on the production build with its service worker. */
import { DISCLAIMER } from '../src/layout/Footer';
import { expect, test } from './fixtures';
import { goOffline, waitForServiceWorker } from './helpers';

test('shell data is precached', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  for (const url of ['/data/rules.json', '/data/missions.json', '/data/lessons.json', '/data/core-stratagems.json', '/data/index.json']) {
    expect(await page.evaluate((u) => caches.match(u, { ignoreSearch: true }).then((r) => r?.status ?? null), url), url).toBe(200);
  }
});

test("offline fallback page when the shell isn't cached", async ({ page, context }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.evaluate(async () => {
    for (const name of await caches.keys()) if (name.includes('precache')) await caches.delete(name);
  });
  await goOffline(context);
  await page.goto('/learn');
  await expect(page.getByRole('heading', { name: 'Recruit+ needs one online visit' })).toBeVisible();
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
