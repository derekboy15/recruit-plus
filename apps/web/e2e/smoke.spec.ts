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
  const stats = page.getByRole('rowgroup', { name: 'Necron Warrior characteristics' });
  const columns = await page.locator('table.ds-stats thead th').allTextContents();
  const values = await stats.getByRole('cell').allTextContents();
  expect(values[columns.indexOf('T')]).toBe('4');

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

  for (const target of [...(await nav.getByRole('link').all()), page.getByRole('button', { name: 'Account', exact: true })]) {
    const b = (await target.boundingBox())!;
    expect(b.height, 'touch target height').toBeGreaterThanOrEqual(44);
  }

  await expect(page.getByText(/Unofficial fan-made tool/)).toBeVisible();
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth) - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
