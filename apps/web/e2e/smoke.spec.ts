import { expect, test } from '@playwright/test';

test('sign in (dev), browse to Necron Warriors, see the datasheet', async ({ page }, testInfo) => {
  await page.goto('/factions');
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/factions$/);

  await page.getByRole('link', { name: /^Necrons/ }).click();
  await page.getByRole('link', { name: /Necron Warriors/ }).click();

  await expect(page.getByRole('heading', { name: 'Necron Warriors' })).toBeVisible();
  await expect(page.getByText('Gauss Flayer').first()).toBeVisible();
  const profile = page.getByRole('table').filter({ hasText: 'Necron Warrior' }).first();
  const headers = await profile.getByRole('columnheader').allTextContents();
  const cells = await profile.getByRole('row').nth(1).getByRole('cell').allTextContents();
  expect(cells[headers.indexOf('T')]).toBe('4');

  const nav = page.getByRole('navigation', { name: 'Main' });
  const box = (await nav.boundingBox())!;
  if (testInfo.project.name === 'mobile') {
    expect(box.y).toBeGreaterThan(700);
    expect(box.width).toBeGreaterThan(370);
  } else {
    expect(box.x).toBe(0);
    expect(box.height).toBeGreaterThan(700);
    expect(box.width).toBeLessThan(120);
  }

  await expect(page.getByText(/Unofficial fan-made tool/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
