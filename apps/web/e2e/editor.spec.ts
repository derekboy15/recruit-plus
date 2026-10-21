import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${project}.png` });
};

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test('edit a Necrons list: add units, change models and wargear, fix a problem, and find it saved', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
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

  const points = page.getByRole('meter', { name: 'Points' });
  await expect(points).toContainText('0 / 2,000 pts');
  await expect(page.getByRole('button', { name: '3 problems' })).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, 'editor-empty', project);

  // Add Necron Warriors from the picker; their editor opens.
  await page.getByRole('button', { name: '+ Add unit' }).click();
  const picker = page.getByRole('dialog', { name: 'Add a unit' });
  await picker.getByRole('searchbox', { name: 'Search units' }).fill('warriors');
  const row = picker.getByRole('button', { name: /^Necron Warriors/ });
  expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(52);
  await row.click();
  const editor = page.getByRole('dialog', { name: 'Necron Warriors' });
  const plus = editor.getByRole('button', { name: 'Add one Necron Warrior (Gauss Flayer)' });
  for (const b of [plus, editor.getByRole('button', { name: 'Remove one Necron Warrior (Gauss Flayer)' })]) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (let i = 0; i < 10; i++) await plus.click();
  await expect(plus).toBeDisabled();
  await expect(points).toContainText('220 / 2,000 pts');
  await noSidewaysScroll(page);
  await shot(page, 'editor-unit', project);
  await editor.getByRole('button', { name: 'Done' }).click();

  // Fix the missing HQ from the problems list; the Lord's weapon is a pick-one card.
  await page.getByRole('button', { name: /problems$/ }).click();
  const problems = page.getByRole('dialog', { name: 'Problems' });
  await expect(problems).toBeVisible();
  await shot(page, 'editor-problems', project);
  await problems.getByRole('button', { name: 'Add an HQ unit' }).click();
  await page.getByRole('dialog', { name: 'Add a unit' }).getByRole('button', { name: /^Lord/ }).click();
  const lord = page.getByRole('dialog', { name: 'Lord' });
  await lord.getByText('Warscythe').click();
  await lord.getByText('Resurrection Orb').click();
  await expect(points).toContainText('310 / 2,000 pts');
  await noSidewaysScroll(page);
  await shot(page, 'editor-lord', project);
  await lord.getByRole('button', { name: 'Done' }).click();
  await shot(page, 'editor-list', project);

  // Leaving straight after an edit still saves it: the lists page shows the new totals.
  await page.getByRole('button', { name: '+ Add unit' }).first().click();
  await page.getByRole('dialog', { name: 'Add a unit' }).getByRole('button', { name: /^Lord/ }).click();
  await expect(points).toContainText('375 / 2,000 pts');
  await page.goto('/build');
  await expect(page.getByRole('link', { name: /Necrons Strike Force/ })).toContainText('375 / 2,000 pts');
});
