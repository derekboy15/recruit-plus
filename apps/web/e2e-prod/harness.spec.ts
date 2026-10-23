/** The production-build harness itself: a seeded session signs in, and the fake Supabase pulls and pushes. */
import { writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { seedDoc, waitForServiceWorker } from './helpers';
import { necronsListNamed } from './data';

test('signed-in session opens /build without the sign-in page', async ({ page, signedIn }) => {
  void signedIn;
  await page.goto('/build');
  await expect(page.getByRole('heading', { name: 'Your lists', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/build$/);
});

test('a seeded remote list is pulled into the app', async ({ page, remote, signedIn }) => {
  void signedIn;
  seedDoc(remote, 'list', necronsListNamed('Harness list'));
  await page.goto('/build');
  await expect(page.getByRole('link', { name: /Harness list/ })).toBeVisible();
});

test('a list created in the app is pushed to the remote', async ({ page, remote, signedIn }, testInfo) => {
  void signedIn;
  await page.goto('/build/new');
  await page.getByRole('button', { name: /^Necrons/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Strike Force/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Arks of Omen Detachment/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Dynasty: Szarekhan' }).check();
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);
  // Auto-sync runs every minute, on reconnect and on focus; focus is the quick way in.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect
    .poll(() => (remote.rows.some((r) => r.kind === 'list') ? 'pushed' : remote.requests.join('\n')), { timeout: 15_000 })
    .toBe('pushed');
  if (process.env.CAPTURE_LIST) writeFileSync(testInfo.outputPath('list.json'), JSON.stringify(remote.rows.find((r) => r.kind === 'list')!.data, null, 1));
});

test('the service worker controls the page', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
});
