/** Option info files (data/info/<slug>.json) are faction data: cached as they are used and served offline (Plan D). */
import { expect, test } from './fixtures';
import { goOffline, waitForServiceWorker } from './helpers';

const URL = '/data/info/necrons.json';

test('an option info file used online is kept with the faction data and opens offline', async ({ page, context }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  expect(await page.evaluate((u) => fetch(u).then((r) => r.status), URL)).toBe(200);
  await expect
    .poll(() => page.evaluate((u) => caches.open('recruit-faction-data').then((c) => c.match(u)).then((r) => r?.status ?? null), URL))
    .toBe(200);
  await goOffline(context);
  const slug = await page.evaluate((u) => fetch(u).then((r) => r.json()).then((j: { slug: string }) => j.slug), URL);
  expect(slug).toBe('necrons');
});
