import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${project}.png` });
};

async function noSidewaysScroll(page: Page, what = 'page') {
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth) - document.documentElement.clientWidth), `${what}: sideways scroll`).toBeLessThanOrEqual(0);
}

/** Signs in (dev) and makes a Necrons Strike Force with the wizard, no army options picked; ends in the editor. */
async function newStrikeForce(page: Page) {
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
}

/** Adds a unit by name with its row's + (no preview). */
async function addUnit(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: 'Add unit', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add a unit' });
  await picker.getByRole('searchbox', { name: 'Search units' }).fill(search);
  await picker.getByRole('button', { name: `Add ${name}` }).click();
  return page.getByRole('dialog', { name });
}

async function listAction(page: Page, item: string) {
  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('edit a Necrons list: add units, change models and wargear, fix a problem, and find it saved', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await newStrikeForce(page);

  const points = page.getByRole('meter', { name: 'Points' });
  await expect(points).toContainText('0 / 2,000 pts');
  await expect(page.getByRole('button', { name: '3 to fix' })).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, 'editor-empty', project);

  // Add Necron Warriors from the picker; their editor opens.
  const editor = await addUnit(page, 'warriors', 'Necron Warriors');
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

  // Fix the missing HQ from Problems; the Lord's weapon is a pick-one card.
  await page.getByRole('button', { name: /to fix$/ }).click();
  const problems = page.getByRole('dialog', { name: 'Problems' });
  await expect(problems).toBeVisible();
  await expect(problems.getByRole('heading', { name: 'Must fix' })).toBeVisible();
  await shot(page, 'editor-problems', project);
  await problems.getByRole('button', { name: 'Add an HQ unit' }).click();
  await page.getByRole('dialog', { name: 'Add a unit' }).getByRole('button', { name: 'Add Lord' }).click();
  const lord = page.getByRole('dialog', { name: 'Lord' });
  await lord.getByText('Warscythe', { exact: true }).click();
  await lord.getByText('Resurrection Orb', { exact: true }).click();
  await expect(points).toContainText('310 / 2,000 pts');
  await noSidewaysScroll(page);
  await shot(page, 'editor-lord', project);
  await lord.getByRole('button', { name: 'Done' }).click();
  await shot(page, 'editor-list', project);

  // Leaving straight after an edit still saves it: the lists page shows the new totals.
  await addUnit(page, 'lord', 'Lord');
  await expect(points).toContainText('375 / 2,000 pts');
  await page.goto('/build');
  await expect(page.getByRole('link', { name: /Necrons Strike Force/ })).toContainText('375 / 2,000 pts');
});

test('Back from a list goes to Your lists', async ({ page }) => {
  await newStrikeForce(page);
  await page.getByRole('link', { name: 'Back to Your lists' }).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Your lists' })).toBeVisible();
});

test('add a unit through its preview, remove it and Undo; choose a dynasty from its chip', async ({ page }, testInfo) => {
  await newStrikeForce(page);
  const points = page.getByRole('meter', { name: 'Points' });

  await page.getByRole('button', { name: 'Add unit', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add a unit' });
  await picker.getByRole('button', { name: /^Elites \d+$/ }).click();
  await picker.getByRole('button', { name: /^Skorpekh Destroyers/ }).click();
  const preview = page.getByRole('dialog', { name: 'Skorpekh Destroyers' });
  await expect(preview.getByRole('group', { name: /characteristics$/ }).first()).toBeVisible();
  await shot(page, 'picker-preview', testInfo.project.name);
  // Back closes just the preview: the picker is still open on Elites.
  await page.goBack();
  await expect(preview).toHaveCount(0);
  await expect(picker.getByRole('button', { name: /^Elites \d+$/ })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: /^Skorpekh Destroyers/ }).click();
  await preview.getByRole('button', { name: /^Add to list · \d+ pts$/ }).click();
  await page.getByRole('dialog', { name: 'Skorpekh Destroyers' }).getByRole('button', { name: 'Done' }).click();
  await expect(points).toContainText('90 / 2,000 pts');

  await page.getByRole('button', { name: 'Options for Skorpekh Destroyers' }).click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await expect(points).toContainText('0 / 2,000 pts');
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(points).toContainText('90 / 2,000 pts');
  await expect(page.getByRole('button', { name: /^Skorpekh Destroyers/ })).toBeVisible();

  await page.getByRole('button', { name: /^Dynasty: / }).click();
  const dynasty = page.getByRole('dialog', { name: 'Choose: Dynasty' });
  await expect(dynasty.getByRole('radio', { name: 'Novokh' })).toBeVisible();
  await shot(page, 'dynasty', testInfo.project.name);
  await dynasty.getByText('Szarekhan', { exact: true }).click();
  await dynasty.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Dynasty: Szarekhan' })).toBeVisible();
});

test('Ctrl+Z undoes the last edit and Ctrl+Shift+Z redoes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a keyboard shortcut');
  await newStrikeForce(page);
  const points = page.getByRole('meter', { name: 'Points' });
  await (await addUnit(page, 'warriors', 'Necron Warriors')).getByRole('button', { name: 'Done' }).click();
  await expect(points).toContainText('110 / 2,000 pts');
  await page.keyboard.press('Control+z');
  await expect(points).toContainText('0 / 2,000 pts');
  await page.keyboard.press('Control+Shift+z');
  await expect(points).toContainText('110 / 2,000 pts');
});

test('a datasheet opens over the list and closes back to it, without leaving the list', async ({ page }) => {
  await newStrikeForce(page);
  const listUrl = page.url();
  await (await addUnit(page, 'warriors', 'Necron Warriors')).getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Options for Necron Warriors' }).click();
  await page.getByRole('menuitem', { name: 'View datasheet' }).click();
  const sheet = page.getByRole('dialog', { name: 'Necron Warriors' });
  await expect(sheet.getByRole('group', { name: 'Necron Warrior characteristics' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(new URL(listUrl).pathname);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(page.url()).toBe(listUrl);
});

test('at 320px nothing scrolls sideways with the picker, a unit, Problems or Export open', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone width');
  await newStrikeForce(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await noSidewaysScroll(page, 'editor');

  await page.getByRole('button', { name: 'Add unit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add a unit' })).toBeVisible();
  await noSidewaysScroll(page, 'picker');
  await page.getByRole('dialog', { name: 'Add a unit' }).getByRole('button', { name: 'Close' }).click();

  const unit = await addUnit(page, 'warriors', 'Necron Warriors');
  await expect(unit).toBeVisible();
  await noSidewaysScroll(page, 'unit editor');
  await unit.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /to fix$/ }).click();
  await expect(page.getByRole('dialog', { name: 'Problems' })).toBeVisible();
  await noSidewaysScroll(page, 'problems');
  await page.getByRole('dialog', { name: 'Problems' }).getByRole('button', { name: 'Close' }).click();

  await listAction(page, 'Export');
  const box = page.getByRole('dialog', { name: 'Export list' }).getByRole('textbox', { name: 'List text' });
  await expect(box).toHaveValue(/Necron Warriors/);
  expect(await box.evaluate((el) => el.scrollWidth - el.clientWidth), 'export text sideways scroll').toBeLessThanOrEqual(0);
  await noSidewaysScroll(page, 'export');
});

test('Export copies the list and Download saves it; Share turns the link on', async ({ page, context }, testInfo) => {
  const project = testInfo.project.name;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await newStrikeForce(page);
  const id = page.url().split('/').pop()!;
  await (await addUnit(page, 'warriors', 'Necron Warriors')).getByRole('button', { name: 'Done' }).click();

  await listAction(page, 'Export');
  const exportSheet = page.getByRole('dialog', { name: 'Export list' });
  await expect(exportSheet.getByRole('textbox', { name: 'List text' })).toHaveValue(/Necrons · Strike Force · 110 \/ 2,000 pts/);
  for (const name of ['Copy', 'Download .txt', 'Done']) {
    const box = (await exportSheet.getByRole('button', { name }).boundingBox())!;
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
  }
  await exportSheet.getByRole('button', { name: 'Copy' }).click();
  await expect(exportSheet.getByRole('button', { name: /^(Copied|Couldn’t copy)/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await exportSheet.getByRole('button', { name: 'Download .txt' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.txt$/);
  await noSidewaysScroll(page);
  await shot(page, 'export', project);
  await exportSheet.getByRole('button', { name: 'Done' }).click();

  await listAction(page, 'Share link');
  const shareSheet = page.getByRole('dialog', { name: 'Share list' });
  await expect(shareSheet).toContainText('Turn sharing off here at any time.');
  await shareSheet.getByRole('checkbox', { name: 'Anyone with the link can view' }).check();
  await expect(shareSheet.getByRole('textbox', { name: 'Share link' })).toHaveValue(new RegExp(`/share/${id}$`));
  await noSidewaysScroll(page);
  await shot(page, 'share', project);
  await shareSheet.getByRole('checkbox', { name: 'Anyone with the link can view' }).uncheck();
  await expect(shareSheet.getByRole('textbox', { name: 'Share link' })).toHaveCount(0);
});
