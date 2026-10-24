import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
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
/** No serious or critical axe violations (WCAG 2.1 A and AA). */
async function axeClean(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

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
  await expect(page.getByRole('link', { name: 'Back to Rules' })).toHaveAttribute('href', '/rules');
  await shot(page, 'rules-article', project);

  // 1b. "On this page" jumps to a section (a toggle on a phone, a column beside the article on a desktop).
  const contents = page.getByRole('navigation', { name: 'On this page' });
  const toggle = contents.getByRole('button', { name: 'On this page' });
  if (project === 'mobile') {
    await expect(contents.getByRole('link', { name: 'Blast', exact: true })).toBeHidden();
    await toggle.click();
  } else {
    // From 1024px the contents sit beside the article: no toggle.
    await expect(toggle).toBeHidden();
  }
  await contents.getByRole('link', { name: 'Blast', exact: true }).click();
  await expect(page).toHaveURL(/#blast$/);
  await expect(page.getByRole('heading', { name: 'Blast', level: 2 })).toBeInViewport();
  await noSidewaysScroll(page);
  await touchTargets(page);
  await axeClean(page);

  // 2. Core stratagems: plain English first; the official wording is remembered across a reload.
  await page.goto('/rules/stratagems');
  await expect(page.getByText(reroll.plain!, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Official wording' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Official wording' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`#strat-${reroll.id}`).getByText(reroll.text, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plain English' }).click();

  // 2b. The glossary jumps by letter, and its terms keep the anchors lessons link to.
  await page.goto('/rules/glossary');
  const jump = page.getByRole('navigation', { name: 'Jump to letter' });
  await jump.getByRole('link', { name: 'L', exact: true }).click();
  await expect(page).toHaveURL(/#letter-L$/);
  await expect(page.getByRole('heading', { name: 'L', level: 2, exact: true })).toBeInViewport();
  await noSidewaysScroll(page);
  await touchTargets(page);
  await page.goto('/rules/glossary#engagement-range');
  await expect(page.getByRole('heading', { name: 'Engagement Range', level: 3 })).toBeInViewport();

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
  await expect(page.getByRole('button', { name: 'Report a problem' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Report a problem' }).click();
  const sheet = page.getByRole('dialog', { name: 'Report a problem' });
  await sheet.getByRole('combobox', { name: 'Which part?' }).selectOption({ label: 'Reanimation Protocols' });
  await sheet.getByRole('radio', { name: "It's unclear" }).check();
  await axeClean(page);
  await sheet.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText("Thanks. We've saved your report.")).toBeVisible();
  await page.goto('/rules/reports');
  await expect(page.getByText('Reanimation Protocols')).toBeVisible();

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

  // 6. Wide terrain tables stay inside the page on a phone: below 600px each row is a card labelled by column.
  await page.goto('/rules/terrain');
  await expect(page.getByRole('heading', { name: 'Terrain', level: 1 })).toBeVisible();
  await noSidewaysScroll(page);
  await touchTargets(page);
  const cell = page.locator('table.blocks__table td[data-label]').first();
  await cell.scrollIntoViewIfNeeded();
  const label = await cell.evaluate((el) => getComputedStyle(el, '::before').content);
  if (project === 'mobile') expect(label).not.toBe('none');
  else expect(label).toBe('none');
  await shot(page, 'terrain-table', project);

  // 7. Factions: everyday names find their armies.
  await page.goto('/factions');
  await expect(page.getByRole('link', { name: 'Back to Rules' })).toHaveAttribute('href', '/rules');
  await page.getByRole('searchbox', { name: 'Search factions' }).fill('space marines');
  await expect(page.getByRole('link', { name: /^Ultramarines/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Chaos Space Marines/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Necrons/ })).toHaveCount(0);
  await noSidewaysScroll(page);
  await touchTargets(page);
});
