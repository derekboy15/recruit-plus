import { expect, test } from '@playwright/test';

test('build a Necrons Strike Force list with the wizard and find it on the lists page', async ({ page }, testInfo) => {
  await page.goto('/build');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/build$/);
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/wizard-${testInfo.project.name}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);

  await page.goto('/build');
  const card = page.getByRole('link', { name: /Necrons Strike Force/ });
  await expect(card).toContainText('/ 2000 pts');
  await expect(card).toContainText(/problems?/);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/lists-${testInfo.project.name}.png`, fullPage: true });
});
