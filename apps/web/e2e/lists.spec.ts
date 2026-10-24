import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/build');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/build$/);
}

/** Makes a Necrons Combat Patrol list with the wizard (no army options picked) and goes back to Your lists. */
async function newPatrol(page: Page) {
  await page.getByRole('link', { name: 'New list' }).click();
  await page.getByRole('button', { name: /^Necrons/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Combat Patrol/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Patrol Detachment/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);
  await page.goto('/build');
}

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test('build a Necrons Strike Force list with the wizard and find it on the lists page', async ({ page }, testInfo) => {
  await signIn(page);
  await expect(page.getByText('No lists yet. Build your first army: it takes a couple of minutes.')).toBeVisible();

  await page.getByRole('link', { name: 'New list' }).click();
  await expect(page).toHaveURL(/\/build\/new$/);
  await page.getByRole('button', { name: /^Necrons/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Strike Force/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Arks of Omen Detachment/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Dynasty: Szarekhan' }).check();

  // Touch targets and no sideways scroll on the last step.
  for (const name of ['Back', 'Decide later', 'Create list']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
  }
  await noSidewaysScroll(page);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/wizard-${testInfo.project.name}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);

  await page.goto('/build');
  const card = page.getByRole('link', { name: /Necrons Strike Force/ });
  await expect(card).toContainText('Necrons · Strike Force · ');
  await expect(card).toContainText('/ 2,000 pts');
  await expect(card).toContainText(/to fix · Edited just now/);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/lists-${testInfo.project.name}.png`, fullPage: true });
});

test('a list can be duplicated, then deleted and brought back with Undo', async ({ page }) => {
  await signIn(page);
  await newPatrol(page);
  const original = page.getByRole('link', { name: /Necrons Combat Patrol/ });
  await expect(original).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Necrons Combat Patrol' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(page.getByRole('status')).toContainText('Duplicated as “Necrons Combat Patrol (copy)”');
  await expect(page.getByRole('link', { name: /Necrons Combat Patrol \(copy\)/ })).toBeVisible();

  await page.getByRole('button', { name: 'Actions for Necrons Combat Patrol (copy)' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('link', { name: /\(copy\)/ })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Deleted “Necrons Combat Patrol (copy)”');
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /Necrons Combat Patrol \(copy\)/ })).toBeVisible();

  // Still there after a reload: the undo was saved.
  await page.reload();
  await expect(page.getByRole('link', { name: /Necrons Combat Patrol \(copy\)/ })).toBeVisible();
});

test('Your lists, with a list’s menu open, fits a 320px phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone width');
  await signIn(page);
  await newPatrol(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByRole('link', { name: /Necrons Combat Patrol/ })).toBeVisible();
  await noSidewaysScroll(page);
  const menu = page.getByRole('button', { name: 'Actions for Necrons Combat Patrol' });
  const box = (await menu.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await menu.click();
  await expect(page.getByRole('menu', { name: 'Actions for Necrons Combat Patrol' })).toBeVisible();
  await noSidewaysScroll(page);
});
