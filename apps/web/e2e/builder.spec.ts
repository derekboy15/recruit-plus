import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { COST_PTS, FORCE, addUnit, availableUnits, buildScope, createRoster, evaluate, type RosterFile } from '@recruit/data/roster';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(DATA, path), 'utf8')) as T;

/**
 * The BSData price of an Arks of Omen Necrons list holding the named units with their default wargear, worked out by
 * the roster engine from the generated data the app serves (public/data), so the test never hard-codes a points value.
 */
function necronsPoints(unitNames: string[]): number {
  const index = readJson<{ catalogues: { slug: string; id: string; rosterScope: string[] }[] }>('index.json');
  const necrons = index.catalogues.find((c) => c.slug === 'necrons')!;
  const slugs = [...necrons.rosterScope.filter((s) => s !== 'system'), 'system'];
  const scope = buildScope(slugs.map((s) => readJson<RosterFile>(join('roster', `${s}.json`))));
  let roster = createRoster(scope, { name: 'Necrons', catalogueId: necrons.id, battleSize: 'strike-force', forceId: FORCE.arksOfOmen });
  const forceSelId = roster.forces[0].id;
  for (const name of unitNames) {
    const unit = availableUnits(scope, roster, forceSelId).find((u) => u.name === name);
    if (!unit) throw new Error(`No unit named ${name} in the Necrons data`);
    roster = addUnit(scope, roster, forceSelId, unit.entryId).roster;
  }
  return evaluate(scope, roster).total[COST_PTS] ?? 0;
}

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${project}.png` });
};

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

async function addWarriors(page: Page) {
  await page.getByRole('button', { name: '+ Add unit' }).click();
  const picker = page.getByRole('dialog', { name: 'Add a unit' });
  await picker.getByRole('searchbox', { name: 'Search units' }).fill('warriors');
  await picker.getByRole('button', { name: /^Necron Warriors/ }).click();
  await page.getByRole('dialog', { name: 'Necron Warriors' }).getByRole('button', { name: 'Done' }).click();
}

test('build a legal Necrons list from scratch, export it and open its share link signed out', async ({ page }, testInfo) => {
  const project = testInfo.project.name;

  // 1. The wizard: Necrons, Strike Force, Arks of Omen, a dynasty (Troops is already the compulsory unit type).
  await page.goto('/build');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await page.getByRole('link', { name: 'New list' }).click();
  await page.getByRole('button', { name: /^Necrons/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Strike Force/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Arks of Omen Detachment/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('radio', { name: 'Troops' })).toBeChecked();
  await page.getByRole('radio', { name: 'Dynasty: Szarekhan' }).check();
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);

  // 2. The list has problems; the missing HQ is one of them.
  const issuesButton = page.getByRole('button', { name: /problems?$/ });
  await expect(issuesButton).toBeVisible();
  await issuesButton.click();
  const problems = page.getByRole('dialog', { name: 'Problems' });
  await expect(problems.getByText(/needs 1 more HQ unit/)).toBeVisible();
  await shot(page, 'builder-problems', project);

  // 3. Its fix offers the cheapest HQ units; Overlord is one tap further, under "Show all units".
  await problems.getByRole('button', { name: 'Add an HQ unit' }).click();
  const picker = page.getByRole('dialog', { name: 'Add a unit' });
  await picker.getByRole('button', { name: 'Show all units' }).click();
  await picker.getByRole('button', { name: /^Overlord/ }).click();
  const overlord = page.getByRole('dialog', { name: 'Overlord' });
  await overlord.getByRole('checkbox', { name: 'Warlord', exact: true }).check();
  await expect(overlord.getByRole('checkbox', { name: 'Warlord', exact: true })).toBeChecked();
  await overlord.getByRole('button', { name: 'Done' }).click();

  // 4. Three Necron Warriors fill the compulsory Troops: the list is legal.
  for (let i = 0; i < 3; i++) await addWarriors(page);
  await expect(page.getByRole('button', { name: '✓ Legal' })).toBeVisible();

  // 5. The header shows the BSData total.
  const total = necronsPoints(['Overlord', 'Necron Warriors', 'Necron Warriors', 'Necron Warriors']);
  await expect(page.getByRole('meter', { name: 'Points' })).toContainText(`${total.toLocaleString('en-US')} / 2,000 pts`);
  await shot(page, 'builder-legal', project);

  // 8. Every button and interactive row in the editor is big enough to tap, and nothing scrolls sideways. A checkbox
  // or radio is tapped through the whole row (label) around it.
  const targets = page.locator('.editor').locator('button, a, summary, select, input:not([type=checkbox]):not([type=radio]), label.opt, label.radio-card');
  for (const target of await targets.all()) {
    if (!(await target.isVisible())) continue;
    const box = (await target.boundingBox())!;
    const label = (await target.getAttribute('aria-label')) || (await target.evaluate((e) => e.outerHTML.slice(0, 120)));
    expect(box.height, `"${label}" height`).toBeGreaterThanOrEqual(44);
  }
  await noSidewaysScroll(page);

  // 6. Export.
  await page.getByRole('button', { name: 'Export' }).click();
  const exportSheet = page.getByRole('dialog', { name: 'Export list' });
  await expect(exportSheet.getByRole('textbox', { name: 'List text' })).toHaveValue(/Necron Warriors \(10 models\)/);
  await exportSheet.getByRole('button', { name: 'Done' }).click();

  // 7. Share, sign out, open the link: read-only, no sign-in.
  await page.getByRole('button', { name: 'Share' }).click();
  const shareSheet = page.getByRole('dialog', { name: 'Share list' });
  await shareSheet.getByRole('checkbox', { name: 'Anyone with the link can view' }).check();
  const link = shareSheet.getByRole('textbox', { name: 'Share link' });
  await expect(link).toHaveValue(/\/share\/[0-9a-f-]{36}$/);
  const shareUrl = await link.inputValue();
  await shareSheet.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

  await page.goto(shareUrl);
  await expect(page).toHaveURL(shareUrl);
  await expect(page.getByText(/Necron Warriors/).first()).toBeVisible();
  await expect(page.getByText(`${total.toLocaleString('en-US')} / 2,000 pts`)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Add unit' })).toHaveCount(0);
  await noSidewaysScroll(page);
  await shot(page, 'builder-shared', project);
});
