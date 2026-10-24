import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${project}.png` });
};

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test('export a list as text, share it, and open the link read-only without signing in', async ({ page, context }, testInfo) => {
  const project = testInfo.project.name;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.goto('/build/new');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await page.getByRole('button', { name: /^Necrons/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Strike Force/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Arks of Omen Detachment/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Decide later' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);
  const listUrl = page.url();
  const id = listUrl.split('/').pop()!;

  await page.getByRole('button', { name: '+ Add unit' }).click();
  const picker = page.getByRole('dialog', { name: 'Add a unit' });
  await picker.getByRole('searchbox', { name: 'Search units' }).fill('warriors');
  await picker.getByRole('button', { name: /^Necron Warriors/ }).click();
  await page.getByRole('dialog', { name: 'Necron Warriors' }).getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('meter', { name: 'Points' })).toContainText('110 / 2,000 pts');

  // Export: the text, with big-enough buttons.
  await page.getByRole('button', { name: 'Export' }).click();
  const exportSheet = page.getByRole('dialog', { name: 'Export list' });
  await expect(exportSheet.getByRole('textbox', { name: 'List text' })).toHaveValue(/Necrons · Strike Force · 110 \/ 2,000 pts/);
  for (const name of ['Copy', 'Download .txt', 'Done']) {
    const box = (await exportSheet.getByRole('button', { name }).boundingBox())!;
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
  }
  await noSidewaysScroll(page);
  await shot(page, 'export', project);
  const download = page.waitForEvent('download');
  await exportSheet.getByRole('button', { name: 'Download .txt' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.txt$/);
  await exportSheet.getByRole('button', { name: 'Done' }).click();

  // Share: switch it on, see the link.
  await page.getByRole('button', { name: 'Share' }).click();
  const shareSheet = page.getByRole('dialog', { name: 'Share list' });
  await shareSheet.getByRole('checkbox', { name: 'Anyone with the link can view' }).check();
  await expect(shareSheet.getByRole('textbox', { name: 'Share link' })).toHaveValue(new RegExp(`/share/${id}$`));
  await expect(shareSheet.getByText('Share links work on other devices once accounts are switched on.')).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, 'share', project);
  await shareSheet.getByRole('button', { name: 'Done' }).click();

  // A visitor who has not signed in opens the link: read-only.
  await page.evaluate(() => {
    localStorage.removeItem('recruit.devUser');
    localStorage.removeItem('recruit.lastUser');
  });
  await page.goto(`/share/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Necrons Strike Force' })).toBeVisible();
  await expect(page.getByText('110 / 2,000 pts')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Troops' })).toBeVisible();
  await expect(page.getByText(/Necron Warriors/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account' })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  for (const name of ['Copy list']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
  }
  expect((await page.getByRole('link', { name: 'Build your own' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await noSidewaysScroll(page);
  await shot(page, 'shared-list', project);

  // Not a shared list: the friendly message.
  await page.goto('/share/00000000-0000-4000-8000-0000000000ff');
  await expect(page.getByText("This list isn't shared, or the link is wrong.")).toBeVisible();
  await noSidewaysScroll(page);
});
