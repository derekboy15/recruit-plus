import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { CatalogueOut, StratagemOut } from '@recruit/data/model';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(DATA, path), 'utf8')) as T;

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${project}.png`, fullPage: true });
};

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

/** Buttons and navigation links in the page body are touch-sized; links inside running text are not targets of their own. */
async function touchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main button, main a')]
      .filter((el) => !el.closest('p, td, th, li > p, .blocks__list'))
      .map((el) => ({ text: (el.textContent ?? '').trim().slice(0, 40), h: el.getBoundingClientRect().height }))
      .filter((x) => x.h > 0 && x.h < 44),
  );
  expect(small).toEqual([]);
}

test('Rules Reference, plain-English stratagems and datasheets, guides and reports', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  const core = readJson<StratagemOut[]>('core-stratagems.json');
  const reroll = core.find((s) => s.name === 'Command Re-roll')!;
  const necrons = readJson<CatalogueOut>('catalogues/necrons.json');
  const reanimation = necrons.units.find((u) => u.name === 'Necron Warriors')!.abilities.find((a) => a.name === 'Reanimation Protocols')!;
  expect(reroll.plain, 'Command Re-roll has plain English').toBeTruthy();
  expect(reanimation.plain, 'Reanimation Protocols has plain English').toBeTruthy();

  // 1. Search the rules and jump to a section.
  await page.goto('/rules');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/rules$/);
  await page.getByRole('searchbox', { name: 'Search the rules' }).fill('look out sir');
  await page.getByRole('list', { name: 'Search results' }).getByRole('link').first().click();
  await expect(page).toHaveURL(/#look-out-sir$/);
  await expect(page.getByRole('heading', { name: 'Look Out, Sir', level: 2 })).toBeVisible();
  await shot(page, 'rules-article', project);

  // 2. Core stratagems: plain English first; the official wording is remembered across a reload.
  await page.goto('/rules/stratagems');
  await expect(page.getByText(reroll.plain!, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Official wording' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Official wording' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`#strat-${reroll.id}`).getByText(reroll.text, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plain English' }).click();

  // 3. A faction guide links its key units to their datasheets.
  await page.goto('/factions/necrons/guide');
  await expect(page.getByRole('heading', { name: 'How this army plays' })).toBeVisible();
  await shot(page, 'guide', project);
  const keyUnits = page.getByRole('heading', { name: 'Key units' }).locator('xpath=following-sibling::ul[1]');
  await keyUnits.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/factions\/necrons\/units\//);

  // 4. A datasheet in plain English, and a report from its one report button.
  await page.goto('/factions/necrons/units/necron-warriors');
  const ability = page.locator('.ability', { has: page.getByRole('heading', { name: 'Reanimation Protocols' }) });
  await expect(ability.getByText(reanimation.plain!, { exact: true })).toBeVisible();
  await shot(page, 'datasheet', project);
  await noSidewaysScroll(page);
  await touchTargets(page);
  await expect(page.getByRole('button', { name: 'Report a rules error' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Report a rules error' }).click();
  await page.getByRole('radio', { name: "It's unclear" }).check();
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText("Thanks. We've saved your report.")).toBeVisible();
  await page.goto('/rules/reports');
  await expect(page.getByText('Necron Warriors')).toBeVisible();

  // 5. Faction stratagems: grouped, and filtered by phase.
  await page.goto('/factions/necrons/stratagems');
  const swift = page.locator('article', { has: page.getByRole('heading', { name: 'Swift Dismemberment' }) });
  await expect(swift).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Annihilation Legion', level: 2 })).toBeVisible();
  const all = await page.locator('article.stratagem').count();
  await page.getByRole('button', { name: 'Fight phase', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight phase', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('article.stratagem').count()).toBeLessThan(all);
  await shot(page, 'stratagems', project);
  await noSidewaysScroll(page);
  await touchTargets(page);

  // 6. Wide terrain tables stay inside the page on a phone.
  await page.goto('/rules/terrain');
  await expect(page.getByRole('heading', { name: 'Terrain', level: 1 })).toBeVisible();
  await noSidewaysScroll(page);
  await touchTargets(page);
});
